import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { PageLoader } from './components/PageLoader'

const FocusPage = lazy(() => import('./pages/FocusPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const AiStudioPage = lazy(() => import('./pages/AiStudioPage'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const TutorialPage = lazy(() => import('./pages/TutorialPage'))

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/ai-studio" element={<AiStudioPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="*" element={<Navigate to="/focus" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
