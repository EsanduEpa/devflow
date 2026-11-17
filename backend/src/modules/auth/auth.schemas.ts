import { z } from 'zod'
import { currentPassword, newPassword } from '../../shared/credentials.js'
import { emailAddress } from '../users/user.schema.js'

const emptyQuery = z.strictObject({})

export const registerSchema = z.object({
  query: emptyQuery,
  body: z.strictObject({
    name: z.string().trim().min(2).max(100),
    email: emailAddress,
    password: newPassword,
  }),
})

export const loginSchema = z.object({
  query: emptyQuery,
  body: z.strictObject({
    email: emailAddress,
    password: currentPassword,
  }),
})

export const logoutSchema = z.object({
  query: emptyQuery,
  body: z.strictObject({}).optional(),
})

export const forgotPasswordSchema = z.object({
  query: emptyQuery,
  body: z.strictObject({ email: emailAddress }),
})

export const resetPasswordSchema = z.object({
  query: emptyQuery,
  body: z.strictObject({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'The reset link is invalid.'),
    newPassword,
  }),
})

export type Registration = z.infer<typeof registerSchema>['body']
export type Credentials = z.infer<typeof loginSchema>['body']
export type ForgotPassword = z.infer<typeof forgotPasswordSchema>['body']
export type ResetPassword = z.infer<typeof resetPasswordSchema>['body']
