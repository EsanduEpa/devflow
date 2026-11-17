import { z } from 'zod'
import { currentPassword, newPassword } from '../../shared/credentials.js'

export const emailAddress = z.string().trim().toLowerCase().pipe(z.email())

export const updateProfileSchema = z.object({
  query: z.strictObject({}),
  body: z.strictObject({
    name: z.string().trim().min(2).max(100).optional(),
    email: emailAddress.optional(),
    profile: z.strictObject({ bio: z.string().max(500) }).optional(),
    currentPassword: currentPassword.optional(),
  }).refine(({ name, email, profile }) => name !== undefined || email !== undefined || profile !== undefined, {
    message: 'Provide at least one profile field to update.',
  }),
})

export const changePasswordSchema = z.object({
  query: z.strictObject({}),
  body: z.strictObject({ currentPassword, newPassword }),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
