import { Router } from 'express'
import type { Connection } from 'mongoose'
import type { AuthConfig } from './config/auth.js'
import type { ResetEmailConfig } from './config/reset-email.js'
import { createAuthModule, type AuthCollections } from './modules/auth/auth.routes.js'
import { projectMemberModel } from './modules/projects/project-member.model.js'
import { projectModel } from './modules/projects/project.model.js'
import { createProjectRoutes, type ProjectCollections } from './modules/projects/project.routes.js'
import { createWorkspaceRoutes, type WorkspaceCollections } from './modules/workspaces/workspace.routes.js'

export async function createApi(
  connection: Connection,
  authConfig: AuthConfig,
  emailConfig: ResetEmailConfig,
  collections?: { auth: AuthCollections; workspace: WorkspaceCollections; project: ProjectCollections },
) {
  const auth = await createAuthModule(connection, authConfig, emailConfig, collections?.auth)
  const projectModels = {
    projects: projectModel(connection, collections?.project.projects),
    members: projectMemberModel(connection, collections?.project.members),
  }
  const workspaces = await createWorkspaceRoutes(connection, auth, projectModels, collections?.workspace)
  const projects = await createProjectRoutes(projectModels, auth, workspaces)
  const router = Router()

  router.use(auth.router)
  router.use('/workspaces', workspaces.router)
  router.use('/workspaces', projects.workspaceProjects)
  router.use('/projects', projects.projectDetails)
  router.use('/invitations', workspaces.invitationRouter)
  return router
}
