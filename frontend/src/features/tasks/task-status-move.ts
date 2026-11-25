import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../shared/api'
import { activityKey } from '../activity/api'
import { dependencyKeys } from '../dependencies/api'
import { projectKeys, type Project } from '../projects/api'
import { workspaceKeys, type WorkspaceRole } from '../workspaces/api'
import { taskBoardKey, taskKey, updateTaskStatus, type Task, type TaskStatus } from './api'
import { taskStatusOrder } from './task-labels'
import { useTaskConflict } from './useTaskConflict'

const developerStatuses = taskStatusOrder.filter((status) => status !== 'DONE')

export function allowedTaskStatuses(task: Task, project: Project, userId: string, role?: WorkspaceRole): TaskStatus[] {
  if (project.status === 'ARCHIVED') return []
  if (role === 'OWNER' || (role === 'MANAGER' && project.managerId === userId)) return taskStatusOrder
  return role === 'DEVELOPER' && task.assigneeId === userId && task.status !== 'DONE' ? developerStatuses : []
}

export type TaskMove = { task: Task; status: TaskStatus; preview: boolean }

export function useTaskStatusMove(userId: string, project: Project) {
  const client = useQueryClient()
  const conflict = useTaskConflict<TaskMove>()
  const boardKey = taskBoardKey(userId, project.id)

  function refreshTaskViews(taskId: string) {
    return Promise.all([
      client.invalidateQueries({ queryKey: activityKey(userId, taskId) }),
      client.invalidateQueries({ queryKey: dependencyKeys.project(userId, project.id) }),
      client.invalidateQueries({ queryKey: boardKey }),
      client.invalidateQueries({ queryKey: ['tasks', userId, 'list', project.id] }),
      client.invalidateQueries({ queryKey: ['dashboard', userId, project.id] }),
    ])
  }

  function reconcile(task: Task) {
    client.setQueryData<Task>(taskKey(userId, task.id), (cached) => cached && cached.version > task.version ? cached : task)
    for (const [key, rows] of client.getQueriesData<Task[]>({ queryKey: boardKey })) {
      const cached = rows?.find(({ id }) => id === task.id)
      if (!rows || !cached || cached.version > task.version) continue
      const status = new URLSearchParams(typeof key[4] === 'string' ? key[4] : '').get('status')
      client.setQueryData(key, rows.flatMap((row) => {
        if (row.id !== task.id) return [row]
        return !status || status === task.status ? [task] : []
      }))
    }
    return refreshTaskViews(task.id)
  }

  const mutation = useMutation({
    mutationFn: ({ task, status }: TaskMove) => updateTaskStatus(task.id, status, task.version),
    onSuccess: async (updated) => {
      conflict.clear()
      await reconcile(updated)
    },
    onError: (error, intent) => {
      conflict.capture(error, intent.task.id, intent)
      void refreshTaskViews(intent.task.id)
      void client.invalidateQueries({ queryKey: taskKey(userId, intent.task.id) })
      if (error instanceof ApiError && [403, 404, 409].includes(error.status)) {
        void client.invalidateQueries({ queryKey: projectKeys.details(userId, project.id) })
        void client.invalidateQueries({ queryKey: workspaceKeys.members(userId, project.workspaceId) })
      }
    },
  })

  return {
    mutation,
    conflict,
    dismissConflict() {
      if (conflict.current) void reconcile(conflict.current)
      conflict.clear()
      mutation.reset()
    },
    move(task: Task, status: TaskStatus, preview = false) {
      if (task.status !== status) mutation.mutate({ task, status, preview })
    },
  }
}
