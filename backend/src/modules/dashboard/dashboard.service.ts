import type { ProjectService } from '../projects/project.service.js'
import type { SprintService } from '../sprints/sprint.service.js'
import type { dashboardRepository } from './dashboard.repository.js'

export function dashboardService(
  repository: ReturnType<typeof dashboardRepository>, projects: Pick<ProjectService, 'requireAccess'>,
  sprints: Pick<SprintService, 'dashboardProgress'>,
) {
  return {
    async statistics(userId: string, projectId: string) {
      const { project } = await projects.requireAccess(userId, projectId)

      const todayUtc = new Date()
      todayUtc.setUTCHours(0, 0, 0, 0)
      const [counts, sprintProgress] = await Promise.all([repository.countTasks(projectId, todayUtc), sprints.dashboardProgress(project)])
      const { completedTasks, totalTasks } = counts
      const completionPercentage = totalTasks ? Math.round((completedTasks * 10_000) / totalTasks) / 100 : 0

      return { projectId, ...counts, completionPercentage, sprintProgress }
    },
  }
}
