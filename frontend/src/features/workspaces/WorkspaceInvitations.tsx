import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, MailPlus } from 'lucide-react'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass, successClass } from '../../shared/form-styles'
import { Badge, EmptyState, LoadingState } from '../../shared/ui'
import { useFieldErrors } from '../../shared/useFieldErrors'
import { workspaceKeys } from './api'
import { createInvitation, listInvitations, type InvitationFields } from './invitation-api'
import { formatDate, invitationStatusLabels, roleLabels } from './workspace-labels'

const invitationTones = { PENDING: 'warning', ACCEPTED: 'success', EXPIRED: 'neutral', REVOKED: 'neutral' } as const

export function WorkspaceInvitations({ userId, workspaceId }: { userId: string; workspaceId: string }) {
  const queryClient = useQueryClient()
  const [copyMessage, setCopyMessage] = useState('')
  const queryKey = workspaceKeys.invitations(userId, workspaceId)
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => listInvitations(workspaceId, signal),
    retry: false,
    gcTime: 0,
  })
  const create = useMutation({
    mutationFn: (fields: InvitationFields) => createInvitation(workspaceId, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    gcTime: 0,
  })
  const invitationUrl = create.data?.acceptUrl
  const fields = useFieldErrors(create.error)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (create.isPending) return
    const data = new FormData(event.currentTarget)
    const role = data.get('role') === 'MANAGER' ? 'MANAGER' : 'DEVELOPER'
    setCopyMessage('')
    create.mutate({ email: String(data.get('email') ?? ''), role })
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopyMessage('Invitation link copied.')
    } catch {
      setCopyMessage('Select the invitation link and copy it manually.')
    }
  }

  return (
    <section className="ui-panel" aria-labelledby="workspace-invitations">
      <h2 className="text-xl font-semibold" id="workspace-invitations">Invitations</h2>
      <form className="mt-4 max-w-2xl" onSubmit={submit}>
        <fieldset className="space-y-4" disabled={create.isPending}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Invitee email
              <input className={fieldClass} name="email" type="email" required {...fields.props('email')} />
              {fields.message('email')}
            </label>
            <label className="block text-sm font-medium">
              Workspace role
              <select className={fieldClass} name="role" defaultValue="DEVELOPER" {...fields.props('role')}>
                <option value="DEVELOPER">Developer</option>
                <option value="MANAGER">Manager</option>
              </select>
              {fields.message('role')}
            </label>
          </div>
          {create.error && <p className={errorClass} role="alert">{apiErrorMessage(create.error)}</p>}
          <button className="ui-button ui-primary"><MailPlus size={16} aria-hidden="true" />
            {create.isPending ? 'Creating…' : 'Create invitation'}
          </button>
        </fieldset>
      </form>
      {invitationUrl && (
        <div className={`mt-4 ${successClass}`}>
          <label className="block font-medium">
            Share this invitation link
            <input className={fieldClass} readOnly value={invitationUrl} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button type="button" className="ui-button ui-secondary mt-2" onClick={() => void copyLink(invitationUrl)}><Copy size={15} aria-hidden="true" />Copy link</button>
          {copyMessage && <p className="mt-2" role="status">{copyMessage}</p>}
        </div>
      )}

      <div className="mt-6 border-t border-line pt-4">
        {list.isPending ? <LoadingState>Loading invitations…</LoadingState> : list.isError ? (
          <>
            <p className={errorClass} role="alert">{apiErrorMessage(list.error)}</p>
            <button className={`mt-2 text-sm ${linkClass}`} onClick={() => void list.refetch()}>Try again</button>
          </>
        ) : list.data.length === 0 ? <EmptyState icon={<MailPlus size={18} aria-hidden="true" />} title="No invitations yet." /> : (
          <ul className="divide-y divide-line" aria-label="Workspace invitations">
            {list.data.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <div className="min-w-0">
                  <p className="break-all font-medium">{invitation.email}</p>
                  <p className="text-secondary">{roleLabels[invitation.role]}</p>
                </div>
                <div className="text-secondary">
                  <Badge tone={invitationTones[invitation.status]}>{invitationStatusLabels[invitation.status]}</Badge>
                  <p>Expires <time dateTime={invitation.expiresAt}>{formatDate(invitation.expiresAt)}</time></p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
