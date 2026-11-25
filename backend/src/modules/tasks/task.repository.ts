import { Types, type ClientSession, type PipelineStage } from 'mongoose'
import { dateAtUtcMidnight } from '../../shared/date-only.js'
import { objectId } from '../../shared/object-id.js'
import type { projectModel } from '../projects/project.model.js'
import type { TaskRecord, TaskStatus, taskModel } from './task.model.js'
import type { TaskCreateInput, TaskListInput, TaskUpdateInput } from './task.schemas.js'

export function taskListPipeline(projectId: string, { page, limit, status, priority, assigneeId, search, sprintId, unfinished }: TaskListInput['query']): PipelineStage[] {
  const exactId = search && objectId.safeParse(search).success ? new Types.ObjectId(search) : undefined
  const words = !exactId && search ? search.match(/[\p{L}\p{M}\p{N}]+/gu)?.join(' ') : undefined
  const match = {
    projectId: new Types.ObjectId(projectId),
    ...(status && { status }),
    ...(unfinished && { status: { $ne: 'DONE' } }),
    ...(sprintId && { sprintId: sprintId === 'none' ? null : new Types.ObjectId(sprintId) }),
    ...(priority && { priority }),
    ...(assigneeId && { assigneeId: assigneeId === 'unassigned' ? null : new Types.ObjectId(assigneeId) }),
    ...(exactId && { _id: exactId }),
    ...(words && { $text: { $search: words } }),
    ...(search && !exactId && !words && { _id: { $in: [] } }),
  }
  return [
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: {
      items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      count: [{ $count: 'total' }],
    } },
  ]
}

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

    async list(projectId: string, query: TaskListInput['query']) {
      const [result] = await tasks.aggregate<{ items: TaskRecord[]; count: { total: number }[] }>(taskListPipeline(projectId, query)).exec()
      return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 }
    },

    async sprintCounts(projectId: Types.ObjectId, ids: Types.ObjectId[], session?: ClientSession) {
      const counts = await tasks.aggregate<{ _id: Types.ObjectId; totalTasks: number; completedTasks: number }>([
        { $match: { projectId, sprintId: { $in: ids } } },
        { $group: {
          _id: '$sprintId',
          totalTasks: { $sum: 1 },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] } },
        } },
      ]).session(session ?? null).exec()
      return new Map(counts.map(({ _id, totalTasks, completedTasks }) => [_id.toString(), { totalTasks, completedTasks }]))
    },

    changeSprint(id: string, from: string | null, to: string | null, actorId: string, session: ClientSession) {
      return tasks.findOneAndUpdate({ _id: id, sprintId: from }, { $set: { sprintId: to, updatedBy: actorId } },
        { session, returnDocument: 'after', runValidators: true }).lean().exec()
    },

    rollOverSprint(projectId: Types.ObjectId, from: string, to: string | null, actorId: string, session: ClientSession) {
      return tasks.updateMany({ projectId, sprintId: from, status: { $ne: 'DONE' } },
        { $set: { sprintId: to, updatedBy: actorId } }, { session }).exec()
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
