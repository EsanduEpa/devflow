import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CircleCheck, ListChecks, Timer } from 'lucide-react'
import { apiErrorMessage } from '../../shared/api'
import { errorClass } from '../../shared/form-styles'
import { LoadingState } from '../../shared/ui'
import { getProjectStatistics } from './api'

const metrics = [
  { key: 'totalTasks', label: 'Total tasks', icon: ListChecks, color: 'text-accent-ink bg-selected' },
  { key: 'completedTasks', label: 'Completed', icon: CircleCheck, color: 'text-success bg-success-surface' },
  { key: 'inProgressTasks', label: 'In progress', icon: Timer, color: 'text-accent-ink bg-selected' },
  { key: 'overdueTasks', label: 'Overdue', icon: CalendarClock, color: 'text-danger bg-danger-surface' },
] as const

export function ProjectDashboard({ projectId, userId }: { projectId: string; userId: string }) {
  const statistics = useQuery({
    queryKey: ['dashboard', userId, projectId],
    queryFn: ({ signal }) => getProjectStatistics(projectId, signal), retry: false, gcTime: 0,
  })
  const values = statistics.data

  return (
    <section aria-labelledby="project-progress" className="ui-panel">
      <h2 id="project-progress" className="text-lg font-semibold">Project progress</h2>
      {statistics.isPending && <LoadingState>Loading project progress…</LoadingState>}
      {statistics.isError && <div className="mt-3">
        <p className={errorClass} role="alert">{apiErrorMessage(statistics.error)}</p>
        <button className="ui-button ui-secondary mt-3" onClick={() => void statistics.refetch()}>Retry loading progress</button>
      </div>}
      {values && <>
        <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {metrics.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="min-w-0 rounded-lg border border-line bg-app p-3">
              <dt className="break-words text-xs font-medium text-secondary sm:text-sm">
                <span className={`mb-2 flex size-8 items-center justify-center rounded-md ${color}`}><Icon size={16} aria-hidden="true" /></span>{label}
              </dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{values[key]}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 text-sm font-semibold">
            <label htmlFor="project-completion">Completion</label>
            <span className="tabular-nums text-accent-ink">{values.completionPercentage}%</span>
          </div>
          <progress id="project-completion" max={100} value={values.completionPercentage}
            className="stat-progress mt-2 block h-2 w-full appearance-none overflow-hidden rounded-md bg-muted" />
          {values.totalTasks === 0 && <p className="mt-2 text-xs text-secondary">This project has no tasks yet.</p>}
        </div>
      </>}
    </section>
  )
}
