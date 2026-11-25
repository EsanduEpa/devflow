import { Router, type Request, type RequestHandler } from 'express'
import { z } from 'zod'
import type { AuthenticatedLocals, authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { objectId } from '../../shared/object-id.js'
import { hasSafePageOffset, paginationFields } from '../../shared/pagination.js'
import type { TaskService } from '../tasks/task.service.js'
import type { ActivityRepository } from './activity.repository.js'

const listSchema = z.object({
  params: z.strictObject({ taskId: objectId.transform((id) => id.toLowerCase()) }),
  query: z.strictObject(paginationFields).refine(hasSafePageOffset, { path: ['page'], message: 'Page number is too large.' }),
})

export function createActivityRoutes(
  activity: Pick<ActivityRepository, 'list'>,
  tasks: Pick<TaskService, 'requireAccess'>,
  requireUser: ReturnType<typeof authenticate>,
) {
  const router = Router()
  const list: RequestHandler<Request['params'], unknown, unknown, unknown,
    AuthenticatedLocals & { input: z.infer<typeof listSchema> }> = async (_request, response) => {
    const { user, input } = response.locals
    const { project } = await tasks.requireAccess(user.id, input.params.taskId)
    response.json(await activity.list(input.params.taskId, project._id, input.query))
  }
  router.get('/:taskId/activity', (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }, requireUser, validateRequest(listSchema), list)
  return router
}
