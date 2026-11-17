import { ApiError } from '../../shared/api-error.js'
import { publicWorkspace } from './workspace.model.js'
import type { WorkspaceRepository } from './workspace.repository.js'
import type { WorkspaceCreateInput, WorkspaceUpdateInput } from './workspace.schemas.js'

function workspaceNotFound() {
  return new ApiError(404, 'NOT_FOUND', 'The workspace was not found.')
}

export function workspaceService(repository: WorkspaceRepository) {
  async function requireMembership(workspaceId: string, userId: string) {
    const membership = await repository.findMembership(workspaceId, userId)
    if (!membership) throw workspaceNotFound()
    return membership
  }

  return {
    async create(userId: string, fields: WorkspaceCreateInput['body']) {
      const { workspace, role } = await repository.create(userId, fields)
      return publicWorkspace(workspace, role)
    },

    async list(userId: string) {
      const memberships = await repository.listForUser(userId)
      return memberships.map(({ workspace, role }) => publicWorkspace(workspace, role))
    },

    async details(userId: string, workspaceId: string) {
      const { role } = await requireMembership(workspaceId, userId)
      const workspace = await repository.findWorkspace(workspaceId)
      if (!workspace) throw workspaceNotFound()
      return publicWorkspace(workspace, role)
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
