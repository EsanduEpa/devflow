import { Router } from 'express'
import type { Connection } from 'mongoose'
import type { AuthConfig } from './config/auth.js'
import type { ResetEmailConfig } from './config/reset-email.js'
import { createAuthModule, type AuthCollections } from './modules/auth/auth.routes.js'
import { createWorkspaceRoutes, type WorkspaceCollections } from './modules/workspaces/workspace.routes.js'

export async function createApi(
  connection: Connection,
  authConfig: AuthConfig,
  emailConfig: ResetEmailConfig,
  collections?: { auth: AuthCollections; workspace: WorkspaceCollections },
) {
  const auth = await createAuthModule(connection, authConfig, emailConfig, collections?.auth)
  const workspaces = await createWorkspaceRoutes(connection, auth, collections?.workspace)
  const router = Router()

  router.use(auth.router)
  router.use('/workspaces', workspaces.router)
  router.use('/invitations', workspaces.invitationRouter)
  return router
}
