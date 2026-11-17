import type { ResetEmailConfig } from '../../config/reset-email.js'
import { ApiError } from '../../shared/api-error.js'
import { hashPassword, hashToken, randomToken } from '../../shared/credentials.js'
import type { ResetPassword } from './auth.schemas.js'
import { resetTokenLifetime } from './password-reset.model.js'
import type { PasswordResetRepository } from './password-reset.repository.js'

function unavailableResetLink() {
  return new ApiError(410, 'RESET_TOKEN_UNAVAILABLE', 'This reset link expired or is no longer available. Request a new link.')
}

export function passwordResetService(repository: PasswordResetRepository, emailConfig: ResetEmailConfig) {
  return {
    async requestReset(email: string) {
      const user = await repository.findUser(email)
      if (!user) return

      const token = randomToken()
      const createdAt = new Date()
      await repository.createToken({
        userId: user._id,
        tokenHash: hashToken(token),
        recoveryVersion: user.recoveryVersion,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + resetTokenLifetime),
      })

      const link = new URL('/reset-password', emailConfig.origin)
      link.hash = new URLSearchParams({ token }).toString()
      await emailConfig.sendResetEmail(user.email, link)
    },

    async resetPassword({ token, newPassword }: ResetPassword) {
      const tokenHash = hashToken(token)
      const stored = await repository.findToken(tokenHash)
      if (!stored) throw new ApiError(400, 'INVALID_RESET_TOKEN', 'The reset link is invalid.')
      if (stored.usedAt || stored.expiresAt.getTime() <= Date.now()) throw unavailableResetLink()
      if (!await repository.completeReset(tokenHash, await hashPassword(newPassword))) throw unavailableResetLink()
    },
  }
}

export type PasswordResetService = ReturnType<typeof passwordResetService>
