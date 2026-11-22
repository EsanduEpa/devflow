import { apiRequest, submitApi } from '../../shared/api'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'

export interface TaskFields {
  title: string
  description: string
  assigneeId?: string | null
  priority?: TaskPriority
  dueDate?: string | null
  status?: TaskStatus
}

export interface Task extends Required<TaskFields> {
  id: string
  projectId: string
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type TaskChanges = Partial<Omit<TaskFields, 'status'>>

export const taskKey = (userId: string, taskId: string) => ['tasks', userId, 'details', taskId] as const

export async function createTask(projectId: string, fields: TaskFields): Promise<Task> {
  const response = await submitApi(`projects/${encodeURIComponent(projectId)}/tasks`, 'POST', fields)
  return (await response.json()).data
}

export async function getTask(taskId: string, signal?: AbortSignal): Promise<Task> {
  const response = await apiRequest(`tasks/${encodeURIComponent(taskId)}`, { signal })
  return (await response.json()).data
}

export async function updateTask(taskId: string, fields: TaskChanges): Promise<Task> {
  const response = await submitApi(`tasks/${encodeURIComponent(taskId)}`, 'PATCH', fields)
  return (await response.json()).data
}

export async function deleteTask(taskId: string) {
  await submitApi(`tasks/${encodeURIComponent(taskId)}`, 'DELETE')
}
