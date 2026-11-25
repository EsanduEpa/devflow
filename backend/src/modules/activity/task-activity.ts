import type { ClientSession } from 'mongoose'
import type { TaskRecord } from '../tasks/task.model.js'
import type { ActivityChange } from './activity.model.js'
import type { ActivityRepository } from './activity.repository.js'

function trackedFields(task: TaskRecord) {
  return {
    assigneeId: task.assigneeId?.toString() ?? null,
    priority: task.priority,
    status: task.status,
    sprintId: task.sprintId?.toString() ?? null,
  }
}

export async function recordTaskActivity(
  activity: Pick<ActivityRepository, 'append'>, task: TaskRecord, actorId: string,
  previous: TaskRecord | null, session: ClientSession,
) {
  const next = trackedFields(task)
  const prior = previous ? trackedFields(previous) : null
  const changes: ActivityChange[] = []
  for (const field of Object.keys(next) as (keyof typeof next)[]) {
    const from = prior?.[field] ?? null
    if (from !== next[field]) changes.push({ field, from, to: next[field] })
  }
  if (previous && !changes.length) return
  await activity.append([{
    taskId: task._id, actorId, changes,
    action: previous ? 'TASK_UPDATED' : 'TASK_CREATED',
    completed: !!previous && previous.status !== 'DONE' && task.status === 'DONE',
    createdAt: previous ? task.updatedAt : task.createdAt,
  }], session)
}
