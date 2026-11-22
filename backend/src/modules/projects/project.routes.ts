import { Router, type RequestHandler } from 'express'
import type { authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import type { TaskRepository } from '../tasks/task.repository.js'
import type { userModel } from '../users/user.model.js'
import type { workspaceMemberModel } from '../workspaces/workspace-member.model.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import { projectController } from './project.controller.js'
import { projectRepository, type ProjectModels } from './project.repository.js'
import { projectCreateSchema, projectDetailsSchema, projectListSchema, projectMemberAddSchema, projectMemberRemoveSchema, projectUpdateSchema } from './project.schemas.js'
import { projectService } from './project.service.js'

export type ProjectCollections = { projects: string; members: string }

export async function createProjectRoutes(
  { projects, members }: ProjectModels,
  { requireUser, verifyCsrf, users }: {
    requireUser: ReturnType<typeof authenticate>
    verifyCsrf: RequestHandler
    users: ReturnType<typeof userModel>
  },
  workspaces: { service: WorkspaceService; members: ReturnType<typeof workspaceMemberModel> },
  tasks: Pick<TaskRepository, 'unassignInProject'>,
) {
  await Promise.all([projects.createIndexes(), members.createIndexes()])
  const service = projectService(projectRepository(projects, members, workspaces.members, users), workspaces.service, tasks)
  const controller = projectController(service)

  const noStore: RequestHandler = (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }
  const workspaceProjects = Router()
  workspaceProjects.get('/:id/projects', noStore, requireUser, validateRequest(projectListSchema), controller.list)
  workspaceProjects.post('/:id/projects', noStore, requireUser, verifyCsrf, validateRequest(projectCreateSchema), controller.create)

  const projectDetails = Router()
  projectDetails.get('/:id', noStore, requireUser, validateRequest(projectDetailsSchema), controller.details)
  projectDetails.patch('/:id', noStore, requireUser, verifyCsrf, validateRequest(projectUpdateSchema), controller.update)
  projectDetails.get('/:id/members', noStore, requireUser, validateRequest(projectDetailsSchema), controller.listMembers)
  projectDetails.post('/:id/members', noStore, requireUser, verifyCsrf, validateRequest(projectMemberAddSchema), controller.addMember)
  projectDetails.delete('/:id/members/:userId', noStore, requireUser, verifyCsrf, validateRequest(projectMemberRemoveSchema), controller.removeMember)

  return { workspaceProjects, projectDetails, service }
}
