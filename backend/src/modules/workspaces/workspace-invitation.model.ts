import { Schema, type Connection } from 'mongoose'
import { emailAddress } from '../users/user.schema.js'

export const invitationRoles = ['MANAGER', 'DEVELOPER'] as const
export const invitationStatuses = ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] as const
export type InvitationStatus = typeof invitationStatuses[number]
export const invitationLifetime = 7 * 24 * 60 * 60 * 1000

const invitationSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  email: {
    type: String, required: true, trim: true, lowercase: true,
    validate: (email: string) => emailAddress.safeParse(email).success,
  },
  role: { type: String, enum: invitationRoles, required: true },
  tokenHash: { type: String, required: true, select: false },
  status: { type: String, enum: invitationStatuses, default: 'PENDING', required: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date, default: null },
}, { timestamps: true })

invitationSchema.index({ tokenHash: 1 }, { unique: true })
invitationSchema.index({ workspaceId: 1, email: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'PENDING' },
})
invitationSchema.index({ workspaceId: 1, status: 1, expiresAt: 1 })

export function workspaceInvitationModel(connection: Connection, collection = 'workspace_invitations') {
  return connection.model('WorkspaceInvitation', invitationSchema, collection)
}
