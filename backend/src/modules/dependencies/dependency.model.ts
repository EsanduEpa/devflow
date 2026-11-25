import { Schema, type Connection } from 'mongoose'
import type { TaskStatus } from '../tasks/task.model.js'

export const resolvedPrerequisiteStatus: TaskStatus = 'DONE'
export const dependencyPairIndex = 'unique_project_dependency_pair'

const dependencySchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, immutable: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
  prerequisiteId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
}, { versionKey: false })

dependencySchema.index({ projectId: 1, taskId: 1, prerequisiteId: 1 }, {
  unique: true, name: dependencyPairIndex,
})
dependencySchema.index({ projectId: 1, prerequisiteId: 1, taskId: 1 })

export function dependencyModel(connection: Connection, collection = 'task_dependencies') {
  return connection.model('TaskDependency', dependencySchema, collection)
}
