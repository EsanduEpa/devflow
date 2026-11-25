import { apiRequest, submitApi } from '../../shared/api'

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED'
export type SprintFields = { name: string; startDate: string; endDate: string }
type SprintCounts = { totalTasks: number; completedTasks: number }
export type Sprint = SprintFields & {
  id: string
  projectId: string
  status: SprintStatus
  startedAt: string | null
  completedAt: string | null
  completionSnapshot: SprintCounts | null
  progress: SprintCounts & { unfinishedTasks: number; completionPercentage: number }
}

export type SprintPage = {
  data: Sprint[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const sprintKeys = {
  project: (userId: string, projectId: string) => ['sprints', userId, projectId] as const,
  list: (userId: string, projectId: string, page: number) => [...sprintKeys.project(userId, projectId), 'list', page] as const,
  detail: (userId: string, projectId: string, sprintId: string) => [...sprintKeys.project(userId, projectId), 'detail', sprintId] as const,
}

export async function listSprints(projectId: string, page: number, signal: AbortSignal): Promise<SprintPage> {
  const response = await apiRequest(`projects/${projectId}/sprints?page=${page}`, { signal })
  return response.json()
}

export async function getSprint(id: string, signal: AbortSignal): Promise<Sprint> {
  const response = await apiRequest(`sprints/${encodeURIComponent(id)}`, { signal })
  return (await response.json()).data
}

export async function createSprint(projectId: string, fields: SprintFields): Promise<Sprint> {
  const response = await submitApi(`projects/${projectId}/sprints`, 'POST', fields)
  return (await response.json()).data
}

export async function changeSprintState(id: string, action: 'start' | 'complete', rolloverSprintId?: string | null) {
  const body = action === 'complete' ? { rolloverSprintId } : undefined
  await submitApi(`sprints/${id}/${action}`, 'POST', body)
}

export async function changeSprintTask(id: string, taskId: string, add: boolean) {
  await submitApi(`sprints/${id}/tasks/${taskId}`, add ? 'POST' : 'DELETE')
}
