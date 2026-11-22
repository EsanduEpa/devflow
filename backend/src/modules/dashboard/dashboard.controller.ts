import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import type { ProjectDetailsInput } from '../projects/project.schemas.js'
import type { dashboardService } from './dashboard.service.js'

export function dashboardController(service: ReturnType<typeof dashboardService>) {
  const statistics: RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: ProjectDetailsInput }> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.statistics(user.id, input.params.id) })
  }

  return { statistics }
}
