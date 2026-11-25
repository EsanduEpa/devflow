import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass } from '../../shared/form-styles'
import { activityKey } from '../activity/api'
import { dependencyKeys } from '../dependencies/api'
import type { Project } from '../projects/api'
import type { WorkspaceRole } from '../workspaces/api'
import { taskBoardKey, taskKey, updateTaskStatus, type Task, type TaskStatus } from './api'
import { TaskConflictNotice } from './TaskConflictNotice'
import { taskStatusLabels, taskStatusOrder } from './task-labels'
import { isTaskConflict, useTaskConflict } from './useTaskConflict'

const developerStatuses = taskStatusOrder.filter((status) => status !== 'DONE')

export function TaskStatusControl({ task, project, userId, role }: {
  task: Task
  project: Project
  userId: string
  role?: WorkspaceRole
}) {
  const client = useQueryClient()
  const conflict = useTaskConflict<TaskStatus>()
  const current = conflict.current ?? task
  async function refresh(updated: Task) {
    client.setQueryData(taskKey(userId, task.id), updated)
    await Promise.all([
      client.invalidateQueries({ queryKey: activityKey(userId, task.id) }),
      client.invalidateQueries({ queryKey: dependencyKeys.project(userId, project.id) }),
      client.invalidateQueries({ queryKey: taskBoardKey(userId, project.id) }),
      client.invalidateQueries({ queryKey: ['tasks', userId, 'list', project.id] }),
      client.invalidateQueries({ queryKey: ['dashboard', userId, project.id] }),
    ])
  }
  const change = useMutation({
    mutationFn: ({ status, version }: { status: TaskStatus; version: number }) => updateTaskStatus(task.id, status, version),
    onSuccess: async (updated) => {
      conflict.clear()
      await refresh(updated)
    },
    onError: (error, { status }) => conflict.capture(error, task.id, status),
  })
  const canManage = role === 'OWNER' || (role === 'MANAGER' && project.managerId === userId)
  const canMove = project.status !== 'ARCHIVED'
    && (canManage || (role === 'DEVELOPER' && current.assigneeId === userId && current.status !== 'DONE'))
  if (!canMove && !conflict.attempt) return null
  const destinations = canManage ? taskStatusOrder : developerStatuses
  const requested = conflict.attempt?.intent

  return (
    <div className="mt-3 space-y-2 border-t border-line pt-2">
      {canMove && <label className="block text-xs font-medium text-secondary">
        Move to
        <select className={`${fieldClass} mt-1.5 min-h-9 px-2 py-1.5 text-xs max-sm:min-h-11`}
          aria-label={`Change status for ${task.title}`} value={current.status} disabled={change.isPending || !!conflict.attempt}
          onChange={(event) => change.mutate({ status: event.target.value as TaskStatus, version: current.version })}>
          {destinations.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
        </select>
      </label>}
      {change.isPending && <p className="text-xs text-secondary" role="status">Saving status…</p>}
      {change.error && !isTaskConflict(change.error) && <p className={errorClass} role="alert">{apiErrorMessage(change.error)}</p>}
      {requested && <TaskConflictNotice message={`Your requested status was ${taskStatusLabels[requested]}.`}
        pending={conflict.pending} error={conflict.error} reload={conflict.reload}>
        {conflict.current && <p className="text-sm text-ink">Latest status is <strong>{taskStatusLabels[current.status]}</strong>.</p>}
        <div className="flex flex-wrap gap-2">
          {conflict.current && canMove && requested !== current.status && destinations.includes(requested) &&
            <button type="button" className="ui-button ui-primary" disabled={change.isPending}
              onClick={() => change.mutate({ status: requested, version: current.version })}>Retry status change</button>}
          <button type="button" className="ui-button ui-secondary" disabled={change.isPending} onClick={() => {
            if (conflict.current) void refresh(conflict.current)
            conflict.clear()
            change.reset()
          }}>Dismiss status change</button>
        </div>
      </TaskConflictNotice>}
    </div>
  )
}
