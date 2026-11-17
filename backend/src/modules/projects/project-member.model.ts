import { Schema, type Connection } from 'mongoose'

const projectMemberSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  joinedAt: { type: Date, required: true, default: Date.now },
})

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true })
projectMemberSchema.index({ userId: 1, projectId: 1 })

export function projectMemberModel(connection: Connection, collection = 'project_members') {
  return connection.model('ProjectMember', projectMemberSchema, collection)
}
