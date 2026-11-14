import { createHash, randomBytes } from 'node:crypto'
import { argon2id, hash, verify } from 'argon2'
import mongoose from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import { publicUser } from '../users/user.model.js'
import type { AuthRepository } from './auth.repository.js'
import type { Credentials, Registration } from './auth.schemas.js'
import { sessionLifetime } from './session.model.js'

function hashPassword(password: string) {
  return hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
}

export function randomToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function authService(repository: AuthRepository) {
  const dummyPasswordHash = await hashPassword(randomToken())

  return {
    async register({ name, email, password }: Registration) {
      const passwordHash = await hashPassword(password)
      try {
        return publicUser(await repository.createUser(name, email, passwordHash))
      } catch (error) {
        if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
          throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account already uses this email address.')
        }
        throw error
      }
    },

    async login({ email, password }: Credentials, previousToken?: string) {
      const user = await repository.findCredentials(email)
      const valid = await verify(user?.passwordHash ?? dummyPasswordHash, password)
      if (!user || !valid) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
      }

      const token = randomToken()
      const createdAt = new Date()
      const expiresAt = new Date(createdAt.getTime() + sessionLifetime)
      await repository.createSession(user._id, hashToken(token), createdAt, expiresAt, previousToken && hashToken(previousToken))
      return { user: publicUser(user), token, expiresAt }
    },

    async currentUser(token?: string) {
      const session = token && await repository.findActiveSession(hashToken(token))
      const user = session && await repository.findUser(session.userId)
      if (!user) {
        throw new ApiError(401, 'UNAUTHENTICATED', 'Log in to continue.')
      }
      return publicUser(user)
    },

    async logout(token?: string) {
      if (token) {
        await repository.deleteSession(hashToken(token))
      }
    },
  }
}

export type AuthService = Awaited<ReturnType<typeof authService>>
