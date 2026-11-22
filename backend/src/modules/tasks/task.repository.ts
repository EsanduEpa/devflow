import { Types, type ClientSession } from 'mongoose'
import { dateAtUtcMidnight } from '../../shared/date-only.js'
import type { PageRequest } from '../../shared/pagination.js'
import type { projectModel } from '../projects/project.model.js'
import type { TaskRecord, TaskStatus, taskModel } from './task.model.js'
import type { TaskCreateInput, TaskUpdateInput } from './task.schemas.js'

export function taskRepository(tasks: ReturnType<typeof taskModel>, projects: ReturnType<typeof projectModel>) {
  return {
    transaction<T>(operation: (session: ClientSession) => Promise<T>) {
      return tasks.db.transaction(operation)
    },

    create(projectId: string, userId: string, { dueDate, ...fields }: TaskCreateInput['body'], session: ClientSession) {
      return new tasks({ ...fields, projectId, createdBy: userId, dueDate: dateAtUtcMidnight(dueDate ?? null) }).save({ session })
    },

    find(id: string, session?: ClientSession) {
      return tasks.findById(id).session(session ?? null).lean().exec()
    },

    async list(projectId: string, { page, limit }: PageRequest) {
      const [result] = await tasks.aggregate<{ items: TaskRecord[]; count: { total: number }[] }>([
        { $match: { projectId: new Types.ObjectId(projectId) } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          count: [{ $count: 'total' }],
        } },
      ]).exec()
      return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 }
    },

    update(id: string, userId: string, { dueDate, ...fields }: TaskUpdateInput['body'], session: ClientSession) {
      return tasks.findByIdAndUpdate(id, { $set: {
        ...fields,
        ...(dueDate !== undefined && { dueDate: dateAtUtcMidnight(dueDate) }),
        updatedBy: userId,
      } }, { session, returnDocument: 'after', runValidators: true }).lean().exec()
    },

    updateStatus(id: string, userId: string, status: TaskStatus, session: ClientSession) {
      return tasks.findByIdAndUpdate(id, { $set: { status, updatedBy: userId } },
        { session, returnDocument: 'after', runValidators: true }).lean().exec()
    },

    remove(id: string, session: ClientSession) {
      return tasks.deleteOne({ _id: id }, { session }).exec()
    },

    unassignInProject(projectId: string, assigneeId: string, actorId: string, session: ClientSession) {
      return tasks.updateMany({ projectId, assigneeId }, { $set: { assigneeId: null, updatedBy: actorId } }, { session }).exec()
    },

    async unassignInWorkspace(workspaceId: string, assigneeId: string, actorId: string, session: ClientSession) {
      const workspaceProjects = await projects.find({ workspaceId }).select('_id').session(session).lean().exec()
      await tasks.updateMany(
        { projectId: { $in: workspaceProjects.map(({ _id }) => _id) }, assigneeId },
        { $set: { assigneeId: null, updatedBy: actorId } },
        { session },
      ).exec()
    },
  }
}

export type TaskRepository = ReturnType<typeof taskRepository>
