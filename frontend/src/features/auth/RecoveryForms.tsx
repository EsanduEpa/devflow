import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'
import { authErrorMessage, forgotPassword, resetPassword } from './api'
import { cardClass, errorClass, fieldClass, linkClass, submitClass, successClass } from '../../shared/form-styles'

export function ForgotPasswordForm() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setError('')
    setMessage('')
    setPending(true)
    try {
      setMessage(await forgotPassword(String(data.get('email') ?? '')))
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Forgot password</h1>
      <p className="mt-3 text-sm text-slate-700">Enter your account email to request a reset link.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input className={fieldClass} name="email" type="email" autoComplete="email" required />
        </label>
        {message && <p className={successClass} role="status">{message}</p>}
        {error && <p className={errorClass} role="alert">{error}</p>}
        <button className={submitClass} disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <Link to="/login" className={`mt-6 inline-block text-sm ${linkClass}`}>Back to log in</Link>
    </section>
  )
}

export function ResetPasswordForm() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const token = new URLSearchParams(hash.slice(1)).get('token') ?? ''
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !validToken) return
    const data = new FormData(event.currentTarget)
    setError('')
    setPending(true)
    try {
      await resetPassword(token, String(data.get('newPassword') ?? ''))
      await queryClient.invalidateQueries({ queryKey: ['current-user'] })
      navigate('/login', { replace: true, state: { passwordUpdated: true } })
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Reset your password</h1>
      {validToken ? (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            New password
            <input className={fieldClass} name="newPassword" type="password" autoComplete="new-password" minLength={12}
              maxLength={128} required aria-describedby="reset-password-rules" />
          </label>
          <p id="reset-password-rules" className="text-sm text-slate-600">Use 12 to 128 characters.</p>
          {error && <p className={errorClass} role="alert">{error}</p>}
          <button className={submitClass} disabled={pending}>{pending ? 'Resetting…' : 'Reset password'}</button>
        </form>
      ) : <p className={`mt-6 ${errorClass}`} role="alert">The reset link is invalid or incomplete.</p>}
      <Link to="/forgot-password" className={`mt-6 inline-block text-sm ${linkClass}`}>Request a new reset link</Link>
    </section>
  )
}
