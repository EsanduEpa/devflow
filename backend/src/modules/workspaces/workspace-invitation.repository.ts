import type { userModel } from '../users/user.model.js'
import type { workspaceMemberModel } from './workspace-member.model.js'
import { invitationLifetime, type InvitationStatus, type workspaceInvitationModel } from './workspace-invitation.model.js'
import type { InvitationCreateInput } from './workspace-invitation.schemas.js'
import type { workspaceModel } from './workspace.model.js'

export function invitationRepository(
  invitations: ReturnType<typeof workspaceInvitationModel>,
  workspaces: ReturnType<typeof workspaceModel>,
  members: ReturnType<typeof workspaceMemberModel>,
  users: ReturnType<typeof userModel>,
) {
  return {
    create(workspaceId: string, invitedBy: string, fields: InvitationCreateInput['body'], tokenHash: string) {
      return invitations.db.transaction(async (session) => {
        const user = await users.findOne({ email: fields.email }).select('_id').session(session).lean().exec()
        if (user && await members.exists({ workspaceId, userId: user._id }).session(session)) {
          return { outcome: 'member' } as const
        }

        const now = new Date()
        const pending = { workspaceId, email: fields.email, status: 'PENDING' } as const
        if (await invitations.exists({ ...pending, expiresAt: { $gt: now } }).session(session)) {
          return { outcome: 'pending' } as const
        }
        await invitations.updateMany({ ...pending, expiresAt: { $lte: now } }, { $set: { status: 'EXPIRED' } }).session(session)
        const invitation = await new invitations({
          workspaceId, invitedBy, ...fields, tokenHash,
          createdAt: now,
          expiresAt: new Date(now.getTime() + invitationLifetime),
        }).save({ session })
        return { outcome: 'created', invitation } as const
      })
    },

    list(workspaceId: string, status: InvitationStatus | undefined, now: Date) {
      if (status === 'EXPIRED') {
        return invitations.find({ workspaceId, $or: [{ status }, { status: 'PENDING', expiresAt: { $lte: now } }] })
          .sort({ createdAt: -1 }).lean().exec()
      }
      return invitations.find({
        workspaceId,
        ...(status && { status }),
        ...(status === 'PENDING' && { expiresAt: { $gt: now } }),
      }).sort({ createdAt: -1 }).lean().exec()
    },

    findByTokenHash(tokenHash: string) {
      return invitations.findOne({ tokenHash }).lean().exec()
    },

    accept(tokenHash: string, userId: string) {
      return invitations.db.transaction(async (session) => {
        const invitation = await invitations.findOne({ tokenHash }).session(session).lean().exec()
        if (!invitation) return { outcome: 'missing' } as const
        if (invitation.status !== 'PENDING' || invitation.expiresAt.getTime() <= Date.now()) {
          return { outcome: 'closed' } as const
        }

        const user = await users.exists({ _id: userId, email: invitation.email }).session(session)
        if (!user) return { outcome: 'wrong-email' } as const
        const workspace = await workspaces.findById(invitation.workspaceId).session(session).lean().exec()
        if (!workspace) return { outcome: 'missing' } as const

        const membership = { workspaceId: workspace._id, userId }
        if (await members.exists(membership).session(session)) return { outcome: 'member' } as const

        const acceptedAt = new Date()
        const claim = await invitations.updateOne(
          { _id: invitation._id, status: 'PENDING', expiresAt: { $gt: acceptedAt } },
          { $set: { status: 'ACCEPTED', acceptedAt } },
        ).session(session)
        if (!claim.matchedCount) return { outcome: 'closed' } as const
        await new members({ ...membership, role: invitation.role, joinedAt: acceptedAt }).save({ session })
        return { outcome: 'accepted', workspace, role: invitation.role } as const
      })
    },
  }
}

export type InvitationRepository = ReturnType<typeof invitationRepository>
