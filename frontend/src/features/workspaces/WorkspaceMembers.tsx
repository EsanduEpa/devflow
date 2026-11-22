import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { Badge, ConfirmDialog, LoadingState } from '../../shared/ui'
import { useFieldErrors } from '../../shared/useFieldErrors'
import { listWorkspaceMembers, removeWorkspaceMember, updateWorkspaceMemberRole, workspaceKeys,
  type EditableWorkspaceRole, type WorkspaceMember } from './api'
import { formatDate, roleLabels } from './workspace-labels'

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
  const fields = useFieldErrors(change.error)

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
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex flex-wrap items-center gap-2" onSubmit={saveRole}>
          <select className={`${fieldClass} mt-0 w-auto py-1.5`} value={draft ?? member.role}
            aria-label={`Workspace role for ${member.user.name}`} disabled={change.isPending} {...fields.props('role')}
            onChange={(event) => {
              setDraft(event.target.value === 'MANAGER' ? 'MANAGER' : 'DEVELOPER')
              change.reset()
            }}>
            <option value="MANAGER">Manager</option>
            <option value="DEVELOPER">Developer</option>
          </select>
          <button className="ui-button ui-secondary"
            aria-label={`Save role for ${member.user.name}`} disabled={!draft || draft === member.role || change.isPending}>Save role</button>
        </form>
        <button type="button" className="ui-button ui-danger"
          aria-label={`Remove ${member.user.name} from workspace`} disabled={change.isPending}
          onClick={() => showRemoval(true)}>Remove</button>
      </div>
      {fields.message('role')}
      {change.error && !confirmRemoval && <p className={`mt-2 ${errorClass}`} role="alert">{apiErrorMessage(change.error)}</p>}
      {change.isSuccess && change.variables.type === 'role' && <p className="mt-2 text-success" role="status">Role updated.</p>}
      {confirmRemoval && <ConfirmDialog title="Remove workspace member?" action="Remove member" waiting="Removing…" pending={change.isPending}
        error={change.error ? apiErrorMessage(change.error) : undefined} onClose={() => showRemoval(false)}
        onConfirm={() => change.mutate({ type: 'remove' }, { onSuccess: () => showRemoval(false) })}>
        <p><strong>{member.user.name}</strong> will lose access to this workspace and its projects. Their tasks will stay and become unassigned.</p>
      </ConfirmDialog>}
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
    <section className="ui-panel" aria-labelledby="workspace-members">
      <h2 id="workspace-members" className="text-lg font-semibold">Members</h2>
      {members.isPending ? <LoadingState>Loading members…</LoadingState> : members.isError ? (
        <div className="mt-3">
          <p className={errorClass} role="alert">{apiErrorMessage(members.error)}</p>
          <button className={`mt-2 text-sm ${linkClass}`} onClick={() => void members.refetch()}>Try again</button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {members.data.map((member) => (
            <li key={member.user.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-medium text-ink">{member.user.name}</p>
                <p className="break-all text-secondary">{member.user.email}</p>
              </div>
              <div className="text-secondary">
                <Badge tone={member.role === 'OWNER' ? 'accent' : 'neutral'}>{roleLabels[member.role]}</Badge>
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
