import { z } from 'zod'
import { objectId } from '../../shared/object-id.js'
import { projectStatuses } from './project.model.js'

const id = objectId.transform((value) => value.toLowerCase())
const params = z.strictObject({ id })
const queryInteger = z.string().regex(/^\d+$/, 'Enter a positive whole number.').transform(Number).pipe(z.int().positive())
const dateOnly = z.iso.date().nullable().default(null)
const status = z.enum(projectStatuses)

export const projectCreateSchema = z.object({
  params,
  query: z.strictObject({}),
  body: z.strictObject({
    name: z.string().trim().min(3).max(150),
    description: z.string().trim().max(2000).default(''),
    managerId: id,
    startDate: dateOnly,
    targetDate: dateOnly,
    status: status.default('PLANNED'),
  }).refine(({ startDate, targetDate }) => !startDate || !targetDate || targetDate >= startDate, {
    path: ['targetDate'],
    message: 'Target date cannot be earlier than the start date.',
  }),
})

export const projectListSchema = z.object({
  params,
  query: z.strictObject({
    status: status.optional(),
    page: queryInteger.default(1),
    limit: queryInteger.pipe(z.int().max(100)).default(20),
  }).refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    path: ['page'],
    message: 'Page number is too large.',
  }),
})

export const projectDetailsSchema = z.object({ params, query: z.strictObject({}) })

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectListInput = z.infer<typeof projectListSchema>
export type ProjectDetailsInput = z.infer<typeof projectDetailsSchema>
