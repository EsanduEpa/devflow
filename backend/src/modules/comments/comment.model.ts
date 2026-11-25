import { Schema, type Connection } from 'mongoose'

const commentSchema = new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  mentionUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  introducedMentionUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  revision: { type: Number, required: true, min: 1, default: 1 },
}, { timestamps: true, versionKey: false })

commentSchema.index({ taskId: 1, createdAt: -1, _id: -1 })

export function commentModel(connection: Connection, collection = 'comments') {
  return connection.model('Comment', commentSchema, collection)
}
