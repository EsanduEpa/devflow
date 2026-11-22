import type { ClientSession } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import type { TaskRepository } from '../tasks/task.repository.js'
import { publicWorkspace } from './workspace.model.js'
import type { WorkspaceRepository } from './workspace.repository.js'
import type { WorkspaceCreateInput, WorkspaceMemberRoleInput, WorkspaceUpdateInput } from './workspace.schemas.js'

function workspaceNotFound() {
  return new ApiError(404, 'NOT_FOUND', 'The workspace was not found.')
}

export function workspaceService(repository: WorkspaceRepository, tasks: Pick<TaskRepository, 'unassignInWorkspace'>) {
  async function requireMembership(workspaceId: string, userId: string, session?: ClientSession) {
    const membership = await repository.findMembership(workspaceId, userId, session)
    if (!membership) throw workspaceNotFound()
    return membership
  }

  async function lockMemberships(workspaceId: string, session: ClientSession) {
    const lock = await repository.lockMemberships(workspaceId, session)
    if (!lock.matchedCount) throw workspaceNotFound()
  }

  function manageMember<T>(actorId: string, workspaceId: string, userId: string,
    operation: (membership: Awaited<ReturnType<typeof requireMembership>>, session: ClientSession) => Promise<T>) {
    return repository.transaction(async (session) => {
      const actor = await requireMembership(workspaceId, actorId, session)
      const workspace = await repository.findWorkspace(workspaceId, session)
      if (!workspace) throw workspaceNotFound()
      if (actor.role !== 'OWNER' || workspace.ownerId.toString() !== actorId) {
        throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner can manage workspace members.')
      }
      const target = await repository.findMembership(workspaceId, userId, session)
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'The workspace member was not found.')
      if (target.role === 'OWNER' || userId === workspace.ownerId.toString()) {
        throw new ApiError(409, 'INVALID_STATE', 'The workspace owner’s role and membership are protected.')
      }
      await lockMemberships(workspaceId, session)
      return operation(target, session)
    })
  }

  async function requireReassignment(workspaceId: string, userId: string, session: ClientSession) {
    const project = await repository.findManagedProject(workspaceId, userId, session)
    if (project) {
      throw new ApiError(409, 'MANAGER_REPLACEMENT_REQUIRED', `Reassign “${project.name}” and any other projects this member manages first.`)
    }
  }

  return {
    lockMemberships,
    async create(userId: string, fields: WorkspaceCreateInput['body']) {
      const { workspace, role } = await repository.create(userId, fields)
      return publicWorkspace(workspace, role)
    },

    async list(userId: string) {
      const memberships = await repository.listForUser(userId)
      return memberships.map(({ workspace, role }) => publicWorkspace(workspace, role))
    },

    async details(userId: string, workspaceId: string, session?: ClientSession) {
      const { role } = await requireMembership(workspaceId, userId, session)
      const workspace = await repository.findWorkspace(workspaceId, session)
      if (!workspace) throw workspaceNotFound()
      return publicWorkspace(workspace, role)
    },

    async listMembers(userId: string, workspaceId: string) {
      await requireMembership(workspaceId, userId)
      if (!await repository.findWorkspace(workspaceId)) throw workspaceNotFound()
      return repository.listMembers(workspaceId)
    },

    changeMemberRole(actorId: string, workspaceId: string, userId: string, role: WorkspaceMemberRoleInput['body']['role']) {
      return manageMember(actorId, workspaceId, userId, async (target, session) => {
        if (target.role === 'MANAGER' && role === 'DEVELOPER') {
          await requireReassignment(workspaceId, userId, session)
        }
        const updated = await repository.updateMemberRole(workspaceId, userId, role, session)
        if (!updated) throw new ApiError(404, 'NOT_FOUND', 'The workspace member was not found.')
        return updated
      })
    },

    removeMember(actorId: string, workspaceId: string, userId: string) {
      return manageMember(actorId, workspaceId, userId, async (_target, session) => {
        await requireReassignment(workspaceId, userId, session)
        await repository.removeProjectMemberships(workspaceId, userId, session)
        await tasks.unassignInWorkspace(workspaceId, userId, actorId, session)
        const removed = await repository.removeWorkspaceMember(workspaceId, userId, session)
        if (!removed.deletedCount) throw new ApiError(404, 'NOT_FOUND', 'The workspace member was not found.')
      })
    },

    async update(userId: string, workspaceId: string, fields: WorkspaceUpdateInput['body']) {
      const { role } = await requireMembership(workspaceId, userId)
      if (role !== 'OWNER') {
        throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner can edit these settings.')
      }
      const workspace = await repository.updateWorkspace(workspaceId, userId, fields)
      if (!workspace) throw workspaceNotFound()
      return publicWorkspace(workspace, role)
    },
  }
}

export type WorkspaceService = ReturnType<typeof workspaceService>
