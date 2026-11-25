import { Router } from 'express'
import type { Connection } from 'mongoose'
import type { AuthConfig } from './config/auth.js'
import type { ResetEmailConfig } from './config/reset-email.js'
import { createAuthModule, type AuthCollections } from './modules/auth/auth.routes.js'
import { commentModel } from './modules/comments/comment.model.js'
import { commentRepository } from './modules/comments/comment.repository.js'
import { createCommentRoutes } from './modules/comments/comment.routes.js'
import { commentService } from './modules/comments/comment.service.js'
import { dashboardRepository } from './modules/dashboard/dashboard.repository.js'
import { createDashboardRoutes } from './modules/dashboard/dashboard.routes.js'
import { dashboardService } from './modules/dashboard/dashboard.service.js'
import { projectMemberModel } from './modules/projects/project-member.model.js'
import { projectModel } from './modules/projects/project.model.js'
import { createProjectRoutes, type ProjectCollections } from './modules/projects/project.routes.js'
import { sprintModel } from './modules/sprints/sprint.model.js'
import { sprintRepository } from './modules/sprints/sprint.repository.js'
import { createSprintRoutes } from './modules/sprints/sprint.routes.js'
import { sprintService } from './modules/sprints/sprint.service.js'
import { taskModel } from './modules/tasks/task.model.js'
import { taskRepository } from './modules/tasks/task.repository.js'
import { createTaskRoutes } from './modules/tasks/task.routes.js'
import { taskService } from './modules/tasks/task.service.js'
import { createWorkspaceRoutes, type WorkspaceCollections } from './modules/workspaces/workspace.routes.js'

export async function createApi(
  connection: Connection,
  authConfig: AuthConfig,
  emailConfig: ResetEmailConfig,
  collections?: {
    auth: AuthCollections
    workspace: WorkspaceCollections
    project: ProjectCollections
    task: { tasks: string }
    sprint: { sprints: string }
    comment: { comments: string }
  },
) {
  const auth = await createAuthModule(connection, authConfig, emailConfig, collections?.auth)
  const projectModels = {
    projects: projectModel(connection, collections?.project.projects),
    members: projectMemberModel(connection, collections?.project.members),
  }
  const tasks = taskModel(connection, collections?.task.tasks)
  const sprints = sprintModel(connection, collections?.sprint.sprints)
  const comments = commentModel(connection, collections?.comment.comments)
  await Promise.all([tasks.createIndexes(), sprints.createIndexes(), comments.createIndexes()])
  const commentStore = commentRepository(comments, auth.users)
  const sprintStore = sprintRepository(sprints)
  const taskStore = taskRepository(tasks, projectModels.projects)
  const workspaces = await createWorkspaceRoutes(connection, auth, projectModels, taskStore, collections?.workspace)
  const projects = await createProjectRoutes(projectModels, auth, workspaces, taskStore)
  const taskOperations = taskService(taskStore, projects.service, workspaces.service, sprintStore, commentStore)
  const taskRoutes = createTaskRoutes(taskOperations, auth)
  const commentRoutes = createCommentRoutes(commentService(commentStore, taskOperations, projects.service, workspaces.service), auth)
  const dashboardRoutes = createDashboardRoutes(dashboardService(dashboardRepository(tasks), projects.service), auth.requireUser)
  const router = Router()

  router.use(auth.router)
  router.use(createSprintRoutes(sprintService(sprintStore, taskStore, projects.service, workspaces.service), auth))
  router.use('/workspaces', workspaces.router)
  router.use('/workspaces', projects.workspaceProjects)
  router.use('/projects', projects.projectDetails)
  router.use('/projects', taskRoutes.projectTasks)
  router.use('/projects', dashboardRoutes)
  router.use('/tasks', taskRoutes.tasks)
  router.use('/tasks', commentRoutes)
  router.use('/invitations', workspaces.invitationRouter)
  return router
}
