import { Router, type Request, type RequestHandler } from 'express'
import type { ZodType } from 'zod'
import type { AuthenticatedLocals, authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { commentCreateSchema, commentListSchema, commentPath, commentUpdateSchema, mentionOptionsSchema } from './comment.schemas.js'
import type { CommentService } from './comment.service.js'

export function createCommentRoutes(service: CommentService, { requireUser, verifyCsrf }: {
  requireUser: ReturnType<typeof authenticate>
  verifyCsrf: RequestHandler
}) {
  const router = Router()
  const noStore: RequestHandler = (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }

  function route<Input>(
    method: 'get' | 'post' | 'patch' | 'delete', path: string, schema: ZodType<Input>,
    handler: RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>,
  ) {
    router[method](path, noStore, requireUser, ...(method === 'get' ? [] : [verifyCsrf]), validateRequest(schema), handler)
  }

  route('get', '/:taskId/comments', commentListSchema, async (_request, response) => {
    const { user, input } = response.locals
    response.json(await service.list(user.id, input.params.taskId, input.query))
  })
  route('get', '/:taskId/comments/mention-options', mentionOptionsSchema, async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.mentionOptions(user.id, input.params.taskId) })
  })
  route('post', '/:taskId/comments', commentCreateSchema, async (_request, response) => {
    const { user, input } = response.locals
    response.status(201).json({ data: await service.create(user.id, input.params.taskId, input.body) })
  })
  route('patch', '/:taskId/comments/:commentId', commentUpdateSchema, async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.update(user.id, input.params.taskId, input.params.commentId, input.body) })
  })
  route('delete', '/:taskId/comments/:commentId', commentPath, async (_request, response) => {
    const { user, input } = response.locals
    await service.remove(user.id, input.params.taskId, input.params.commentId)
    response.status(204).end()
  })
  return router
}
