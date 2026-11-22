import type { ProjectStatus } from './api'

export const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

export const projectStatusTones = { PLANNED: 'neutral', ACTIVE: 'accent', COMPLETED: 'success', ARCHIVED: 'warning' } as const
