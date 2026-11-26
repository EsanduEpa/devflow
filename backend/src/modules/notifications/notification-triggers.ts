import type { ClientSession } from 'mongoose'
import type { ProjectRecord } from '../projects/project.model.js'
import type { Realtime } from '../realtime/realtime.js'
import type { TaskRecord } from '../tasks/task.model.js'
import type { NotificationInput, NotificationRepository } from './notification.repository.js'

export function notificationTriggers(repository: NotificationRepository, live?: Realtime) {
  return {
    task(project: ProjectRecord, current: TaskRecord, actorId: string, previous: TaskRecord | null, session: ClientSession) {
      const taskId = current._id.toString()
      const occurrenceId = taskId + ':' + current.version
      const events: NotificationInput[] = []
      const assignee = current.assigneeId?.toString()
      const manager = project.managerId.toString()
      if (assignee && assignee !== actorId) {
        if (assignee !== previous?.assigneeId?.toString()) {
          events.push({ recipientId: assignee, kind: 'ASSIGNMENT', occurrenceId, taskId })
        } else if (previous?.status === 'DONE' && current.status !== 'DONE') {
          events.push({ recipientId: assignee, kind: 'REOPENED', occurrenceId, taskId })
        }
      }
      if (current.status === 'IN_REVIEW' && previous?.status !== 'IN_REVIEW' && manager !== actorId) {
        events.push({ recipientId: manager, kind: 'REVIEW', occurrenceId, taskId })
      }
      return repository.insert(events, session)
    },

    mentions(taskId: string, commentId: string, revision: number, actorId: string, introduced: string[], session: ClientSession) {
      return repository.insert(introduced.filter((id) => id !== actorId).map((recipientId) => ({
        recipientId, taskId, kind: 'MENTION', occurrenceId: commentId + ':' + revision,
      })), session)
    },

    invitation(invitationId: string, recipientId: string | undefined, actorId: string, session: ClientSession) {
      return repository.insert(recipientId && recipientId !== actorId
        ? [{ recipientId, invitationId, occurrenceId: invitationId, kind: 'INVITATION' }] : [], session)
    },

    committed<T>({ result, recipients }: { result: T; recipients: string[] }) {
      live?.notifyRecipients(recipients)
      return result
    },
  }
}

export type NotificationTriggers = ReturnType<typeof notificationTriggers>
