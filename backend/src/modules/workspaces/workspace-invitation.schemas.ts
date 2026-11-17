import { z } from 'zod'
import { objectId } from '../../shared/object-id.js'
import { emailAddress } from '../users/user.schema.js'
import { invitationRoles, invitationStatuses } from './workspace-invitation.model.js'

const workspaceParams = z.strictObject({ id: objectId })
const tokenParams = z.strictObject({ token: z.string() })
const emptyQuery = z.strictObject({})

export const invitationCreateSchema = z.object({
  params: workspaceParams,
  query: emptyQuery,
  body: z.strictObject({ email: emailAddress, role: z.enum(invitationRoles) }),
})

export const invitationListSchema = z.object({
  params: workspaceParams,
  query: z.strictObject({ status: z.enum(invitationStatuses).optional() }),
})

export const invitationPreviewSchema = z.object({ params: tokenParams, query: emptyQuery })

export const invitationAcceptSchema = invitationPreviewSchema.extend({ body: z.strictObject({}).optional() })

export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>
export type InvitationListInput = z.infer<typeof invitationListSchema>
export type InvitationPreviewInput = z.infer<typeof invitationPreviewSchema>
export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>
