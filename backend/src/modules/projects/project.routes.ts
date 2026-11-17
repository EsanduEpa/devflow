import { Router, type RequestHandler } from 'express'
import type { Connection } from 'mongoose'
import type { authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import type { userModel } from '../users/user.model.js'
import type { workspaceMemberModel } from '../workspaces/workspace-member.model.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import { projectController } from './project.controller.js'
import { projectMemberModel } from './project-member.model.js'
import { projectModel } from './project.model.js'
import { projectRepository } from './project.repository.js'
import { projectCreateSchema, projectDetailsSchema, projectListSchema } from './project.schemas.js'
import { projectService } from './project.service.js'

export type ProjectCollections = { projects: string; members: string }

export async function createProjectRoutes(
  connection: Connection,
  { requireUser, verifyCsrf, users }: {
    requireUser: ReturnType<typeof authenticate>
    verifyCsrf: RequestHandler
    users: ReturnType<typeof userModel>
  },
  workspaces: { service: WorkspaceService; members: ReturnType<typeof workspaceMemberModel> },
  collections?: ProjectCollections,
) {
  const projects = projectModel(connection, collections?.projects)
  const members = projectMemberModel(connection, collections?.members)
  await Promise.all([projects.createIndexes(), members.createIndexes()])
  const controller = projectController(projectService(projectRepository(projects, members, workspaces.members, users), workspaces.service))

  const noStore: RequestHandler = (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }
  const workspaceProjects = Router()
  workspaceProjects.get('/:id/projects', noStore, requireUser, validateRequest(projectListSchema), controller.list)
  workspaceProjects.post('/:id/projects', noStore, requireUser, verifyCsrf, validateRequest(projectCreateSchema), controller.create)

  const projectDetails = Router()
  projectDetails.get('/:id', noStore, requireUser, validateRequest(projectDetailsSchema), controller.details)

  return { workspaceProjects, projectDetails }
}
