import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authErrorMessage, changePassword, updateProfile, type PublicUser } from '../auth/api'
import { errorClass, fieldClass, submitClass, successClass } from '../../shared/form-styles'
import { PageHeader } from '../../shared/ui'
import { useFieldErrors } from '../../shared/useFieldErrors'

function EditProfile({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [bio, setBio] = useState(user.profile?.bio ?? '')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const emailChanged = email.trim().toLowerCase() !== user.email
  const nameChanged = name.trim() !== user.name
  const bioChanged = bio !== (user.profile?.bio ?? '')
  const fields = useFieldErrors(error)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setError(null)
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
      setError(error)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="ui-panel" aria-labelledby="profile-details">
      <h2 id="profile-details" className="text-lg font-semibold">Profile details</h2>
      <form onSubmit={save} className="mt-4">
        <fieldset disabled={pending} className="space-y-4">
          <label className="block text-sm font-medium">
            Full name
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)}
              autoComplete="name" required minLength={2} maxLength={100} {...fields.props('name')} />
            {fields.message('name')}
          </label>
          <label className="block text-sm font-medium">
            Email
            <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)}
              autoComplete="email" required {...fields.props('email')} />
            {fields.message('email')}
          </label>
          {emailChanged && (
            <label className="block text-sm font-medium">
              Current password to change your email
              <input className={fieldClass} name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} {...fields.props('currentPassword')} />
              {fields.message('currentPassword')}
            </label>
          )}
          <label className="block text-sm font-medium">
            Bio
            <textarea className={fieldClass} rows={3} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} {...fields.props('profile.bio')} />
            {fields.message('profile.bio')}
          </label>
          {notice && <p className={successClass} role="status">{notice}</p>}
          {error != null && <p className={errorClass} role="alert">{authErrorMessage(error)}</p>}
          <button className={submitClass} disabled={!nameChanged && !emailChanged && !bioChanged}>
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}

function ChangePasswordForm({ onChanged }: { onChanged: () => Promise<void> }) {
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const fields = useFieldErrors(error)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setError(null)
    setPending(true)
    try {
      await changePassword(String(data.get('currentPassword') ?? ''), String(data.get('newPassword') ?? ''))
      await onChanged()
    } catch (error) {
      setError(error)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="ui-panel" aria-labelledby="change-password-title">
      <h2 id="change-password-title" className="text-lg font-semibold">Change password</h2>
      <p className="mt-2 text-sm text-secondary">Changing your password signs you out on all devices.</p>
      <form onSubmit={save} className="mt-5">
        <fieldset disabled={pending} className="space-y-4">
          <label className="block text-sm font-medium">
            Current password
            <input className={fieldClass} name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} {...fields.props('currentPassword')} />
            {fields.message('currentPassword')}
          </label>
          <label className="block text-sm font-medium">
            New password
            <input className={fieldClass} name="newPassword" type="password" autoComplete="new-password" minLength={12}
              maxLength={128} required {...fields.props('newPassword', 'change-password-rules')} />
            {fields.message('newPassword')}
          </label>
          <p id="change-password-rules" className="text-sm text-secondary">Use 12 to 128 characters.</p>
          {error != null && <p className={errorClass} role="alert">{authErrorMessage(error)}</p>}
          <button className={submitClass}>{pending ? 'Changing…' : 'Change password'}</button>
        </fieldset>
      </form>
    </section>
  )
}

export function AccountSettings({ user, onPasswordChanged }: { user: PublicUser; onPasswordChanged: (email: string) => Promise<void> }) {
  return (
    <div className="w-full min-w-0 max-w-6xl space-y-5">
      <PageHeader title="Profile settings" />
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        <EditProfile key={user.id} user={user} />
        <ChangePasswordForm key={`password:${user.id}`} onChanged={() => onPasswordChanged(user.email)} />
      </div>
    </div>
  )
}
