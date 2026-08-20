import type { SoundscapeConfig } from '../../domain/models'
import { AMBIENT_SOUNDS, MUSIC_TRACKS } from './catalog'

export interface SoundscapeSnapshot extends SoundscapeConfig {
  playing: boolean
}

type Listener = () => void

function makeAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src)
  audio.loop = true
  audio.preload = 'metadata'
  return audio
}

class SoundscapeService {
  private config: SoundscapeConfig = {
    masterVolume: 0.5,
    musicId: null,
    musicVolume: 0.45,
    ambient: [{ id: 'spring-rain', volume: 0.35 }],
  }
  private music: HTMLAudioElement | null = null
  private ambientNodes = new Map<string, HTMLAudioElement>()
  private listeners = new Set<Listener>()
  private snapshot: SoundscapeSnapshot = {
    ...this.config,
    ambient: [...this.config.ambient],
    playing: false,
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): SoundscapeSnapshot => this.snapshot

  configure(config: SoundscapeConfig): void {
    this.config = {
      masterVolume: Math.max(0, Math.min(1, config.masterVolume)),
      musicId: config.musicId,
      musicVolume: Math.max(0, Math.min(1, config.musicVolume)),
      ambient: config.ambient.map((item) => ({
        ...item,
        volume: Math.max(0, Math.min(1, item.volume)),
      })),
    }
    this.syncNodes()
    this.publish()
  }

  setMasterVolume(volume: number): void {
    this.configure({ ...this.config, masterVolume: volume })
  }

  setMusic(musicId: string | null): void {
    this.configure({ ...this.config, musicId })
  }

  setMusicVolume(volume: number): void {
    this.configure({ ...this.config, musicVolume: volume })
  }

  setAmbient(id: string, enabled: boolean): void {
    const exists = this.config.ambient.some((item) => item.id === id)
    const ambient =
      enabled && !exists
        ? [...this.config.ambient, { id, volume: 0.35 }]
        : !enabled
          ? this.config.ambient.filter((item) => item.id !== id)
          : this.config.ambient
    this.configure({ ...this.config, ambient })
  }

  setAmbientVolume(id: string, volume: number): void {
    this.configure({
      ...this.config,
      ambient: this.config.ambient.map((item) => (item.id === id ? { ...item, volume } : item)),
    })
  }

  async play(): Promise<void> {
    this.syncNodes()
    const nodes = [this.music, ...this.ambientNodes.values()].filter(
      (node): node is HTMLAudioElement => node !== null,
    )
    await Promise.allSettled(nodes.map((node) => node.play()))
    this.snapshot = { ...this.snapshot, playing: true }
    this.emit()
  }

  pause(): void {
    this.music?.pause()
    for (const node of this.ambientNodes.values()) node.pause()
    this.snapshot = { ...this.snapshot, playing: false }
    this.emit()
  }

  stop(): void {
    this.pause()
    if (this.music) this.music.currentTime = 0
    for (const node of this.ambientNodes.values()) node.currentTime = 0
  }

  async preview(kind: 'music' | 'ambient', id: string, volume: number): Promise<void> {
    const item = (kind === 'music' ? MUSIC_TRACKS : AMBIENT_SOUNDS).find(
      (candidate) => candidate.id === id,
    )
    if (!item) return
    const preview = new Audio(item.src)
    preview.volume = Math.max(0, Math.min(1, volume * this.config.masterVolume))
    await preview.play()
    window.setTimeout(() => {
      preview.pause()
      preview.src = ''
    }, 2200)
  }

  private syncNodes(): void {
    const selectedMusic = MUSIC_TRACKS.find((item) => item.id === this.config.musicId)
    if (!selectedMusic) {
      this.music?.pause()
      this.music = null
    } else if (!this.music || !this.music.src.endsWith(selectedMusic.src)) {
      const wasPlaying = this.snapshot.playing
      this.music?.pause()
      this.music = makeAudio(selectedMusic.src)
      if (wasPlaying) void this.music.play()
    }
    if (this.music) this.music.volume = this.config.masterVolume * this.config.musicVolume

    const activeIds = new Set(this.config.ambient.map((item) => item.id))
    for (const [id, node] of this.ambientNodes) {
      if (!activeIds.has(id)) {
        node.pause()
        this.ambientNodes.delete(id)
      }
    }
    for (const item of this.config.ambient) {
      const catalogItem = AMBIENT_SOUNDS.find((candidate) => candidate.id === item.id)
      if (!catalogItem) continue
      let node = this.ambientNodes.get(item.id)
      if (!node) {
        node = makeAudio(catalogItem.src)
        this.ambientNodes.set(item.id, node)
        if (this.snapshot.playing) void node.play()
      }
      node.volume = this.config.masterVolume * item.volume
    }
  }

  private publish(): void {
    this.snapshot = {
      ...this.config,
      ambient: this.config.ambient.map((item) => ({ ...item })),
      playing: this.snapshot.playing,
    }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export const soundscapeService = new SoundscapeService()
