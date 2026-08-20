import { BarChart3, FileText, WandSparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import styles from './AiWorkspaceTabs.module.css'

export type AiWorkspaceView = 'overview' | 'planner' | 'reports'

const tabs = [
  { view: 'overview', label: '数据概览', to: '/insights', icon: BarChart3 },
  { view: 'planner', label: 'AI 拆解', to: '/ai-studio', icon: WandSparkles },
  { view: 'reports', label: '日报周报', to: '/insights?view=reports', icon: FileText },
] as const

export function AiWorkspaceTabs({ active }: { active: AiWorkspaceView }) {
  return (
    <nav className={styles.tabs} aria-label="番茄智舱">
      <span>番茄智舱</span>
      <div>
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.view}
              to={tab.to}
              className={tab.view === active ? styles.active! : styles.tab!}
            >
              <Icon />
              {tab.label}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
