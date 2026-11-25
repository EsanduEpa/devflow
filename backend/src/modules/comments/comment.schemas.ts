import { z } from 'zod'
import { objectId } from '../../shared/object-id.js'
import { hasSafePageOffset, paginationFields } from '../../shared/pagination.js'

const id = objectId.transform((value) => value.toLowerCase())
const taskPath = z.object({ params: z.strictObject({ taskId: id }), query: z.strictObject({}) })
export const commentPath = taskPath.extend({ params: taskPath.shape.params.extend({ commentId: id }) })
export const mentionOptionsSchema = taskPath
export const commentListSchema = taskPath.extend({
  query: z.strictObject(paginationFields).refine(hasSafePageOffset, { path: ['page'], message: 'Page number is too large.' }),
})

const fields = {
  body: z.string().trim().min(1).max(5000),
  mentionUserIds: z.array(id).max(20).refine((ids) => new Set(ids).size === ids.length, 'Each mention must be unique.'),
}
export const commentCreateSchema = taskPath.extend({
  body: z.strictObject({ ...fields, mentionUserIds: fields.mentionUserIds.default([]) }),
})
export const commentUpdateSchema = commentPath.extend({
  body: z.strictObject(fields).partial().refine((input) => Object.keys(input).length > 0, {
    message: 'Provide a comment field to update.',
  }),
})

export type CommentFields = z.infer<typeof commentCreateSchema>['body']
