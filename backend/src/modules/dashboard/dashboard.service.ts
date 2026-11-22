import type { ProjectService } from '../projects/project.service.js'
import type { dashboardRepository } from './dashboard.repository.js'

export function dashboardService(repository: ReturnType<typeof dashboardRepository>, projects: Pick<ProjectService, 'requireAccess'>) {
  return {
    async statistics(userId: string, projectId: string) {
      await projects.requireAccess(userId, projectId)

      const todayUtc = new Date()
      todayUtc.setUTCHours(0, 0, 0, 0)
      const counts = await repository.countTasks(projectId, todayUtc)
      const { completedTasks, totalTasks } = counts
      const completionPercentage = totalTasks ? Math.round((completedTasks * 10_000) / totalTasks) / 100 : 0

      return { projectId, ...counts, completionPercentage }
    },
  }
}
