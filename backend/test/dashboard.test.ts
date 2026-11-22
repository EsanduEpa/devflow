import { afterEach, expect, it, vi } from 'vitest'
import { dashboardService } from '../src/modules/dashboard/dashboard.service.js'
import type { ProjectService } from '../src/modules/projects/project.service.js'
import { ApiError } from '../src/shared/api-error.js'

afterEach(() => vi.useRealTimers())

it('uses the UTC day boundary and rounds midpoint completion percentages up', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2028-03-01T00:00:01.000Z') })
  const requireAccess = vi.fn<ProjectService['requireAccess']>()
  const counts = { totalTasks: 32, completedTasks: 1, inProgressTasks: 4, overdueTasks: 2 }
  const countTasks = vi.fn().mockResolvedValue(counts)
  const service = dashboardService({ countTasks }, { requireAccess })

  await expect(service.statistics('viewer', 'project')).resolves.toEqual({
    projectId: 'project', ...counts, completionPercentage: 3.13,
  })
  expect(requireAccess).toHaveBeenCalledWith('viewer', 'project')
  expect(countTasks).toHaveBeenCalledWith('project', new Date('2028-03-01T00:00:00.000Z'))
})

it('rejects missing project access before asking for any task statistics', async () => {
  const denied = new ApiError(404, 'NOT_FOUND', 'The project was not found.')
  const requireAccess = vi.fn<ProjectService['requireAccess']>().mockRejectedValue(denied)
  const countTasks = vi.fn()
  const service = dashboardService({ countTasks }, { requireAccess })

  await expect(service.statistics('viewer', 'project')).rejects.toBe(denied)
  expect(countTasks).not.toHaveBeenCalled()
})
