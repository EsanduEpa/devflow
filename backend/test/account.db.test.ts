import { randomBytes, randomUUID } from 'node:crypto'
import mongoose from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { authConfig } from '../src/config/auth.js'
import { connectDatabase } from '../src/config/database.js'
import { resetEmailConfig } from '../src/config/reset-email.js'
import { createAuthModule } from '../src/modules/auth/auth.routes.js'
import { hashToken } from '../src/shared/credentials.js'
import { startTestInbox } from './fixtures/smtp.js'

const suffix = randomUUID().replaceAll('-', '')
const collections = { users: `m4_users_${suffix}`, sessions: `m4_sessions_${suffix}`, resetTokens: `m4_reset_tokens_${suffix}` }
const origin = 'http://127.0.0.1:5173'
const auth = '/api/v1/auth'
const profile = '/api/v1/users/me'
const password = 'DevFlowOriginalPassword!'
const newPassword = 'DevFlowChangedPassword!'
const resetPassword = 'DevFlowRecoveredPassword!'
const genericReply = { data: { message: 'If an account exists, password reset instructions will be sent.' } }
const config = authConfig({ CSRF_SECRET: randomBytes(32).toString('hex') })
let app: ReturnType<typeof createApp>
let inbox: Awaited<ReturnType<typeof startTestInbox>> | undefined

function agent() {
  return request.agent(app)
}

async function submit(client: ReturnType<typeof agent>, method: 'post' | 'patch', path: string, body: object, status: number) {
  const csrf = await client.get(`${auth}/csrf`).expect(200)
  return client[method](path).set('Origin', origin).set('X-CSRF-Token', csrf.body.data.csrfToken)
    .send(body).expect(status)
}

async function register(email: string) {
  await submit(agent(), 'post', `${auth}/register`, { name: 'Alex Perera', email, password }, 201)
}

async function login(email: string, client = agent(), credentials = password, status = 200) {
  await submit(client, 'post', `${auth}/login`, { email, password: credentials }, status)
  return client
}

async function receiveLink(email: string) {
  const index = inbox!.messages.length
  const result = await submit(agent(), 'post', `${auth}/forgot-password`, { email }, 202)
  expect(result.body).toEqual(genericReply)
  await expect.poll(() => inbox!.messages[index], { timeout: 5000 }).toContain(`To: ${email}`)
  const decoded = inbox!.messages[index].replace(/=\r?\n/g, '').replaceAll('=3D', '=')
  const link = new URL(decoded.match(/http:\/\/[^\s]+/)![0])
  expect(link.origin).toBe(origin)
  expect(link.pathname).toBe('/reset-password')
  expect(link.search).toBe('')
  const token = new URLSearchParams(link.hash.slice(1)).get('token')
  expect(token).toMatch(/^[\w-]{43}$/)
  return token!
}

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI?.trim() || process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Set MONGODB_TEST_URI or MONGODB_URI in backend/.env to run database tests.')
  const connection = await connectDatabase(uri, 'devflow_test')
  inbox = await startTestInbox()
  const email = resetEmailConfig({ SMTP_PORT: String(inbox.port) }, config)
  app = createApp((await createAuthModule(connection, config, email, collections)).router)
}, 20_000)

afterAll(async () => {
  try {
    const db = mongoose.connection.db
    if (db && mongoose.connection.readyState === 1) {
      for (const name of Object.values(collections)) {
        if (await db.listCollections({ name }, { nameOnly: true }).hasNext()) await db.dropCollection(name)
      }
    }
  } finally {
    await inbox?.close()
    await mongoose.disconnect()
  }
}, 20_000)

describe('Account management', () => {
  it('allows partial profile updates and protects email changes, including existing M3 records', async () => {
    const email = 'profile@example.test'
    const nextEmail = 'new-profile@example.test'
    const taken = 'taken@example.test'
    await register(email)
    await register(taken)
    const client = await login(email)
    const db = mongoose.connection.db!
    await db.collection(collections.users).updateOne({ email }, { $unset: { passwordVersion: '', recoveryVersion: '' } })
    await db.collection(collections.sessions).updateMany({}, { $unset: { passwordVersion: '' } })

    await request(app).patch(profile).send({ name: 'Intruder' }).expect(401)
    await client.patch(profile).send({ name: 'No CSRF' }).expect(403)
    for (const fields of [
      { name: 'X' },
      { name: 'a'.repeat(101) },
      { profile: { bio: 'a'.repeat(501) } },
      { profile: { bio: '', secret: 'no' } },
      { role: 'admin' },
    ]) {
      await submit(client, 'patch', profile, fields, 400)
    }
    const updated = await submit(client, 'patch', profile, { name: ' Alex Updated ', profile: { bio: 'Developer' } }, 200)
    expect(updated.body.data).toMatchObject({ name: 'Alex Updated', email, profile: { bio: 'Developer' } })
    expect(updated.body.data).not.toHaveProperty('passwordHash')
    expect(updated.body.data).not.toHaveProperty('passwordVersion')

    await submit(client, 'patch', profile, { email: ` ${email.toUpperCase()} ` }, 200)
    await submit(client, 'patch', profile, { email: nextEmail }, 400)
    await submit(client, 'patch', profile, { email: nextEmail, currentPassword: 'wrong' }, 401)
    await submit(client, 'patch', profile, { email: ` ${taken.toUpperCase()} `, currentPassword: password }, 409)

    const oldLink = await receiveLink(email)
    const emailUpdate = await submit(client, 'patch', profile, { email: ` ${nextEmail.toUpperCase()} `, currentPassword: password }, 200)
    expect(emailUpdate.body.data).toMatchObject({ name: 'Alex Updated', email: nextEmail, profile: { bio: 'Developer' } })
    await client.get(`${auth}/me`).expect(200, emailUpdate.body)
    await submit(agent(), 'post', `${auth}/reset-password`, { token: oldLink, newPassword }, 410)
    const tokens = db.collection(collections.resetTokens)
    expect((await tokens.findOne({ tokenHash: hashToken(oldLink) }))?.usedAt).toBeNull()
  }, 25_000)

  it('changes a password, revokes all sessions, and invalidates earlier recovery links', async () => {
    const email = 'change@example.test'
    await register(email)
    const left = await login(email)
    const right = await login(email)
    const link = await receiveLink(email)
    const path = `${profile}/password`
    await submit(left, 'patch', path, { currentPassword: 'wrong', newPassword }, 401)
    await submit(left, 'patch', path, { currentPassword: password, newPassword: 'short' }, 400)
    await right.get(`${auth}/me`).expect(200)
    const change = await submit(left, 'patch', path, { currentPassword: password, newPassword }, 204)
    expect(change.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringMatching(/^devflow_session=;/)]))
    await left.get(`${auth}/me`).expect(401)
    await right.get(`${auth}/me`).expect(401)
    await submit(agent(), 'post', `${auth}/reset-password`, { token: link, newPassword: resetPassword }, 410)
    await login(email, agent(), password, 401)
    await login(email, agent(), newPassword)
  }, 25_000)

  it('delivers generic recovery instructions, expires links, and allows only one concurrent reset', async () => {
    const email = 'recovery@example.test'
    await register(email)
    const left = await login(email)
    const right = await login(email)
    const unknown = await submit(agent(), 'post', `${auth}/forgot-password`, { email: 'unknown@example.test' }, 202)
    expect(unknown.body).toEqual(genericReply)

    const db = mongoose.connection.db!
    const tokens = db.collection(collections.resetTokens)
    const expired = await receiveLink(email)
    const tokenHash = hashToken(expired)
    const record = await tokens.findOne({ tokenHash })
    expect(record).not.toBeNull()
    expect(record!.expiresAt.getTime() - record!.createdAt.getTime()).toBe(30 * 60 * 1000)
    expect(record).not.toHaveProperty('token')
    expect(await tokens.findOne({ tokenHash: expired })).toBeNull()
    await tokens.updateOne({ tokenHash }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    const path = `${auth}/reset-password`
    await submit(left, 'post', path, { token: expired, newPassword: resetPassword }, 410)
    await submit(left, 'post', path, { token: randomBytes(32).toString('base64url'), newPassword: resetPassword }, 400)

    const token = await receiveLink(email)
    await submit(left, 'post', path, { token, newPassword: 'short' }, 400)
    const body = { token, newPassword: resetPassword }
    const clients = [left, right]
    const csrf = await Promise.all(clients.map((client) => client.get(`${auth}/csrf`).expect(200)))
    const results = await Promise.all(clients.map((client, index) =>
      client.post(path).set('Origin', origin).set('X-CSRF-Token', csrf[index].body.data.csrfToken).send(body)))
    expect(results.map((result) => result.status).sort()).toEqual([204, 410])
    await submit(agent(), 'post', path, body, 410)
    expect((await tokens.findOne({ tokenHash: hashToken(token) }))?.usedAt).toBeInstanceOf(Date)
    await left.get(`${auth}/me`).expect(401)
    await right.get(`${auth}/me`).expect(401)
    await login(email, agent(), password, 401)
    await login(email, agent(), resetPassword)
  }, 25_000)
})
