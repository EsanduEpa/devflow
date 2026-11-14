import { Router, type Request, type RequestHandler } from 'express'
import type { Model } from 'mongoose'
import { z } from 'zod'
import { validateRequest } from '../../src/middleware/validate-request.js'
import { ApiError } from '../../src/shared/api-error.js'
import { objectId } from '../../src/shared/object-id.js'

const renameItemRequest = z.object({
  params: z.strictObject({ id: objectId }),
  query: z.strictObject({ dryRun: z.stringbool({ truthy: ['true'], falsy: ['false'] }).default(false) }),
  body: z.strictObject({ name: z.string().trim().min(1).max(80) }),
})

interface Item {
  id: string
  name: string
}

interface ItemsRepository {
  find(id: string): Promise<Item | null>
  rename(id: string, name: string): Promise<Item | null>
}

export function mongoItemsRepository(model: Model<{ name: string }>): ItemsRepository {
  return {
    async find(id) {
      const item = await model.findById(id).lean()
      return item && { id: item._id.toString(), name: item.name }
    },
    async rename(id, name) {
      const item = await model.findByIdAndUpdate(id, { name }, {
        returnDocument: 'after',
        runValidators: true,
      }).lean()
      return item && { id: item._id.toString(), name: item.name }
    },
  }
}

async function renameItem(repository: ItemsRepository, id: string, name: string, dryRun: boolean) {
  const item = dryRun ? await repository.find(id) : await repository.rename(id, name)
  if (!item) {
    throw new ApiError(404, 'NOT_FOUND', 'The requested item was not found.')
  }

  return { id: item.id, name }
}

export function itemsRouter(repository: ItemsRepository) {
  const router = Router()
  const controller: RequestHandler<Request['params'], { data: Item }, unknown, unknown, {
    input: z.infer<typeof renameItemRequest>
  }> = async (_request, response) => {
    const { params, body, query } = response.locals.input
    const data = await renameItem(repository, params.id, body.name, query.dryRun)
    response.json({ data })
  }

  router.patch('/items/:id', validateRequest(renameItemRequest), controller)
  return router
}
