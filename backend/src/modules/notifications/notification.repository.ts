import { Types, type ClientSession } from 'mongoose'
import type { PageRequest } from '../../shared/pagination.js'
import type { NotificationKind, notificationModel } from './notification.model.js'

export type NotificationInput = {
  recipientId: string
  kind: NotificationKind
  occurrenceId: string
  taskId?: string
  invitationId?: string
}

export type NotificationRecord = {
  _id: Types.ObjectId
  kind: NotificationKind
  taskId?: Types.ObjectId | null
  invitationId?: Types.ObjectId | null
  createdAt: Date
  readAt?: Date | null
}

export function notificationRepository(notifications: ReturnType<typeof notificationModel>) {
  return {
    async insert(events: NotificationInput[], session: ClientSession) {
      if (!events.length) return []
      const createdAt = new Date()
      const result = await notifications.bulkWrite(events.map(({ recipientId, kind, occurrenceId, ...links }) => ({
        updateOne: {
          filter: { recipientId, kind, occurrenceId },
          update: { $setOnInsert: { ...links, createdAt, readAt: null } },
          upsert: true,
        },
      })), { session })
      return [...new Set(Object.keys(result.upsertedIds).map((index) => events[Number(index)].recipientId))]
    },

    exists({ recipientId, kind, occurrenceId }: NotificationInput) {
      return notifications.exists({ recipientId, kind, occurrenceId }).exec()
    },

    async list(recipientId: string, { page, limit }: PageRequest) {
      const [result] = await notifications.aggregate<{ items: NotificationRecord[]; count: { total: number }[] }>([
        { $match: { recipientId: new Types.ObjectId(recipientId) } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          count: [{ $count: 'total' }],
        } },
      ]).exec()
      return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 }
    },

    countUnread(recipientId: string) {
      return notifications.countDocuments({ recipientId, readAt: null }).exec()
    },

    async markRead(recipientId: string, id: string) {
      const notification = await notifications.findOneAndUpdate(
        { _id: id, recipientId, readAt: null }, { $set: { readAt: new Date() } },
        { returnDocument: 'after' },
      ).lean().exec()
      if (notification) return { notification, changed: true }
      return { notification: await notifications.findOne({ _id: id, recipientId }).lean().exec(), changed: false }
    },
  }
}

export type NotificationRepository = ReturnType<typeof notificationRepository>
