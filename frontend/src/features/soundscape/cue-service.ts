const CUES = {
  'default-start': '/assets/audio/focus-start.mp3',
  'default-complete': '/assets/audio/focus-complete.mp3',
} as const

class CueService {
  async play(id: keyof typeof CUES, volume: number): Promise<void> {
    const audio = new Audio(CUES[id])
    audio.volume = Math.max(0, Math.min(1, volume))
    try {
      await audio.play()
    } catch {
      // Browsers can block audio until the first user gesture.
    }
  }
}

export const cueService = new CueService()
