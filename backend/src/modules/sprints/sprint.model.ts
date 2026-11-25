import { Schema, type Connection, type Types } from 'mongoose'

export const sprintStatuses = ['PLANNED', 'ACTIVE', 'COMPLETED'] as const
export type SprintStatus = typeof sprintStatuses[number]
export type SprintCounts = { totalTasks: number; completedTasks: number }

const snapshotSchema = new Schema({
  totalTasks: { type: Number, required: true },
  completedTasks: { type: Number, required: true },
}, { _id: false })

const sprintSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, immutable: true },
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 150 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: sprintStatuses, default: 'PLANNED', required: true },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completionSnapshot: { type: snapshotSchema, default: null },
}, { timestamps: true })

sprintSchema.index({ projectId: 1, startDate: -1, _id: -1 })
export const activeSprintIndex = 'one_active_sprint_per_project'
sprintSchema.index({ projectId: 1 }, {
  name: activeSprintIndex, unique: true, partialFilterExpression: { status: 'ACTIVE' },
})

export function sprintModel(connection: Connection, collection = 'sprints') {
  return connection.model('Sprint', sprintSchema, collection)
}

export type SprintRecord = {
  _id: Types.ObjectId
  projectId: Types.ObjectId
  name: string
  startDate: Date
  endDate: Date
  status: SprintStatus
  startedAt?: Date | null
  completedAt?: Date | null
  completionSnapshot?: SprintCounts | null
  createdAt: Date
  updatedAt: Date
}

export function publicSprint(sprint: SprintRecord, counts: SprintCounts = { totalTasks: 0, completedTasks: 0 }) {
  const { totalTasks, completedTasks } = sprint.completionSnapshot ?? counts
  return {
    id: sprint._id.toString(),
    projectId: sprint.projectId.toString(),
    name: sprint.name,
    startDate: sprint.startDate.toISOString().slice(0, 10),
    endDate: sprint.endDate.toISOString().slice(0, 10),
    status: sprint.status,
    startedAt: sprint.startedAt ?? null,
    completedAt: sprint.completedAt ?? null,
    completionSnapshot: sprint.completionSnapshot ?? null,
    createdAt: sprint.createdAt,
    updatedAt: sprint.updatedAt,
    progress: {
      totalTasks,
      completedTasks,
      unfinishedTasks: totalTasks - completedTasks,
      completionPercentage: totalTasks ? Math.round(completedTasks * 10_000 / totalTasks) / 100 : 0,
    },
  }
}
