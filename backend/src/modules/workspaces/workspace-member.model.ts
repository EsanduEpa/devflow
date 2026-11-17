import { Schema, type Connection } from 'mongoose'

export const workspaceRoles = ['OWNER', 'MANAGER', 'DEVELOPER'] as const
export type WorkspaceRole = typeof workspaceRoles[number]

const workspaceMemberSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: workspaceRoles, required: true },
  joinedAt: { type: Date, required: true, default: Date.now },
})

workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true })
workspaceMemberSchema.index({ userId: 1, workspaceId: 1 })
workspaceMemberSchema.index({ workspaceId: 1 }, {
  unique: true,
  partialFilterExpression: { role: 'OWNER' },
})

export function workspaceMemberModel(connection: Connection, collection = 'workspace_members') {
  return connection.model('WorkspaceMember', workspaceMemberSchema, collection)
}
