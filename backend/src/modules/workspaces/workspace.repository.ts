import { Types, type ClientSession } from 'mongoose'
import type { ProjectModels } from '../projects/project.repository.js'
import type { userModel } from '../users/user.model.js'
import type { WorkspaceRecord, workspaceModel } from './workspace.model.js'
import type { WorkspaceRole, workspaceMemberModel } from './workspace-member.model.js'
import type { WorkspaceCreateInput, WorkspaceUpdateInput } from './workspace.schemas.js'

type MembershipWorkspace = { workspace: WorkspaceRecord; role: WorkspaceRole }
type WorkspaceMemberSummary = {
  user: { id: string; name: string; email: string }
  role: WorkspaceRole
  joinedAt: Date
}

export function workspaceRepository(
  workspaces: ReturnType<typeof workspaceModel>,
  members: ReturnType<typeof workspaceMemberModel>,
  users: ReturnType<typeof userModel>,
  projectModels: ProjectModels,
) {
  return {
    create(userId: string, fields: WorkspaceCreateInput['body']) {
      return workspaces.db.transaction(async (session) => {
        const workspace = await new workspaces({ ...fields, ownerId: userId }).save({ session })
        const member = await new members({ workspaceId: workspace._id, userId, role: 'OWNER' }).save({ session })
        return { workspace, role: member.role }
      })
    },

    listForUser(userId: string) {
      return members.aggregate<MembershipWorkspace>([
        { $match: { userId: new Types.ObjectId(userId) } },
        {
          $lookup: {
            from: workspaces.collection.name,
            localField: 'workspaceId',
            foreignField: '_id',
            as: 'workspace',
          },
        },
        { $unwind: '$workspace' },
        { $sort: { 'workspace.name': 1, 'workspace._id': 1 } },
        { $project: { _id: 0, workspace: 1, role: 1 } },
      ]).exec()
    },

    findMembership(workspaceId: string, userId: string, session?: ClientSession) {
      return members.findOne({ workspaceId, userId }).session(session ?? null).lean().exec()
    },

    listMembers(workspaceId: string) {
      return members.aggregate<WorkspaceMemberSummary>([
        { $match: { workspaceId: new Types.ObjectId(workspaceId) } },
        {
          $lookup: {
            from: users.collection.name,
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $sort: { joinedAt: 1, _id: 1 } },
        {
          $project: {
            _id: 0, role: 1, joinedAt: 1,
            user: { id: { $toString: '$user._id' }, name: '$user.name', email: '$user.email' },
          },
        },
      ]).exec()
    },

    transaction<T>(operation: (session: ClientSession) => Promise<T>) {
      return workspaces.db.transaction(operation)
    },

    lockMemberships(workspaceId: string, session: ClientSession) {
      // Project writes and workspace membership changes share a write lock on this record.
      return workspaces.updateOne({ _id: workspaceId }, { $inc: { __v: 1 } }, { session, timestamps: false }).exec()
    },

    findManagedProject(workspaceId: string, userId: string, session: ClientSession) {
      return projectModels.projects.findOne({ workspaceId, managerId: userId }).select('name').session(session).lean().exec()
    },

    async updateMemberRole(workspaceId: string, userId: string, role: Exclude<WorkspaceRole, 'OWNER'>, session: ClientSession) {
      const user = await users.findById(userId).select('name email').session(session).lean().exec()
      if (!user) return null
      const membership = await members.findOneAndUpdate(
        { workspaceId, userId, role: { $ne: 'OWNER' } },
        { $set: { role } },
        { session, returnDocument: 'after', runValidators: true },
      ).lean().exec()
      if (!membership) return null
      return { user: { id: user._id.toString(), name: user.name, email: user.email }, role: membership.role, joinedAt: membership.joinedAt }
    },

    async removeProjectMemberships(workspaceId: string, userId: string, session: ClientSession) {
      const memberships = await projectModels.members.aggregate<{ projectId: Types.ObjectId }>([
        { $match: { userId: new Types.ObjectId(userId) } },
        { $lookup: {
          from: projectModels.projects.collection.name, localField: 'projectId', foreignField: '_id',
          pipeline: [{ $match: { workspaceId: new Types.ObjectId(workspaceId) } }, { $project: { _id: 1 } }],
          as: 'project',
        } },
        { $match: { 'project.0': { $exists: true } } },
        { $project: { _id: 0, projectId: 1 } },
      ]).session(session).exec()
      if (memberships.length) {
        await projectModels.members.deleteMany({
          userId, projectId: { $in: memberships.map(({ projectId }) => projectId) },
        }, { session }).exec()
      }
    },

    removeWorkspaceMember(workspaceId: string, userId: string, session: ClientSession) {
      return members.deleteOne({ workspaceId, userId, role: { $ne: 'OWNER' } }, { session }).exec()
    },

    findWorkspace(id: string, session?: ClientSession) {
      return workspaces.findById(id).session(session ?? null).lean().exec()
    },

    updateWorkspace(id: string, ownerId: string, fields: WorkspaceUpdateInput['body']) {
      return workspaces.findOneAndUpdate(
        { _id: id, ownerId },
        { $set: fields },
        { returnDocument: 'after', runValidators: true },
      ).lean().exec()
    },
  }
}

export type WorkspaceRepository = ReturnType<typeof workspaceRepository>
