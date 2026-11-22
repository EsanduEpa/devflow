import { createHash, randomBytes, randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { authConfig } from '../src/config/auth.js'
import { connectDatabase } from '../src/config/database.js'
import { createAuthModule } from '../src/modules/auth/auth.routes.js'

const suffix = randomUUID().replaceAll('-', '')
const collections = { users: `m3_users_${suffix}`, sessions: `m3_sessions_${suffix}`, resetTokens: `m3_reset_tokens_${suffix}` }
const origin = 'http://127.0.0.1:5173'
const credentials = { email: 'alex@example.test', password: 'DevFlowExamplePassword!' }
const registration = { ...credentials, name: 'Alex Perera', email: 'register@example.test' }
const path = '/api/v1/auth'
const config = authConfig({ CSRF_SECRET: randomBytes(32).toString('hex') })
const resetEmail = { origin, async sendResetEmail() { throw new Error('M3 tests do not send password reset email.') } }
let app: ReturnType<typeof createApp>

function agent() {
  return request.agent(app)
}

async function csrfToken(client: ReturnType<typeof agent>): Promise<string> {
  const response = await client.get(`${path}/csrf`).expect('Cache-Control', 'no-store').expect(200)
  return response.body.data.csrfToken
}

async function login(client: ReturnType<typeof agent>, status = 200) {
  const token = await csrfToken(client)
  return client.post(`${path}/login`).set('Origin', origin).set('X-CSRF-Token', token)
    .send(credentials).expect(status)
}

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI?.trim() || process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Set MONGODB_TEST_URI or MONGODB_URI in backend/.env to run database tests.')

  try {
    const connection = await connectDatabase(uri, 'devflow_test')
    app = createApp((await createAuthModule(connection, config, resetEmail, collections)).router)
    const client = agent()
    const token = await csrfToken(client)
    await client.post(`${path}/register`).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ ...credentials, name: 'Alex Perera' }).expect(201)
  } catch {
    throw new Error('Could not prepare the auth test collections. Check Atlas access and devflow_test permissions.')
  }
}, 20_000)

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const db = mongoose.connection.db!
      for (const name of Object.values(collections)) {
        const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext()
        if (exists) await db.dropCollection(name)
      }
    }
  } finally {
    await mongoose.disconnect()
  }
}, 20_000)

describe('MongoDB-backed authentication', () => {
  it('validates input, normalizes email, hashes the password, and rejects a duplicate', async () => {
    const client = agent()
    const token = await csrfToken(client)
    await client.post(`${path}/register`).set('Origin', origin).send(registration).expect(403)
    await client.post(`${path}/register`).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ ...registration, password: 'short' }).expect(400)

    const result = await client.post(`${path}/register`).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ ...registration, name: ' Alex Perera ', email: ' REGISTER@EXAMPLE.TEST ' }).expect(201)
    expect(result.body.data).toMatchObject({ name: registration.name, email: registration.email })
    expect(result.body.data).not.toHaveProperty('passwordHash')
    expect(result.headers['set-cookie']).toBeUndefined()
    await client.get(`${path}/me`).expect(401)

    const users = mongoose.connection.model('User')
    const stored = await users.findOne({ email: registration.email }).select('+passwordHash').orFail()
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/)
    expect((await users.findById(stored._id).orFail()).passwordHash).toBeUndefined()

    const duplicate = await client.post(`${path}/register`).set('Origin', origin).set('X-CSRF-Token', token)
      .send(registration).expect(409)
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_EXISTS')
  }, 15_000)

  it('returns the same error for unknown accounts and incorrect passwords', async () => {
    const client = agent()
    const token = await csrfToken(client)
    const errors = []
    for (const email of [credentials.email, 'unknown@example.test']) {
      const result = await client.post(`${path}/login`).set('Origin', origin).set('X-CSRF-Token', token)
        .send({ email, password: 'WrongPassword123!' }).expect(401)
      errors.push(result.body.error)
    }
    expect(errors[0]).toEqual(errors[1])
    expect(errors[0].code).toBe('INVALID_CREDENTIALS')
  }, 15_000)

  it('uses an HTTP-only session, refreshes CSRF after login, and rejects replay after logout', async () => {
    const client = agent()
    const anonymousToken = await csrfToken(client)
    const result = await login(client)
    const [cookie] = result.headers['set-cookie'] as unknown as string[]
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    const cookiePair = cookie.split(';')[0]
    const raw = cookiePair.slice('devflow_session='.length)
    const tokenHash = createHash('sha256').update(raw).digest('hex')
    const sessions = mongoose.connection.model('Session')
    const session = await sessions.findOne({ tokenHash }).orFail()
    expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(7 * 86400000)
    expect(result.body.data).toEqual({
      id: expect.any(String), name: 'Alex Perera', email: credentials.email,
      createdAt: expect.any(String), updatedAt: expect.any(String),
    })
    expect(result.text).not.toContain(raw)

    await request(app).get(`${path}/me`).set('Cookie', cookiePair).expect(200, result.body)
    await client.post(`${path}/logout`).set('Origin', origin).set('X-CSRF-Token', anonymousToken).expect(403)
    const token = await csrfToken(client)
    expect(token).not.toBe(anonymousToken)
    await client.post(`${path}/logout`).set('Origin', origin).set('X-CSRF-Token', token).expect(204)
    expect(await sessions.findOne({ tokenHash })).toBeNull()
    await request(app).get(`${path}/me`).set('Cookie', cookiePair).expect(401)
  }, 15_000)

  it('rotates an existing session on login', async () => {
    const client = agent()
    const first = await login(client)
    const [cookie] = first.headers['set-cookie'] as unknown as string[]
    const previous = cookie.split(';')[0]
    await login(client)
    await client.get(`${path}/me`).expect(200)
    await request(app).get(`${path}/me`).set('Cookie', previous).expect(401)
  }, 15_000)

  it('rejects an expired session and has a TTL index for cleanup', async () => {
    const client = agent()
    const result = await login(client)
    const [cookie] = result.headers['set-cookie'] as unknown as string[]
    const tokenHash = createHash('sha256').update(cookie.split(';')[0].slice('devflow_session='.length)).digest('hex')
    const sessions = mongoose.connection.model('Session')
    const indexes = await sessions.collection.indexes()
    expect(indexes).toContainEqual(expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }))
    await sessions.updateOne({ tokenHash }, { expiresAt: new Date(Date.now() - 1000) })
    await client.get(`${path}/me`).expect(401)
  }, 15_000)

  it('rate limits repeated login and registration requests', async () => {
    const isolatedApp = createApp((await createAuthModule(mongoose.connection, config, resetEmail, collections)).router)
    const client = request.agent(isolatedApp)
    const token = await csrfToken(client)
    for (const [route, limit] of [['login', 10], ['register', 5]] as const) {
      for (let attempt = 0; attempt < limit; attempt++) {
        await client.post(`${path}/${route}`).set('Origin', origin).set('X-CSRF-Token', token).send({}).expect(400)
      }
      const response = await client.post(`${path}/${route}`).set('Origin', origin).set('X-CSRF-Token', token).send({}).expect(429)
      expect(response.body.error.code).toBe('RATE_LIMITED')
      expect(response.headers['retry-after']).toBeDefined()
    }
  }, 15_000)
})
