import { useQuery } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, linkClass } from '../../shared/form-styles'
import { listWorkspaceMembers, workspaceKeys } from './api'
import { formatDate, roleLabels } from './workspace-labels'

export function WorkspaceMembers({ userId, workspaceId }: { userId: string; workspaceId: string }) {
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
          {members.data.map(({ user, role, joinedAt }) => (
            <li key={user.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-medium text-slate-950">{user.name}</p>
                <p className="break-all text-slate-600">{user.email}</p>
              </div>
              <div className="text-slate-600">
                <p className="font-medium text-indigo-800">{roleLabels[role]}</p>
                <p>Joined <time dateTime={joinedAt}>{formatDate(joinedAt)}</time></p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
