import { Router, type RequestHandler } from 'express'
import type { Connection } from 'mongoose'
import type { authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import type { ProjectModels } from '../projects/project.repository.js'
import type { TaskRepository } from '../tasks/task.repository.js'
import type { userModel } from '../users/user.model.js'
import { invitationController } from './workspace-invitation.controller.js'
import { workspaceInvitationModel } from './workspace-invitation.model.js'
import { invitationRepository } from './workspace-invitation.repository.js'
import { invitationAcceptSchema, invitationCreateSchema, invitationListSchema, invitationPreviewSchema } from './workspace-invitation.schemas.js'
import { invitationService } from './workspace-invitation.service.js'
import { workspaceController } from './workspace.controller.js'
import { workspaceMemberModel } from './workspace-member.model.js'
import { workspaceModel } from './workspace.model.js'
import { workspaceRepository } from './workspace.repository.js'
import { workspaceCreateSchema, workspaceDetailsSchema, workspaceListSchema, workspaceMemberRemoveSchema, workspaceMemberRoleSchema, workspaceUpdateSchema } from './workspace.schemas.js'
import { workspaceService } from './workspace.service.js'

export type WorkspaceCollections = { workspaces: string; members: string; invitations: string }

export async function createWorkspaceRoutes(
  connection: Connection,
  { requireUser, verifyCsrf, users }: {
    requireUser: ReturnType<typeof authenticate>
    verifyCsrf: RequestHandler
    users: ReturnType<typeof userModel>
  },
  projectModels: ProjectModels,
  tasks: Pick<TaskRepository, 'unassignInWorkspace'>,
  collections?: WorkspaceCollections,
) {
  const workspaces = workspaceModel(connection, collections?.workspaces)
  const members = workspaceMemberModel(connection, collections?.members)
  const invitationModel = workspaceInvitationModel(connection, collections?.invitations)
  await Promise.all([workspaces.createIndexes(), members.createIndexes(), invitationModel.createIndexes()])

  const repository = workspaceRepository(workspaces, members, users, projectModels)
  const service = workspaceService(repository, tasks)
  const controller = workspaceController(service)
  const invitations = invitationController(invitationService(invitationRepository(invitationModel, workspaces, members, users), repository, service))
  const router = Router()
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  router.get('/', requireUser, validateRequest(workspaceListSchema), controller.list)
  router.post('/', requireUser, verifyCsrf, validateRequest(workspaceCreateSchema), controller.create)
  router.get('/:id', requireUser, validateRequest(workspaceDetailsSchema), controller.details)
  router.patch('/:id', requireUser, verifyCsrf, validateRequest(workspaceUpdateSchema), controller.update)
  router.get('/:id/members', requireUser, validateRequest(workspaceDetailsSchema), controller.listMembers)
  router.patch('/:id/members/:userId', requireUser, verifyCsrf, validateRequest(workspaceMemberRoleSchema), controller.changeMemberRole)
  router.delete('/:id/members/:userId', requireUser, verifyCsrf, validateRequest(workspaceMemberRemoveSchema), controller.removeMember)
  router.get('/:id/invitations', requireUser, validateRequest(invitationListSchema), invitations.list)
  router.post('/:id/invitations', requireUser, verifyCsrf, validateRequest(invitationCreateSchema), invitations.create)

  const invitationRouter = Router()
  invitationRouter.use((_request, response, next) => {
    response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
    next()
  })
  invitationRouter.get('/:token', validateRequest(invitationPreviewSchema), invitations.preview)
  invitationRouter.post('/:token/accept', requireUser, verifyCsrf, validateRequest(invitationAcceptSchema), invitations.accept)
  return { router, invitationRouter, service, members }
}
