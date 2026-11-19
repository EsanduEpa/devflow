import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { AuthForm } from './features/auth/AuthForm'
import { ForgotPasswordForm, ResetPasswordForm } from './features/auth/RecoveryForms'
import { authErrorMessage, currentUser, logout, type PublicUser } from './features/auth/api'
import { afterAuthentication, readInvitationToken } from './features/auth/invitation-return'
import { AccountSettings } from './features/profile/AccountSettings'
import { ProjectDetailsPage } from './features/projects/ProjectDetailsPage'
import { Workspaces } from './features/workspaces/Workspaces'
import { InvitationPage } from './features/workspaces/InvitationPage'

function Home({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    setError('')
    try {
      await logout()
      await queryClient.cancelQueries({ queryKey: ['current-user'] })
      queryClient.setQueryData(['current-user'], null)
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Welcome, {user.name}</h1>
      <p className="mt-2 break-all text-slate-700">{user.email}</p>
      {error && <p className="mt-5 text-red-900" role="alert">{error}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link to="/workspaces" className="rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white hover:bg-indigo-800">Workspaces</Link>
        <Link to="/profile" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50">Profile settings</Link>
        <button onClick={signOut} disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 disabled:opacity-65">
          {pending ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </section>
  )
}

function InvitationRoute({ user }: { user: PublicUser | null }) {
  const { token } = useParams()
  return <InvitationPage key={token} user={user} />
}

export default function App() {
  const { state } = useLocation()
  const signedInPath = afterAuthentication(readInvitationToken(state))
  const { data: user, isPending, isError, error, refetch } = useQuery({
    queryKey: ['current-user'],
    queryFn: ({ signal }) => currentUser(signal),
    retry: false,
  })

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xl font-semibold tracking-tight text-indigo-800">DevFlow</div>
      </header>
      <main className="flex justify-center px-4 py-12 sm:py-20">
        {isPending ? <p role="status">Checking your session…</p> : isError ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <p role="alert">{authErrorMessage(error)}</p>
            <button onClick={() => void refetch()} className="mt-3 font-medium text-indigo-700 underline">Try again</button>
          </section>
        ) : (
          <Routes>
            <Route path="/" element={user ? <Home user={user} /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={user ? <Navigate to={signedInPath} replace /> : <AuthForm key="login" />} />
            <Route path="/register" element={user ? <Navigate to={signedInPath} replace /> : <AuthForm key="register" isRegistration />} />
            <Route path="/profile" element={<AccountSettings user={user ?? null} />} />
            <Route path="/workspaces/*" element={user ? <Workspaces key={user.id} userId={user.id} /> : <Navigate to="/login" replace />} />
            <Route path="/projects/:projectId" element={user ? <ProjectDetailsPage key={user.id} userId={user.id} /> : <Navigate to="/login" replace />} />
            <Route path="/projects/:projectId/settings" element={user ? <ProjectDetailsPage key={user.id} userId={user.id} settings /> : <Navigate to="/login" replace />} />
            <Route path="/invitations/:token" element={<InvitationRoute user={user ?? null} />} />
            <Route path="/forgot-password" element={<ForgotPasswordForm />} />
            <Route path="/reset-password" element={<ResetPasswordForm />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  )
}
