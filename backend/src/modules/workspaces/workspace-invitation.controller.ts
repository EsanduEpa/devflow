import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import { ApiError } from '../../shared/api-error.js'
import type { InvitationAcceptInput, InvitationCreateInput, InvitationListInput, InvitationPreviewInput } from './workspace-invitation.schemas.js'
import type { InvitationService } from './workspace-invitation.service.js'

type InvitationRequest<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function invitationController(service: InvitationService) {
  const create: InvitationRequest<InvitationCreateInput> = async (request, response) => {
    const { user, input } = response.locals
    const origin = request.get('Origin')
    if (!origin) throw new ApiError(403, 'CSRF_TOKEN_INVALID', 'The request origin is required.')
    response.status(201).json({ data: await service.create(user.id, input.params.id, input.body, origin) })
  }

  const list: InvitationRequest<InvitationListInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.list(user.id, input.params.id, input.query.status) })
  }

  const preview: RequestHandler<Request['params'], unknown, unknown, unknown, { input: InvitationPreviewInput }> =
    async (_request, response) => {
      response.json({ data: await service.preview(response.locals.input.params.token) })
    }

  const accept: InvitationRequest<InvitationAcceptInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.accept(input.params.token, user.id) })
  }

  return { create, list, preview, accept }
}
