import { z } from 'zod'
import { objectId } from '../../shared/object-id.js'

const emptyQuery = z.strictObject({})
const params = z.strictObject({ id: objectId })
const workspaceFields = z.strictObject({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
})

export const workspaceListSchema = z.object({ query: emptyQuery })
export const workspaceDetailsSchema = z.object({ query: emptyQuery, params })
export const workspaceCreateSchema = z.object({ query: emptyQuery, body: workspaceFields })

export const workspaceUpdateSchema = z.object({
  query: emptyQuery,
  params,
  body: workspaceFields.partial().refine(({ name, description }) => name !== undefined || description !== undefined, {
    message: 'Provide a name or description to update.',
  }),
})

export type WorkspaceListInput = z.infer<typeof workspaceListSchema>
export type WorkspaceDetailsInput = z.infer<typeof workspaceDetailsSchema>
export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>
