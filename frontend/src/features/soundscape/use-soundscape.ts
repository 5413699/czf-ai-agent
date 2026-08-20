import { useSyncExternalStore } from 'react'
import { soundscapeService } from './soundscape-service'

export function useSoundscape() {
  return useSyncExternalStore(
    soundscapeService.subscribe,
    soundscapeService.getSnapshot,
    soundscapeService.getSnapshot,
  )
}
