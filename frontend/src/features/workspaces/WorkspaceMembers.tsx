import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { listWorkspaceMembers, removeWorkspaceMember, updateWorkspaceMemberRole, workspaceKeys,
  type EditableWorkspaceRole, type WorkspaceMember } from './api'
import { formatDate, roleLabels } from './workspace-labels'

const controlClass = 'rounded-lg border px-3 py-1.5 font-medium disabled:opacity-50'
type MemberChange = { type: 'role'; role: EditableWorkspaceRole } | { type: 'remove' }

function MemberControls({ userId, workspaceId, member }: { userId: string; workspaceId: string; member: WorkspaceMember }) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<EditableWorkspaceRole | null>(null)
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const queryKey = workspaceKeys.members(userId, workspaceId)
  const change = useMutation({
    mutationFn: async (action: MemberChange) => {
      if (action.type === 'role') await updateWorkspaceMemberRole(workspaceId, member.user.id, action.role)
      else await removeWorkspaceMember(workspaceId, member.user.id)
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey })
      setDraft(null)
    },
  })

  function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft && draft !== member.role && !change.isPending) change.mutate({ type: 'role', role: draft })
  }

  function showRemoval(show: boolean) {
    setConfirmRemoval(show)
    change.reset()
  }

  return (
    <div className="w-full">
      {confirmRemoval ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
          <p>Remove <strong>{member.user.name}</strong> from this workspace? They will lose access to the workspace and its projects.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={`${controlClass} border-red-800 bg-red-800 text-white hover:bg-red-900`}
              disabled={change.isPending} onClick={() => change.mutate({ type: 'remove' })}>Remove member</button>
            <button type="button" className={`${controlClass} border-red-200 bg-white hover:bg-red-100`}
              disabled={change.isPending} onClick={() => showRemoval(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <form className="flex flex-wrap items-end gap-2" onSubmit={saveRole}>
            <select className={`${fieldClass} mt-0 w-auto py-1.5`} value={draft ?? member.role}
              aria-label={`Workspace role for ${member.user.name}`} disabled={change.isPending}
              onChange={(event) => {
                setDraft(event.target.value === 'MANAGER' ? 'MANAGER' : 'DEVELOPER')
                change.reset()
              }}>
              <option value="MANAGER">Manager</option>
              <option value="DEVELOPER">Developer</option>
            </select>
            <button className={`${controlClass} border-slate-300 hover:bg-slate-50`}
              aria-label={`Save role for ${member.user.name}`} disabled={!draft || draft === member.role || change.isPending}>Save role</button>
          </form>
          <button type="button" className={`${controlClass} border-red-200 text-red-800 hover:bg-red-50`}
            aria-label={`Remove ${member.user.name} from workspace`} disabled={change.isPending}
            onClick={() => showRemoval(true)}>Remove</button>
        </div>
      )}
      {change.error && <p className={`mt-2 ${errorClass}`} role="alert">{apiErrorMessage(change.error)}</p>}
      {change.isSuccess && change.variables.type === 'role' && <p className="mt-2 text-emerald-800" role="status">Role updated.</p>}
    </div>
  )
}

export function WorkspaceMembers({ userId, workspaceId, canManage = false }: { userId: string; workspaceId: string; canManage?: boolean }) {
  const members = useQuery({
    queryKey: workspaceKeys.members(userId, workspaceId),
    queryFn: ({ signal }) => listWorkspaceMembers(workspaceId, signal),
    retry: false,
    gcTime: 0,
  })

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="workspace-members">
      <h2 id="workspace-members" className="text-lg font-semibold">Members</h2>
      {members.isPending ? <p className="mt-3 text-sm" role="status">Loading members…</p> : members.isError ? (
        <div className="mt-3">
          <p className={errorClass} role="alert">{apiErrorMessage(members.error)}</p>
          <button className={`mt-2 text-sm ${linkClass}`} onClick={() => void members.refetch()}>Try again</button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-slate-200">
          {members.data.map((member) => (
            <li key={member.user.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-medium text-slate-950">{member.user.name}</p>
                <p className="break-all text-slate-600">{member.user.email}</p>
              </div>
              <div className="text-slate-600">
                <p className="font-medium text-indigo-800">{roleLabels[member.role]}</p>
                <p>Joined <time dateTime={member.joinedAt}>{formatDate(member.joinedAt)}</time></p>
              </div>
              {canManage && member.role !== 'OWNER' && <MemberControls userId={userId} workspaceId={workspaceId} member={member} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
