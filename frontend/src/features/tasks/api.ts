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
  version: number
  sprintId: string | null
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type TaskChanges = Partial<Omit<TaskFields, 'status'>>

export const taskKey = (userId: string, taskId: string) => ['tasks', userId, 'details', taskId] as const
export const taskBoardKey = (userId: string, projectId: string) => ['tasks', userId, 'board', projectId] as const
export const taskListKey = (userId: string, projectId: string, query: string) => ['tasks', userId, 'list', projectId, query] as const

interface TaskListResult {
  data: Task[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export async function listTaskPage(projectId: string, query: URLSearchParams, signal: AbortSignal): Promise<TaskListResult> {
  const response = await apiRequest(`projects/${encodeURIComponent(projectId)}/tasks?${query}`, { signal })
  return response.json()
}

export async function listBoardTasks(projectId: string, signal: AbortSignal, filters = new URLSearchParams()) {
  const loadPage = (page: number) => {
    const params = new URLSearchParams(filters)
    params.set('page', String(page))
    return listTaskPage(projectId, params, signal)
  }
  const first = await loadPage(1)
  const tasks = new Map(first.data.map((task) => [task.id, task]))
  for (let page = 2; page <= first.pagination.totalPages; page++) {
    const next = await loadPage(page)
    for (const task of next.data) tasks.set(task.id, task)
  }
  return [...tasks.values()]
}

export async function createTask(projectId: string, fields: TaskFields): Promise<Task> {
  const response = await submitApi(`projects/${encodeURIComponent(projectId)}/tasks`, 'POST', fields)
  return (await response.json()).data
}

export async function getTask(taskId: string, signal?: AbortSignal): Promise<Task> {
  const response = await apiRequest(`tasks/${encodeURIComponent(taskId)}`, { signal })
  return (await response.json()).data
}

export async function updateTask(taskId: string, fields: TaskChanges, expectedVersion: number): Promise<Task> {
  const response = await submitApi(`tasks/${encodeURIComponent(taskId)}`, 'PATCH', { ...fields, expectedVersion })
  return (await response.json()).data
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, expectedVersion: number): Promise<Task> {
  const response = await submitApi(`tasks/${encodeURIComponent(taskId)}/status`, 'PATCH', { status, expectedVersion })
  return (await response.json()).data
}

export async function deleteTask(taskId: string) {
  await submitApi(`tasks/${encodeURIComponent(taskId)}`, 'DELETE')
}
