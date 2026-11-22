import { Types } from 'mongoose'
import type { taskModel } from '../tasks/task.model.js'

type TaskCounts = {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
}

export function dashboardRepository(tasks: ReturnType<typeof taskModel>) {
  return {
    async countTasks(projectId: string, todayUtc: Date): Promise<TaskCounts> {
      const [counts] = await tasks.aggregate<TaskCounts>([
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
        } },
        { $project: { _id: 0 } },
      ]).exec()

      return counts ?? { totalTasks: 0, completedTasks: 0, inProgressTasks: 0, overdueTasks: 0 }
    },
  }
}
