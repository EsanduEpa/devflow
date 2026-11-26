import { mongo, type ClientSession } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import type { ActivityRepository } from '../activity/activity.repository.js'
import { recordTaskActivity } from '../activity/task-activity.js'
import type { PageRequest } from '../../shared/pagination.js'
import type { ProjectRecord } from '../projects/project.model.js'
import type { ProjectService } from '../projects/project.service.js'
import { staleTaskVersion } from '../tasks/task-version.js'
import { publicTask } from '../tasks/task.model.js'
import type { TaskRepository } from '../tasks/task.repository.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import { activeSprintIndex, publicSprint, type SprintRecord } from './sprint.model.js'
import type { SprintRepository } from './sprint.repository.js'
import type { SprintCreateFields } from './sprint.schemas.js'

const sprintNotFound = () => new ApiError(404, 'NOT_FOUND', 'The sprint was not found.')
const taskNotFound = () => new ApiError(404, 'NOT_FOUND', 'The task was not found.')
const invalidState = (message: string) => new ApiError(409, 'INVALID_STATE', message)
const invalidSelection = (field: string, message: string) => new ApiError(400, 'VALIDATION_ERROR', message, [{ field, message }])

export function sprintService(
  repository: SprintRepository, tasks: TaskRepository, projects: ProjectService, workspaces: WorkspaceService,
  activity: Pick<ActivityRepository, 'append'>,
) {
  async function requireSprint(userId: string, id: string, session?: ClientSession) {
    const sprint = await repository.find(id, session)
    if (!sprint) throw sprintNotFound()
    const access = await projects.requireAccess(userId, sprint.projectId.toString(), session).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) throw sprintNotFound()
      throw error
    })
    return { sprint, ...access }
  }

  async function lockEditableProject({ project, canManage }: { project: ProjectRecord; canManage: boolean }, session: ClientSession) {
    if (!canManage) throw new ApiError(403, 'FORBIDDEN', 'Only the workspace owner or assigned project manager can manage sprints.')
    if (project.status === 'ARCHIVED') throw invalidState('Restore this project before changing its sprints.')
    // Project archive, task writes and membership revocations already acquire this same guard.
    await workspaces.lockMemberships(project.workspaceId.toString(), session)
  }

  function manage<T>(userId: string, id: string, operation: (sprint: SprintRecord, session: ClientSession) => Promise<T>) {
    return repository.transaction(async (session) => {
      const access = await requireSprint(userId, id, session)
      await lockEditableProject(access, session)
      return operation(access.sprint, session)
    })
  }

  async function render(sprint: SprintRecord, session?: ClientSession) {
    if (sprint.completionSnapshot) return publicSprint(sprint)
    const counts = await tasks.sprintCounts(sprint.projectId, [sprint._id], session)
    return publicSprint(sprint, counts.get(sprint._id.toString()))
  }

  async function renderList(projectId: ProjectRecord['_id'], items: SprintRecord[]) {
    const live = items.filter(({ status }) => status !== 'COMPLETED').map(({ _id }) => _id)
    const counts = live.length ? await tasks.sprintCounts(projectId, live) : undefined
    return items.map((sprint) => publicSprint(sprint, counts?.get(sprint._id.toString())))
  }

  async function changeMembership(userId: string, id: string, taskId: string, add: boolean, expectedVersion?: number) {
    return manage(userId, id, async (sprint, session) => {
      if (sprint.status === 'COMPLETED') throw invalidState('Completed sprint membership cannot be changed.')
      const task = await tasks.find(taskId, session)
      if (!task) throw taskNotFound()
      if (!task.projectId.equals(sprint.projectId)) {
        await projects.requireAccess(userId, task.projectId.toString(), session).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) throw taskNotFound()
          throw error
        })
        throw invalidSelection('params.taskId', 'Choose a task from this sprint’s project.')
      }
      if (expectedVersion !== undefined && expectedVersion !== (task.version ?? 0)) throw staleTaskVersion()
      const current = task.sprintId?.toString() ?? null
      if (add && current === id) return publicTask(task)
      if (add && current !== null) throw invalidState('Remove this task from its current sprint first.')
      if (!add && current !== id) throw new ApiError(404, 'NOT_FOUND', 'The task is not in this sprint.')
      const updated = await tasks.changeSprint(taskId, current, add ? id : null, userId, session, expectedVersion)
      if (!updated && expectedVersion !== undefined) throw staleTaskVersion()
      if (!updated) throw invalidState('The task’s sprint changed. Refresh and try again.')
      await recordTaskActivity(activity, updated, userId, task, session)
      return publicTask(updated)
    })
  }

  return {
    async list(userId: string, projectId: string, query: PageRequest) {
      const { project } = await projects.requireAccess(userId, projectId)
      const { items, total } = await repository.list(projectId, query)
      return {
        data: await renderList(project._id, items),
        pagination: { ...query, total, totalPages: Math.ceil(total / query.limit) },
      }
    },

    async dashboardProgress(project: ProjectRecord) {
      const id = project._id.toString()
      const [items, active] = await Promise.all([repository.pageItems(id, { page: 1, limit: 5 }), repository.active(id)])
      const recent = active ? [active, ...items.filter(({ _id }) => !_id.equals(active._id))].slice(0, 5) : items
      return renderList(project._id, recent)
    },

    async details(userId: string, id: string) {
      return render((await requireSprint(userId, id)).sprint)
    },

    create(userId: string, projectId: string, fields: SprintCreateFields) {
      return repository.transaction(async (session) => {
        const access = await projects.requireAccess(userId, projectId, session)
        await lockEditableProject(access, session)
        return publicSprint(await repository.create(projectId, fields, session))
      })
    },

    async start(userId: string, id: string) {
      try {
        return await manage(userId, id, async (_sprint, session) => {
          const started = await repository.transition(id, 'PLANNED', { status: 'ACTIVE', startedAt: new Date() }, session)
          if (!started) throw invalidState('Only a planned sprint can be started.')
          return render(started, session)
        })
      } catch (error) {
        if (error instanceof mongo.MongoServerError && error.code === 11000 && error.message.includes(activeSprintIndex)) {
          throw new ApiError(409, 'ACTIVE_SPRINT_EXISTS', 'Complete the active sprint before starting another.')
        }
        throw error
      }
    },

    complete(userId: string, id: string, rolloverSprintId: string | null) {
      return manage(userId, id, async (sprint, session) => {
        if (sprint.status !== 'ACTIVE') throw invalidState('Only an active sprint can be completed.')
        if (rolloverSprintId) {
          const { sprint: target } = await requireSprint(userId, rolloverSprintId, session)
          if (!target.projectId.equals(sprint.projectId) || target._id.equals(sprint._id)) {
            throw invalidSelection('body.rolloverSprintId', 'Choose a different sprint from this project.')
          }
          if (target.status !== 'PLANNED') throw invalidState('The rollover sprint must still be planned.')
          if (target.startDate <= sprint.endDate) {
            throw invalidSelection('body.rolloverSprintId', 'Choose a sprint that starts after this sprint ends.')
          }
        }
        const counts = await tasks.sprintCounts(sprint.projectId, [sprint._id], session)
        const completionSnapshot = counts.get(id) ?? { totalTasks: 0, completedTasks: 0 }
        await tasks.rollOverSprint(sprint.projectId, id, rolloverSprintId, userId, session)
        const completed = await repository.transition(id, 'ACTIVE', {
          status: 'COMPLETED', completedAt: new Date(), completionSnapshot,
        }, session)
        if (!completed) throw invalidState('Only an active sprint can be completed.')
        return publicSprint(completed)
      })
    },

    addTask: (userId: string, id: string, taskId: string, expectedVersion?: number) => changeMembership(userId, id, taskId, true, expectedVersion),
    removeTask: (userId: string, id: string, taskId: string, expectedVersion?: number) => changeMembership(userId, id, taskId, false, expectedVersion),
  }
}

export type SprintService = ReturnType<typeof sprintService>
