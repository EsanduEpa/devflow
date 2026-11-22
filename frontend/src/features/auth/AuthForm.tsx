import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router'
import { authErrorMessage, login, register } from './api'
import { readInvitationToken } from './invitation-return'
import { cardClass, errorClass, fieldClass, linkClass, submitClass, successClass } from '../../shared/form-styles'
import { useFieldErrors } from '../../shared/useFieldErrors'

export function AuthForm({ isRegistration = false, onLogin }: { isRegistration?: boolean; onLogin?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const invitationToken = readInvitationToken(location.state)
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const title = isRegistration ? 'Create an account' : 'Log in'
  const fields = useFieldErrors(error)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    setError(null)
    setPending(true)

    try {
      if (isRegistration) {
        await register({ name: String(form.get('name') ?? ''), email, password })
        navigate('/login', { replace: true, state: { registered: true, email, invitationToken } })
      } else {
        const user = await login({ email, password })
        await queryClient.cancelQueries({ queryKey: ['current-user'] })
        onLogin?.()
        queryClient.setQueryData(['current-user'], user)
      }
    } catch (error) {
      setError(error)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="ui-heading">{title}</h1>
      {!isRegistration && location.state?.registered && (
        <p className={`mt-4 ${successClass}`} role="status">
          Your account is ready. Log in to continue.
        </p>
      )}
      {!isRegistration && location.state?.passwordUpdated && (
        <p className={`mt-4 ${successClass}`} role="status">Your password was updated. Log in with your new password.</p>
      )}
      {!isRegistration && location.state?.sessionEnded && (
        <p className={`mt-4 ${errorClass}`} role="status">Your session ended. Log in to continue.</p>
      )}
      <form onSubmit={submit} className="mt-5 space-y-4">
        {isRegistration && (
          <label className="block text-sm font-medium">
            Full name
            <input className={fieldClass} name="name" autoComplete="name" required minLength={2} maxLength={100} {...fields.props('name')} />
            {fields.message('name')}
          </label>
        )}
        <label className="block text-sm font-medium">
          Email
          <input className={fieldClass} name="email" type="email" autoComplete="email" required defaultValue={location.state?.email} {...fields.props('email')} />
          {fields.message('email')}
        </label>
        <label className="block text-sm font-medium">
          Password
          <input className={fieldClass} type="password" name="password" required minLength={isRegistration ? 12 : undefined} maxLength={128}
            autoComplete={isRegistration ? 'new-password' : 'current-password'} {...fields.props('password', isRegistration ? 'password-rules' : undefined)} />
          {fields.message('password')}
        </label>
        {isRegistration && <p id="password-rules" className="text-sm text-secondary">Use 12 to 128 characters.</p>}
        {!isRegistration && <Link to="/forgot-password" className={`block text-sm ${linkClass}`}>Forgot password?</Link>}
        {error != null && <p className={errorClass} role="alert">{authErrorMessage(error)}</p>}
        <button disabled={pending} className={`${submitClass} w-full`}>
          {pending ? (isRegistration ? 'Creating account…' : 'Logging in…') : title}
        </button>
      </form>
      <p className="mt-6 text-sm text-secondary">
        {isRegistration ? 'Already have an account? ' : 'New to DevFlow? '}
        <Link to={isRegistration ? '/login' : '/register'} state={{ invitationToken }} className={linkClass}>
          {isRegistration ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </section>
  )
}
