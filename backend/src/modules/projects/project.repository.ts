import { Types, type PipelineStage } from 'mongoose'
import type { userModel } from '../users/user.model.js'
import type { WorkspaceRole, workspaceMemberModel } from '../workspaces/workspace-member.model.js'
import type { projectMemberModel } from './project-member.model.js'
import type { ProjectRecord, projectModel } from './project.model.js'
import type { ProjectCreateInput, ProjectListInput } from './project.schemas.js'

function dateAtUtcMidnight(value: string | null) {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`)
}

type ProjectPage = { items: ProjectRecord[]; count: { total: number }[] }

export function projectRepository(
  projects: ReturnType<typeof projectModel>,
  projectMembers: ReturnType<typeof projectMemberModel>,
  workspaceMembers: ReturnType<typeof workspaceMemberModel>,
  users: ReturnType<typeof userModel>,
) {
  return {
    create(workspaceId: string, { startDate, targetDate, ...fields }: ProjectCreateInput['body']) {
      return projects.db.transaction(async (session) => {
        const project = await new projects({
          ...fields, workspaceId, startDate: dateAtUtcMidnight(startDate), targetDate: dateAtUtcMidnight(targetDate),
        }).save({ session })
        await new projectMembers({ projectId: project._id, userId: project.managerId }).save({ session })
        return project
      })
    },

    async findEligibleManager(workspaceId: string, userId: string) {
      const member = await workspaceMembers.exists({ workspaceId, userId, role: { $in: ['OWNER', 'MANAGER'] } }).exec()
      return member && await users.exists({ _id: userId }).exec()
    },

    async list(workspaceId: string, userId: string, role: WorkspaceRole, { page, limit, status }: ProjectListInput['query']) {
      const pipeline: PipelineStage[] = [
        { $match: { workspaceId: new Types.ObjectId(workspaceId), status: status ?? { $ne: 'ARCHIVED' } } },
      ]
      if (role !== 'OWNER') {
        const memberId = new Types.ObjectId(userId)
        const membership = { 'access.0': { $exists: true } }
        pipeline.push(
          {
            $lookup: {
              from: projectMembers.collection.name,
              localField: '_id',
              foreignField: 'projectId',
              pipeline: [{ $match: { userId: memberId } }, { $project: { _id: 1 } }],
              as: 'access',
            },
          },
          { $match: role === 'MANAGER' ? { $or: [{ managerId: memberId }, membership] } : membership },
          { $unset: 'access' },
        )
      }
      pipeline.push({
        $facet: {
          items: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      })
      const [result] = await projects.aggregate<ProjectPage>(pipeline).exec()
      return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 }
    },

    find(id: string) {
      return projects.findById(id).lean().exec()
    },

    hasMembership(projectId: string, userId: string) {
      return projectMembers.exists({ projectId, userId }).exec()
    },
  }
}

export type ProjectRepository = ReturnType<typeof projectRepository>
