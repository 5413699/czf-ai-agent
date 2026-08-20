import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className={styles.header}>
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  )
}
