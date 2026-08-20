import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import styles from './AppErrorBoundary.module.css'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(): State {
    return { hasError: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed', error, info)
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className={styles.page}>
        <div className={styles.panel}>
          <AlertTriangle aria-hidden="true" />
          <p className={styles.eyebrow}>番茄自习室遇到了一点问题</p>
          <h1>这次没有保存好页面状态</h1>
          <p>本地学习数据不会因此丢失。重新载入页面后即可继续。</p>
          <button type="button" onClick={() => window.location.reload()}>
            <RotateCcw size={18} />
            重新载入
          </button>
        </div>
      </main>
    )
  }
}
