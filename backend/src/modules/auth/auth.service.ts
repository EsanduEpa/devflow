import { verify } from 'argon2'
import { ApiError } from '../../shared/api-error.js'
import { hashPassword, hashToken, randomToken } from '../../shared/credentials.js'
import { publicUser, rethrowUserWriteError } from '../users/user.model.js'
import type { AuthRepository } from './auth.repository.js'
import type { Credentials, Registration } from './auth.schemas.js'
import { sessionLifetime } from './session.model.js'

export async function authService(repository: AuthRepository) {
  const dummyPasswordHash = await hashPassword(randomToken())

  async function currentSession(token?: string) {
    const session = token && await repository.findActiveSession(hashToken(token))
    const user = session && await repository.findUser(session.userId)
    if (!session || !user || session.passwordVersion !== user.passwordVersion) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Log in to continue.')
    }
    return { user: publicUser(user), expiresAt: session.expiresAt }
  }

  return {
    async register({ name, email, password }: Registration) {
      const passwordHash = await hashPassword(password)
      try {
        return publicUser(await repository.createUser(name, email, passwordHash))
      } catch (error) {
        rethrowUserWriteError(error)
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
      await repository.createSession({
        userId: user._id,
        passwordVersion: user.passwordVersion,
        tokenHash: hashToken(token),
        createdAt,
        expiresAt,
      }, previousToken && hashToken(previousToken))
      return { user: publicUser(user), token, expiresAt }
    },

    async currentUser(token?: string) {
      return (await currentSession(token)).user
    },

    currentSession,

    async logout(token?: string) {
      if (token) {
        await repository.deleteSession(hashToken(token))
      }
    },
  }
}

export type AuthService = Awaited<ReturnType<typeof authService>>
