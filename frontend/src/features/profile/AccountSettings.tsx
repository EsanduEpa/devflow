import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router'
import { authErrorMessage, changePassword, updateProfile, type PublicUser } from '../auth/api'
import { cardClass, errorClass, fieldClass, linkClass, submitClass, successClass } from '../../shared/form-styles'

function EditProfile({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [bio, setBio] = useState(user.profile?.bio ?? '')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const emailChanged = email.trim().toLowerCase() !== user.email
  const nameChanged = name.trim() !== user.name
  const bioChanged = bio !== (user.profile?.bio ?? '')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setError('')
    setNotice('')
    setPending(true)
    try {
      const updated = await updateProfile({
        ...(nameChanged && { name }),
        ...(emailChanged && { email, currentPassword: String(data.get('currentPassword') ?? '') }),
        ...(bioChanged && { profile: { bio } }),
      })
      await queryClient.cancelQueries({ queryKey: ['current-user'] })
      queryClient.setQueryData(['current-user'], updated)
      setName(updated.name)
      setEmail(updated.email)
      setBio(updated.profile?.bio ?? '')
      setNotice('Profile saved.')
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={cardClass}>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Profile settings</h1>
      <form onSubmit={save} className="mt-7">
        <fieldset disabled={pending} className="space-y-4">
          <label className="block text-sm font-medium">
            Full name
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)}
              autoComplete="name" required minLength={2} maxLength={100} />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)}
              autoComplete="email" required />
          </label>
          {emailChanged && (
            <label className="block text-sm font-medium">
              Current password to change your email
              <input className={fieldClass} name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
            </label>
          )}
          <label className="block text-sm font-medium">
            Bio
            <textarea className={fieldClass} rows={3} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} />
          </label>
          {notice && <p className={successClass} role="status">{notice}</p>}
          {error && <p className={errorClass} role="alert">{error}</p>}
          <button className={submitClass} disabled={!nameChanged && !emailChanged && !bioChanged}>
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}

function ChangePasswordForm({ onChanged }: { onChanged: () => Promise<void> }) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setError('')
    setPending(true)
    try {
      await changePassword(String(data.get('currentPassword') ?? ''), String(data.get('newPassword') ?? ''))
      await onChanged()
    } catch (error) {
      setError(authErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold text-slate-950">Change password</h2>
      <p className="mt-2 text-sm text-slate-700">Changing your password signs you out on all devices.</p>
      <form onSubmit={save} className="mt-5">
        <fieldset disabled={pending} className="space-y-4">
          <label className="block text-sm font-medium">
            Current password
            <input className={fieldClass} name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
          </label>
          <label className="block text-sm font-medium">
            New password
            <input className={fieldClass} name="newPassword" type="password" autoComplete="new-password" minLength={12}
              maxLength={128} required aria-describedby="change-password-rules" />
          </label>
          <p id="change-password-rules" className="text-sm text-slate-600">Use 12 to 128 characters.</p>
          {error && <p className={errorClass} role="alert">{error}</p>}
          <button className={submitClass}>{pending ? 'Changing…' : 'Change password'}</button>
        </fieldset>
      </form>
    </section>
  )
}

export function AccountSettings({ user }: { user: PublicUser | null }) {
  const queryClient = useQueryClient()
  const [updatedEmail, setUpdatedEmail] = useState<string | null>(null)

  async function passwordChanged(email: string) {
    await queryClient.cancelQueries({ queryKey: ['current-user'] })
    setUpdatedEmail(email)
    queryClient.setQueryData(['current-user'], null)
  }

  if (updatedEmail !== null) {
    return <Navigate to="/login" replace state={{ passwordUpdated: true, email: updatedEmail }} />
  }
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="w-full max-w-md space-y-5">
      <Link to="/" className={`text-sm ${linkClass}`}>Back to home</Link>
      <EditProfile key={user.id} user={user} />
      <ChangePasswordForm key={`password:${user.id}`} onChanged={() => passwordChanged(user.email)} />
    </div>
  )
}
