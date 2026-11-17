import { Schema, type Connection } from 'mongoose'

export const sessionLifetime = 7 * 24 * 60 * 60 * 1000

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  passwordVersion: { type: Number, required: true, default: 0 },
  tokenHash: { type: String, required: true, select: false },
  createdAt: { type: Date, required: true, default: Date.now },
  expiresAt: {
    type: Date,
    required: true,
    validate(this: { createdAt: Date }, expiresAt: Date) {
      const lifetime = expiresAt.getTime() - this.createdAt.getTime()
      return lifetime > 0 && lifetime <= sessionLifetime
    },
  },
})

sessionSchema.index({ tokenHash: 1 }, { unique: true })
sessionSchema.index({ userId: 1 })
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export function sessionModel(connection: Connection, collection = 'sessions') {
  return connection.model('Session', sessionSchema, collection)
}
