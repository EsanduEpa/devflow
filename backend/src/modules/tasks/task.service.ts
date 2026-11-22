import type { ClientSession } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import type { ProjectRecord } from '../projects/project.model.js'
import type { ProjectService } from '../projects/project.service.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import { publicTask } from './task.model.js'
import type { TaskRepository } from './task.repository.js'
import type { TaskCreateInput, TaskUpdateInput } from './task.schemas.js'

function taskNotFound() {
  return new ApiError(404, 'NOT_FOUND', 'The task was not found.')
}

export function taskService(repository: TaskRepository, projects: ProjectService, workspaces: WorkspaceService) {
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

  function manage<T>(userId: string, taskId: string, operation: (project: ProjectRecord, session: ClientSession) => Promise<T>) {
    return repository.transaction(async (session) => {
      const { project, canManage } = await requireTaskAccess(userId, taskId, session)
      if (!canManage) throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner or assigned project manager can edit or delete tasks.')
      await lockEditableProject(project, session)
      return operation(project, session)
    })
  }

  async function validateAssignee(project: ProjectRecord, assigneeId: string | null | undefined, session: ClientSession) {
    if (assigneeId && !await projects.isEligibleTaskAssignee(project, assigneeId, session)) {
      const message = 'Choose a member of this project as the assignee.'
      throw new ApiError(400, 'VALIDATION_ERROR', message, [{ field: 'body.assigneeId', message }])
    }
  }

  return {
    create(userId: string, projectId: string, fields: TaskCreateInput['body']) {
      return repository.transaction(async (session) => {
        const { project, canManage } = await projects.requireAccess(userId, projectId, session)
        if (!canManage && (fields.assigneeId !== undefined || fields.priority !== undefined || fields.status !== undefined || fields.dueDate !== undefined)) {
          throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner or assigned project manager can set assignment, priority, status or due dates.')
        }
        await lockEditableProject(project, session)
        await validateAssignee(project, fields.assigneeId, session)
        return publicTask(await repository.create(projectId, userId, fields, session))
      })
    },

    async details(userId: string, taskId: string) {
      const { task } = await requireTaskAccess(userId, taskId)
      return publicTask(task)
    },

    update(userId: string, taskId: string, fields: TaskUpdateInput['body']) {
      return manage(userId, taskId, async (project, session) => {
        await validateAssignee(project, fields.assigneeId, session)
        const updated = await repository.update(taskId, userId, fields, session)
        if (!updated) throw taskNotFound()
        return publicTask(updated)
      })
    },

    remove(userId: string, taskId: string) {
      return manage(userId, taskId, async (_project, session) => {
        const result = await repository.remove(taskId, session)
        if (!result.deletedCount) throw taskNotFound()
      })
    },
  }
}

export type TaskService = ReturnType<typeof taskService>
