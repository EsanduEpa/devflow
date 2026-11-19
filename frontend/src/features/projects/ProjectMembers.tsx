import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass, linkClass } from '../../shared/form-styles'
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

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!candidate || change.isPending) return
    change.mutate({ type: 'add', memberId: candidate }, { onSuccess: () => setCandidate('') })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="project-members">
      <h2 id="project-members" className="text-lg font-semibold">Project members</h2>
      {members.isPending ? <p className="mt-3 text-sm" role="status">Loading project members…</p> : members.isError ? (
        <div className="mt-3">
          <p className={errorClass} role="alert">{apiErrorMessage(members.error)}</p>
          <button className={`mt-2 text-sm ${linkClass}`} onClick={() => void members.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          {members.data.length ? (
            <ul className="mt-2 divide-y divide-slate-200" aria-label="Project members">
              {members.data.map(({ user, workspaceRole, joinedAt }) => (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-950">{user.name}</p>
                    <p className="text-slate-600">{roleLabels[workspaceRole]} · Joined <time dateTime={joinedAt}>{formatDate(joinedAt)}</time></p>
                  </div>
                  {user.id === project.managerId ? <span className="font-medium text-indigo-800">Project manager</span> : workspaceMembers && (
                    <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
                      disabled={change.isPending} aria-label={`Remove ${user.name} from project`}
                      onClick={() => change.mutate({ type: 'remove', memberId: user.id })}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-600">No project members to display.</p>}
          {!!candidates?.length && (
            <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4" onSubmit={add}>
              <label className="min-w-0 flex-1 text-sm font-medium">
                Workspace member
                <select name="userId" className={fieldClass} value={candidate} onChange={(event) => setCandidate(event.target.value)} required disabled={change.isPending}>
                  <option value="">Choose someone to add</option>
                  {candidates.map(({ user, role }) => <option key={user.id} value={user.id}>{user.name} ({roleLabels[role]})</option>)}
                </select>
              </label>
              <button className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-60"
                disabled={!candidate || change.isPending}>Add member</button>
            </form>
          )}
          {workspaceMembers && !candidates?.length && <p className="mt-4 text-sm text-slate-600">Everyone in the workspace is already a project member.</p>}
          {change.error && <p className={`mt-3 ${errorClass}`} role="alert">{apiErrorMessage(change.error)}</p>}
          {change.isSuccess && <p className="mt-3 text-sm text-emerald-800" role="status">{change.variables.type === 'add' ? 'Member added.' : 'Member removed.'}</p>}
        </>
      )}
    </section>
  )
}
