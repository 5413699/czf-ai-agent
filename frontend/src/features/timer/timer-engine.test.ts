// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimerSettings } from '../../domain/models'
import { useWorkspaceStore } from '../workspace/workspace-store'
import { TimerEngine } from './timer-engine'

const TEST_SETTINGS: TimerSettings = {
  presetId: 'classic',
  focusMs: 1_000,
  shortBreakMs: 1_000,
  longBreakMs: 2_000,
  longBreakInterval: 4,
  autoStartFocus: true,
  autoStartBreak: true,
}

describe('TimerEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T00:00:00.000Z'))
    localStorage.clear()
    useWorkspaceStore.getState().resetWorkspace()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('links a completed focus to both its task and subtask', () => {
    const workspace = useWorkspaceStore.getState()
    const project = workspace.addProject({
      name: 'Spring AI',
      description: '',
      preferredFocusPresetId: 'classic',
    })
    const task = workspace.addTask(project.id, {
      name: '完成 RAG',
      description: '',
      url: '',
      estimatedMinutes: 25,
    })
    expect(task).not.toBeNull()
    const subtask = workspace.addSubtask(project.id, task!.id, {
      name: '接入向量库',
      description: '',
      url: '',
      estimatedMinutes: 25,
    })
    expect(subtask).not.toBeNull()

    const engine = new TimerEngine()
    engine.configure(TEST_SETTINGS)
    engine.setAssignment({
      label: '验证检索链路',
      projectId: project.id,
      taskId: task!.id,
      subtaskId: subtask!.id,
    })
    engine.start()
    vi.advanceTimersByTime(1_100)

    const state = useWorkspaceStore.getState()
    const savedTask = state.projects[0]!.tasks[0]!
    expect(state.focusRecords).toHaveLength(1)
    expect(state.focusRecords[0]).toMatchObject({ presetId: 'classic', round: 1 })
    expect(savedTask.completedPomodoros).toBe(1)
    expect(savedTask.subtasks[0]!.completedPomodoros).toBe(1)
    engine.destroy()
  })

  it('applies queued settings only when the next focus phase begins', () => {
    const engine = new TimerEngine()
    engine.configure(TEST_SETTINGS)
    engine.start()
    engine.queueSettings({ ...TEST_SETTINGS, presetId: 'deep', focusMs: 2_000 })

    vi.advanceTimersByTime(1_100)
    expect(engine.getSnapshot()).toMatchObject({ phase: 'shortBreak' })
    expect(engine.getSnapshot().settings.presetId).toBe('classic')

    vi.advanceTimersByTime(1_000)
    expect(engine.getSnapshot()).toMatchObject({ phase: 'focus', phaseDurationMs: 2_000 })
    expect(engine.getSnapshot().settings.presetId).toBe('deep')
    engine.destroy()
  })

  it('recovers every elapsed automatic phase using the original deadlines', () => {
    localStorage.setItem(
      'studyflow:timer',
      JSON.stringify({
        schemaVersion: 2,
        settings: TEST_SETTINGS,
        state: {
          phase: 'focus',
          status: 'running',
          round: 1,
          completedFocuses: 0,
          phaseStartedAt: 0,
          phaseEndsAt: 1_000,
          phaseDurationMs: 1_000,
          pausedRemainingMs: 1_000,
          assignment: { label: '', projectId: null, taskId: null, subtaskId: null },
        },
      }),
    )
    vi.setSystemTime(5_500)

    const engine = new TimerEngine()
    const snapshot = engine.getSnapshot()
    expect(snapshot).toMatchObject({
      phase: 'shortBreak',
      status: 'running',
      completedFocuses: 3,
      round: 3,
    })
    expect(snapshot.remainingMs).toBe(500)
    expect(useWorkspaceStore.getState().focusRecords).toHaveLength(3)
    engine.destroy()
  })
})
