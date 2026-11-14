import { z } from 'zod'

export const emailAddress = z.string().trim().toLowerCase().pipe(z.email())
