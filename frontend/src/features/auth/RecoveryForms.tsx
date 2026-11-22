import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'
import { authErrorMessage, forgotPassword, resetPassword } from './api'
import { cardClass, errorClass, fieldClass, linkClass, submitClass, successClass } from '../../shared/form-styles'
import { useFieldErrors } from '../../shared/useFieldErrors'

export function ForgotPasswordForm() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const fields = useFieldErrors(error)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setError(null)
    setMessage('')
    setPending(true)
    try {
      setMessage(await forgotPassword(String(data.get('email') ?? '')))
    } catch (error) {
      setError(error)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="ui-heading">Forgot password</h1>
      <p className="mt-3 text-sm text-secondary">Enter your account email to request a reset link.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input className={fieldClass} name="email" type="email" autoComplete="email" required {...fields.props('email')} />
          {fields.message('email')}
        </label>
        {message && <p className={successClass} role="status">{message}</p>}
        {error != null && <p className={errorClass} role="alert">{authErrorMessage(error)}</p>}
        <button className={`${submitClass} w-full`} disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button>
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
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const fields = useFieldErrors(error)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !validToken) return
    const data = new FormData(event.currentTarget)
    setError(null)
    setPending(true)
    try {
      await resetPassword(token, String(data.get('newPassword') ?? ''))
      await queryClient.invalidateQueries({ queryKey: ['current-user'] })
      navigate('/login', { replace: true, state: { passwordUpdated: true } })
    } catch (error) {
      setError(error)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="ui-heading">Reset your password</h1>
      {validToken ? (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            New password
            <input className={fieldClass} name="newPassword" type="password" autoComplete="new-password" minLength={12}
              maxLength={128} required {...fields.props('newPassword', 'reset-password-rules')} />
            {fields.message('newPassword')}
          </label>
          <p id="reset-password-rules" className="text-sm text-secondary">Use 12 to 128 characters.</p>
          {error != null && <p className={errorClass} role="alert">{authErrorMessage(error)}</p>}
          <button className={`${submitClass} w-full`} disabled={pending}>{pending ? 'Resetting…' : 'Reset password'}</button>
        </form>
      ) : <p className={`mt-6 ${errorClass}`} role="alert">The reset link is invalid or incomplete.</p>}
      <Link to="/forgot-password" className={`mt-6 inline-block text-sm ${linkClass}`}>Request a new reset link</Link>
    </section>
  )
}
