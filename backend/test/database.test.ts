import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/config/database.js'
import { itemsRouter, mongoItemsRepository } from './fixtures/items.js'

const collection = `m2_items_${randomUUID().replaceAll('-', '')}`

describe('MongoDB integration', () => {
  const schema = new mongoose.Schema({
    name: { type: String, required: true, minlength: 1, maxlength: 80 },
  }, { autoCreate: false })
  const Item = mongoose.model('M2Item', schema, collection)
  let collectionCreated = false

  beforeAll(async () => {
    const uri = process.env.MONGODB_TEST_URI?.trim() || process.env.MONGODB_URI?.trim()
    if (!uri) {
      throw new Error('Set MONGODB_TEST_URI or MONGODB_URI in backend/.env to run database tests.')
    }

    try {
      await connectDatabase(uri, 'devflow_test')
      await Item.createCollection()
      collectionCreated = true
    } catch {
      throw new Error('Could not prepare devflow_test. Check Atlas connectivity and test database permissions.')
    }
  }, 20_000)

  afterAll(async () => {
    try {
      if (collectionCreated) {
        await Item.collection.drop()
      }
    } finally {
      await mongoose.disconnect()
    }
  }, 20_000)

  it('writes through the HTTP route, service, repository, and Mongoose model', async () => {
    const item = await Item.create({ name: 'Original' })
    const id = item._id.toString()

    await request(createApp(itemsRouter(mongoItemsRepository(Item))))
      .patch(`/api/v1/items/${id}`).send({ name: 'Updated' })
      .expect(200, { data: { id, name: 'Updated' } })
    expect((await Item.findById(id))?.name).toBe('Updated')
  }, 15_000)

  it('commits two writes together and rolls back two writes on failure', async () => {
    const committed = [new Item({ name: 'Commit first' }), new Item({ name: 'Commit second' })]
    await mongoose.connection.transaction(async (session) => {
      for (const item of committed) {
        await item.save({ session })
      }
    })
    expect(await Item.countDocuments({ _id: { $in: committed.map((item) => item._id) } })).toBe(2)

    const rolledBack = [new Item({ name: 'Rollback first' }), new Item({ name: 'Rollback second' })]
    const failure = new Error('Force M2 rollback')
    await expect(mongoose.connection.transaction(async (session) => {
      for (const item of rolledBack) {
        await item.save({ session })
      }
      throw failure
    })).rejects.toBe(failure)
    expect(await Item.countDocuments({ _id: { $in: rolledBack.map((item) => item._id) } })).toBe(0)
  }, 20_000)
})
