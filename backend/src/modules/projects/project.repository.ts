import { Types, type ClientSession, type PipelineStage } from 'mongoose'
import { dateAtUtcMidnight } from '../../shared/date-only.js'
import type { userModel } from '../users/user.model.js'
import type { WorkspaceRole, workspaceMemberModel } from '../workspaces/workspace-member.model.js'
import type { projectMemberModel } from './project-member.model.js'
import type { ProjectRecord, projectModel } from './project.model.js'
import type { ProjectCreateInput, ProjectListInput, ProjectUpdateInput } from './project.schemas.js'

type ProjectPage = { items: ProjectRecord[]; count: { total: number }[] }
type ProjectMemberSummary = { user: { id: string; name: string }; workspaceRole: WorkspaceRole; joinedAt: Date }
export type ProjectModels = { projects: ReturnType<typeof projectModel>; members: ReturnType<typeof projectMemberModel> }

export function projectRepository(
  projects: ReturnType<typeof projectModel>,
  projectMembers: ReturnType<typeof projectMemberModel>,
  workspaceMembers: ReturnType<typeof workspaceMemberModel>,
  users: ReturnType<typeof userModel>,
) {
  return {
    async create(workspaceId: string, { startDate, targetDate, ...fields }: ProjectCreateInput['body'], session: ClientSession) {
      const project = await new projects({
        ...fields, workspaceId, startDate: dateAtUtcMidnight(startDate), targetDate: dateAtUtcMidnight(targetDate),
      }).save({ session })
      await new projectMembers({ projectId: project._id, userId: project.managerId }).save({ session })
      return project
    },

    async findEligibleManager(workspaceId: string, userId: string, session?: ClientSession) {
      const member = await workspaceMembers.exists({ workspaceId, userId, role: { $in: ['OWNER', 'MANAGER'] } })
        .session(session ?? null).exec()
      return member && await users.exists({ _id: userId }).session(session ?? null).exec()
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

    find(id: string, session?: ClientSession) {
      return projects.findById(id).session(session ?? null).lean().exec()
    },

    hasMembership(projectId: string, userId: string, session?: ClientSession) {
      return projectMembers.exists({ projectId, userId }).session(session ?? null).exec()
    },

    transaction<T>(operation: (session: ClientSession) => Promise<T>) {
      return projects.db.transaction(operation)
    },

    update(id: string, { startDate, targetDate, ...fields }: ProjectUpdateInput['body'], session: ClientSession) {
      return projects.findByIdAndUpdate(id, { $set: {
        ...fields,
        ...(startDate !== undefined && { startDate: dateAtUtcMidnight(startDate) }),
        ...(targetDate !== undefined && { targetDate: dateAtUtcMidnight(targetDate) }),
      } }, { session, returnDocument: 'after', runValidators: true }).lean().exec()
    },

    async isWorkspaceMember(workspaceId: Types.ObjectId, userId: string, session: ClientSession) {
      const member = await workspaceMembers.exists({ workspaceId, userId }).session(session).exec()
      return member && await users.exists({ _id: userId }).session(session).exec()
    },

    addMember(projectId: string, userId: string, session: ClientSession) {
      return new projectMembers({ projectId, userId }).save({ session })
    },

    ensureMember(projectId: string, userId: string, session: ClientSession) {
      return projectMembers.updateOne({ projectId, userId }, { $setOnInsert: { joinedAt: new Date() } }, { upsert: true, session }).exec()
    },

    removeMember(projectId: string, userId: string, session: ClientSession) {
      return projectMembers.deleteOne({ projectId, userId }, { session }).exec()
    },

    listAccessUsers(project: ProjectRecord, ids?: string[], session?: ClientSession) {
      return workspaceMembers.aggregate<{ id: string; name: string }>([
        { $match: {
          workspaceId: project.workspaceId,
          ...(ids && { userId: { $in: ids.map((id) => new Types.ObjectId(id)) } }),
        } },
        { $lookup: {
          from: projectMembers.collection.name, localField: 'userId', foreignField: 'userId',
          pipeline: [{ $match: { projectId: project._id } }, { $project: { _id: 1 } }], as: 'roster',
        } },
        { $match: { $or: [
          { role: 'OWNER' },
          { role: 'MANAGER', userId: project.managerId },
          { 'roster.0': { $exists: true } },
        ] } },
        { $lookup: {
          from: users.collection.name, localField: 'userId', foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }], as: 'user',
        } },
        { $unwind: '$user' },
        { $sort: { 'user.name': 1, userId: 1 } },
        { $project: { _id: 0, id: { $toString: '$userId' }, name: '$user.name' } },
      ]).session(session ?? null).exec()
    },

    listMembers(project: ProjectRecord) {
      return projectMembers.aggregate<ProjectMemberSummary>([
        { $match: { projectId: project._id } },
        { $lookup: {
          from: workspaceMembers.collection.name, localField: 'userId', foreignField: 'userId',
          pipeline: [{ $match: { workspaceId: project.workspaceId } }, { $project: { role: 1 } }],
          as: 'workspaceMember',
        } },
        { $unwind: '$workspaceMember' },
        { $lookup: {
          from: users.collection.name, localField: 'userId', foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }], as: 'user',
        } },
        { $unwind: '$user' },
        { $sort: { joinedAt: 1, _id: 1 } },
        { $project: { _id: 0, user: { id: { $toString: '$user._id' }, name: '$user.name' }, workspaceRole: '$workspaceMember.role', joinedAt: 1 } },
      ]).exec()
    },
  }
}

export type ProjectRepository = ReturnType<typeof projectRepository>
