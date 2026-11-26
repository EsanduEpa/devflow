import { randomBytes, randomUUID } from 'node:crypto'
import mongoose, { Types } from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApi } from '../src/api.js'
import { createApp } from '../src/app.js'
import { authConfig } from '../src/config/auth.js'
import { connectDatabase } from '../src/config/database.js'
import { hashToken } from '../src/shared/credentials.js'

const suffix = randomUUID().replaceAll('-', '')
const collections = {
  auth: { users: `m6_users_${suffix}`, sessions: `m6_sessions_${suffix}`, resetTokens: `m6_resets_${suffix}` },
  workspace: { workspaces: `m6_workspaces_${suffix}`, members: `m6_members_${suffix}`, invitations: `m6_invites_${suffix}` },
  project: { projects: `m6_projects_${suffix}`, members: `m6_project_members_${suffix}` },
  task: { tasks: `m6_tasks_${suffix}` },
  sprint: { sprints: `m6_sprints_${suffix}` },
  comment: { comments: `m6_comments_${suffix}` },
  activity: { activity: `m6_activity_${suffix}` },
  dependency: { dependencies: `m6_dependencies_${suffix}` },
  notification: { notifications: `m6_notifications_${suffix}` },
}
const origin = 'http://127.0.0.1:5173'
const auth = '/api/v1/auth'
const workspacePath = '/api/v1/workspaces'
const invitePath = '/api/v1/invitations'
const ownerEmail = 'owner@example.test'
const outsiderEmail = 'outsider@example.test'
const password = 'DevFlowInvitationPassword!'
let app: ReturnType<typeof createApp>
let owner: Awaited<ReturnType<typeof account>>
let outsider: Awaited<ReturnType<typeof account>>

function agent() {
  return request.agent(app)
}

async function csrfToken(client: ReturnType<typeof agent>) {
  const csrf = await client.get(`${auth}/csrf`).expect(200)
  return csrf.body.data.csrfToken as string
}

async function submit(client: ReturnType<typeof agent>, url: string, status: number, body?: object) {
  const csrf = await csrfToken(client)
  const call = client.post(url).set('Origin', origin).set('X-CSRF-Token', csrf)
  return (body ? call.send(body) : call).expect(status)
}

async function account(email: string) {
  const client = agent()
  const result = await submit(client, `${auth}/register`, 201, { name: email.split('@')[0], email, password })
  await submit(client, `${auth}/login`, 200, { email, password })
  return { client, userId: result.body.data.id as string }
}

async function workspace(name: string) {
  const response = await submit(owner.client, workspacePath, 201, { name, description: 'Private description' })
  return {
    id: new Types.ObjectId(response.body.data.id),
    invitations: `${workspacePath}/${response.body.data.id}/invitations`,
    members: `${workspacePath}/${response.body.data.id}/members`,
  }
}

async function invite(url: string, email: string, role: 'MANAGER' | 'DEVELOPER' = 'DEVELOPER') {
  const { body } = await submit(owner.client, url, 201, { email, role })
  const link = new URL(body.data.acceptUrl)
  expect(link.origin).toBe(origin)
  expect(link.pathname).toMatch(/^\/invitations\/[A-Za-z0-9_-]{43}$/)
  const token = link.pathname.split('/').at(-1)!
  return { data: body.data, token, preview: `${invitePath}/${token}`, accept: `${invitePath}/${token}/accept` }
}

function records() {
  return mongoose.connection.db!.collection(collections.workspace.invitations)
}

function memberships() {
  return mongoose.connection.db!.collection(collections.workspace.members)
}

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI?.trim() || process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Set MONGODB_TEST_URI or MONGODB_URI in backend/.env to run database tests.')
  const connection = await connectDatabase(uri, 'devflow_test')
  const config = authConfig({ APP_ORIGINS: origin, CSRF_SECRET: randomBytes(32).toString('hex') })
  const email = { origin, async sendResetEmail() { throw new Error('Invitation tests do not send email.') } }
  app = createApp(await createApi(connection, config, email, collections))
  owner = await account(ownerEmail)
  outsider = await account(outsiderEmail)
}, 25_000)

afterAll(async () => {
  try {
    const db = mongoose.connection.db
    if (db && mongoose.connection.readyState === 1) {
      for (const name of Object.values(collections).flatMap((group) => Object.values(group))) {
        if (await db.listCollections({ name }, { nameOnly: true }).hasNext()) await db.dropCollection(name)
      }
    }
  } finally {
    await mongoose.disconnect()
  }
}, 25_000)

describe('Workspace invitations', () => {
  it('restricts invitation management and member viewing, and only reveals the minimal preview', async () => {
    const team = await workspace('Invitation permissions')
    await request(app).get(team.members).expect(401)
    await outsider.client.get(team.members).expect(404)
    await outsider.client.get(team.invitations).expect(404)
    await submit(outsider.client, team.invitations, 404, { email: 'other@example.test', role: 'MANAGER' })
    await owner.client.post(team.invitations).send({ email: 'other@example.test', role: 'MANAGER' }).expect(403)
    await submit(owner.client, team.invitations, 400, { email: 'other@example.test', role: 'OWNER' })
    await submit(owner.client, team.invitations, 400, { email: 'other@example.test', role: 'MANAGER', expiresAt: new Date() })
    const existing = await submit(owner.client, team.invitations, 409, { email: ownerEmail, role: 'MANAGER' })
    expect(existing.body.error.code).toBe('MEMBERSHIP_ALREADY_EXISTS')

    await memberships().insertOne({ workspaceId: team.id, userId: new Types.ObjectId(outsider.userId), role: 'MANAGER', joinedAt: new Date() })
    await outsider.client.get(team.invitations).expect(403)
    await submit(outsider.client, team.invitations, 403, { email: 'other@example.test', role: 'DEVELOPER' })
    const members = await outsider.client.get(team.members).expect(200)
    expect(members.body.data).toEqual([
      { user: { id: owner.userId, name: 'owner', email: ownerEmail }, role: 'OWNER', joinedAt: expect.any(String) },
      { user: { id: outsider.userId, name: 'outsider', email: outsiderEmail }, role: 'MANAGER', joinedAt: expect.any(String) },
    ])

    const pending = await invite(team.invitations, '  NEW.MEMBER@EXAMPLE.TEST  ', 'MANAGER')
    expect(pending.data).toMatchObject({ email: 'new.member@example.test', status: 'PENDING', role: 'MANAGER' })
    const stored = await records().findOne({ _id: new Types.ObjectId(pending.data.id) })
    expect(stored).toMatchObject({ tokenHash: hashToken(pending.token), invitedBy: new Types.ObjectId(owner.userId) })
    expect(stored).not.toHaveProperty('token')
    expect(stored!.expiresAt.getTime() - stored!.createdAt.getTime()).toBe(7 * 86400000)
    const list = await owner.client.get(`${team.invitations}?status=PENDING`).expect(200)
    expect(list.body.data).toEqual([{
      id: pending.data.id, email: 'new.member@example.test', role: 'MANAGER', status: 'PENDING',
      createdAt: expect.any(String), expiresAt: pending.data.expiresAt,
    }])
    await request(app).get(pending.preview).expect('Referrer-Policy', 'no-referrer').expect('Cache-Control', 'no-store').expect(200, {
      data: { workspaceName: 'Invitation permissions', role: 'MANAGER', maskedEmail: 'n***@example.test', expiresAt: pending.data.expiresAt },
    })
  }, 25_000)

  it('requires the invited account and creates exactly one membership on simultaneous acceptance', async () => {
    const team = await workspace('Join a workspace')
    const email = 'joiner@example.test'
    const invitation = await invite(team.invitations, email)
    await request(app).post(invitation.accept).expect(401)
    await outsider.client.post(invitation.accept).expect(403)
    const wrong = await submit(outsider.client, invitation.accept, 403)
    expect(wrong.body.error.message).toContain('email address that received')
    await outsider.client.get(team.members).expect(404)

    const invitee = await account(email)
    const second = agent()
    await submit(second, `${auth}/login`, 200, { email, password })
    await submit(invitee.client, invitation.accept, 400, { role: 'OWNER' })
    const results = await Promise.all([invitee.client, second].map(async (client) => {
      const csrf = await csrfToken(client)
      return client.post(invitation.accept).set('Origin', origin).set('X-CSRF-Token', csrf)
    }))
    expect(results.map(({ status }) => status).sort()).toEqual([200, 410])
    expect(results.find(({ status }) => status === 200)?.body.data).toMatchObject({
      id: team.id.toString(), name: 'Join a workspace', myRole: 'DEVELOPER',
    })

    const restriction = { workspaceId: team.id, userId: new Types.ObjectId(invitee.userId) }
    expect(await memberships().find(restriction).toArray()).toEqual([expect.objectContaining({ role: 'DEVELOPER' })])
    expect(await records().findOne({ _id: new Types.ObjectId(invitation.data.id) })).toMatchObject({
      status: 'ACCEPTED', acceptedAt: expect.any(Date),
    })
    await request(app).get(invitation.preview).expect(410)
    await submit(invitee.client, invitation.accept, 410)
    const joined = await invitee.client.get(workspacePath).expect(200)
    expect(joined.body.data).toEqual([expect.objectContaining({ id: team.id.toString(), myRole: 'DEVELOPER' })])
    const list = await owner.client.get(team.members).expect(200)
    expect(list.body.data).toContainEqual({
      user: { id: invitee.userId, email, name: 'joiner' },
      role: 'DEVELOPER', joinedAt: expect.any(String),
    })
    await invitee.client.get(team.invitations).expect(403)
  }, 25_000)

  it('blocks duplicate pending invitations, permits replacement after expiry, and rejects closed links', async () => {
    const team = await workspace('Replacement invitations')
    const email = 'replace@example.test'
    const csrf = await csrfToken(owner.client)
    const results = await Promise.all([email, email.toUpperCase()].map((address) =>
      owner.client.post(team.invitations).set('Origin', origin).set('X-CSRF-Token', csrf).send({ email: address, role: 'MANAGER' })))
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409])
    expect(results.find(({ status }) => status === 409)?.body.error.code).toBe('INVITATION_ALREADY_EXISTS')
    const created = results.find(({ status }) => status === 201)!.body.data
    const expiredPath = new URL(created.acceptUrl).pathname
    const expiredId = new Types.ObjectId(created.id)
    await records().updateOne({ _id: expiredId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    await request(app).get(`/api/v1${expiredPath}`).expect(410)
    await submit(outsider.client, `/api/v1${expiredPath}/accept`, 410)
    await owner.client.get(`${team.invitations}?status=PENDING`).expect(200, { data: [] })
    const expiredList = await owner.client.get(`${team.invitations}?status=EXPIRED`).expect(200)
    expect(expiredList.body.data).toEqual([expect.objectContaining({ id: created.id, status: 'EXPIRED' })])

    const replacement = await invite(team.invitations, email)
    expect(await records().findOne({ _id: expiredId })).toMatchObject({ status: 'EXPIRED' })
    await records().updateOne({ _id: new Types.ObjectId(replacement.data.id) }, { $set: { status: 'REVOKED' } })
    await request(app).get(replacement.preview).expect(410)
    await submit(outsider.client, replacement.accept, 410)
    await request(app).get(`${invitePath}/${randomBytes(32).toString('base64url')}`).expect(404)
  }, 25_000)

  it('does not consume an invitation if the matching user already joined the workspace', async () => {
    const team = await workspace('Existing membership')
    const invitation = await invite(team.invitations, outsiderEmail)
    const userId = new Types.ObjectId(outsider.userId)
    await memberships().insertOne({ workspaceId: team.id, userId, role: 'DEVELOPER', joinedAt: new Date() })
    const result = await submit(outsider.client, invitation.accept, 409)
    expect(result.body.error.code).toBe('MEMBERSHIP_ALREADY_EXISTS')
    expect(await records().findOne({ _id: new Types.ObjectId(invitation.data.id) })).toMatchObject({
      status: 'PENDING', acceptedAt: null,
    })
    expect(await memberships().countDocuments({ workspaceId: team.id, userId })).toBe(1)
  }, 15_000)

  it('rolls back the invitation claim if the workspace membership write fails', async () => {
    const team = await workspace('Invitation rollback')
    const invitation = await invite(team.invitations, outsiderEmail)
    const memberQuery = { workspaceId: team.id, userId: new Types.ObjectId(outsider.userId) }
    const inviteQuery = { _id: new Types.ObjectId(invitation.data.id) }
    const saveMembership = vi.spyOn(mongoose.connection.model('WorkspaceMember').collection, 'insertOne')
      .mockRejectedValueOnce(new Error('Intentional invitation membership write failure'))
    try {
      await submit(outsider.client, invitation.accept, 500)
      expect(saveMembership).toHaveBeenCalledOnce()
    } finally {
      saveMembership.mockRestore()
    }

    expect(await records().findOne(inviteQuery)).toMatchObject({ status: 'PENDING', acceptedAt: null })
    expect(await memberships().countDocuments(memberQuery)).toBe(0)
    await submit(outsider.client, invitation.accept, 200)
    expect(await records().findOne(inviteQuery)).toMatchObject({ status: 'ACCEPTED' })
    expect(await memberships().countDocuments(memberQuery)).toBe(1)
  }, 25_000)
})
