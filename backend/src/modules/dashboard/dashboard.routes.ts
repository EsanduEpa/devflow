import { Router, type RequestHandler } from 'express'
import type { authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { projectDetailsSchema } from '../projects/project.schemas.js'
import { dashboardController } from './dashboard.controller.js'
import type { dashboardService } from './dashboard.service.js'

export function createDashboardRoutes(service: ReturnType<typeof dashboardService>, requireUser: ReturnType<typeof authenticate>) {
  const controller = dashboardController(service)
  const noStore: RequestHandler = (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }
  const router = Router()
  router.get('/:id/dashboard', noStore, requireUser, validateRequest(projectDetailsSchema), controller.statistics)
  return router
}
