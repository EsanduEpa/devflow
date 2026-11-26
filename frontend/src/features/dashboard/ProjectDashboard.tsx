import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CircleCheck, ListChecks, Timer } from 'lucide-react'
import { Link } from 'react-router'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, linkClass } from '../../shared/form-styles'
import { Badge, LoadingState } from '../../shared/ui'
import { SprintBadge } from '../sprints/sprint-ui'
import { taskPriorityLabels, taskPriorityTones } from '../tasks/task-labels'
import type { TaskPriority } from '../tasks/api'
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
  const projectPath = `/projects/${projectId}`

  return (
    <section aria-labelledby="project-progress" className="ui-panel min-w-0">
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
        <section aria-labelledby="priority-breakdown" className="mt-5 border-t border-line pt-4">
          <h3 id="priority-breakdown" className="font-semibold">Tasks by priority</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(taskPriorityLabels) as TaskPriority[]).map((priority) => {
              const count = values.priorityCounts[priority]
              return <li key={priority}>
                <Link to={`${projectPath}/tasks?priority=${priority}`} className="flex items-center justify-between gap-2 rounded-md border border-line p-2 hover:bg-muted"
                  aria-label={`${taskPriorityLabels[priority]} priority, ${count} ${count === 1 ? 'task' : 'tasks'}`}>
                  <Badge tone={taskPriorityTones[priority]}>{taskPriorityLabels[priority]}</Badge>
                  <span className="font-semibold tabular-nums">{count}</span>
                </Link>
              </li>
            })}
          </ul>
        </section>
        <section aria-labelledby="sprint-progress" className="mt-5 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="sprint-progress" className="font-semibold">Sprint progress</h3>
            <Link to={`${projectPath}/sprints`} className={`${linkClass} text-sm`}>View all sprints</Link>
          </div>
          {values.sprintProgress.length === 0 && <p className="mt-2 text-sm text-secondary">No sprints yet.</p>}
          <ul className="mt-2 divide-y divide-line">
            {values.sprintProgress.map((sprint) => <li key={sprint.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`${projectPath}/sprints/${sprint.id}`} className={`${linkClass} min-w-0 break-words text-sm font-semibold`}>{sprint.name}</Link>
                <SprintBadge sprint={sprint} />
              </div>
              <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-sm text-secondary">
                <span>{sprint.progress.completedTasks} of {sprint.progress.totalTasks} tasks done{sprint.status === 'COMPLETED' && ' at completion'}</span>
                <span className="tabular-nums">{sprint.progress.completionPercentage}%</span>
              </div>
              <progress aria-label={`${sprint.name} completion`} max={100} value={sprint.progress.completionPercentage}
                className="stat-progress mt-2 block h-2 w-full appearance-none overflow-hidden rounded-md bg-muted" />
              {sprint.status !== 'COMPLETED' && <Link to={`${projectPath}/tasks?sprintId=${sprint.id}`} className={`${linkClass} mt-2 inline-block text-sm`}
                aria-label={`View tasks in ${sprint.name}`}>View tasks</Link>}
            </li>)}
          </ul>
        </section>
      </>}
    </section>
  )
}
