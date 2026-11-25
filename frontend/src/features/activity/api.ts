import { apiRequest } from '../../shared/api'
import type { TaskPriority, TaskStatus } from '../tasks/api'

type Change<Value> = { from: Value | null; to: Value | null }
type ReferenceChange = Change<string> & { fromLabel: string | null; toLabel: string | null }
export type ActivityChange =
  | (Change<TaskStatus> & { field: 'status' })
  | (Change<TaskPriority> & { field: 'priority' })
  | (ReferenceChange & { field: 'assigneeId' | 'sprintId' })

export type ActivityEntry = {
  id: string
  taskId: string
  actor: { id: string; name: string | null }
  action: 'TASK_CREATED' | 'TASK_UPDATED'
  changes: ActivityChange[]
  completed: boolean
  createdAt: string
}

type ActivityPage = {
  data: ActivityEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const activityKey = (userId: string, taskId: string) => ['task-activity', userId, taskId] as const

export async function listActivity(taskId: string, page: number, signal: AbortSignal): Promise<ActivityPage> {
  const response = await apiRequest(`tasks/${encodeURIComponent(taskId)}/activity?page=${page}`, { signal })
  return response.json()
}
