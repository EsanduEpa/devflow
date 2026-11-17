import { Types } from 'mongoose'
import type { sessionModel } from '../auth/session.model.js'
import type { userModel } from './user.model.js'
import type { UpdateProfileInput } from './user.schema.js'

type ProfileFields = Omit<UpdateProfileInput['body'], 'currentPassword'>
type EmailVerification = { email: string; passwordHash: string }

export function userRepository(users: ReturnType<typeof userModel>, sessions: ReturnType<typeof sessionModel>) {
  return {
    findCredentials(id: string) {
      return users.findById(id).select('+passwordHash').exec()
    },

    updateProfile(id: string, fields: ProfileFields, verified?: EmailVerification) {
      const changes: Record<string, string> = {}
      if (fields.name !== undefined) changes.name = fields.name
      if (fields.email !== undefined) changes.email = fields.email
      if (fields.profile !== undefined) changes['profile.bio'] = fields.profile.bio

      const filter = { _id: id, ...verified }
      if (!Object.keys(changes).length) return users.findOne(filter).exec()
      return users.findOneAndUpdate(filter, {
        $set: changes,
        ...(verified && { $inc: { recoveryVersion: 1 } }),
      }, { returnDocument: 'after', runValidators: true }).exec()
    },

    changePassword(id: string, currentHash: string, passwordHash: string) {
      return users.db.transaction(async (transaction) => {
        const result = await users.updateOne({ _id: id, passwordHash: currentHash }, {
          $set: { passwordHash },
          $inc: { passwordVersion: 1, recoveryVersion: 1 },
        }).session(transaction)
        if (!result.matchedCount) return false

        await sessions.deleteMany({ userId: new Types.ObjectId(id) }).session(transaction)
        return true
      })
    },
  }
}

export type UserRepository = ReturnType<typeof userRepository>
