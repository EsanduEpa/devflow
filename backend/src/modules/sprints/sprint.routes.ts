import { Router, type Request, type RequestHandler } from 'express'
import type { ZodType } from 'zod'
import type { AuthenticatedLocals, authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import type { Realtime } from '../realtime/realtime.js'
import { sprintComplete, sprintCreate, sprintDetails, sprintList, sprintMembership, sprintStart } from './sprint.schemas.js'
import type { SprintService } from './sprint.service.js'

export function createSprintRoutes(service: SprintService, { requireUser, verifyCsrf }: {
  requireUser: ReturnType<typeof authenticate>
  verifyCsrf: RequestHandler
}, live?: Realtime) {
  const router = Router()
  function sprintChanged(sprint: { projectId: string }) {
    live?.publish({ projectId: sprint.projectId, kind: 'sprint.changed' })
  }

  function membershipChanged(task: { projectId: string; id: string; version: number }) {
    live?.publish({ projectId: task.projectId, kind: 'task.changed', taskId: task.id, version: task.version })
  }
  const noStore: RequestHandler = (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }

  function route<Input>(
    method: 'get' | 'post' | 'delete', path: string, schema: ZodType<Input>,
    handler: RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>,
  ) {
    router[method](path, noStore, requireUser, ...(method === 'get' ? [] : [verifyCsrf]), validateRequest(schema), handler)
  }

  route('get', '/projects/:projectId/sprints', sprintList, async (_request, response) => {
    const { user, input } = response.locals
    response.json(await service.list(user.id, input.params.projectId, input.query))
  })
  route('post', '/projects/:projectId/sprints', sprintCreate, async (_request, response) => {
    const { user, input } = response.locals
    const sprint = await service.create(user.id, input.params.projectId, input.body)
    sprintChanged(sprint)
    response.status(201).json({ data: sprint })
  })
  route('get', '/sprints/:sprintId', sprintDetails, async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.details(user.id, input.params.sprintId) })
  })
  route('post', '/sprints/:sprintId/start', sprintStart, async (_request, response) => {
    const { user, input } = response.locals
    const sprint = await service.start(user.id, input.params.sprintId)
    sprintChanged(sprint)
    response.json({ data: sprint })
  })
  route('post', '/sprints/:sprintId/complete', sprintComplete, async (_request, response) => {
    const { user, input } = response.locals
    const sprint = await service.complete(user.id, input.params.sprintId, input.body.rolloverSprintId)
    sprintChanged(sprint)
    response.json({ data: sprint })
  })
  route('post', '/sprints/:sprintId/tasks/:taskId', sprintMembership, async (_request, response) => {
    const { user, input } = response.locals
    const task = await service.addTask(user.id, input.params.sprintId, input.params.taskId, input.query.expectedVersion)
    membershipChanged(task)
    response.json({ data: task })
  })
  route('delete', '/sprints/:sprintId/tasks/:taskId', sprintMembership, async (_request, response) => {
    const { user, input } = response.locals
    const task = await service.removeTask(user.id, input.params.sprintId, input.params.taskId, input.query.expectedVersion)
    membershipChanged(task)
    response.status(204).end()
  })

  return router
}
