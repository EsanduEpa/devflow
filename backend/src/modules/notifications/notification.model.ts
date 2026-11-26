import { Schema, type Connection } from 'mongoose'

export const notificationKinds = ['ASSIGNMENT', 'MENTION', 'REVIEW', 'DEADLINE', 'INVITATION'] as const
export type NotificationKind = typeof notificationKinds[number]

const schema = new Schema({
  recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  kind: { type: String, enum: notificationKinds, required: true, immutable: true },
  occurrenceId: { type: String, required: true, immutable: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', immutable: true },
  invitationId: { type: Schema.Types.ObjectId, ref: 'WorkspaceInvitation', immutable: true },
  createdAt: { type: Date, required: true, immutable: true },
  readAt: { type: Date, default: null },
}, { versionKey: false })

schema.index({ recipientId: 1, kind: 1, occurrenceId: 1 }, { unique: true })
schema.index({ recipientId: 1, createdAt: -1, _id: -1 })
schema.index({ recipientId: 1, readAt: 1 })

export function notificationModel(connection: Connection, collection = 'notifications') {
  return connection.model('Notification', schema, collection)
}
