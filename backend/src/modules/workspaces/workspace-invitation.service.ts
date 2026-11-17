import { mongo, type Types } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import { hashToken, randomToken } from '../../shared/credentials.js'
import type { InvitationStatus } from './workspace-invitation.model.js'
import type { InvitationRepository } from './workspace-invitation.repository.js'
import type { InvitationCreateInput } from './workspace-invitation.schemas.js'
import { publicWorkspace } from './workspace.model.js'
import type { WorkspaceRepository } from './workspace.repository.js'
import type { WorkspaceService } from './workspace.service.js'

function missingInvite() {
  return new ApiError(404, 'NOT_FOUND', 'This invitation link is invalid.')
}

function closedInvite() {
  return new ApiError(410, 'INVITATION_UNAVAILABLE', 'This invitation has expired or is no longer available. Ask the workspace owner for a new link.')
}

function existingMember() {
  return new ApiError(409, 'MEMBERSHIP_ALREADY_EXISTS', 'This account already belongs to the workspace.')
}

function pendingInvite() {
  return new ApiError(409, 'INVITATION_ALREADY_EXISTS', 'A pending invitation already exists for this email.')
}

function tokenHash(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw missingInvite()
  return hashToken(token)
}

type InvitationSummary = {
  _id: Types.ObjectId
  email: string
  role: InvitationCreateInput['body']['role']
  status: InvitationStatus
  createdAt: Date
  expiresAt: Date
}

function summarize(invitation: InvitationSummary, now: Date) {
  return {
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role,
    status: invitation.status === 'PENDING' && invitation.expiresAt <= now ? 'EXPIRED' : invitation.status,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  }
}

export function invitationService(
  repository: InvitationRepository,
  workspaceRepository: WorkspaceRepository,
  workspaces: WorkspaceService,
) {
  async function requireOwner(userId: string, workspaceId: string) {
    const workspace = await workspaces.details(userId, workspaceId)
    if (workspace.myRole !== 'OWNER' || workspace.ownerId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner can manage invitations.')
    }
  }

  return {
    async create(userId: string, workspaceId: string, fields: InvitationCreateInput['body'], origin: string) {
      await requireOwner(userId, workspaceId)
      const token = randomToken()
      const result = await repository.create(workspaceId, userId, fields, hashToken(token)).catch((error: unknown) => {
        if (error instanceof mongo.MongoServerError && error.code === 11000 && error.keyPattern?.email === 1) {
          throw pendingInvite()
        }
        throw error
      })
      if (result.outcome === 'member') throw existingMember()
      if (result.outcome === 'pending') throw pendingInvite()
      const { id, email, role, status, expiresAt } = summarize(result.invitation, new Date())
      return { id, email, role, status, expiresAt, acceptUrl: new URL(`/invitations/${token}`, origin).href }
    },

    async list(userId: string, workspaceId: string, status?: InvitationStatus) {
      await requireOwner(userId, workspaceId)
      const now = new Date()
      return (await repository.list(workspaceId, status, now)).map((invitation) => summarize(invitation, now))
    },

    async preview(token: string) {
      const invitation = await repository.findByTokenHash(tokenHash(token))
      if (!invitation) throw missingInvite()
      if (invitation.status !== 'PENDING' || invitation.expiresAt.getTime() <= Date.now()) throw closedInvite()
      const workspace = await workspaceRepository.findWorkspace(invitation.workspaceId.toString())
      if (!workspace) throw missingInvite()
      const [local, domain] = invitation.email.split('@')
      return { workspaceName: workspace.name, role: invitation.role, maskedEmail: `${local[0]}***@${domain}`, expiresAt: invitation.expiresAt }
    },

    async accept(token: string, userId: string) {
      const result = await repository.accept(tokenHash(token), userId).catch((error: unknown) => {
        if (error instanceof mongo.MongoServerError && error.code === 11000 && error.keyPattern?.userId === 1) {
          throw existingMember()
        }
        throw error
      })
      switch (result.outcome) {
        case 'missing': throw missingInvite()
        case 'closed': throw closedInvite()
        case 'member': throw existingMember()
        case 'wrong-email': throw new ApiError(403, 'FORBIDDEN', 'Use the account for the email address that received this invitation.')
        case 'accepted': return publicWorkspace(result.workspace, result.role)
      }
    },
  }
}

export type InvitationService = ReturnType<typeof invitationService>
