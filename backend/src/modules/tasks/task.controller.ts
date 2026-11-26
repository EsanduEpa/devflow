import type { Request, RequestHandler } from 'express'
import type { AuthenticatedLocals } from '../../middleware/authenticate.js'
import type { TaskCreateInput, TaskDetailsInput, TaskListInput, TaskStatusInput, TaskUpdateInput } from './task.schemas.js'
import type { Realtime } from '../realtime/realtime.js'
import type { TaskService } from './task.service.js'

type TaskRequest<Input> = RequestHandler<Request['params'], unknown, unknown, unknown, AuthenticatedLocals & { input: Input }>

export function taskController(service: TaskService, live?: Realtime) {
  function taskChanged({ projectId, id, version }: Awaited<ReturnType<TaskService['details']>>) {
    live?.publish({ projectId, kind: 'task.changed', taskId: id, version })
  }

  const create: TaskRequest<TaskCreateInput> = async (_request, response) => {
    const { user, input } = response.locals
    const task = await service.create(user.id, input.params.id, input.body)
    taskChanged(task)
    response.status(201).json({ data: task })
  }

  const details: TaskRequest<TaskDetailsInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json({ data: await service.details(user.id, input.params.id) })
  }

  const list: TaskRequest<TaskListInput> = async (_request, response) => {
    const { user, input } = response.locals
    response.json(await service.list(user.id, input.params.id, input.query))
  }

  const changeStatus: TaskRequest<TaskStatusInput> = async (_request, response) => {
    const { user, input } = response.locals
    const task = await service.changeStatus(user.id, input.params.id, input.body.status, input.body.expectedVersion)
    taskChanged(task)
    response.json({ data: task })
  }

  const update: TaskRequest<TaskUpdateInput> = async (_request, response) => {
    const { user, input } = response.locals
    const task = await service.update(user.id, input.params.id, input.body)
    taskChanged(task)
    response.json({ data: task })
  }

  const remove: TaskRequest<TaskDetailsInput> = async (_request, response) => {
    const { user, input } = response.locals
    const projectId = await service.remove(user.id, input.params.id)
    live?.publish({ projectId, kind: 'task.deleted', taskId: input.params.id })
    response.status(204).end()
  }

  return { create, details, list, changeStatus, update, remove }
}
