import { Router, type RequestHandler } from 'express'
import type { Connection } from 'mongoose'
import type { authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { workspaceController } from './workspace.controller.js'
import { workspaceMemberModel } from './workspace-member.model.js'
import { workspaceModel } from './workspace.model.js'
import { workspaceRepository } from './workspace.repository.js'
import { workspaceCreateSchema, workspaceDetailsSchema, workspaceListSchema, workspaceUpdateSchema } from './workspace.schemas.js'
import { workspaceService } from './workspace.service.js'

export type WorkspaceCollections = { workspaces: string; members: string }

export async function createWorkspaceRoutes(
  connection: Connection,
  { requireUser, verifyCsrf }: { requireUser: ReturnType<typeof authenticate>; verifyCsrf: RequestHandler },
  collections?: WorkspaceCollections,
) {
  const workspaces = workspaceModel(connection, collections?.workspaces)
  const members = workspaceMemberModel(connection, collections?.members)
  await Promise.all([workspaces.createIndexes(), members.createIndexes()])

  const controller = workspaceController(workspaceService(workspaceRepository(workspaces, members)))
  const router = Router()
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  router.get('/', requireUser, validateRequest(workspaceListSchema), controller.list)
  router.post('/', requireUser, verifyCsrf, validateRequest(workspaceCreateSchema), controller.create)
  router.get('/:id', requireUser, validateRequest(workspaceDetailsSchema), controller.details)
  router.patch('/:id', requireUser, verifyCsrf, validateRequest(workspaceUpdateSchema), controller.update)
  return router
}
