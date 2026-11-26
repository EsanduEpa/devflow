import { Types, type PipelineStage } from 'mongoose'
import { taskPriorities, type taskModel } from '../tasks/task.model.js'

type TaskCounts = {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  priorityCounts: Record<typeof taskPriorities[number], number>
}

export function dashboardTaskPipeline(projectId: string, todayUtc: Date): [PipelineStage.Match, PipelineStage.Group, PipelineStage.Project] {
  const priorities = Object.fromEntries(taskPriorities.map((priority) => [priority, {
    $sum: { $cond: [{ $eq: ['$priority', priority] }, 1, 0] },
  }]))
  return [
    { $match: { projectId: new Types.ObjectId(projectId) } },
    { $group: {
      _id: null,
      totalTasks: { $sum: 1 },
      completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] } },
      inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] } },
      overdueTasks: { $sum: { $cond: [{ $and: [
        { $eq: [{ $type: '$dueDate' }, 'date'] },
        { $lt: ['$dueDate', todayUtc] },
        { $ne: ['$status', 'DONE'] },
      ] }, 1, 0] } },
      ...priorities,
    } },
    { $project: { _id: 0, totalTasks: 1, completedTasks: 1, inProgressTasks: 1, overdueTasks: 1,
      priorityCounts: { LOW: '$LOW', MEDIUM: '$MEDIUM', HIGH: '$HIGH', URGENT: '$URGENT' } } },
  ]
}

export function dashboardRepository(tasks: ReturnType<typeof taskModel>) {
  return {
    async countTasks(projectId: string, todayUtc: Date): Promise<TaskCounts> {
      const [counts] = await tasks.aggregate<TaskCounts>(dashboardTaskPipeline(projectId, todayUtc)).exec()
      return counts ?? { totalTasks: 0, completedTasks: 0, inProgressTasks: 0, overdueTasks: 0,
        priorityCounts: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 } }
    },
  }
}
