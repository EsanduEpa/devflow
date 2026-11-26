import { Router, type Request, type RequestHandler } from 'express'
import { z } from 'zod'
import type { AuthenticatedLocals, authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { objectId } from '../../shared/object-id.js'
import { hasSafePageOffset, paginationFields } from '../../shared/pagination.js'
import type { NotificationService } from './notification.service.js'

const listSchema = z.object({
  query: z.strictObject(paginationFields).refine(hasSafePageOffset, { path: ['page'], message: 'Page number is too large.' }),
})
const markSchema = z.object({
  params: z.strictObject({ id: objectId }), query: z.strictObject({}), body: z.strictObject({ read: z.literal(true) }),
})
type Handler<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function createNotificationRoutes(service: NotificationService, { requireUser, verifyCsrf }: {
  requireUser: ReturnType<typeof authenticate>
  verifyCsrf: RequestHandler
}) {
  const router = Router()
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  const list: Handler<z.infer<typeof listSchema>> = async (_request, response) => {
    response.json(await service.list(response.locals.user, response.locals.input.query))
  }
  const unread: RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals> = async (_request, response) => {
    response.json({ data: await service.unreadCount(response.locals.user.id) })
  }
  const mark: Handler<z.infer<typeof markSchema>> = async (_request, response) => {
    response.json({ data: await service.markRead(response.locals.user, response.locals.input.params.id) })
  }

  router.get('/', requireUser, validateRequest(listSchema), list)
  router.get('/unread-count', requireUser, unread)
  router.patch('/:id', requireUser, verifyCsrf, validateRequest(markSchema), mark)
  return router
}
