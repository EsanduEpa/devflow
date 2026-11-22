import { Router, type RequestHandler } from 'express'
import type { authenticate } from '../../middleware/authenticate.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { taskController } from './task.controller.js'
import { taskCreateSchema, taskDetailsSchema, taskListSchema, taskStatusSchema, taskUpdateSchema } from './task.schemas.js'
import type { TaskService } from './task.service.js'

export function createTaskRoutes(service: TaskService, { requireUser, verifyCsrf }: {
  requireUser: ReturnType<typeof authenticate>
  verifyCsrf: RequestHandler
}) {
  const controller = taskController(service)
  const noStore: RequestHandler = (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }
  const projectTasks = Router()
  projectTasks.get('/:id/tasks', noStore, requireUser, validateRequest(taskListSchema), controller.list)
  projectTasks.post('/:id/tasks', noStore, requireUser, verifyCsrf, validateRequest(taskCreateSchema), controller.create)

  const tasks = Router()
  tasks.get('/:id', noStore, requireUser, validateRequest(taskDetailsSchema), controller.details)
  tasks.patch('/:id', noStore, requireUser, verifyCsrf, validateRequest(taskUpdateSchema), controller.update)
  tasks.patch('/:id/status', noStore, requireUser, verifyCsrf, validateRequest(taskStatusSchema), controller.changeStatus)
  tasks.delete('/:id', noStore, requireUser, verifyCsrf, validateRequest(taskDetailsSchema), controller.remove)
  return { projectTasks, tasks }
}
