import type { Request, RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { ApiError } from '../shared/api-error.js'

export function validateRequest<Input>(
  schema: ZodType<Input>,
): RequestHandler<Request['params'], unknown, unknown, unknown, { input: Input }> {
  return (request, response, next) => {
    const result = schema.safeParse({
      body: request.body,
      query: request.query,
      params: request.params,
    })

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'request',
        message: issue.code === 'unrecognized_keys' ? 'Contains unsupported fields.' : issue.message,
      }))
      next(new ApiError(400, 'VALIDATION_ERROR', 'Some fields contain invalid values.', details))
      return
    }

    response.locals.input = result.data
    next()
  }
}
