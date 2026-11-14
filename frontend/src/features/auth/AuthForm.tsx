import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'
import { authErrorMessage, login, register } from './api'

const fieldClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-indigo-600'

export function AuthForm({ isRegistration = false }: { isRegistration?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const title = isRegistration ? 'Create an account' : 'Log in'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    setError('')
    setPending(true)

    try {
      if (isRegistration) {
        await register({ name: String(form.get('name') ?? ''), email, password })
        navigate('/login', { replace: true, state: { registered: true, email } })
      } else {
        const user = await login({ email, password })
        await queryClient.cancelQueries({ queryKey: ['current-user'] })
        queryClient.setQueryData(['current-user'], user)
        navigate('/', { replace: true })
      }
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      {!isRegistration && location.state?.registered && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          Your account is ready. Log in to continue.
        </p>
      )}
      <form onSubmit={submit} className="mt-7 space-y-4">
        {isRegistration && (
          <label className="block text-sm font-medium">
            Full name
            <input className={fieldClass} name="name" autoComplete="name" required minLength={2} maxLength={100} />
          </label>
        )}
        <label className="block text-sm font-medium">
          Email
          <input className={fieldClass} name="email" type="email" autoComplete="email" required defaultValue={location.state?.email} />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input className={fieldClass} type="password" name="password" required minLength={isRegistration ? 12 : undefined} maxLength={128}
            autoComplete={isRegistration ? 'new-password' : 'current-password'} aria-describedby={isRegistration ? 'password-rules' : undefined} />
        </label>
        {isRegistration && <p id="password-rules" className="text-sm text-slate-600">Use 12 to 128 characters.</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">{error}</p>}
        <button disabled={pending} className="mt-2 w-full rounded-lg bg-indigo-700 px-4 py-2.5 font-medium text-white hover:bg-indigo-800 disabled:opacity-65">
          {pending ? (isRegistration ? 'Creating account…' : 'Logging in…') : title}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-700">
        {isRegistration ? 'Already have an account? ' : 'New to DevFlow? '}
        <Link to={isRegistration ? '/login' : '/register'} className="font-medium text-indigo-700 underline underline-offset-4">
          {isRegistration ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </section>
  )
}
