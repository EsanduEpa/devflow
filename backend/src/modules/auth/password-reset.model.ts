import { Schema, type Connection } from 'mongoose'

export const resetTokenLifetime = 30 * 60 * 1000

const passwordResetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, select: false },
  recoveryVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, required: true },
})

passwordResetSchema.index({ tokenHash: 1 }, { unique: true })
passwordResetSchema.index({ userId: 1 })
// Retain recent expired records long enough to report expiry to the user.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 })

export function passwordResetModel(connection: Connection, collection = 'password_reset_tokens') {
  return connection.model('PasswordResetToken', passwordResetSchema, collection)
}
