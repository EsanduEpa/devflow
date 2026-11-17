import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import type { ProjectCreateInput, ProjectDetailsInput, ProjectListInput } from './project.schemas.js'
import type { ProjectService } from './project.service.js'

type ProjectRequest<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function projectController(service: ProjectService) {
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

  return { create, list, details }
}
