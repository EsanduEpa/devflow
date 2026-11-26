import { Types } from 'mongoose'
import { io, type Socket } from 'socket.io-client'
import request from 'supertest'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { hashToken } from '../src/shared/credentials.js'
import { startStage1App } from './fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowRealtimeFixturePassword!'
let app: Awaited<ReturnType<typeof startStage1App>>
let owner: Awaited<ReturnType<typeof account>>
let developer: typeof owner
let outsider: typeof owner
let projectId: string
let taskId: string
const sockets: Socket[] = []

async function write(client: ReturnType<typeof request.agent>, method: 'post' | 'patch' | 'delete', path: string, status: number, body?: object) {
  const { body: csrf } = await client.get(api + '/auth/csrf').expect(200)
  const call = client[method](api + path).set('Origin', app.origin).set('X-CSRF-Token', csrf.data.csrfToken)
  return (body ? call.send(body) : call).expect(status)
}

async function logIn(client: ReturnType<typeof request.agent>, email: string) {
  const result = await write(client, 'post', '/auth/login', 200, { email, password })
  const headers = result.headers['set-cookie'] as unknown as string[]
  const cookie = headers.find((header) => header.startsWith('devflow_session='))?.split(';', 1)[0]
  if (!cookie) throw Error('Expected the session cookie.')
  return { id: result.body.data.id as string, email, client, cookie }
}

async function account(name: string) {
  const client = request.agent(app.origin)
  const email = name.toLowerCase() + '@example.test'
  await write(client, 'post', '/auth/register', 201, { name, email, password })
  return logIn(client, email)
}

function createSocket(cookie?: string, origin = app.origin) {
  const socket = io(app.origin, {
    autoConnect: false, reconnection: false, transports: ['websocket'],
    extraHeaders: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
  })
  sockets.push(socket)
  return socket
}

async function socketFor(account: typeof owner) {
  const socket = createSocket(account.cookie)
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
    socket.connect()
  })
  return socket
}

function received(socket: Socket, event: string) {
  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, listener)
      reject(Error(`Timed out waiting for ${event}.`))
    }, 8_000)
    const listener = (payload: unknown) => {
      clearTimeout(timeout)
      resolve(payload)
    }
    socket.once(event, listener)
  })
}

const subscribe = (socket: Socket, id = projectId) => socket.timeout(5000).emitWithAck('project:subscribe', { projectId: id })
const updateStatus = (status: string, expectedVersion?: number, expectedStatus = 200) =>
  write(owner.client, 'patch', '/tasks/' + taskId + '/status', expectedStatus, { status, expectedVersion })

beforeAll(async () => {
  app = await startStage1App('realtime')
  const accounts = await Promise.all(['Owner', 'Developer', 'Outsider'].map(account))
  owner = accounts[0]
  developer = accounts[1]
  outsider = accounts[2]
  const workspace = await write(owner.client, 'post', '/workspaces', 201, { name: 'Live tests' })
  const workspaceId = new Types.ObjectId(workspace.body.data.id)
  await app.database.collection(app.collections.workspace.members).insertMany([developer, outsider].map(({ id }) => ({
    workspaceId, userId: new Types.ObjectId(id), role: 'DEVELOPER', joinedAt: new Date(),
  })))
  const created = await write(owner.client, 'post', '/workspaces/' + workspaceId + '/projects', 201, {
    name: 'Live project', managerId: owner.id,
  })
  projectId = created.body.data.id
  await write(owner.client, 'post', '/projects/' + projectId + '/members', 201, { userId: developer.id })
  const task = await write(owner.client, 'post', '/projects/' + projectId + '/tasks', 201, { title: 'Live task' })
  taskId = task.body.data.id
}, 65_000)

afterAll(async () => {
  for (const socket of sockets) socket.disconnect()
  await app?.close()
}, 35_000)

it('rejects missing sessions and unapproved origins', async () => {
  const anonymous = createSocket()
  const anonymousError = received(anonymous, 'connect_error')
  anonymous.connect()
  expect(await anonymousError).toMatchObject({ data: { code: 'UNAUTHENTICATED' } })
  const foreignOrigin = createSocket(owner.cookie, 'https://other.example.test')
  const originError = received(foreignOrigin, 'connect_error')
  foreignOrigin.connect()
  await originError
  expect(foreignOrigin.connected).toBe(false)
})

it('delivers committed signals only to authorized subscribers and evicts revoked project access', async () => {
  const [sender, teammate, outside] = await Promise.all([owner, developer, outsider].map(socketFor))
  try {
    expect(await subscribe(sender)).toEqual({ data: { projectId } })
    expect(await subscribe(teammate)).toEqual({ data: { projectId } })
    expect(await subscribe(outside)).toMatchObject({ error: { code: 'NOT_FOUND' } })
    expect(await outside.timeout(5000).emitWithAck('project:subscribe', { projectId: 'room override' }))
      .toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
    const unpermitted: unknown[] = []
    outside.on('project:changed', (event) => unpermitted.push(event))

    const delivered = [received(sender, 'project:changed'), received(teammate, 'project:changed')]
    await write(owner.client, 'patch', '/tasks/' + taskId, 200, { assigneeId: developer.id, expectedVersion: 0 })
    const [event, second] = await Promise.all(delivered)
    expect(event).toEqual({ eventId: expect.any(String), projectId, kind: 'task.changed', taskId, version: 1 })
    expect(second).toEqual(event)

    const following: unknown[] = []
    teammate.on('project:changed', (event) => following.push(event))
    await updateStatus('DONE', 0, 409)
    const comment = received(sender, 'project:changed')
    await write(developer.client, 'post', '/tasks/' + taskId + '/comments', 201, { body: 'Private discussion' })
    expect(await comment).toEqual({ eventId: expect.any(String), projectId, kind: 'comment.changed', taskId })
    await expect.poll(() => following.length, { timeout: 5000 }).toBe(1)
    expect(following).toEqual([{ eventId: expect.any(String), projectId, kind: 'comment.changed', taskId }])

    expect(await teammate.timeout(5000).emitWithAck('project:unsubscribe', { projectId })).toEqual({ data: { projectId } })
    expect(await teammate.timeout(5000).emitWithAck('project:unsubscribe', { projectId })).toEqual({ data: { projectId } })
    const whileAway = received(sender, 'project:changed')
    await updateStatus('TODO', 1)
    await whileAway
    expect(following).toHaveLength(1)
    expect(await subscribe(teammate)).toEqual({ data: { projectId } })

    const revoked = received(teammate, 'project:access-revoked')
    const projectChanged = received(sender, 'project:changed')
    await write(owner.client, 'delete', '/projects/' + projectId + '/members/' + developer.id, 204)
    expect(await revoked).toEqual({ projectId })
    expect(await projectChanged).toMatchObject({ kind: 'project.changed', projectId })
    expect(await subscribe(teammate)).toMatchObject({ error: { code: 'NOT_FOUND' } })
    const afterRemoval = received(sender, 'project:changed')
    await updateStatus('IN_PROGRESS')
    await afterRemoval
    expect(following).toHaveLength(1)
    expect(unpermitted).toEqual([])
  } finally {
    for (const socket of [sender, teammate, outside]) socket.disconnect()
  }
}, 90_000)

it('disconnects a logged-out socket and an idle socket whose session expires', async () => {
  const loggedOut = await socketFor(outsider)
  const revoked = received(loggedOut, 'disconnect')
  await write(outsider.client, 'post', '/auth/logout', 204)
  expect(await revoked).toBe('io server disconnect')

  const fresh = await logIn(outsider.client, outsider.email)
  const expiring = await socketFor(fresh)
  const expired = received(expiring, 'disconnect')
  await app.database.collection(app.collections.auth.sessions).updateOne({
    tokenHash: hashToken(fresh.cookie.slice('devflow_session='.length)),
  }, { $set: { expiresAt: new Date(Date.now() + 250) } })
  expect(await expired).toBe('io server disconnect')
}, 35_000)
