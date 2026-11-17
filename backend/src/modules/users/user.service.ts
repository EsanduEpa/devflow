import { verify } from 'argon2'
import { ApiError } from '../../shared/api-error.js'
import { hashPassword } from '../../shared/credentials.js'
import { publicUser, rethrowUserWriteError } from './user.model.js'
import type { UserRepository } from './user.repository.js'
import type { ChangePasswordInput, UpdateProfileInput } from './user.schema.js'

function incorrectPassword() {
  return new ApiError(401, 'INVALID_CURRENT_PASSWORD', 'The current password is incorrect.')
}

export function userService(repository: UserRepository) {
  return {
    async updateProfile(id: string, { name, email, profile, currentPassword }: UpdateProfileInput['body']) {
      let verified
      if (email !== undefined) {
        const user = await repository.findCredentials(id)
        if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Log in to continue.')

        if (email === user.email) {
          email = undefined
        } else {
          if (currentPassword === undefined) {
            throw new ApiError(400, 'CURRENT_PASSWORD_REQUIRED', 'Enter your current password to change your email.')
          }
          if (!await verify(user.passwordHash, currentPassword)) throw incorrectPassword()
          verified = { email: user.email, passwordHash: user.passwordHash }
        }
      }

      const updated = await repository.updateProfile(id, { name, email, profile }, verified).catch(rethrowUserWriteError)
      if (!updated) {
        throw new ApiError(409, 'PROFILE_CHANGED', 'Your account changed while you were editing. Refresh and try again.')
      }
      return publicUser(updated)
    },

    async changePassword(id: string, { currentPassword, newPassword }: ChangePasswordInput['body']) {
      const user = await repository.findCredentials(id)
      if (!user || !await verify(user.passwordHash, currentPassword)) throw incorrectPassword()

      const updated = await repository.changePassword(id, user.passwordHash, await hashPassword(newPassword))
      if (!updated) throw incorrectPassword()
    },
  }
}

export type UserService = ReturnType<typeof userService>
