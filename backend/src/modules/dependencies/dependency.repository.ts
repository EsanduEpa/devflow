import type { ClientSession, Types } from 'mongoose'
import type { TaskStatus, taskModel } from '../tasks/task.model.js'
import type { dependencyModel } from './dependency.model.js'

type Edge = { taskId: Types.ObjectId; prerequisiteId: Types.ObjectId }
type RelatedTask = { _id: Types.ObjectId; title: string; status: TaskStatus }

export function dependencyRepository(
  dependencies: ReturnType<typeof dependencyModel>, tasks: ReturnType<typeof taskModel>,
) {
  return {
    transaction<T>(operation: (session: ClientSession) => Promise<T>) {
      return dependencies.db.transaction(operation)
    },

    graph(projectId: Types.ObjectId, session: ClientSession) {
      return dependencies.find({ projectId }).select('taskId prerequisiteId -_id').session(session).lean<Edge[]>().exec()
    },

    async list(projectId: Types.ObjectId, taskId: Types.ObjectId) {
      const rows = await dependencies.aggregate<{ outgoing: boolean; related: RelatedTask }>([
        { $match: { projectId, $or: [{ taskId }, { prerequisiteId: taskId }] } },
        { $set: { outgoing: { $eq: ['$taskId', taskId] } } },
        { $set: { relatedId: { $cond: ['$outgoing', '$prerequisiteId', '$taskId'] } } },
        { $lookup: {
          from: tasks.collection.name, localField: 'relatedId', foreignField: '_id',
          pipeline: [{ $match: { projectId } }, { $project: { title: 1, status: 1 } }], as: 'related',
        } },
        { $unwind: '$related' },
        { $sort: { 'related.title': 1, 'related._id': 1 } },
        { $project: { _id: 0, outgoing: 1, related: 1 } },
      ]).exec()
      const prerequisites = []
      const dependents = []
      for (const { outgoing, related } of rows) {
        const summary = { id: related._id.toString(), title: related.title, status: related.status }
        if (outgoing) prerequisites.push(summary)
        else dependents.push(summary)
      }
      return { prerequisites, dependents }
    },

    create(projectId: Types.ObjectId, taskId: string, prerequisiteId: string, session: ClientSession) {
      return new dependencies({ projectId, taskId, prerequisiteId }).save({ session })
    },

    remove(projectId: Types.ObjectId, taskId: string, prerequisiteId: string, session: ClientSession) {
      return dependencies.deleteOne({ projectId, taskId, prerequisiteId }, { session }).exec()
    },

    removeForTask(projectId: Types.ObjectId, taskId: string, session: ClientSession) {
      return dependencies.deleteMany({ projectId, $or: [{ taskId }, { prerequisiteId: taskId }] }, { session }).exec()
    },
  }
}

export type DependencyRepository = ReturnType<typeof dependencyRepository>
