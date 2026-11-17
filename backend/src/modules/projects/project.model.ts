import { Schema, type Connection, type Types } from 'mongoose'

export const projectStatuses = ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const
export type ProjectStatus = typeof projectStatuses[number]

const projectSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, immutable: true },
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date, default: null },
  targetDate: { type: Date, default: null },
  status: { type: String, enum: projectStatuses, required: true, default: 'PLANNED' },
}, { timestamps: true })

projectSchema.index({ workspaceId: 1, status: 1 })
projectSchema.index({ managerId: 1, status: 1 })

export function projectModel(connection: Connection, collection = 'projects') {
  return connection.model('Project', projectSchema, collection)
}

export type ProjectRecord = {
  _id: Types.ObjectId
  workspaceId: Types.ObjectId
  name: string
  description?: string | null
  managerId: Types.ObjectId
  startDate?: Date | null
  targetDate?: Date | null
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
}

export function publicProject(project: ProjectRecord) {
  return {
    id: project._id.toString(),
    workspaceId: project.workspaceId.toString(),
    name: project.name,
    description: project.description ?? '',
    managerId: project.managerId.toString(),
    startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
    targetDate: project.targetDate?.toISOString().slice(0, 10) ?? null,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}
