import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
import { Badge, ConfirmDialog, LoadingState } from '../../shared/ui'
import { useFieldErrors } from '../../shared/useFieldErrors'
import type { WorkspaceMember } from '../workspaces/api'
import { formatDate, roleLabels } from '../workspaces/workspace-labels'
import { addProjectMember, listProjectMembers, projectKeys, removeProjectMember, type Project } from './api'

export function ProjectMembers({ project, userId, workspaceMembers }: {
  project: Project
  userId: string
  workspaceMembers?: WorkspaceMember[]
}) {
  const queryClient = useQueryClient()
  const [candidate, setCandidate] = useState('')
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)
  const queryKey = projectKeys.members(userId, project.id)
  const members = useQuery({
    queryKey,
    queryFn: ({ signal }) => listProjectMembers(project.id, signal),
    retry: false,
    gcTime: 0,
  })
  const change = useMutation({
    mutationFn: ({ type, memberId }: { type: 'add' | 'remove'; memberId: string }) =>
      type === 'add' ? addProjectMember(project.id, memberId) : removeProjectMember(project.id, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })
  const candidates = workspaceMembers?.filter(({ user }) => !members.data?.some((member) => member.user.id === user.id))
  const fields = useFieldErrors(change.error)

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!candidate || change.isPending) return
    change.mutate({ type: 'add', memberId: candidate }, { onSuccess: () => setCandidate('') })
  }

  return (
    <section className="ui-panel" aria-labelledby="project-members">
      <h2 id="project-members" className="text-lg font-semibold">Project members</h2>
      {members.isPending ? <LoadingState>Loading project members…</LoadingState> : members.isError ? (
        <div className="mt-3">
          <p className={errorClass} role="alert">{apiErrorMessage(members.error)}</p>
          <button className={`mt-2 text-sm ${linkClass}`} onClick={() => void members.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          {members.data.length ? (
            <ul className="mt-2 divide-y divide-line" aria-label="Project members">
              {members.data.map(({ user, workspaceRole, joinedAt }) => (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-ink">{user.name}</p>
                    <p className="text-secondary">{roleLabels[workspaceRole]} · Joined <time dateTime={joinedAt}>{formatDate(joinedAt)}</time></p>
                  </div>
                  {user.id === project.managerId ? <Badge tone="accent">Project manager</Badge> : workspaceMembers && (
                    <button type="button" className="ui-button ui-danger"
                      disabled={change.isPending} aria-label={`Remove ${user.name} from project`}
                      onClick={() => { change.reset(); setRemoving(user) }}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-secondary">No project members to display.</p>}
          {!!candidates?.length && (
            <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4" onSubmit={add}>
              <label className="min-w-0 flex-1 text-sm font-medium">
                Workspace member
                <select name="userId" className={fieldClass} value={candidate} onChange={(event) => setCandidate(event.target.value)} required disabled={change.isPending} {...fields.props('userId')}>
                  <option value="">Choose someone to add</option>
                  {candidates.map(({ user, role }) => <option key={user.id} value={user.id}>{user.name} ({roleLabels[role]})</option>)}
                </select>
                {fields.message('userId')}
              </label>
              <button className="ui-button ui-primary disabled:opacity-60"
                disabled={!candidate || change.isPending}>Add member</button>
            </form>
          )}
          {workspaceMembers && !candidates?.length && <p className="mt-4 text-sm text-secondary">Everyone in the workspace is already a project member.</p>}
          {change.error && !removing && <p className={`mt-3 ${errorClass}`} role="alert">{apiErrorMessage(change.error)}</p>}
          {change.isSuccess && <p className="mt-3 text-sm text-success" role="status">{change.variables.type === 'add' ? 'Member added.' : 'Member removed.'}</p>}
        </>
      )}
      {removing && <ConfirmDialog title="Remove project member?" pending={change.isPending}
        action="Remove member" waiting="Removing…" error={change.error ? apiErrorMessage(change.error) : undefined}
        onClose={() => { change.reset(); setRemoving(null) }}
        onConfirm={() => change.mutate({ type: 'remove', memberId: removing.id }, { onSuccess: () => setRemoving(null) })}>
        <p><strong>{removing.name}</strong> will lose access through this membership. Their tasks will stay in the project and become unassigned.</p>
      </ConfirmDialog>}
    </section>
  )
}
