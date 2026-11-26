import type { ProjectService } from '../projects/project.service.js'
import type { projectModel } from '../projects/project.model.js'
import type { Realtime } from '../realtime/realtime.js'
import type { taskModel } from '../tasks/task.model.js'
import type { WorkspaceService } from '../workspaces/workspace.service.js'
import type { NotificationInput, NotificationRepository } from './notification.repository.js'

export type DeadlineScan = (now?: Date) => Promise<void>

export function createDeadlineScan(
  taskRecords: ReturnType<typeof taskModel>, projectRecords: ReturnType<typeof projectModel>,
  projects: ProjectService, workspaces: WorkspaceService, repository: NotificationRepository, live?: Realtime,
): DeadlineScan {
  return async (now = new Date()) => {
    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)
    const end = new Date(today)
    end.setUTCDate(end.getUTCDate() + 3)
    const filter = { dueDate: { $gte: today, $lt: end }, status: { $ne: 'DONE' as const }, assigneeId: { $ne: null } }
    const candidates = taskRecords.find(filter).select('projectId dueDate assigneeId').lean().cursor()
    function notification(taskId: string, recipientId: string, dueDate: Date): NotificationInput {
      return { taskId, recipientId, kind: 'DEADLINE', occurrenceId: taskId + ':' + dueDate.toISOString().slice(0, 10) }
    }

    for await (const candidate of candidates) {
      if (!candidate.assigneeId || !candidate.dueDate) continue
      const event = notification(candidate._id.toString(), candidate.assigneeId.toString(), candidate.dueDate)
      if (await repository.exists(event)) continue

      const recipients = await taskRecords.db.transaction(async (session) => {
        const project = await projectRecords.findById(candidate.projectId).session(session).lean().exec()
        if (!project || project.status === 'ARCHIVED') return []
        await workspaces.lockMemberships(project.workspaceId.toString(), session)
        const task = await taskRecords.findOne({ ...filter, _id: candidate._id, projectId: project._id })
          .session(session).lean().exec()
        if (!task?.assigneeId || !task.dueDate) return []
        const recipientId = task.assigneeId.toString()
        if (!await projects.isEligibleTaskAssignee(project, recipientId, session)) return []
        return repository.insert([notification(task._id.toString(), recipientId, task.dueDate)], session)
      })
      live?.notifyRecipients(recipients)
    }
  }
}

export function startDeadlineScan(scan: DeadlineScan) {
  let running = false
  async function tick() {
    if (running) return
    running = true
    try { await scan() }
    catch { console.error('DevFlow could not finish checking task deadlines.') }
    finally { running = false }
  }
  const timer = setInterval(() => void tick(), 15 * 60 * 1000)
  timer.unref()
  void tick()
}
