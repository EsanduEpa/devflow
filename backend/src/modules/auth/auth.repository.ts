import type { Types } from 'mongoose'
import type { userModel } from '../users/user.model.js'
import type { sessionModel } from './session.model.js'

type NewSession = {
  userId: Types.ObjectId
  passwordVersion: number
  tokenHash: string
  createdAt: Date
  expiresAt: Date
}

export function authRepository(users: ReturnType<typeof userModel>, sessions: ReturnType<typeof sessionModel>) {
  return {
    createUser(name: string, email: string, passwordHash: string) {
      return users.create({ name, email, passwordHash })
    },
    findCredentials(email: string) {
      return users.findOne({ email }).select('+passwordHash').exec()
    },
    findUser(userId: Types.ObjectId) {
      return users.findById(userId).exec()
    },
    async createSession(session: NewSession, previousHash?: string) {
      if (!previousHash) {
        await sessions.create(session)
        return
      }

      await sessions.db.transaction(async (transaction) => {
        await sessions.deleteOne({ tokenHash: previousHash }).session(transaction)
        await new sessions(session).save({ session: transaction })
      })
    },
    findActiveSession(tokenHash: string) {
      return sessions.findOne({ tokenHash, expiresAt: { $gt: new Date() } }).exec()
    },
    deleteSession(tokenHash: string) {
      return sessions.deleteOne({ tokenHash }).exec()
    },
  }
}

export type AuthRepository = ReturnType<typeof authRepository>
