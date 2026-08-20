import { EMPTY_ASSIGNMENT, SCHEMA_VERSION } from '../../domain/defaults'
import type {
  FocusAssignment,
  FocusRecord,
  TimerPhase,
  TimerSettings,
  TimerSnapshot,
  TimerStatus,
} from '../../domain/models'
import { createId } from '../../shared/lib/id'
import { useWorkspaceStore } from '../workspace/workspace-store'

const STORAGE_KEY = 'studyflow:timer'
const DEFAULT_SETTINGS: TimerSettings = {
  presetId: 'classic',
  focusMs: 25 * 60 * 1000,
  shortBreakMs: 5 * 60 * 1000,
  longBreakMs: 15 * 60 * 1000,
  longBreakInterval: 4,
  autoStartFocus: true,
  autoStartBreak: true,
}

interface TimerState {
  phase: TimerPhase
  status: TimerStatus
  round: number
  completedFocuses: number
  phaseStartedAt: number | null
  phaseEndsAt: number | null
  phaseDurationMs: number
  pausedRemainingMs: number
  assignment: FocusAssignment
}

export interface PhaseTransition {
  currentPhase: TimerPhase
  nextPhase: TimerPhase
  nextRound: number
}

interface TimerEventMap {
  statechange: TimerSnapshot
  phasechange: TimerSnapshot
  focuscomplete: FocusRecord
  beforePhaseChange: PhaseTransition
}

type Listener<K extends keyof TimerEventMap> = (event: TimerEventMap[K]) => void

interface PersistedTimer {
  schemaVersion: number
  settings: TimerSettings
  state: TimerState
}

function durationFor(settings: TimerSettings, phase: TimerPhase): number {
  if (phase === 'shortBreak') return settings.shortBreakMs
  if (phase === 'longBreak') return settings.longBreakMs
  return settings.focusMs
}

function loadTimer(): PersistedTimer | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as PersistedTimer | null
    return parsed?.schemaVersion === SCHEMA_VERSION ? parsed : null
  } catch {
    return null
  }
}

export class TimerEngine {
  private settings: TimerSettings = { ...DEFAULT_SETTINGS }
  private state: TimerState
  private snapshot: TimerSnapshot
  private listeners = new Map<keyof TimerEventMap, Set<(event: never) => void>>()
  private intervalId: number | null = null
  private lastPublishedSecond = -1
  private queuedSettings: TimerSettings | null = null

  constructor() {
    const saved = loadTimer()
    if (saved) this.settings = { ...saved.settings }
    this.state = saved?.state ?? {
      phase: 'focus',
      status: 'idle',
      round: 1,
      completedFocuses: 0,
      phaseStartedAt: null,
      phaseEndsAt: null,
      phaseDurationMs: this.settings.focusMs,
      pausedRemainingMs: this.settings.focusMs,
      assignment: { ...EMPTY_ASSIGNMENT },
    }
    if (this.state.status === 'running' && this.state.phaseEndsAt === null)
      this.state.status = 'paused'
    this.snapshot = this.createSnapshot()
    this.recover()
    this.syncTicker()
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { passive: true })
  }

  subscribe = (listener: () => void): (() => void) => {
    const unsubscribe = this.on('statechange', listener)
    return unsubscribe
  }

  getSnapshot = (): TimerSnapshot => this.snapshot

  on<K extends keyof TimerEventMap>(eventName: K, listener: Listener<K>): () => void {
    const listeners = this.listeners.get(eventName) ?? new Set()
    listeners.add(listener as (event: never) => void)
    this.listeners.set(eventName, listeners)
    return () => listeners.delete(listener as (event: never) => void)
  }

  configure(settings: TimerSettings): void {
    this.settings = {
      presetId: settings.presetId,
      focusMs: Math.max(1000, settings.focusMs),
      shortBreakMs: Math.max(1000, settings.shortBreakMs),
      longBreakMs: Math.max(1000, settings.longBreakMs),
      longBreakInterval: Math.max(2, Math.min(12, Math.round(settings.longBreakInterval))),
      autoStartFocus: settings.autoStartFocus,
      autoStartBreak: settings.autoStartBreak,
    }
    if (this.state.status === 'idle' || this.state.status === 'waiting') {
      const duration = durationFor(this.settings, this.state.phase)
      this.state = { ...this.state, phaseDurationMs: duration, pausedRemainingMs: duration }
    }
    this.publish(true)
  }

  queueSettings(settings: TimerSettings): void {
    if (this.state.status === 'idle') this.configure(settings)
    else this.queuedSettings = settings
  }

  setAssignment(assignment: FocusAssignment): void {
    this.state = { ...this.state, assignment: { ...assignment } }
    this.publish(true)
  }

  start(): void {
    if (this.state.status === 'running') return
    if (this.state.status === 'paused') {
      this.resume()
      return
    }
    this.startCurrentPhase(durationFor(this.settings, this.state.phase))
  }

  startPendingPhase(): void {
    if (this.state.status !== 'waiting') return
    this.startCurrentPhase(durationFor(this.settings, this.state.phase))
  }

  pause(): void {
    if (this.state.status !== 'running') return
    const remaining = this.remainingAt(Date.now())
    this.state = {
      ...this.state,
      status: 'paused',
      phaseEndsAt: null,
      pausedRemainingMs: remaining,
    }
    this.syncTicker()
    this.publish(true)
  }

  resume(): void {
    if (this.state.status !== 'paused') return
    this.startCurrentPhase(this.state.pausedRemainingMs)
  }

  stop(): void {
    const duration = durationFor(this.settings, 'focus')
    this.state = {
      ...this.state,
      phase: 'focus',
      status: 'idle',
      round: 1,
      phaseStartedAt: null,
      phaseEndsAt: null,
      phaseDurationMs: duration,
      pausedRemainingMs: duration,
      assignment: { ...EMPTY_ASSIGNMENT },
    }
    this.queuedSettings = null
    this.syncTicker()
    this.publish(true)
  }

  skipPhase(): void {
    if (this.state.status === 'idle' && this.state.phase === 'focus') return
    this.transition(false)
  }

  recover(): void {
    if (this.state.status !== 'running' || this.state.phaseEndsAt === null) return
    let guard = 0
    while (this.state.status === 'running' && this.remainingAt(Date.now()) <= 0 && guard < 100) {
      const transitionAt = this.state.phaseEndsAt
      this.transition(true, transitionAt)
      guard += 1
    }
    this.publish(true)
  }

  destroy(): void {
    if (this.intervalId !== null) window.clearInterval(this.intervalId)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.listeners.clear()
  }

  private handleVisibilityChange = (): void => {
    if (!document.hidden) this.recover()
  }

  private startCurrentPhase(duration: number): void {
    const startedAt = Date.now()
    this.state = {
      ...this.state,
      status: 'running',
      phaseStartedAt: startedAt,
      phaseEndsAt: startedAt + Math.max(1, duration),
      phaseDurationMs: durationFor(this.settings, this.state.phase),
      pausedRemainingMs: Math.max(1, duration),
    }
    this.syncTicker()
    this.publish(true)
  }

  private remainingAt(timestamp: number): number {
    if (this.state.status === 'running' && this.state.phaseEndsAt !== null) {
      return Math.max(0, this.state.phaseEndsAt - timestamp)
    }
    return Math.max(0, this.state.pausedRemainingMs)
  }

  private tick = (): void => {
    if (this.state.status !== 'running') return
    if (this.remainingAt(Date.now()) <= 0) {
      this.transition(true)
      return
    }
    const second = Math.ceil(this.remainingAt(Date.now()) / 1000)
    if (second !== this.lastPublishedSecond) this.publish(false)
  }

  private transition(completed: boolean, transitionAt = Date.now()): void {
    const currentPhase = this.state.phase
    const completedAt = new Date(transitionAt).toISOString()
    if (completed && currentPhase === 'focus') {
      const record: FocusRecord = {
        id: createId('focus'),
        phase: 'focus',
        durationSeconds: Math.round(this.state.phaseDurationMs / 1000),
        startedAt: new Date(
          this.state.phaseStartedAt ?? transitionAt - this.state.phaseDurationMs,
        ).toISOString(),
        completedAt,
        round: this.state.round,
        presetId: this.settings.presetId,
        ...this.state.assignment,
      }
      useWorkspaceStore.getState().addFocusRecord(record)
      this.emit('focuscomplete', record)
    }

    const completedFocuses =
      this.state.completedFocuses + (completed && currentPhase === 'focus' ? 1 : 0)
    const leavingFocus = currentPhase === 'focus'
    const nextPhase: TimerPhase = leavingFocus
      ? completedFocuses % this.settings.longBreakInterval === 0
        ? 'longBreak'
        : 'shortBreak'
      : 'focus'
    const nextRound = leavingFocus ? this.state.round : this.state.round + 1
    this.emit('beforePhaseChange', { currentPhase, nextPhase, nextRound })

    if (nextPhase === 'focus' && this.queuedSettings) {
      this.settings = this.queuedSettings
      this.queuedSettings = null
    }
    const duration = durationFor(this.settings, nextPhase)
    const autoStart =
      nextPhase === 'focus' ? this.settings.autoStartFocus : this.settings.autoStartBreak
    const now = transitionAt
    this.state = {
      ...this.state,
      phase: nextPhase,
      status: autoStart ? 'running' : 'waiting',
      round: nextRound,
      completedFocuses,
      phaseStartedAt: autoStart ? now : null,
      phaseEndsAt: autoStart ? now + duration : null,
      phaseDurationMs: duration,
      pausedRemainingMs: duration,
    }
    this.syncTicker()
    this.publish(true)
    this.emit('phasechange', this.snapshot)
  }

  private syncTicker(): void {
    if (this.state.status === 'running' && this.intervalId === null) {
      this.intervalId = window.setInterval(this.tick, 250)
    } else if (this.state.status !== 'running' && this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private createSnapshot(): TimerSnapshot {
    const remainingMs = this.remainingAt(Date.now())
    return {
      ...this.state,
      remainingMs,
      progress: this.state.phaseDurationMs > 0 ? 1 - remainingMs / this.state.phaseDurationMs : 0,
      assignment: { ...this.state.assignment },
      settings: { ...this.settings },
    }
  }

  private publish(force: boolean): void {
    const snapshot = this.createSnapshot()
    const second = Math.ceil(snapshot.remainingMs / 1000)
    if (!force && second === this.lastPublishedSecond) return
    this.lastPublishedSecond = second
    this.snapshot = snapshot
    this.persist()
    this.emit('statechange', snapshot)
  }

  private persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          settings: this.settings,
          state: this.state,
        }),
      )
    } catch {
      // The timer remains usable when storage is disabled or full.
    }
  }

  private emit<K extends keyof TimerEventMap>(eventName: K, event: TimerEventMap[K]): void {
    for (const listener of this.listeners.get(eventName) ?? []) listener(event as never)
  }
}

export const timerEngine = new TimerEngine()

export function settingsFromPreset(preset: {
  id?: string
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
  autoStartFocus: boolean
  autoStartBreak: boolean
}): TimerSettings {
  return {
    presetId: preset.id ?? null,
    focusMs: preset.focusMinutes * 60 * 1000,
    shortBreakMs: preset.shortBreakMinutes * 60 * 1000,
    longBreakMs: preset.longBreakMinutes * 60 * 1000,
    longBreakInterval: preset.longBreakInterval,
    autoStartFocus: preset.autoStartFocus,
    autoStartBreak: preset.autoStartBreak,
  }
}
