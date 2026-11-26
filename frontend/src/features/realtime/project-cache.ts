import type { QueryClient } from '@tanstack/react-query'
import type { Task } from '../tasks/api'

export function projectQueries(client: QueryClient, userId: string, projectId: string, extraTaskIds: string[]) {
  const taskIds = new Set(extraTaskIds)
  for (const [, task] of client.getQueriesData<Task>({ queryKey: ['tasks', userId, 'details'] })) {
    if (task?.projectId === projectId) taskIds.add(task.id)
  }

  return { predicate: ({ queryKey: [group, viewer, scope, resource] }: { queryKey: readonly unknown[] }) => {
    if (viewer !== userId) return false
    switch (group) {
      case 'projects':
        return (scope === 'details' || scope === 'members') && resource === projectId
      case 'tasks':
        return scope === 'details' ? taskIds.has(String(resource)) : resource === projectId
      case 'comments':
      case 'task-activity':
        return taskIds.has(String(scope))
      case 'dashboard':
      case 'sprints':
      case 'task-dependencies':
        return scope === projectId
      default:
        return false
    }
  } }
}
