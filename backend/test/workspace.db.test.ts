import { randomBytes, randomUUID } from 'node:crypto'
import mongoose, { Types } from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApi } from '../src/api.js'
import { createApp } from '../src/app.js'
import { authConfig } from '../src/config/auth.js'
import { connectDatabase } from '../src/config/database.js'

const suffix = randomUUID().replaceAll('-', '')
const collections = {
  auth: { users: `m5_users_${suffix}`, sessions: `m5_sessions_${suffix}`, resetTokens: `m5_resets_${suffix}` },
  workspace: { workspaces: `m5_workspaces_${suffix}`, members: `m5_members_${suffix}`, invitations: `m5_invitations_${suffix}` },
}
const origin = 'http://127.0.0.1:5173'
const auth = '/api/v1/auth'
const path = '/api/v1/workspaces'
const password = 'DevFlowWorkspacePassword!'
let app: ReturnType<typeof createApp>
let owner: Awaited<ReturnType<typeof createAccount>>
let member: Awaited<ReturnType<typeof createAccount>>
let rollbackOwner: Awaited<ReturnType<typeof createAccount>>

function agent() {
  return request.agent(app)
}

async function submit(client: ReturnType<typeof agent>, method: 'post' | 'patch', url: string, body: object, status: number) {
  const csrf = await client.get(`${auth}/csrf`).expect(200)
  return client[method](url).set('Origin', origin).set('X-CSRF-Token', csrf.body.data.csrfToken).send(body).expect(status)
}

async function createAccount(email: string) {
  const client = agent()
  const result = await submit(client, 'post', `${auth}/register`, { name: 'Workspace Tester', email, password }, 201)
  await submit(client, 'post', `${auth}/login`, { email, password }, 200)
  return { client, id: result.body.data.id as string, objectId: new Types.ObjectId(result.body.data.id) }
}

async function createWorkspace(client: ReturnType<typeof agent>, name: string, description?: string) {
  const result = await submit(client, 'post', path, { name, description }, 201)
  return result.body.data
}

function workspaces() {
  return mongoose.connection.db!.collection(collections.workspace.workspaces)
}

function members() {
  return mongoose.connection.db!.collection(collections.workspace.members)
}

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI?.trim() || process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Set MONGODB_TEST_URI or MONGODB_URI in backend/.env to run database tests.')
  const connection = await connectDatabase(uri, 'devflow_test')
  const config = authConfig({ APP_ORIGINS: origin, CSRF_SECRET: randomBytes(32).toString('hex') })
  const email = { origin, async sendResetEmail() { throw new Error('Workspace tests do not send email.') } }
  app = createApp(await createApi(connection, config, email, collections))
  const accounts = await Promise.all([
    createAccount('owner@example.test'),
    createAccount('member@example.test'),
    createAccount('rollback@example.test'),
  ])
  owner = accounts[0]
  member = accounts[1]
  rollbackOwner = accounts[2]
}, 25_000)

afterAll(async () => {
  try {
    const db = mongoose.connection.db
    if (db && mongoose.connection.readyState === 1) {
      for (const name of [...Object.values(collections.auth), ...Object.values(collections.workspace)]) {
        if (await db.listCollections({ name }, { nameOnly: true }).hasNext()) await db.dropCollection(name)
      }
    }
  } finally {
    await mongoose.disconnect()
  }
}, 25_000)

describe('Workspace API with MongoDB', () => {
  it('authenticates and validates creation, then derives ownership and the workspace list from MongoDB', async () => {
    await request(app).get(path).expect(401)
    await request(app).post(path).send({ name: 'Private' }).expect(401)
    await owner.client.get(path).expect('Cache-Control', 'no-store').expect(200, { data: [] })
    await owner.client.post(path).send({ name: 'Missing CSRF' }).expect(403)
    for (const fields of [
      { name: ' x ' },
      { name: 'x'.repeat(101) },
      { name: 'Valid name', description: 'x'.repeat(501) },
      { name: 'Valid name', ownerId: member.id },
      { name: 'Valid name', role: 'DEVELOPER' },
      { name: 'Valid name', myRole: 'DEVELOPER' },
    ]) {
      await submit(owner.client, 'post', path, fields, 400)
    }

    const first = await createWorkspace(owner.client, ' DevFlow Team ', ' Our team area ')
    const second = await createWorkspace(owner.client, 'Side Projects')
    const sameName = await createWorkspace(member.client, 'DevFlow Team')
    expect(first).toMatchObject({ name: 'DevFlow Team', description: 'Our team area', ownerId: owner.id, myRole: 'OWNER' })
    expect(first.id).not.toBe(sameName.id)
    expect(first.createdAt).toBe(new Date(first.createdAt).toISOString())
    expect(first.updatedAt).toBe(new Date(first.updatedAt).toISOString())
    const wsId = new Types.ObjectId(first.id)
    const stored = await workspaces().findOne({ _id: wsId })
    expect(stored).toMatchObject({ ownerId: owner.objectId })
    expect(stored).not.toHaveProperty('myRole')
    expect(await members().find({ workspaceId: wsId }).toArray()).toEqual([
      expect.objectContaining({ userId: owner.objectId, role: 'OWNER', joinedAt: expect.any(Date) }),
    ])
    await owner.client.get(path).expect(200, { data: [first, second] })
    await member.client.get(path).expect(200, { data: [sameName] })
    await owner.client.get(`${path}/${first.id}`).expect(200, { data: first })
  }, 25_000)

  it('uses roles per workspace and hides an unrelated workspace on both read and update', async () => {
    const team = await createWorkspace(owner.client, 'Manager workspace', 'Manager scope')
    const otherTeam = await createWorkspace(owner.client, 'Developer workspace', 'Developer scope')
    const privateTeam = await createWorkspace(owner.client, 'Private workspace', 'Private scope')
    await members().insertMany([
      { workspaceId: new Types.ObjectId(team.id), userId: member.objectId, role: 'MANAGER', joinedAt: new Date() },
      { workspaceId: new Types.ObjectId(otherTeam.id), userId: member.objectId, role: 'DEVELOPER', joinedAt: new Date() },
    ])

    const list = await member.client.get(path).expect(200)
    expect(list.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: team.id, myRole: 'MANAGER' }),
      expect.objectContaining({ id: otherTeam.id, myRole: 'DEVELOPER' }),
    ]))
    expect(list.body.data).not.toContainEqual(expect.objectContaining({ id: privateTeam.id }))
    await member.client.get(`${path}/${team.id}`).expect(200, { data: { ...team, myRole: 'MANAGER' } })
    await member.client.get(`${path}/${otherTeam.id}`).expect(200, { data: { ...otherTeam, myRole: 'DEVELOPER' } })
    const hidden = await member.client.get(`${path}/${privateTeam.id}`).expect(404)
    await member.client.get(`${path}/${new Types.ObjectId()}`).expect(404, hidden.body)
    await member.client.get(`${path}/invalid`).expect(400)
    await submit(member.client, 'patch', `${path}/${team.id}`, { name: 'Manager edit' }, 403)
    await submit(member.client, 'patch', `${path}/${otherTeam.id}`, { name: 'Developer edit' }, 403)
    const hiddenPatch = await submit(member.client, 'patch', `${path}/${privateTeam.id}`, { name: 'Unauthorized edit' }, 404)
    expect(hiddenPatch.body).toEqual(hidden.body)
    await owner.client.get(`${path}/${privateTeam.id}`).expect(200, { data: privateTeam })

    await owner.client.patch(`${path}/${team.id}`).send({ name: 'No CSRF' }).expect(403)
    const url = `${path}/${team.id}`
    await submit(owner.client, 'patch', url, { ownerId: member.id }, 400)
    await submit(owner.client, 'patch', url, { myRole: 'MANAGER' }, 400)
    await submit(owner.client, 'patch', url, {}, 400)
    const renamed = await submit(owner.client, 'patch', url, { name: ' Renamed workspace ' }, 200)
    expect(renamed.body.data).toMatchObject({ name: 'Renamed workspace', description: team.description, ownerId: owner.id, myRole: 'OWNER' })
    await member.client.get(url).expect(200, { data: { ...renamed.body.data, myRole: 'MANAGER' } })
  }, 25_000)

  it('enforces unique memberships and at most one Owner even when writes bypass the API', async () => {
    const workspace = await createWorkspace(owner.client, 'Index test')
    const base = { workspaceId: new Types.ObjectId(workspace.id), joinedAt: new Date() }
    await expect(members().insertOne({ ...base, userId: owner.objectId, role: 'DEVELOPER' })).rejects.toMatchObject({ code: 11000 })
    await expect(members().insertOne({ ...base, userId: member.objectId, role: 'OWNER' })).rejects.toMatchObject({ code: 11000 })
    await members().insertOne({ ...base, userId: member.objectId, role: 'DEVELOPER' })
    expect(await members().countDocuments({ workspaceId: base.workspaceId })).toBe(2)
  }, 15_000)

  it('rolls back a workspace if saving its Owner membership fails', async () => {
    const existing = await createWorkspace(rollbackOwner.client, 'Existing workspace')
    await members().createIndex({ userId: 1 }, {
      name: 'test_force_owner_membership_failure',
      unique: true,
      partialFilterExpression: { userId: rollbackOwner.objectId },
    })

    await submit(rollbackOwner.client, 'post', path, { name: 'Must roll back' }, 500)
    expect(await workspaces().find({ ownerId: rollbackOwner.objectId }).toArray()).toEqual([
      expect.objectContaining({ _id: new Types.ObjectId(existing.id) }),
    ])
    expect(await members().countDocuments({ userId: rollbackOwner.objectId })).toBe(1)
    await rollbackOwner.client.get(path).expect(200, { data: [existing] })
  }, 15_000)
})
