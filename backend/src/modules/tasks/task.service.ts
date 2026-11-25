import type { ClientSession } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import type { ActivityRepository } from '../activity/activity.repository.js'
import { recordTaskActivity } from '../activity/task-activity.js'
import type { CommentRepository } from '../comments/comment.repository.js'
import type { ProjectRecord } from '../projects/project.model.js'
import type { ProjectService } from '../projects/project.service.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import type { SprintRepository } from '../sprints/sprint.repository.js'
import { publicTask, type TaskRecord, type TaskStatus } from './task.model.js'
import type { TaskRepository } from './task.repository.js'
import type { TaskCreateInput, TaskListInput, TaskUpdateInput } from './task.schemas.js'

function taskNotFound() {
  return new ApiError(404, 'NOT_FOUND', 'The task was not found.')
}

export function taskService(
  repository: TaskRepository, projects: ProjectService, workspaces: WorkspaceService,
  sprints: Pick<SprintRepository, 'find'>, comments: Pick<CommentRepository, 'removeForTask'>,
  activity: Pick<ActivityRepository, 'append' | 'removeForTask'>,
) {
  async function requireTaskAccess(userId: string, taskId: string, session?: ClientSession) {
    const task = await repository.find(taskId, session)
    if (!task) throw taskNotFound()
    const access = await projects.requireAccess(userId, task.projectId.toString(), session).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) throw taskNotFound()
      throw error
    })
    return { task, ...access }
  }

  async function lockEditableProject(project: ProjectRecord, session: ClientSession) {
    if (project.status === 'ARCHIVED') {
      throw new ApiError(409, 'INVALID_STATE', 'Restore this project before changing its tasks.')
    }
    await workspaces.lockMemberships(project.workspaceId.toString(), session)
  }

  function manage<T>(userId: string, taskId: string, operation: (project: ProjectRecord, task: TaskRecord, session: ClientSession) => Promise<T>) {
    return repository.transaction(async (session) => {
      const { project, canManage, task } = await requireTaskAccess(userId, taskId, session)
      if (!canManage) throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner or assigned project manager can edit or delete tasks.')
      await lockEditableProject(project, session)
      return operation(project, task, session)
    })
  }

  async function validateAssignee(project: ProjectRecord, assigneeId: string | null | undefined, session: ClientSession) {
    if (assigneeId && !await projects.isEligibleTaskAssignee(project, assigneeId, session)) {
      const message = 'Choose a member of this project as the assignee.'
      throw new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'body.assigneeId', message }])
    }
  }

  return {
    requireAccess: requireTaskAccess,

    create(userId: string, projectId: string, fields: TaskCreateInput['body']) {
      return repository.transaction(async (session) => {
        const { project, canManage } = await projects.requireAccess(userId, projectId, session)
        if (!canManage && (fields.assigneeId !== undefined || fields.priority !== undefined || fields.status !== undefined || fields.dueDate !== undefined)) {
          throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner or assigned project manager can set assignment, priority, status or due dates.')
        }
        await lockEditableProject(project, session)
        await validateAssignee(project, fields.assigneeId, session)
        const task = await repository.create(projectId, userId, fields, session)
        await recordTaskActivity(activity, task, userId, null, session)
        return publicTask(task)
      })
    },

    async details(userId: string, taskId: string) {
      const { task } = await requireTaskAccess(userId, taskId)
      return publicTask(task)
    },

    async list(userId: string, projectId: string, query: TaskListInput['query']) {
      const { project } = await projects.requireAccess(userId, projectId)
      if (query.sprintId && query.sprintId !== 'none') {
        const sprint = await sprints.find(query.sprintId)
        if (!sprint?.projectId.equals(project._id)) throw new ApiError(404, 'NOT_FOUND', 'The sprint was not found in this project.')
      }
      const { items, total } = await repository.list(projectId, query)
      return {
        data: items.map(publicTask),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      }
    },

    changeStatus(userId: string, taskId: string, status: TaskStatus) {
      return repository.transaction(async (session) => {
        const { task, project, canManage, myRole } = await requireTaskAccess(userId, taskId, session)
        if (!canManage) {
          if (myRole !== 'DEVELOPER' || task.assigneeId?.toString() !== userId) {
            throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner, assigned project manager, or task assignee with the Developer role can change its status.')
          }
          if (task.status === 'DONE' || status === 'DONE') {
            throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner or assigned project manager can approve or reopen a Done task.')
          }
        }
        await lockEditableProject(project, session)
        const updated = await repository.updateStatus(taskId, userId, status, session)
        if (!updated) throw taskNotFound()
        await recordTaskActivity(activity, updated, userId, task, session)
        return publicTask(updated)
      })
    },

    update(userId: string, taskId: string, fields: TaskUpdateInput['body']) {
      return manage(userId, taskId, async (project, task, session) => {
        await validateAssignee(project, fields.assigneeId, session)
        const updated = await repository.update(taskId, userId, fields, session)
        if (!updated) throw taskNotFound()
        await recordTaskActivity(activity, updated, userId, task, session)
        return publicTask(updated)
      })
    },

    remove(userId: string, taskId: string) {
      return manage(userId, taskId, async (_project, _task, session) => {
        const result = await repository.remove(taskId, session)
        if (!result.deletedCount) throw taskNotFound()
        await comments.removeForTask(taskId, session)
        await activity.removeForTask(taskId, session)
      })
    },
  }
}

export type TaskService = ReturnType<typeof taskService>
