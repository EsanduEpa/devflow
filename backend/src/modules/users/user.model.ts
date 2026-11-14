import { Schema, type Connection, type HydratedDocument, type InferSchemaType } from 'mongoose'
import { emailAddress } from './user.schema.js'

const profileSchema = new Schema({ bio: String }, { _id: false })

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
