import { z } from 'zod'
import { objectId } from '../../shared/object-id.js'
import { hasSafePageOffset, paginationFields } from '../../shared/pagination.js'

const id = objectId.transform((value) => value.toLowerCase())
const query = z.strictObject({})
const emptyBody = z.strictObject({}).optional()
const project = z.object({ params: z.strictObject({ projectId: id }), query })

export const sprintDetails = z.object({ params: z.strictObject({ sprintId: id }), query })
export const sprintStart = sprintDetails.extend({ body: emptyBody })
export const sprintMembership = sprintDetails.extend({
  params: sprintDetails.shape.params.extend({ taskId: id }),
  body: emptyBody,
})
export const sprintList = project.extend({
  query: z.strictObject(paginationFields).refine(hasSafePageOffset, { path: ['page'], message: 'Page number is too large.' }),
})
export const sprintCreate = project.extend({
  body: z.strictObject({ name: z.string().trim().min(3).max(150), startDate: z.iso.date(), endDate: z.iso.date() })
    .refine(({ startDate, endDate }) => endDate >= startDate, {
      path: ['endDate'], message: 'End date must be on or after the start date.',
    }),
})
export const sprintComplete = sprintDetails.extend({
  body: z.strictObject({ rolloverSprintId: id.nullable() }),
})

export type SprintCreateFields = z.infer<typeof sprintCreate>['body']
