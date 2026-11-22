import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import type { TaskCreateInput, TaskDetailsInput, TaskUpdateInput } from './task.schemas.js'
import type { TaskService } from './task.service.js'

type TaskRequest<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function taskController(service: TaskService) {
  const create: TaskRequest<TaskCreateInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.status(201).json({ data: await service.create(user.id, input.params.id, input.body) })
  }

  const details: TaskRequest<TaskDetailsInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.details(user.id, input.params.id) })
  }

  const update: TaskRequest<TaskUpdateInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.update(user.id, input.params.id, input.body) })
  }

  const remove: TaskRequest<TaskDetailsInput> = async (_request, response) => {
    const { user, input } = response.locals
    await service.remove(user.id, input.params.id)
    response.status(204).end()
  }

  return { create, details, update, remove }
}
