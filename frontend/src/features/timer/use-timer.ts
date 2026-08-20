import { useSyncExternalStore } from 'react'
import { timerEngine } from './timer-engine'

export function useTimer() {
  return useSyncExternalStore(
    timerEngine.subscribe,
    timerEngine.getSnapshot,
    timerEngine.getSnapshot,
  )
}
