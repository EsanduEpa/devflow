import { Schema, type Connection, type Types } from 'mongoose'

const actions = ['TASK_CREATED', 'TASK_UPDATED'] as const
const fields = ['assigneeId', 'priority', 'status', 'sprintId'] as const

export type ActivityChange = { field: typeof fields[number]; from: string | null; to: string | null }
export type ActivityEntry = {
  taskId: Types.ObjectId
  actorId: string
  action: typeof actions[number]
  changes: ActivityChange[]
  completed: boolean
  createdAt: Date
}

const changeSchema = new Schema({
  field: { type: String, enum: fields, required: true },
  from: { type: String, default: null },
  to: { type: String, default: null },
}, { _id: false })

const activitySchema = new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  action: { type: String, enum: actions, required: true, immutable: true },
  changes: { type: [changeSchema], required: true, immutable: true },
  completed: { type: Boolean, required: true, immutable: true },
  createdAt: { type: Date, required: true, immutable: true },
}, { versionKey: false })

activitySchema.index({ taskId: 1, createdAt: -1, _id: -1 })

export function activityModel(connection: Connection, collection = 'task_activity') {
  return connection.model('TaskActivity', activitySchema, collection)
}
