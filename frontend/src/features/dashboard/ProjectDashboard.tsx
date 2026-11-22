import { useQuery } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, linkClass } from '../../shared/form-styles'
import { getProjectStatistics } from './api'

const metrics = [
  { key: 'totalTasks', label: 'Total tasks' },
  { key: 'completedTasks', label: 'Completed' },
  { key: 'inProgressTasks', label: 'In progress' },
  { key: 'overdueTasks', label: 'Overdue' },
] as const

export function ProjectDashboard({ projectId, userId }: { projectId: string; userId: string }) {
  const statistics = useQuery({
    queryKey: ['dashboard', userId, projectId],
    queryFn: ({ signal }) => getProjectStatistics(projectId, signal),
    retry: false,
    gcTime: 0,
  })

  return (
    <section aria-labelledby="project-progress" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <h2 id="project-progress" className="text-lg font-semibold text-slate-950">Project progress</h2>
      {statistics.isPending && <p className="mt-3 text-sm text-slate-700" role="status">Loading project progress…</p>}
      {statistics.isError && (
        <div className="mt-3 text-sm">
          <p className={errorClass} role="alert">{apiErrorMessage(statistics.error)}</p>
          <button className={`mt-2 ${linkClass}`} onClick={() => void statistics.refetch()}>Retry loading progress</button>
        </div>
      )}
      {statistics.isSuccess && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(({ key, label }) => (
              <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-sm text-slate-700">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-950">{statistics.data[key]}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2 text-sm font-medium text-slate-900">
              <label htmlFor="project-completion">Completion</label>
              <span>{statistics.data.completionPercentage}%</span>
            </div>
            <progress id="project-completion" max={100} value={statistics.data.completionPercentage}
              className="mt-2 block h-2 w-full appearance-none overflow-hidden rounded-full bg-slate-200 [&::-moz-progress-bar]:bg-indigo-700 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-indigo-700" />
          </div>
        </>
      )}
    </section>
  )
}
