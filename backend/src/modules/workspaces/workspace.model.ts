import { Schema, type Connection, type Types } from 'mongoose'
import type { WorkspaceRole } from './workspace-member.model.js'

const workspaceSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
}, { timestamps: true })

workspaceSchema.index({ ownerId: 1 })

export function workspaceModel(connection: Connection, collection = 'workspaces') {
  return connection.model('Workspace', workspaceSchema, collection)
}

export type WorkspaceRecord = {
  _id: Types.ObjectId
  name: string
  description?: string | null
  ownerId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export function publicWorkspace(workspace: WorkspaceRecord, myRole: WorkspaceRole) {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    description: workspace.description ?? '',
    ownerId: workspace.ownerId.toString(),
    myRole,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  }
}
