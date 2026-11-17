import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass, successClass } from '../../shared/form-styles'
import { workspaceKeys } from './api'
import { createInvitation, listInvitations, type InvitationFields } from './invitation-api'
import { formatDate, invitationStatusLabels, roleLabels } from './workspace-labels'

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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="workspace-invitations">
      <h2 className="text-xl font-semibold" id="workspace-invitations">Invitations</h2>
      <form className="mt-4" onSubmit={submit}>
        <fieldset className="space-y-4" disabled={create.isPending}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Invitee email
              <input className={fieldClass} name="email" type="email" required />
            </label>
            <label className="block text-sm font-medium">
              Workspace role
              <select className={fieldClass} name="role" defaultValue="DEVELOPER">
                <option value="DEVELOPER">Developer</option>
                <option value="MANAGER">Manager</option>
              </select>
            </label>
          </div>
          {create.error && <p className={errorClass} role="alert">{apiErrorMessage(create.error)}</p>}
          <button className="rounded-lg bg-indigo-700 px-4 py-2.5 font-medium text-white hover:bg-indigo-800 disabled:opacity-65">
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
          <button type="button" className={`mt-2 ${linkClass}`} onClick={() => void copyLink(invitationUrl)}>Copy link</button>
          {copyMessage && <p className="mt-2" role="status">{copyMessage}</p>}
        </div>
      )}

      <div className="mt-6 border-t border-slate-200 pt-4">
        {list.isPending ? <p className="text-sm" role="status">Loading invitations…</p> : list.isError ? (
          <>
            <p className={errorClass} role="alert">{apiErrorMessage(list.error)}</p>
            <button className={`mt-2 text-sm ${linkClass}`} onClick={() => void list.refetch()}>Try again</button>
          </>
        ) : list.data.length === 0 ? <p className="text-sm text-slate-600">No invitations yet.</p> : (
          <ul className="divide-y divide-slate-200" aria-label="Workspace invitations">
            {list.data.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <div className="min-w-0">
                  <p className="break-all font-medium">{invitation.email}</p>
                  <p className="text-slate-600">{roleLabels[invitation.role]}</p>
                </div>
                <div className="text-slate-600">
                  <p className="font-medium text-indigo-800">{invitationStatusLabels[invitation.status]}</p>
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
