import { Types, type ClientSession } from 'mongoose'
import type { PageRequest } from '../../shared/pagination.js'
import type { sprintModel } from '../sprints/sprint.model.js'
import type { userModel } from '../users/user.model.js'
import type { ActivityChange, ActivityEntry, activityModel } from './activity.model.js'

type ActivityRecord = Omit<ActivityEntry, 'actorId'> & { _id: Types.ObjectId; actorId: Types.ObjectId }

export function activityRepository(
  activity: ReturnType<typeof activityModel>, users: ReturnType<typeof userModel>, sprints: ReturnType<typeof sprintModel>,
) {
  return {
    append(entries: ActivityEntry[], session: ClientSession) {
      return activity.insertMany(entries, { session })
    },

    removeForTask(taskId: string, session: ClientSession) {
      return activity.deleteMany({ taskId }, { session }).exec()
    },

    async list(taskId: string, projectId: Types.ObjectId, { page, limit }: PageRequest) {
      const [result] = await activity.aggregate<{ items: ActivityRecord[]; count: { total: number }[] }>([
        { $match: { taskId: new Types.ObjectId(taskId) } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'total' }] } },
      ]).exec()
      const items = result?.items ?? []
      const userIds = new Set(items.map(({ actorId }) => actorId.toString()))
      const sprintIds = new Set<string>()
      for (const { changes } of items) {
        for (const { field, from, to } of changes) {
          if (field !== 'assigneeId' && field !== 'sprintId') continue
          const ids = field === 'assigneeId' ? userIds : sprintIds
          if (from) ids.add(from)
          if (to) ids.add(to)
        }
      }
      const [people, sprintRows] = await Promise.all([
        userIds.size ? users.find({ _id: { $in: [...userIds] } }).select('name').lean().exec() : [],
        sprintIds.size ? sprints.find({ projectId, _id: { $in: [...sprintIds] } }).select('name').lean().exec() : [],
      ])
      const names = new Map(people.map(({ _id, name }) => [_id.toString(), name]))
      const sprintNames = new Map(sprintRows.map(({ _id, name }) => [_id.toString(), name]))
      function renderChange(change: ActivityChange) {
        const labels = change.field === 'assigneeId' ? names : sprintNames
        if (change.field !== 'assigneeId' && change.field !== 'sprintId') return change
        return {
          ...change,
          fromLabel: change.from ? labels.get(change.from) ?? null : null,
          toLabel: change.to ? labels.get(change.to) ?? null : null,
        }
      }

      const total = result?.count[0]?.total ?? 0
      return {
        data: items.map(({ _id, taskId, actorId, action, changes, completed, createdAt }) => ({
          id: _id.toString(), taskId: taskId.toString(),
          actor: { id: actorId.toString(), name: names.get(actorId.toString()) ?? null },
          action, changes: changes.map(renderChange), completed, createdAt,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }
    },
  }
}

export type ActivityRepository = ReturnType<typeof activityRepository>
