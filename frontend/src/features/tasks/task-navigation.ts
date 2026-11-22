import { matchPath, type Location } from 'react-router'

export const taskFilterKeys = ['search', 'status', 'priority', 'assigneeId'] as const

export function taskBackground(location: Location): Location | undefined {
  if (!matchPath('/tasks/:taskId', location.pathname) && !matchPath('/projects/:projectId/tasks/new', location.pathname)) return undefined
  const candidate = location.state?.taskBackground as Location | undefined
  if (typeof candidate?.pathname !== 'string') return undefined
  return ['/projects/:projectId/board', '/projects/:projectId/tasks', '/projects/:projectId', '/projects/:projectId/dashboard']
    .some((path) => matchPath(path, candidate.pathname))
    ? candidate : undefined
}
