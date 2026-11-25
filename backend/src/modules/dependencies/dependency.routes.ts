import { Router, type Request, type RequestHandler } from 'express'
import { z } from 'zod'
import type { AuthenticatedLocals, authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { objectId } from '../../shared/object-id.js'
import type { DependencyService } from './dependency.service.js'

const id = objectId.transform((value) => value.toLowerCase())
const listSchema = z.object({ params: z.strictObject({ taskId: id }), query: z.strictObject({}) })
const changeSchema = listSchema.extend({
  params: listSchema.shape.params.extend({ prerequisiteId: id }),
  body: z.strictObject({}).optional(),
})

type DependencyRequest<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function createDependencyRoutes(service: DependencyService, { requireUser, verifyCsrf }: {
  requireUser: ReturnType<typeof authenticate>
  verifyCsrf: RequestHandler
}) {
  const router = Router()
  const noStore: RequestHandler = (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }

  const list: DependencyRequest<z.infer<typeof listSchema>> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.list(user.id, input.params.taskId) })
  }
  const add: DependencyRequest<z.infer<typeof changeSchema>> = async (_request, response) => {
    const { user, input } = response.locals
    response.status(201).json({ data: await service.add(user.id, input.params.taskId, input.params.prerequisiteId) })
  }
  const remove: DependencyRequest<z.infer<typeof changeSchema>> = async (_request, response) => {
    const { user, input } = response.locals
    await service.remove(user.id, input.params.taskId, input.params.prerequisiteId)
    response.status(204).end()
  }

  router.get('/:taskId/dependencies', noStore, requireUser, validateRequest(listSchema), list)
  router.post('/:taskId/dependencies/:prerequisiteId', noStore, requireUser, verifyCsrf, validateRequest(changeSchema), add)
  router.delete('/:taskId/dependencies/:prerequisiteId', noStore, requireUser, verifyCsrf, validateRequest(changeSchema), remove)
  return router
}
