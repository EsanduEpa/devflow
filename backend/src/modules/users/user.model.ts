import { mongo, Schema, type Connection, type HydratedDocument, type InferSchemaType } from 'mongoose'
import { ApiError } from '../../shared/api-error.js'
import { emailAddress } from './user.schema.js'

const profileSchema = new Schema({ bio: { type: String, maxlength: 500 } }, { _id: false })

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: (value: string) => emailAddress.safeParse(value).success,
  },
  passwordHash: { type: String, required: true, select: false },
  // Sessions and reset links carry the version current when they were issued.
  passwordVersion: { type: Number, required: true, default: 0 },
  recoveryVersion: { type: Number, required: true, default: 0 },
  profile: profileSchema,
}, { timestamps: true })

userSchema.index({ email: 1 }, { unique: true })

export function userModel(connection: Connection, collection = 'users') {
  return connection.model('User', userSchema, collection)
}

export function publicUser(user: HydratedDocument<InferSchemaType<typeof userSchema>>) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    ...(user.profile?.bio != null && { profile: { bio: user.profile.bio } }),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export type PublicUser = ReturnType<typeof publicUser>

export function rethrowUserWriteError(error: unknown): never {
  if (error instanceof mongo.MongoServerError && error.code === 11000) {
    throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account already uses this email address.')
  }
  throw error
}
