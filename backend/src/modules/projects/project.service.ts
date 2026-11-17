import { ApiError } from '../../shared/api-error.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import { publicProject } from './project.model.js'
import type { ProjectRepository } from './project.repository.js'
import type { ProjectCreateInput, ProjectListInput } from './project.schemas.js'

function projectNotFound() {
  return new ApiError(404, 'NOT_FOUND', 'The project was not found.')
}

export function projectService(repository: ProjectRepository, workspaces: WorkspaceService) {
  return {
    async create(userId: string, workspaceId: string, fields: ProjectCreateInput['body']) {
      const { myRole } = await workspaces.details(userId, workspaceId)
      if (myRole === 'DEVELOPER') {
        throw new ApiError(403, 'FORBIDDEN', 'Only workspace owners and managers can create projects.')
      }
      if (myRole === 'MANAGER' && fields.managerId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'When you create a project as a workspace manager, you must assign yourself.')
      }
      if (!await repository.findEligibleManager(workspaceId, fields.managerId)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Choose an owner or manager from this workspace.', [
          { field: 'body.managerId', message: 'Choose an owner or manager from this workspace.' },
        ])
      }
      return publicProject(await repository.create(workspaceId, fields))
    },

    async list(userId: string, workspaceId: string, query: ProjectListInput['query']) {
      const { myRole } = await workspaces.details(userId, workspaceId)
      const { items, total } = await repository.list(workspaceId, userId, myRole, query)
      return {
        data: items.map(publicProject),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      }
    },

    async details(userId: string, id: string) {
      const project = await repository.find(id)
      if (!project) throw projectNotFound()
      const { myRole } = await workspaces.details(userId, project.workspaceId.toString()).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) throw projectNotFound()
        throw error
      })
      if (myRole === 'OWNER' || (myRole === 'MANAGER' && project.managerId.toString() === userId)) {
        return publicProject(project)
      }
      if (!await repository.hasMembership(id, userId)) throw projectNotFound()
      return publicProject(project)
    },
  }
}

export type ProjectService = ReturnType<typeof projectService>
