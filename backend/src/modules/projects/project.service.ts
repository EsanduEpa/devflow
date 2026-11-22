import { mongo, type ClientSession } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import type { TaskRepository } from '../tasks/task.repository.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import { publicProject, type ProjectRecord } from './project.model.js'
import type { ProjectRepository } from './project.repository.js'
import type { ProjectCreateInput, ProjectListInput, ProjectUpdateInput } from './project.schemas.js'

function projectNotFound() {
  return new ApiError(404, 'NOT_FOUND', 'The project was not found.')
}

export function projectService(repository: ProjectRepository, workspaces: WorkspaceService, tasks: Pick<TaskRepository, 'unassignInProject'>) {
  async function requireAccess(userId: string, id: string, session?: ClientSession) {
    const project = await repository.find(id, session)
    if (!project) throw projectNotFound()

    const { myRole } = await workspaces.details(userId, project.workspaceId.toString(), session).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) throw projectNotFound()
      throw error
    })
    const canManage = myRole === 'OWNER' || (myRole === 'MANAGER' && project.managerId.toString() === userId)
    if (!canManage && !await repository.hasMembership(id, userId, session)) throw projectNotFound()
    return { project, canManage, myRole }
  }

  function manage<T>(userId: string, id: string, operation: (project: ProjectRecord, session: ClientSession) => Promise<T>) {
    return repository.transaction(async (session) => {
      const { project, canManage } = await requireAccess(userId, id, session)
      if (!canManage) throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner or assigned project manager can manage this project.')
      await workspaces.lockMemberships(project.workspaceId.toString(), session)
      return operation(project, session)
    })
  }

  async function validateManager(workspaceId: string, managerId: string, session?: ClientSession) {
    if (!await repository.findEligibleManager(workspaceId, managerId, session)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Choose an owner or manager from this workspace.', [
        { field: 'body.managerId', message: 'Choose an owner or manager from this workspace.' },
      ])
    }
  }

  return {
    requireAccess,
    async isEligibleTaskAssignee(project: ProjectRecord, memberId: string, session: ClientSession) {
      const membership = await repository.hasMembership(project._id.toString(), memberId, session)
      return !!membership && !!await repository.isWorkspaceMember(project.workspaceId, memberId, session)
    },

    create(userId: string, workspaceId: string, fields: ProjectCreateInput['body']) {
      return repository.transaction(async (session) => {
        const { myRole } = await workspaces.details(userId, workspaceId, session)
        if (myRole === 'DEVELOPER') {
          throw new ApiError(403, 'FORBIDDEN', 'Only workspace owners and managers can create projects.')
        }
        if (myRole === 'MANAGER' && fields.managerId !== userId) {
          throw new ApiError(403, 'FORBIDDEN', 'When you create a project as a workspace manager, you must assign yourself.')
        }
        await workspaces.lockMemberships(workspaceId, session)
        await validateManager(workspaceId, fields.managerId, session)
        return publicProject(await repository.create(workspaceId, fields, session))
      })
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
      const { project } = await requireAccess(userId, id)
      return publicProject(project)
    },

    update(userId: string, id: string, fields: ProjectUpdateInput['body']) {
      return manage(userId, id, async (project, session) => {
        const current = publicProject(project)
        const startDate = fields.startDate === undefined ? current.startDate : fields.startDate
        const targetDate = fields.targetDate === undefined ? current.targetDate : fields.targetDate
        if (startDate && targetDate && targetDate < startDate) {
          const message = 'Target date cannot be earlier than the start date.'
          throw new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'body.targetDate', message }])
        }
        if (fields.managerId !== undefined) {
          await validateManager(current.workspaceId, fields.managerId, session)
          await repository.ensureMember(id, fields.managerId, session)
        }
        const updated = await repository.update(id, fields, session)
        if (!updated) throw projectNotFound()
        return publicProject(updated)
      })
    },

    async listMembers(userId: string, id: string) {
      const { project } = await requireAccess(userId, id)
      return repository.listMembers(project)
    },

    addMember(userId: string, id: string, memberId: string) {
      return manage(userId, id, async (project, session) => {
        if (!await repository.isWorkspaceMember(project.workspaceId, memberId, session)) {
          const message = 'Choose someone from this workspace.'
          throw new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'body.userId', message }])
        }
        const member = await repository.addMember(id, memberId, session)
        return { id: member._id.toString(), projectId: id, userId: memberId, joinedAt: member.joinedAt }
      }).catch((error: unknown) => {
        if (error instanceof mongo.MongoServerError && error.code === 11000) {
          throw new ApiError(409, 'MEMBERSHIP_ALREADY_EXISTS', 'This person already belongs to the project.')
        }
        throw error
      })
    },

    removeMember(userId: string, id: string, memberId: string) {
      return manage(userId, id, async (project, session) => {
        if (project.managerId.toString() === memberId) {
          throw new ApiError(409, 'MANAGER_REPLACEMENT_REQUIRED', 'Assign a new project manager before removing this member.')
        }
        const result = await repository.removeMember(id, memberId, session)
        if (!result.deletedCount) throw new ApiError(404, 'NOT_FOUND', 'This person is not a member of the project.')
        await tasks.unassignInProject(id, memberId, userId, session)
      })
    },
  }
}

export type ProjectService = ReturnType<typeof projectService>
