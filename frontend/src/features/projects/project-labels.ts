import type { ProjectStatus } from './api'

export const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

const calendarDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })

export function formatProjectDate(date: string | null) {
  return date ? calendarDateFormat.format(new Date(`${date}T00:00:00.000Z`)) : 'Not set'
}
