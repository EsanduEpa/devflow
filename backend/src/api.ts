import { Router } from 'express'
import type { Connection } from 'mongoose'
import type { AuthConfig } from './config/auth.js'
import type { ResetEmailConfig } from './config/reset-email.js'
import { createAuthModule, type AuthCollections } from './modules/auth/auth.routes.js'
import { projectMemberModel } from './modules/projects/project-member.model.js'
import { projectModel } from './modules/projects/project.model.js'
import { createProjectRoutes, type ProjectCollections } from './modules/projects/project.routes.js'
import { taskModel } from './modules/tasks/task.model.js'
import { taskRepository } from './modules/tasks/task.repository.js'
import { createTaskRoutes } from './modules/tasks/task.routes.js'
import { taskService } from './modules/tasks/task.service.js'
import { createWorkspaceRoutes, type WorkspaceCollections } from './modules/workspaces/workspace.routes.js'

export async function createApi(
  connection: Connection,
  authConfig: AuthConfig,
  emailConfig: ResetEmailConfig,
  collections?: { auth: AuthCollections; workspace: WorkspaceCollections; project: ProjectCollections; task: { tasks: string } },
) {
  const auth = await createAuthModule(connection, authConfig, emailConfig, collections?.auth)
  const projectModels = {
    projects: projectModel(connection, collections?.project.projects),
    members: projectMemberModel(connection, collections?.project.members),
  }
  const tasks = taskModel(connection, collections?.task.tasks)
  await tasks.createIndexes()
  const taskStore = taskRepository(tasks, projectModels.projects)
  const workspaces = await createWorkspaceRoutes(connection, auth, projectModels, taskStore, collections?.workspace)
  const projects = await createProjectRoutes(projectModels, auth, workspaces, taskStore)
  const taskRoutes = createTaskRoutes(taskService(taskStore, projects.service, workspaces.service), auth)
  const router = Router()

  router.use(auth.router)
  router.use('/workspaces', workspaces.router)
  router.use('/workspaces', projects.workspaceProjects)
  router.use('/projects', projects.projectDetails)
  router.use('/projects', taskRoutes.projectTasks)
  router.use('/tasks', taskRoutes.tasks)
  router.use('/invitations', workspaces.invitationRouter)
  return router
}
