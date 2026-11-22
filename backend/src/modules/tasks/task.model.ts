import { Schema, type Connection, type Types } from 'mongoose'

export const taskPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export const taskStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const

const taskSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, immutable: true },
  title: { type: String, trim: true, minlength: 3, maxlength: 200, required: true },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  priority: { type: String, enum: taskPriorities, default: 'MEDIUM', required: true },
  status: { type: String, enum: taskStatuses, default: 'BACKLOG', required: true },
  dueDate: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

taskSchema.index({ projectId: 1, status: 1 })
taskSchema.index({ projectId: 1, assigneeId: 1 })
taskSchema.index({ projectId: 1, priority: 1 })
taskSchema.index({ projectId: 1, dueDate: 1 })
taskSchema.index({ projectId: 1, title: 'text' })

export function taskModel(connection: Connection, collection = 'tasks') {
  return connection.model('Task', taskSchema, collection)
}

type TaskRecord = {
  _id: Types.ObjectId
  projectId: Types.ObjectId
  title: string
  description?: string | null
  assigneeId?: Types.ObjectId | null
  priority: typeof taskPriorities[number]
  status: typeof taskStatuses[number]
  dueDate?: Date | null
  createdBy: Types.ObjectId
  updatedBy?: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

export function publicTask(task: TaskRecord) {
  return {
    id: task._id.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    description: task.description ?? '',
    assigneeId: task.assigneeId?.toString() ?? null,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
    createdBy: task.createdBy.toString(),
    updatedBy: task.updatedBy?.toString() ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}
