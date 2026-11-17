import { Router } from 'express'
import type { Connection } from 'mongoose'
import type { AuthConfig } from './config/auth.js'
import type { ResetEmailConfig } from './config/reset-email.js'
import { createAuthModule, type AuthCollections } from './modules/auth/auth.routes.js'
import { createProjectRoutes, type ProjectCollections } from './modules/projects/project.routes.js'
import { createWorkspaceRoutes, type WorkspaceCollections } from './modules/workspaces/workspace.routes.js'

export async function createApi(
  connection: Connection,
  authConfig: AuthConfig,
  emailConfig: ResetEmailConfig,
  collections?: { auth: AuthCollections; workspace: WorkspaceCollections; project: ProjectCollections },
) {
  const auth = await createAuthModule(connection, authConfig, emailConfig, collections?.auth)
  const workspaces = await createWorkspaceRoutes(connection, auth, collections?.workspace)
  const projects = await createProjectRoutes(connection, auth, workspaces, collections?.project)
  const router = Router()

  router.use(auth.router)
  router.use('/workspaces', workspaces.router)
  router.use('/workspaces', projects.workspaceProjects)
  router.use('/projects', projects.projectDetails)
  router.use('/invitations', workspaces.invitationRouter)
  return router
}
