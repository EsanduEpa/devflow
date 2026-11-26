import type { ClientSession } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import type { PageRequest } from '../../shared/pagination.js'
import type { NotificationTriggers } from '../notifications/notification-triggers.js'
import type { ProjectRecord } from '../projects/project.model.js'
import type { ProjectService } from '../projects/project.service.js'
import type { Realtime } from '../realtime/realtime.js'
import type { TaskService } from '../tasks/task.service.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import type { CommentRecord, CommentRepository } from './comment.repository.js'
import type { CommentFields } from './comment.schemas.js'

const commentNotFound = () => new ApiError(404, 'NOT_FOUND', 'The comment was not found.')

function requireEditable(project: ProjectRecord) {
  if (project.status === 'ARCHIVED') {
    throw new ApiError(409, 'INVALID_STATE', 'Restore this project before changing its comments.')
  }
}

export function commentService(
  repository: CommentRepository, tasks: Pick<TaskService, 'requireAccess'>,
  notifications: NotificationTriggers, projects: Pick<ProjectService, 'listAccessUsers'>, workspaces: Pick<WorkspaceService, 'lockMemberships'>, live?: Realtime,
) {
  async function render(records: CommentRecord[], session?: ClientSession) {
    if (!records.length) return []
    const ids = records.flatMap(({ authorId, mentionUserIds }) => [authorId, ...mentionUserIds])
    const names = await repository.names([...new Map(ids.map((id) => [id.toString(), id])).values()], session)
    return records.map(({ _id, taskId, authorId, body, mentionUserIds, createdAt, updatedAt, revision }) => ({
      id: _id.toString(),
      taskId: taskId.toString(),
      author: { id: authorId.toString(), name: names.get(authorId.toString()) ?? null },
      body,
      mentionUserIds: mentionUserIds.map(String),
      mentions: mentionUserIds.map((id) => ({ id: id.toString(), name: names.get(id.toString()) ?? null })),
      createdAt,
      updatedAt,
      revision,
    }))
  }

  async function validateMentions(project: ProjectRecord, ids: string[], session: ClientSession) {
    if (!ids.length) return
    const eligible = await projects.listAccessUsers(project, ids, session)
    if (eligible.length === ids.length) return
    const message = 'Mention only people who currently have access to this project.'
    throw new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'body.mentionUserIds', message }])
  }

  async function write<T>(
    userId: string, taskId: string, operation: (project: ProjectRecord, session: ClientSession) => Promise<{ result: T; recipients?: string[] }>,
  ) {
    const { projectId, result, recipients = [] } = await repository.transaction(async (session) => {
      const { project } = await tasks.requireAccess(userId, taskId, session)
      await workspaces.lockMemberships(project.workspaceId.toString(), session)
      return { projectId: project._id.toString(), ...await operation(project, session) }
    })
    live?.publish({ projectId, kind: 'comment.changed', taskId })
    return notifications.committed({ result, recipients })
  }

  async function requireAuthor(userId: string, taskId: string, id: string, session: ClientSession) {
    const comment = await repository.find(taskId, id, session)
    if (!comment) throw commentNotFound()
    if (comment.authorId.toString() !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the comment author can change this comment.')
    }
    return comment
  }

  return {
    async list(userId: string, taskId: string, query: PageRequest) {
      await tasks.requireAccess(userId, taskId)
      const { items, total } = await repository.list(taskId, query)
      return {
        data: await render(items),
        pagination: { ...query, total, totalPages: Math.ceil(total / query.limit) },
      }
    },

    async mentionOptions(userId: string, taskId: string) {
      const { project } = await tasks.requireAccess(userId, taskId)
      return projects.listAccessUsers(project)
    },

    create(userId: string, taskId: string, fields: CommentFields) {
      return write(userId, taskId, async (project, session) => {
        requireEditable(project)
        await validateMentions(project, fields.mentionUserIds, session)
        const created = await repository.create(taskId, userId, fields, session)
        const recipients = await notifications.mentions(taskId, created.id, created.revision, userId, fields.mentionUserIds, session)
        const [result] = await render([created], session)
        return { result, recipients }
      })
    },

    update(userId: string, taskId: string, id: string, patch: Partial<CommentFields>) {
      return write(userId, taskId, async (project, session) => {
        const previous = await requireAuthor(userId, taskId, id, session)
        requireEditable(project)
        const before = previous.mentionUserIds.map(String)
        const fields = { body: patch.body ?? previous.body, mentionUserIds: patch.mentionUserIds ?? before }
        await validateMentions(project, fields.mentionUserIds, session)
        const introduced = fields.mentionUserIds.filter((userId) => !before.includes(userId))
        const updated = await repository.update(taskId, id, userId, fields, introduced, session)
        if (!updated) throw commentNotFound()
        const recipients = await notifications.mentions(taskId, id, updated.revision, userId, introduced, session)
        const [result] = await render([updated], session)
        return { result, recipients }
      })
    },

    remove(userId: string, taskId: string, id: string) {
      return write(userId, taskId, async (project, session) => {
        await requireAuthor(userId, taskId, id, session)
        requireEditable(project)
        const deleted = await repository.remove(taskId, id, userId, session)
        if (!deleted.deletedCount) throw commentNotFound()
        return { result: undefined }
      })
    },
  }
}

export type CommentService = ReturnType<typeof commentService>
