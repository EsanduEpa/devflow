import { Types, type ClientSession } from 'mongoose'
import type { PageRequest } from '../../shared/pagination.js'
import type { userModel } from '../users/user.model.js'
import type { commentModel } from './comment.model.js'
import type { CommentFields } from './comment.schemas.js'

export type CommentRecord = {
  _id: Types.ObjectId
  taskId: Types.ObjectId
  authorId: Types.ObjectId
  body: string
  mentionUserIds: Types.ObjectId[]
  revision: number
  createdAt: Date
  updatedAt: Date
}

export function commentRepository(comments: ReturnType<typeof commentModel>, users: ReturnType<typeof userModel>) {
  return {
    transaction<T>(operation: (session: ClientSession) => Promise<T>) {
      return comments.db.transaction(operation)
    },

    async list(taskId: string, { page, limit }: PageRequest) {
      const [result] = await comments.aggregate<{ items: CommentRecord[]; count: { total: number }[] }>([
        { $match: { taskId: new Types.ObjectId(taskId) } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'total' }] } },
      ]).exec()
      return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 }
    },

    find(taskId: string, id: string, session: ClientSession) {
      return comments.findOne({ taskId, _id: id }).session(session).lean().exec()
    },

    create(taskId: string, authorId: string, fields: CommentFields, session: ClientSession) {
      return new comments({ taskId, authorId, ...fields, introducedMentionUserIds: fields.mentionUserIds }).save({ session })
    },

    update(taskId: string, id: string, authorId: string, fields: CommentFields, introducedMentionUserIds: string[], session: ClientSession) {
      return comments.findOneAndUpdate({ taskId, _id: id, authorId }, {
        $set: { ...fields, introducedMentionUserIds },
        $inc: { revision: 1 },
      }, { returnDocument: 'after', session, runValidators: true }).lean().exec()
    },

    remove(taskId: string, id: string, authorId: string, session: ClientSession) {
      return comments.deleteOne({ taskId, _id: id, authorId }, { session }).exec()
    },

    removeForTask(taskId: string, session: ClientSession) {
      return comments.deleteMany({ taskId }, { session }).exec()
    },

    async names(ids: Types.ObjectId[], session?: ClientSession) {
      const people = await users.find({ _id: { $in: ids } }).select('name').session(session ?? null).lean().exec()
      return new Map(people.map(({ _id, name }) => [_id.toString(), name]))
    },
  }
}

export type CommentRepository = ReturnType<typeof commentRepository>
