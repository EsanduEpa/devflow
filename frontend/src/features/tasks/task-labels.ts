import type { TaskPriority, TaskStatus } from './api'

export const taskPriorityLabels: Record<TaskPriority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' }
export const taskStatusLabels: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
}

export const taskStatusOrder: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

export const taskPriorityTones = { LOW: 'neutral', MEDIUM: 'accent', HIGH: 'warning', URGENT: 'danger' } as const
export const taskStatusTones = { BACKLOG: 'neutral', TODO: 'neutral', IN_PROGRESS: 'accent', IN_REVIEW: 'warning', DONE: 'success' } as const
