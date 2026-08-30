import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BookOpen, Bot, CircleHelp, Focus, Leaf, Moon, Sun, Timer } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { Theme } from '../domain/models'
import { usePreferencesStore } from '../features/preferences/preferences-store'
import styles from './AppShell.module.css'

const CustomerSupportWidget = lazy(
  () => import('../components/customer-support/CustomerSupportWidget'),
)

const navigation = [
  { to: '/focus', label: '入栈', icon: Focus },
  { to: '/tasks', label: '任务', icon: BookOpen },
  { to: '/ai-studio', label: '时栈台', icon: Bot },
  { to: '/tutorial', label: '教程', icon: CircleHelp },
]
const themes: Array<{ id: Theme; label: string; icon: typeof Sun }> = [
  { id: 'night', label: '极夜', icon: Moon },
  { id: 'day', label: '永昼', icon: Sun },
  { id: 'eye', label: '护眼', icon: Leaf },
]
const themeColors: Record<Theme, string> = {
  night: '#0d1015',
  day: '#f5f7fb',
  eye: '#edf3e9',
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const theme = usePreferencesStore((state) => state.theme)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', themeColors[theme])
  }, [theme])
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink className={styles.brand!} to="/focus" aria-label="时栈首页">
          <span className={styles.brandMark}>
            <Timer size={22} />
          </span>
          <span>
            <strong>时栈</strong>
            <small>时间有痕，成果有栈</small>
          </span>
        </NavLink>
        <nav className={styles.desktopNav} aria-label="主导航">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => {
                const workspaceActive =
                  to === '/ai-studio' &&
                  (location.pathname === '/ai-studio' || location.pathname === '/insights')
                return isActive || workspaceActive ? styles.activeLink : styles.navLink
              }}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.themeSwitch} aria-label="主题">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={theme === id ? styles.activeTheme : ''}
              onClick={() => setTheme(id)}
              title={label}
              aria-label={label}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <nav className={styles.mobileNav} aria-label="移动端主导航">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => {
              const workspaceActive =
                to === '/ai-studio' &&
                (location.pathname === '/ai-studio' || location.pathname === '/insights')
              return isActive || workspaceActive ? styles.mobileActive : ''
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={null}>
        <CustomerSupportWidget />
      </Suspense>
    </div>
  )
}
