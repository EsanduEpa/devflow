import { Types } from 'mongoose'
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

    findMembership(workspaceId: string, userId: string) {
      return members.findOne({ workspaceId, userId }).lean().exec()
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

    findWorkspace(id: string) {
      return workspaces.findById(id).lean().exec()
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
