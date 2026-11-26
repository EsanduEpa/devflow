import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import type { WorkspaceCreateInput, WorkspaceDetailsInput, WorkspaceListInput, WorkspaceMemberRemoveInput, WorkspaceMemberRoleInput, WorkspaceUpdateInput } from './workspace.schemas.js'
import type { Realtime } from '../realtime/realtime.js'
import type { WorkspaceService } from './workspace.service.js'

type WorkspaceRequest<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function workspaceController(service: WorkspaceService, live?: Realtime) {
  const list: WorkspaceRequest<WorkspaceListInput> = async (_request, response) => {
    response.json({ data: await service.list(response.locals.user.id) })
  }

  const create: WorkspaceRequest<WorkspaceCreateInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.status(201).json({ data: await service.create(user.id, input.body) })
  }

  const details: WorkspaceRequest<WorkspaceDetailsInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.details(user.id, input.params.id) })
  }

  const update: WorkspaceRequest<WorkspaceUpdateInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.update(user.id, input.params.id, input.body) })
  }

  const listMembers: WorkspaceRequest<WorkspaceDetailsInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.listMembers(user.id, input.params.id) })
  }

  const changeMemberRole: WorkspaceRequest<WorkspaceMemberRoleInput> = async (_request, response) => {
    const { user, input } = response.locals
    const updated = await service.changeMemberRole(user.id, input.params.id, input.params.userId, input.body.role)
    live?.workspaceChanged(input.params.id)
    response.json({ data: updated })
  }

  const removeMember: WorkspaceRequest<WorkspaceMemberRemoveInput> = async (_request, response) => {
    const { user, input } = response.locals
    await service.removeMember(user.id, input.params.id, input.params.userId)
    live?.notifyRecipients([input.params.userId])
    live?.workspaceChanged(input.params.id)
    response.status(204).end()
  }

  return { list, create, details, update, listMembers, changeMemberRole, removeMember }
}
