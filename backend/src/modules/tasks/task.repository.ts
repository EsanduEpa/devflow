import { Types, type ClientSession, type PipelineStage, type QueryFilter } from 'mongoose'
import type { ActivityChange } from '../activity/activity.model.js'
import type { ActivityRepository } from '../activity/activity.repository.js'
import { resolvedPrerequisiteStatus, type dependencyModel } from '../dependencies/dependency.model.js'
import { dateAtUtcMidnight } from '../../shared/date-only.js'
import { objectId } from '../../shared/object-id.js'
import type { projectModel } from '../projects/project.model.js'
import type { TaskRecord, TaskStatus, taskModel } from './task.model.js'
import type { TaskCreateInput, TaskListInput, TaskUpdateFields } from './task.schemas.js'

export function taskListPipeline(
  projectId: string, { page, limit, status, priority, assigneeId, search, sprintId, unfinished, blocked }: TaskListInput['query'],
  collections: { tasks: string; dependencies: string },
): PipelineStage[] {
  const project = new Types.ObjectId(projectId)
  const exactId = search && objectId.safeParse(search).success ? new Types.ObjectId(search) : undefined
  const words = !exactId && search ? search.match(/[\p{L}\p{M}\p{N}]+/gu)?.join(' ') : undefined
  const match = {
    projectId: project,
    ...(status && { status }),
    ...(unfinished && { status: { $ne: 'DONE' } }),
    ...(sprintId && { sprintId: sprintId === 'none' ? null : new Types.ObjectId(sprintId) }),
    ...(priority && { priority }),
    ...(assigneeId && { assigneeId: assigneeId === 'unassigned' ? null : new Types.ObjectId(assigneeId) }),
    ...(exactId && { _id: exactId }),
    ...(words && { $text: { $search: words } }),
    ...(search && !exactId && !words && { _id: { $in: [] } }),
  }
  const pipeline: PipelineStage[] = [{ $match: match }, { $sort: { createdAt: -1, _id: -1 } }]
  if (blocked !== undefined) {
    pipeline.push({ $lookup: {
      from: collections.dependencies, localField: '_id', foreignField: 'taskId', as: 'unresolvedEdges',
      pipeline: [
        { $match: { projectId: project } },
        { $lookup: {
          from: collections.tasks, localField: 'prerequisiteId', foreignField: '_id', as: 'prerequisite',
          pipeline: [{ $match: { projectId: project, status: { $ne: resolvedPrerequisiteStatus } } }, { $project: { _id: 1 } }],
        } },
        { $match: { 'prerequisite.0': { $exists: true } } },
        { $limit: 1 },
        { $project: { _id: 1 } },
      ],
    } }, { $match: { 'unresolvedEdges.0': { $exists: blocked } } }, { $unset: 'unresolvedEdges' })
  }
  pipeline.push({ $facet: {
    items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
    count: [{ $count: 'total' }],
  } })
  return pipeline
}

function versionFilter(expectedVersion?: number): QueryFilter<TaskRecord> {
  if (expectedVersion === undefined) return {}
  if (expectedVersion === 0) return { $or: [{ version: 0 }, { version: { $exists: false } }] }
  return { version: expectedVersion }
}

export function taskRepository(
  tasks: ReturnType<typeof taskModel>, projects: ReturnType<typeof projectModel>, activity: Pick<ActivityRepository, 'append'>,
  dependencies: ReturnType<typeof dependencyModel>,
) {
  const collections = { tasks: tasks.collection.name, dependencies: dependencies.collection.name }
  async function updateManyWithActivity(
    filter: QueryFilter<TaskRecord>, change: ActivityChange, actorId: string, session: ClientSession,
  ) {
    // The surrounding workspace lock keeps this set stable through the update and history insert.
    const affected = await tasks.find(filter).select('_id').session(session).lean().exec()
    if (!affected.length) return
    const createdAt = new Date()
    await tasks.updateMany(filter, {
      $set: { [change.field]: change.to, updatedBy: actorId, updatedAt: createdAt },
      $inc: { version: 1 },
    }, { session, timestamps: false }).exec()
    await activity.append(affected.map(({ _id }) => ({
      taskId: _id, actorId, action: 'TASK_UPDATED', changes: [change], completed: false, createdAt,
    })), session)
  }

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
      const [result] = await tasks.aggregate<{ items: TaskRecord[]; count: { total: number }[] }>(taskListPipeline(projectId, query, collections)).exec()
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

    changeSprint(
      id: string, from: string | null, to: string | null, actorId: string, session: ClientSession, expectedVersion?: number,
    ) {
      return tasks.findOneAndUpdate({ _id: id, sprintId: from, ...versionFilter(expectedVersion) }, {
        $set: { sprintId: to, updatedBy: actorId },
        $inc: { version: 1 },
      }, { session, returnDocument: 'after', runValidators: true }).lean().exec()
    },

    rollOverSprint(projectId: Types.ObjectId, from: string, to: string | null, actorId: string, session: ClientSession) {
      return updateManyWithActivity(
        { projectId, sprintId: from, status: { $ne: 'DONE' } }, { field: 'sprintId', from, to }, actorId, session,
      )
    },

    update(id: string, userId: string, { dueDate, ...fields }: TaskUpdateFields, session: ClientSession, expectedVersion?: number) {
      return tasks.findOneAndUpdate({ _id: id, ...versionFilter(expectedVersion) }, {
        $set: {
          ...fields,
          ...(dueDate !== undefined && { dueDate: dateAtUtcMidnight(dueDate) }),
          updatedBy: userId,
        },
        $inc: { version: 1 },
      }, { session, returnDocument: 'after', runValidators: true }).lean().exec()
    },

    updateStatus(id: string, userId: string, status: TaskStatus, session: ClientSession, expectedVersion?: number) {
      return tasks.findOneAndUpdate({ _id: id, ...versionFilter(expectedVersion) }, {
        $set: { status, updatedBy: userId },
        $inc: { version: 1 },
      }, { session, returnDocument: 'after', runValidators: true }).lean().exec()
    },

    remove(id: string, session: ClientSession) {
      return tasks.deleteOne({ _id: id }, { session }).exec()
    },

    unassignInProject(projectId: string, assigneeId: string, actorId: string, session: ClientSession) {
      return updateManyWithActivity(
        { projectId, assigneeId }, { field: 'assigneeId', from: assigneeId, to: null }, actorId, session,
      )
    },

    async unassignInWorkspace(workspaceId: string, assigneeId: string, actorId: string, session: ClientSession) {
      const workspaceProjects = await projects.find({ workspaceId }).select('_id').session(session).lean().exec()
      await updateManyWithActivity(
        { projectId: { $in: workspaceProjects.map(({ _id }) => _id) }, assigneeId },
        { field: 'assigneeId', from: assigneeId, to: null }, actorId, session,
      )
    },
  }
}

export type TaskRepository = ReturnType<typeof taskRepository>
