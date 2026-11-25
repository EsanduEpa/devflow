import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass } from '../../shared/form-styles'
import type { Project } from '../projects/api'
import type { WorkspaceRole } from '../workspaces/api'
import type { Task, TaskStatus } from './api'
import { TaskConflictNotice } from './TaskConflictNotice'
import { taskStatusLabels } from './task-labels'
import { allowedTaskStatuses, useTaskStatusMove } from './task-status-move'
import { isTaskConflict } from './useTaskConflict'

export function TaskStatusSelect({ task, destinations, disabled, onMove }: {
  task: Task
  destinations: TaskStatus[]
  disabled: boolean
  onMove: (status: TaskStatus) => void
}) {
  if (!destinations.length) return null
  return <label className="block text-xs font-medium text-secondary">
    Move to
    <select className={`${fieldClass} mt-1.5 min-h-9 px-2 py-1.5 text-xs max-sm:min-h-11`}
      aria-label={`Change status for ${task.title}`} value={task.status} disabled={disabled} data-task-status-control={task.id}
      onChange={(event) => onMove(event.target.value as TaskStatus)}>
      {destinations.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
    </select>
  </label>
}

export function TaskMoveFeedback({ mover, destinations, announceSuccess = false }: {
  mover: ReturnType<typeof useTaskStatusMove>
  destinations: TaskStatus[]
  announceSuccess?: boolean
}) {
  const { mutation, conflict } = mover
  const requested = conflict.attempt?.intent.status
  const latest = conflict.current

  return <>
    {mutation.isPending && <p className="text-xs text-secondary" role="status">Saving status…</p>}
    {announceSuccess && mutation.isSuccess && <p className="text-sm text-secondary" role="status">
      {mutation.data.title} moved to {taskStatusLabels[mutation.data.status]}.
    </p>}
    {mutation.error && !isTaskConflict(mutation.error) && <p className={errorClass} role="alert">{apiErrorMessage(mutation.error)}</p>}
    {requested && <TaskConflictNotice message={`Your requested status was ${taskStatusLabels[requested]}.`}
      pending={conflict.pending} error={conflict.error} reload={conflict.reload}>
      {latest && <p className="break-words text-sm text-ink">
        {announceSuccess && <span className="font-semibold">{latest.title}. </span>}
        Latest status is <strong>{taskStatusLabels[latest.status]}</strong>.
      </p>}
      <div className="flex flex-wrap gap-2">
        {latest && requested !== latest.status && destinations.includes(requested) &&
          <button type="button" className="ui-button ui-primary" disabled={mutation.isPending}
            onClick={() => mover.move(latest, requested, conflict.attempt?.intent.preview)}>Retry status change</button>}
        <button type="button" className="ui-button ui-secondary" disabled={mutation.isPending}
          onClick={mover.dismissConflict}>Dismiss status change</button>
      </div>
    </TaskConflictNotice>}
  </>
}

export function TaskStatusControl({ task, project, userId, role }: {
  task: Task
  project: Project
  userId: string
  role?: WorkspaceRole
}) {
  const mover = useTaskStatusMove(userId, project)
  const current = mover.conflict.current ?? task
  const destinations = allowedTaskStatuses(current, project, userId, role)
  if (!destinations.length && !mover.conflict.attempt) return null
  return <div className="mt-3 space-y-2 border-t border-line pt-2">
    <TaskStatusSelect task={current} destinations={destinations} disabled={mover.mutation.isPending || !!mover.conflict.attempt}
      onMove={(status) => mover.move(current, status)} />
    <TaskMoveFeedback mover={mover} destinations={destinations} />
  </div>
}
