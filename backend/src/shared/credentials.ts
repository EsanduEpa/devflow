import { createHash, randomBytes } from 'node:crypto'
import { argon2id, hash } from 'argon2'
import { z } from 'zod'

export const currentPassword = z.string().min(1).max(128)
export const newPassword = currentPassword.min(12)

export function hashPassword(password: string) {
  return hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
}

export function randomToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
