import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { ClockStyle, TimerSnapshot } from '../../domain/models'
import { timerEngine } from '../../features/timer/timer-engine'
import styles from './SmoothTimerDial.module.css'

interface Props {
  timer: TimerSnapshot
  style?: ClockStyle
  label: string
  children?: ReactNode
}

function formatTime(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function SmoothTimerDial({ timer, style = 'tomato-fill', label, children }: Props) {
  const dialRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    const paint = () => {
      const live = timerEngine.getSnapshot()
      const remaining =
        live.status === 'running' && live.phaseEndsAt
          ? Math.max(0, live.phaseEndsAt - Date.now())
          : live.remainingMs
      const progress = live.phaseDurationMs > 0 ? 1 - remaining / live.phaseDurationMs : 0
      const normalized = Math.max(0, Math.min(1, progress))
      dialRef.current?.style.setProperty('--progress', `${normalized * 360}deg`)
      dialRef.current?.style.setProperty('--fill', `${normalized * 100}%`)
      frame = window.requestAnimationFrame(paint)
    }
    frame = window.requestAnimationFrame(paint)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      ref={dialRef}
      className={`${styles.dial} ${styles[style]}`}
      style={
        {
          '--progress': `${timer.progress * 360}deg`,
          '--fill': `${timer.progress * 100}%`,
        } as CSSProperties
      }
    >
      <div className={styles.leaf} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className={styles.content}>
        <strong>{formatTime(timer.remainingMs)}</strong>
        <span title={label}>{label}</span>
        {children}
      </div>
    </div>
  )
}
