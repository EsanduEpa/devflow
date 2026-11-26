import { useEffect, useLayoutEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { AuthForm } from './features/auth/AuthForm'
import { ForgotPasswordForm, ResetPasswordForm } from './features/auth/RecoveryForms'
import { authErrorMessage, currentUser, type PublicUser } from './features/auth/api'
import { afterAuthentication, readInvitationToken } from './features/auth/invitation-return'
import { NotificationInbox } from './features/notifications/NotificationInbox'
import { AccountSettings } from './features/profile/AccountSettings'
import { ProjectDetailsPage } from './features/projects/ProjectDetailsPage'
import { ProjectSprintsPage } from './features/sprints/ProjectSprintsPage'
import { TaskPage, TaskDrawer } from './features/tasks/TaskPage'
import { TaskBoardPage } from './features/tasks/TaskBoardPage'
import { ProjectTaskListPage } from './features/tasks/ProjectTaskListPage'
import { taskBackground } from './features/tasks/task-navigation'
import { Workspaces } from './features/workspaces/Workspaces'
import { InvitationPage } from './features/workspaces/InvitationPage'
import { AppShell } from './shared/AppShell'
import { errorClass } from './shared/form-styles'
import { applyTheme, readTheme } from './shared/theme'
import { ThemeToggle } from './shared/ThemeToggle'
import { Brand, LoadingState } from './shared/ui'

function InvitationRoute({ user }: { user: PublicUser | null }) {
  const { token } = useParams()
  return <InvitationPage key={token} user={user} />
}

export default function App() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [theme, setTheme] = useState(readTheme)
  const [loginNotice, setLoginNotice] = useState<{ sessionEnded: true } | { passwordUpdated: true; email: string } | null>(null)
  const { data: user, isPending, isError, error, refetch } = useQuery({
    queryKey: ['current-user'], queryFn: ({ signal }) => currentUser(signal), retry: false,
  })
  const loginRedirect = <Navigate to="/login" replace state={loginNotice} />
  const signedInPath = afterAuthentication(readInvitationToken(location.state))
  const background = user ? taskBackground(location) : undefined
  const publicForm = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname)
  useLayoutEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    function endSession() {
      if (!queryClient.getQueryData<PublicUser | null>(['current-user'])) return
      setLoginNotice((notice) => notice && 'passwordUpdated' in notice ? notice : { sessionEnded: true })
      void queryClient.cancelQueries({ queryKey: ['current-user'] }).then(() => queryClient.setQueryData(['current-user'], null))
    }
    window.addEventListener('devflow:session-ended', endSession)
    return () => window.removeEventListener('devflow:session-ended', endSession)
  }, [queryClient])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    applyTheme(next, true)
    setTheme(next)
  }

  async function passwordChanged(email: string) {
    setLoginNotice({ passwordUpdated: true, email })
    await queryClient.cancelQueries({ queryKey: ['current-user'] })
    queryClient.setQueryData(['current-user'], null)
  }

  const content = isPending ? <LoadingState>Checking your session…</LoadingState> : isError ? (
    <section className="ui-panel max-w-md">
      <p className={errorClass} role="alert">{authErrorMessage(error)}</p>
      <button type="button" onClick={() => void refetch()} className="ui-button ui-secondary mt-3">Try again</button>
    </section>
  ) : (
    <>
      <Routes location={background ?? location}>
        <Route path="/" element={user ? <Navigate to="/workspaces" replace /> : loginRedirect} />
        <Route path="/login" element={user ? <Navigate to={signedInPath} replace /> : <AuthForm key="login" onLogin={() => setLoginNotice(null)} />} />
        <Route path="/register" element={user ? <Navigate to={signedInPath} replace /> : <AuthForm key="register" isRegistration />} />
        <Route path="/notifications" element={user ? <NotificationInbox key={user.id} userId={user.id} /> : loginRedirect} />
        <Route path="/profile" element={user ? <AccountSettings user={user} onPasswordChanged={passwordChanged} /> : loginRedirect} />
        <Route path="/workspaces/*" element={user ? <Workspaces key={user.id} userId={user.id} /> : loginRedirect} />
        <Route path="/projects/:projectId" element={user ? <ProjectDetailsPage key={user.id} userId={user.id} /> : loginRedirect} />
        <Route path="/projects/:projectId/dashboard" element={user ? <ProjectDetailsPage key={user.id} userId={user.id} /> : loginRedirect} />
        <Route path="/projects/:projectId/settings" element={user ? <ProjectDetailsPage key={user.id} userId={user.id} settings /> : loginRedirect} />
        <Route path="/projects/:projectId/sprints/:sprintId?" element={user ? <ProjectSprintsPage key={user.id} userId={user.id} /> : loginRedirect} />
        <Route path="/projects/:projectId/board" element={user ? <TaskBoardPage key={user.id} userId={user.id} /> : loginRedirect} />
        <Route path="/projects/:projectId/tasks" element={user ? <ProjectTaskListPage key={user.id} userId={user.id} /> : loginRedirect} />
        <Route path="/projects/:projectId/tasks/new" element={user ? <TaskPage key={`${user.id}:create`} userId={user.id} create /> : loginRedirect} />
        <Route path="/tasks/:taskId" element={user ? <TaskPage key={user.id} userId={user.id} /> : loginRedirect} />
        <Route path="/invitations/:token" element={<InvitationRoute user={user ?? null} />} />
        <Route path="/forgot-password" element={<ForgotPasswordForm />} />
        <Route path="/reset-password" element={<ResetPasswordForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {background && user && <TaskDrawer userId={user.id} />}
    </>
  )

  if (user && !publicForm) {
    return <AppShell key={user.id} user={user} theme={theme} onToggle={toggleTheme} current={background ?? location}>{content}</AppShell>
  }

  return (
    <div className="auth-shell">
      <header className="flex min-h-15 items-center justify-end px-4 sm:px-8">
        <ThemeToggle theme={theme} onToggle={toggleTheme} compact />
      </header>
      <main className="auth-content">
        <div className="max-w-md">
          <div className="mb-4 flex justify-center"><Brand /></div>
          {content}
        </div>
      </main>
    </div>
  )
}
