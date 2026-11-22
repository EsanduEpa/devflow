import { z } from 'zod'
import { objectId } from '../../shared/object-id.js'
import { hasSafePageOffset, paginationFields } from '../../shared/pagination.js'
import { projectStatuses } from './project.model.js'

const id = objectId.transform((value) => value.toLowerCase())
const params = z.strictObject({ id })
const dateOnly = z.iso.date().nullable().default(null)
const status = z.enum(projectStatuses)
const name = z.string().trim().min(3).max(150)
const description = z.string().trim().max(2000)

export const projectCreateSchema = z.object({
  params,
  query: z.strictObject({}),
  body: z.strictObject({
    name,
    description: description.default(''),
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
    ...paginationFields,
  }).refine(hasSafePageOffset, {
    path: ['page'],
    message: 'Page number is too large.',
  }),
})

export const projectDetailsSchema = z.object({ params, query: z.strictObject({}) })
export const projectUpdateSchema = projectDetailsSchema.extend({
  body: z.strictObject({
    name,
    description,
    managerId: id,
    startDate: z.iso.date().nullable(),
    targetDate: z.iso.date().nullable(),
    status,
  }).partial().refine((fields) => Object.keys(fields).length > 0, {
    message: 'Provide at least one project field to update.',
  }),
})

export const projectMemberAddSchema = projectDetailsSchema.extend({ body: z.strictObject({ userId: id }) })
export const projectMemberRemoveSchema = projectDetailsSchema.extend({ params: params.extend({ userId: id }) })

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectListInput = z.infer<typeof projectListSchema>
export type ProjectDetailsInput = z.infer<typeof projectDetailsSchema>
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>
export type ProjectMemberAddInput = z.infer<typeof projectMemberAddSchema>
export type ProjectMemberRemoveInput = z.infer<typeof projectMemberRemoveSchema>
