import { apiRequest } from '../../shared/api'
import type { Sprint } from '../sprints/api'
import type { TaskPriority } from '../tasks/api'

export interface ProjectStatistics {
  projectId: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  completionPercentage: number
  priorityCounts: Record<TaskPriority, number>
  sprintProgress: Sprint[]
}

export async function getProjectStatistics(projectId: string, signal: AbortSignal): Promise<ProjectStatistics> {
  const response = await apiRequest(`projects/${encodeURIComponent(projectId)}/dashboard`, { signal })
  return (await response.json()).data
}
