import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router'
import { AuthForm } from './features/auth/AuthForm'
import { authErrorMessage, currentUser, logout, type PublicUser } from './features/auth/api'

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
      <button onClick={signOut} disabled={pending} className="mt-6 rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50 disabled:opacity-65">
        {pending ? 'Logging out…' : 'Log out'}
      </button>
    </section>
  )
}

export default function App() {
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
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthForm key="login" />} />
            <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthForm key="register" isRegistration />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  )
}
