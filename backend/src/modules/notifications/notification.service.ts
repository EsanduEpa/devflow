import type { PageRequest } from '../../shared/pagination.js'
import { ApiError } from '../../shared/api-error.js'
import type { ProjectService } from '../projects/project.service.js'
import type { Realtime } from '../realtime/realtime.js'
import type { taskModel } from '../tasks/task.model.js'
import type { PublicUser } from '../users/user.model.js'
import type { workspaceInvitationModel } from '../workspaces/workspace-invitation.model.js'
import type { workspaceModel } from '../workspaces/workspace.model.js'
import type { NotificationRecord, NotificationRepository } from './notification.repository.js'

export function notificationService(
  repository: NotificationRepository, tasks: ReturnType<typeof taskModel>, projects: ProjectService,
  invitations: ReturnType<typeof workspaceInvitationModel>, workspaces: ReturnType<typeof workspaceModel>, live?: Realtime,
) {
  async function render(user: PublicUser, items: NotificationRecord[]) {
    const taskIds = items.flatMap(({ taskId }) => taskId ? [taskId] : [])
    const inviteIds = items.flatMap(({ invitationId }) => invitationId ? [invitationId] : [])
    const [linkedTasks, invites] = await Promise.all([
      taskIds.length ? tasks.find({ _id: { $in: taskIds } }).select('title projectId').lean().exec() : [],
      inviteIds.length ? invitations.find({
        _id: { $in: inviteIds }, email: user.email, status: 'PENDING', expiresAt: { $gt: new Date() },
      }).select('workspaceId').lean().exec() : [],
    ])
    const projectIds = [...new Set(linkedTasks.map(({ projectId }) => projectId.toString()))]
    const [access, workspaceNames] = await Promise.all([
      Promise.all(projectIds.map(async (id) => {
        try {
          await projects.requireAccess(user.id, id)
          return id
        } catch (error) {
          if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null
          throw error
        }
      })),
      invites.length ? workspaces.find({ _id: { $in: invites.map(({ workspaceId }) => workspaceId) } }).select('name').lean().exec() : [],
    ])
    const authorized = new Set(access)
    const visibleTasks = new Map(linkedTasks.filter(({ projectId }) => authorized.has(projectId.toString()))
      .map(({ _id, title }) => [_id.toString(), { id: _id.toString(), title }]))
    const names = new Map(workspaceNames.map(({ _id, name }) => [_id.toString(), name]))
    const visibleInvites = new Map(invites.map(({ _id, workspaceId }) => [_id.toString(), names.get(workspaceId.toString())]))

    return items.map(({ _id, kind, taskId, invitationId, createdAt, readAt }) => {
      const task = taskId ? visibleTasks.get(taskId.toString()) : undefined
      const workspaceName = invitationId ? visibleInvites.get(invitationId.toString()) : undefined
      return { id: _id.toString(), kind, createdAt, readAt: readAt ?? null,
        unavailable: !task && !workspaceName, ...(task && { task }), ...(workspaceName && { workspaceName }) }
    })
  }

  return {
    async list(user: PublicUser, query: PageRequest) {
      const { items, total } = await repository.list(user.id, query)
      return { data: await render(user, items), pagination: { ...query, total, totalPages: Math.ceil(total / query.limit) } }
    },

    async unreadCount(userId: string) {
      return { count: await repository.countUnread(userId) }
    },

    async markRead(user: PublicUser, id: string) {
      const { notification, changed } = await repository.markRead(user.id, id)
      if (!notification) throw new ApiError(404, 'NOT_FOUND', 'The notification was not found.')
      if (changed) live?.notifyRecipients([user.id])
      const [result] = await render(user, [notification])
      return result
    },
  }
}

export type NotificationService = ReturnType<typeof notificationService>
