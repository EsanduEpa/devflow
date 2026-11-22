import { Router } from 'express'
import mongoose from 'mongoose'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { app, createApp } from '../src/app.js'
import { itemsRouter } from './fixtures/items.js'

const id = '507f1f77bcf86cd799439011'

afterEach(() => vi.restoreAllMocks())

describe('DevFlow HTTP foundation', () => {
  it('preserves the M1 health response', async () => {
    await request(app).get('/api/health').expect(200, { status: 'ok' })
  })

  it('returns a JSON 404 for an unknown route', async () => {
    await request(app).get('/api/v1/missing').expect(404, {
      error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
    })
  })

  it('returns a safe error for malformed JSON', async () => {
    await request(app).post('/api/v1/missing')
      .type('json').send('{"password":"private",')
      .expect(400, {
        error: { code: 'VALIDATION_ERROR', message: 'The request body contains invalid JSON.' },
      })
  })

  it('rejects excessive JSON bodies', async () => {
    const response = await request(app).post('/api/v1/missing')
      .send({ text: 'x'.repeat(100 * 1024) }).expect(413)
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it.each([
    ['/items/invalid', { name: 'Updated' }, 'params.id'],
    [`/items/${id}`, { name: ' ' }, 'body.name'],
    [`/items/${id}`, { name: 'Updated', unsupported: true }, 'body'],
    [`/items/${id}?dryRun=maybe`, { name: 'Updated' }, 'query.dryRun'],
  ])('validates %s before using the repository', async (path, body, field) => {
    const repository = { find: vi.fn(), rename: vi.fn() }
    const response = await request(createApp(itemsRouter(repository)))
      .patch(`/api/v1${path}`).send(body).expect(400)

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [expect.objectContaining({ field })],
    })
    expect(repository.find).not.toHaveBeenCalled()
    expect(repository.rename).not.toHaveBeenCalled()
  })

  it('returns a standard success envelope using parsed request fields', async () => {
    const repository = { find: vi.fn(), rename: vi.fn().mockResolvedValue({ id, name: 'Updated' }) }

    await request(createApp(itemsRouter(repository)))
      .patch(`/api/v1/items/${id}?dryRun=false`).send({ name: ' Updated ' })
      .expect(200, { data: { id, name: 'Updated' } })
    expect(repository.rename).toHaveBeenCalledWith(id, 'Updated')
    expect(repository.find).not.toHaveBeenCalled()
  })

  it.each([
    [500, 'INTERNAL_ERROR', 'An unexpected error occurred.', new Error('passwordHash=fixture-hash token=fixture-token')],
    [503, 'SERVICE_UNAVAILABLE', 'The database is temporarily unavailable.', new mongoose.mongo.MongoNetworkError('mongodb+srv://fixture:example@database.invalid/')],
  ])('handles a rejected route with status %i without exposing sensitive details', async (status, code, message, error) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = Router()
    router.get('/fail', async () => { throw error })

    await request(createApp(router)).get('/api/v1/fail').expect(status, { error: { code, message } })
    expect(log.mock.calls).toEqual([['DevFlow API request failed', { method: 'GET', status, code }]])
  })
})
