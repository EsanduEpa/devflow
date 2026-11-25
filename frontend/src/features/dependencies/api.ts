import { apiRequest, submitApi } from '../../shared/api'
import type { TaskStatus } from '../tasks/api'

export type RelatedTask = { id: string; title: string; status: TaskStatus }
type TaskDependencies = { prerequisites: RelatedTask[]; dependents: RelatedTask[]; blocked: boolean }

export const dependencyKeys = {
  project: (userId: string, projectId: string) => ['task-dependencies', userId, projectId] as const,
  task: (userId: string, projectId: string, taskId: string) => [...dependencyKeys.project(userId, projectId), taskId] as const,
}

export async function getTaskDependencies(taskId: string, signal: AbortSignal): Promise<TaskDependencies> {
  const response = await apiRequest(`tasks/${encodeURIComponent(taskId)}/dependencies`, { signal })
  return (await response.json()).data
}

export async function changeTaskDependency(taskId: string, prerequisiteId: string, add: boolean) {
  await submitApi(
    `tasks/${encodeURIComponent(taskId)}/dependencies/${encodeURIComponent(prerequisiteId)}`,
    add ? 'POST' : 'DELETE',
  )
}
