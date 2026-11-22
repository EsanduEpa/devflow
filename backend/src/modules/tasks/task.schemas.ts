import { z } from 'zod'
import { objectId } from '../../shared/object-id.js'
import { hasSafePageOffset, paginationFields } from '../../shared/pagination.js'
import { taskPriorities, taskStatuses } from './task.model.js'

const id = objectId.transform((value) => value.toLowerCase())
const details = z.object({ params: z.strictObject({ id }), query: z.strictObject({}) })
const taskFields = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  assigneeId: id.nullable().optional(),
  priority: z.enum(taskPriorities).optional(),
  dueDate: z.iso.date().nullable().optional(),
}

export const taskDetailsSchema = details
export const taskCreateSchema = details.extend({ body: z.strictObject({ ...taskFields, status: z.enum(taskStatuses).optional() }) })
export const taskStatusSchema = details.extend({ body: z.strictObject({ status: z.enum(taskStatuses) }) })
export const taskListSchema = details.extend({
  query: z.strictObject(paginationFields).refine(hasSafePageOffset, { path: ['page'], message: 'Page number is too large.' }),
})
export const taskUpdateSchema = details.extend({
  body: z.strictObject(taskFields).partial().refine((fields) => Object.keys(fields).length > 0, {
    message: 'Provide at least one task field to update.',
  }),
})

export type TaskDetailsInput = z.infer<typeof taskDetailsSchema>
export type TaskCreateInput = z.infer<typeof taskCreateSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>
export type TaskStatusInput = z.infer<typeof taskStatusSchema>
export type TaskListInput = z.infer<typeof taskListSchema>
