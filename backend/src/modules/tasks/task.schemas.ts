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

export const taskVersionSchema = z.int().nonnegative()
const expectedVersion = taskVersionSchema.optional()

export const taskDetailsSchema = details
export const taskCreateSchema = details.extend({ body: z.strictObject({ ...taskFields, status: z.enum(taskStatuses).optional() }) })
export const taskStatusSchema = details.extend({ body: z.strictObject({ status: z.enum(taskStatuses), expectedVersion }) })
export const taskListSchema = details.extend({
  query: z.strictObject({
    ...paginationFields,
    sprintId: z.union([id, z.literal('none')]).optional(),
    blocked: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    unfinished: z.literal('true').optional(),
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(taskPriorities).optional(),
    assigneeId: z.union([id, z.literal('unassigned')]).optional(),
    search: z.string().trim().max(200).optional(),
  }).refine(hasSafePageOffset, { path: ['page'], message: 'Page number is too large.' })
    .refine(({ unfinished, sprintId, status }) => !unfinished || (!!sprintId && sprintId !== 'none' && !status), {
      path: ['unfinished'], message: 'Filter unfinished work in a specific sprint without a status filter.',
    }),
})
export const taskUpdateSchema = details.extend({
  body: z.strictObject({ ...taskFields, expectedVersion }).partial().refine(({ expectedVersion: _, ...fields }) => Object.keys(fields).length > 0, {
    message: 'Provide at least one task field to update.',
  }),
})

export type TaskDetailsInput = z.infer<typeof taskDetailsSchema>
export type TaskCreateInput = z.infer<typeof taskCreateSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>
export type TaskUpdateFields = Omit<TaskUpdateInput['body'], 'expectedVersion'>
export type TaskStatusInput = z.infer<typeof taskStatusSchema>
export type TaskListInput = z.infer<typeof taskListSchema>
