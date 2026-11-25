import { Router, type Request, type RequestHandler } from 'express'
import type { ZodType } from 'zod'
import type { AuthenticatedLocals, authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { sprintComplete, sprintCreate, sprintDetails, sprintList, sprintMembership, sprintStart } from './sprint.schemas.js'
import type { SprintService } from './sprint.service.js'

export function createSprintRoutes(service: SprintService, { requireUser, verifyCsrf }: {
  requireUser: ReturnType<typeof authenticate>
  verifyCsrf: RequestHandler
}) {
  const router = Router()
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
    response.status(201).json({ data: await service.create(user.id, input.params.projectId, input.body) })
  })
  route('get', '/sprints/:sprintId', sprintDetails, async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.details(user.id, input.params.sprintId) })
  })
  route('post', '/sprints/:sprintId/start', sprintStart, async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.start(user.id, input.params.sprintId) })
  })
  route('post', '/sprints/:sprintId/complete', sprintComplete, async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.complete(user.id, input.params.sprintId, input.body.rolloverSprintId) })
  })
  route('post', '/sprints/:sprintId/tasks/:taskId', sprintMembership, async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.addTask(user.id, input.params.sprintId, input.params.taskId, input.query.expectedVersion) })
  })
  route('delete', '/sprints/:sprintId/tasks/:taskId', sprintMembership, async (_request, response) => {
    const { user, input } = response.locals
    await service.removeTask(user.id, input.params.sprintId, input.params.taskId, input.query.expectedVersion)
    response.status(204).end()
  })

  return router
}
