import { z } from 'zod'
import { emailAddress } from '../users/user.schema.js'

const emptyQuery = z.strictObject({})

export const registerSchema = z.object({
  query: emptyQuery,
  body: z.strictObject({
    name: z.string().trim().min(2).max(100),
    email: emailAddress,
    password: z.string().min(12).max(128),
  }),
})

export const loginSchema = z.object({
  query: emptyQuery,
  body: z.strictObject({
    email: emailAddress,
    password: z.string().min(1).max(128),
  }),
})

export const logoutSchema = z.object({
  query: emptyQuery,
  body: z.strictObject({}).optional(),
})

export type Registration = z.infer<typeof registerSchema>['body']
export type Credentials = z.infer<typeof loginSchema>['body']
