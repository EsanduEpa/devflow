import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '../../shared/api'
import { errorClass, fieldClass } from '../../shared/form-styles'
import { dependencyKeys } from '../dependencies/api'
import { activityKey } from '../activity/api'
import type { Project } from '../projects/api'
import type { WorkspaceRole } from '../workspaces/api'
import { taskBoardKey, taskKey, updateTaskStatus, type Task, type TaskStatus } from './api'
import { taskStatusLabels, taskStatusOrder } from './task-labels'

const developerStatuses = taskStatusOrder.filter((status) => status !== 'DONE')

export function TaskStatusControl({ task, project, userId, role }: {
  task: Task
  project: Project
  userId: string
  role?: WorkspaceRole
}) {
  const client = useQueryClient()
  const change = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus(task.id, status),
    onSuccess: async (updated) => {
      client.setQueryData(taskKey(userId, task.id), updated)
      await Promise.all([
        client.invalidateQueries({ queryKey: activityKey(userId, task.id) }),
        client.invalidateQueries({ queryKey: dependencyKeys.project(userId, project.id) }),
        client.invalidateQueries({ queryKey: taskBoardKey(userId, project.id) }),
        client.invalidateQueries({ queryKey: ['tasks', userId, 'list', project.id] }),
        client.invalidateQueries({ queryKey: ['dashboard', userId, project.id] }),
      ])
    },
  })
  const canManage = role === 'OWNER' || (role === 'MANAGER' && project.managerId === userId)
  const canMove = role === 'DEVELOPER' && task.assigneeId === userId && task.status !== 'DONE'
  if (project.status === 'ARCHIVED' || (!canManage && !canMove)) return null
  const destinations = canManage ? taskStatusOrder : developerStatuses

  return (
    <div className="mt-3 border-t border-line pt-2">
      <label className="block text-xs font-medium text-secondary">
        Move to
        <select className={`${fieldClass} mt-1.5 min-h-9 px-2 py-1.5 text-xs max-sm:min-h-11`}
          aria-label={`Change status for ${task.title}`} value={task.status} disabled={change.isPending}
          onChange={(event) => change.mutate(event.target.value as TaskStatus)}>
          {destinations.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}
        </select>
      </label>
      {change.isPending && <p className="mt-1 text-xs text-secondary" role="status">Saving status…</p>}
      {change.error && <p className={`mt-2 ${errorClass}`} role="alert">{apiErrorMessage(change.error)}</p>}
    </div>
  )
}
