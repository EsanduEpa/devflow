import { z } from 'zod'

const queryInteger = z.string().regex(/^\d+$/, 'Enter a positive whole number.').transform(Number).pipe(z.int().positive())

export const paginationFields = {
  page: queryInteger.default(1),
  limit: queryInteger.pipe(z.int().max(100)).default(20),
}

export type PageRequest = { page: number; limit: number }

export function hasSafePageOffset({ page, limit }: PageRequest) {
  return Number.isSafeInteger((page - 1) * limit)
}
