import type { ClientSession } from 'mongoose'
import { dateAtUtcMidnight } from '../../shared/date-only.js'
import type { PageRequest } from '../../shared/pagination.js'
import type { SprintCounts, SprintStatus, sprintModel } from './sprint.model.js'
import type { SprintCreateFields } from './sprint.schemas.js'

export function sprintRepository(sprints: ReturnType<typeof sprintModel>) {
  return {
    transaction<T>(operation: (session: ClientSession) => Promise<T>) {
      return sprints.db.transaction(operation)
    },

    create(projectId: string, { startDate, endDate, name }: SprintCreateFields, session: ClientSession) {
      return new sprints({ projectId, name, startDate: dateAtUtcMidnight(startDate), endDate: dateAtUtcMidnight(endDate) })
        .save({ session })
    },

    find(id: string, session?: ClientSession) {
      return sprints.findById(id).session(session ?? null).lean().exec()
    },

    async list(projectId: string, { page, limit }: PageRequest) {
      const [items, total] = await Promise.all([
        sprints.find({ projectId }).sort({ startDate: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
        sprints.countDocuments({ projectId }).exec(),
      ])
      return { items, total }
    },

    transition(id: string, from: SprintStatus, fields: {
      status: SprintStatus; startedAt?: Date; completedAt?: Date; completionSnapshot?: SprintCounts
    }, session: ClientSession) {
      return sprints.findOneAndUpdate({ _id: id, status: from }, { $set: fields }, {
        session, returnDocument: 'after', runValidators: true,
      }).lean().exec()
    },
  }
}

export type SprintRepository = ReturnType<typeof sprintRepository>
