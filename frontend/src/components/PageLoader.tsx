import { Timer } from 'lucide-react'
import styles from './PageLoader.module.css'
export function PageLoader() {
  return (
    <div className={styles.loader}>
      <Timer />
      <span>正在准备你的自习室...</span>
    </div>
  )
}
