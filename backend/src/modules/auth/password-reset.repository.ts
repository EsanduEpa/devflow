import type { Types } from 'mongoose'
import type { userModel } from '../users/user.model.js'
import type { passwordResetModel } from './password-reset.model.js'
import type { sessionModel } from './session.model.js'

type NewResetToken = {
  userId: Types.ObjectId
  tokenHash: string
  recoveryVersion: number
  createdAt: Date
  expiresAt: Date
}

export function passwordResetRepository(
  users: ReturnType<typeof userModel>,
  sessions: ReturnType<typeof sessionModel>,
  tokens: ReturnType<typeof passwordResetModel>,
) {
  return {
    findUser(email: string) {
      return users.findOne({ email }).exec()
    },

    createToken(token: NewResetToken) {
      return tokens.create(token)
    },

    findToken(tokenHash: string) {
      return tokens.findOne({ tokenHash }).exec()
    },

    completeReset(tokenHash: string, passwordHash: string) {
      return users.db.transaction(async (transaction) => {
        const now = new Date()
        const token = await tokens.findOne({ tokenHash, usedAt: null, expiresAt: { $gt: now } }).session(transaction).exec()
        if (!token) return false

        const result = await users.updateOne({
          _id: token.userId,
          recoveryVersion: token.recoveryVersion === 0 ? { $in: [0, null] } : token.recoveryVersion,
        }, {
          $set: { passwordHash },
          $inc: { passwordVersion: 1, recoveryVersion: 1 },
        }).session(transaction)
        if (!result.matchedCount) return false

        await tokens.updateOne({ _id: token._id }, { $set: { usedAt: now } }).session(transaction)
        await sessions.deleteMany({ userId: token.userId }).session(transaction)
        return true
      })
    },
  }
}

export type PasswordResetRepository = ReturnType<typeof passwordResetRepository>
