import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import type { ProjectCreateInput, ProjectDetailsInput, ProjectListInput, ProjectMemberAddInput, ProjectMemberRemoveInput, ProjectUpdateInput } from './project.schemas.js'
import type { Realtime } from '../realtime/realtime.js'
import type { ProjectService } from './project.service.js'

type ProjectRequest<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function projectController(service: ProjectService, live?: Realtime) {
  const create: ProjectRequest<ProjectCreateInput> = async (_request, response) => {
    const { user, input } = response.locals
    const project = await service.create(user.id, input.params.id, input.body)
    response.status(201).json({ data: project })
  }

  const list: ProjectRequest<ProjectListInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json(await service.list(user.id, input.params.id, input.query))
  }

  const details: ProjectRequest<ProjectDetailsInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.details(user.id, input.params.id) })
  }

  const update: ProjectRequest<ProjectUpdateInput> = async (_request, response) => {
    const { user, input } = response.locals
    const project = await service.update(user.id, input.params.id, input.body)
    live?.publish({ projectId: project.id, kind: 'project.changed' })
    response.json({ data: project })
  }

  const listMembers: ProjectRequest<ProjectDetailsInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.listMembers(user.id, input.params.id) })
  }

  const addMember: ProjectRequest<ProjectMemberAddInput> = async (_request, response) => {
    const { user, input } = response.locals
    const member = await service.addMember(user.id, input.params.id, input.body.userId)
    live?.publish({ projectId: input.params.id, kind: 'project.changed' })
    response.status(201).json({ data: member })
  }

  const removeMember: ProjectRequest<ProjectMemberRemoveInput> = async (_request, response) => {
    const { user, input } = response.locals
    await service.removeMember(user.id, input.params.id, input.params.userId)
    live?.notifyRecipients([input.params.userId])
    live?.publish({ projectId: input.params.id, kind: 'project.changed' })
    response.status(204).end()
  }

  return { create, list, details, update, listMembers, addMember, removeMember }
}
