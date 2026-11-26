import { mongo, type ClientSession, type Types } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import type { Realtime } from '../realtime/realtime.js'
import type { TaskService } from '../tasks/task.service.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import { dependencyPairIndex, resolvedPrerequisiteStatus } from './dependency.model.js'
import type { DependencyRepository } from './dependency.repository.js'

function reaches(graph: Map<string, Set<string>>, start: string, destination: string) {
  const pending = [start]
  const visited = new Set(pending)
  while (pending.length) {
    const current = pending.pop()!
    if (current === destination) return true
    for (const next of graph.get(current) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      pending.push(next)
    }
  }
  return false
}

const duplicate = () => new ApiError(409, 'DEPENDENCY_EXISTS', 'This prerequisite is already linked.')

export function dependencyService(
  repository: DependencyRepository,
  tasks: Pick<TaskService, 'requireAccess'>,
  workspaces: Pick<WorkspaceService, 'lockMemberships'>,
  live?: Realtime,
) {
  async function manage<T>(
    userId: string, taskId: string, prerequisiteId: string,
    operation: (projectId: Types.ObjectId, session: ClientSession) => Promise<T>,
  ) {
    const { projectId, result } = await repository.transaction(async (session) => {
      const { project, canManage } = await tasks.requireAccess(userId, taskId, session)
      if (!canManage) throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner or assigned project manager can manage dependencies.')
      if (project.status === 'ARCHIVED') {
        throw new ApiError(409, 'INVALID_STATE', 'Restore this project before changing its dependencies.')
      }
      // Graph mutations share this write lock with project access changes and task deletion.
      await workspaces.lockMemberships(project.workspaceId.toString(), session)

      const { task: prerequisite } = await tasks.requireAccess(userId, prerequisiteId, session)
      if (taskId === prerequisiteId || !prerequisite.projectId.equals(project._id)) {
        const message = 'Choose a different task in this project as the prerequisite.'
        throw new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'params.prerequisiteId', message }])
      }
      return { projectId: project._id.toString(), result: await operation(project._id, session) }
    })
    live?.publish({ projectId, kind: 'project.changed' })
    return result
  }

  return {
    async list(userId: string, taskId: string) {
      const { project, task } = await tasks.requireAccess(userId, taskId)
      const result = await repository.list(project._id, task._id)
      return { ...result, blocked: result.prerequisites.some(({ status }) => status !== resolvedPrerequisiteStatus) }
    },

    add(userId: string, taskId: string, prerequisiteId: string) {
      return manage(userId, taskId, prerequisiteId, async (projectId, session) => {
        const edges = await repository.graph(projectId, session)
        const graph = new Map<string, Set<string>>()
        for (const edge of edges) {
          const source = edge.taskId.toString()
          const links = graph.get(source) ?? new Set<string>()
          links.add(edge.prerequisiteId.toString())
          graph.set(source, links)
        }
        if (graph.get(taskId)?.has(prerequisiteId)) throw duplicate()
        if (reaches(graph, prerequisiteId, taskId)) {
          throw new ApiError(409, 'DEPENDENCY_CYCLE', 'Adding this prerequisite would create a dependency cycle.')
        }
        await repository.create(projectId, taskId, prerequisiteId, session)
        return { taskId, prerequisiteId }
      }).catch((error: unknown) => {
        if (error instanceof mongo.MongoServerError && error.code === 11000 && error.message.includes(dependencyPairIndex)) {
          throw duplicate()
        }
        throw error
      })
    },

    remove(userId: string, taskId: string, prerequisiteId: string) {
      return manage(userId, taskId, prerequisiteId, async (projectId, session) => {
        const result = await repository.remove(projectId, taskId, prerequisiteId, session)
        if (!result.deletedCount) throw new ApiError(404, 'NOT_FOUND', 'The dependency was not found.')
      })
    },
  }
}

export type DependencyService = ReturnType<typeof dependencyService>
