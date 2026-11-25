import { Types } from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { startStage1App } from './fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowConflictTestPassword!'
let app: Awaited<ReturnType<typeof startStage1App>>
let owner: Awaited<ReturnType<typeof account>>
let developer: typeof owner
let outsider: typeof owner
let workspace: string
let project: string

type Client = ReturnType<typeof request.agent>

async function prepare(client: Client, method: 'post' | 'patch' | 'delete', path: string, body?: object) {
  const { body: csrf } = await client.get(api + '/auth/csrf').expect(200)
  const call = client[method](api + path).set('Origin', app.origin).set('X-CSRF-Token', csrf.data.csrfToken)
  return { call: body ? call.send(body) : call }
}

async function write(client: Client, method: 'post' | 'patch' | 'delete', path: string, status: number, body?: object) {
  const { call } = await prepare(client, method, path, body)
  return call.expect(status)
}

async function account(name: string) {
  const client = request.agent(app.origin)
  const email = name.toLowerCase() + '@example.test'
  const { body } = await write(client, 'post', '/auth/register', 201, { name, email, password })
  await write(client, 'post', '/auth/login', 200, { email, password })
  return { client, id: body.data.id as string }
}

async function task(title: string, fields: object = {}) {
  const { body } = await write(owner.client, 'post', project + '/tasks', 201, { title, ...fields })
  expect(body.data.version).toBe(0)
  return '/tasks/' + body.data.id
}

async function read(path: string) {
  const { body } = await owner.client.get(api + path).expect(200)
  return body.data
}

async function expectConflict(method: 'post' | 'patch' | 'delete', path: string, body?: object) {
  const result = await write(owner.client, method, path, 409, body)
  expect(result.body.error.code).toBe('STALE_VERSION')
  expect(Object.keys(result.body)).toEqual(['error'])
}

beforeAll(async () => {
  app = await startStage1App('conflict')
  const accounts = await Promise.all(['Owner', 'Developer', 'Outsider'].map(account))
  owner = accounts[0]
  developer = accounts[1]
  outsider = accounts[2]
  const created = await write(owner.client, 'post', '/workspaces', 201, { name: 'Conflict test workspace' })
  workspace = '/workspaces/' + created.body.data.id
  const workspaceId = new Types.ObjectId(created.body.data.id)
  await app.database.collection(app.collections.workspace.members).insertMany([developer, outsider].map(({ id }) => ({
    userId: new Types.ObjectId(id), role: 'DEVELOPER', workspaceId, joinedAt: new Date(),
  })))
  const team = await write(owner.client, 'post', workspace + '/projects', 201, { name: 'Conflict project', managerId: owner.id })
  project = '/projects/' + team.body.data.id
  await write(owner.client, 'post', project + '/members', 201, { userId: developer.id })
}, 60_000)

afterAll(async () => { await app?.close() }, 35_000)

it('treats a missing version as zero, accepts older callers and preserves state on conflict', async () => {
  const path = await task('Legacy version', { assigneeId: developer.id })
  const taskId = new Types.ObjectId(path.split('/').at(-1))
  await app.database.collection(app.collections.task.tasks).updateOne({ _id: taskId }, { $unset: { version: '' } })
  expect((await read(path)).version).toBe(0)
  expect((await read(project + '/tasks')).find(({ id }: { id: string }) => id === taskId.toString()).version).toBe(0)

  for (const version of [-1, 1.5, '0', Number.MAX_SAFE_INTEGER + 1]) {
    await write(owner.client, 'patch', path, 400, { title: 'Invalid version', expectedVersion: version })
  }
  await write(owner.client, 'patch', path, 400, { expectedVersion: 0 })
  const result = await write(owner.client, 'patch', path, 200, { priority: 'HIGH', expectedVersion: 0 })
  const saved = result.body.data
  const activity = await read(path + '/activity')
  expect(saved.version).toBe(1)
  await expectConflict('patch', path, { priority: 'LOW', expectedVersion: 0 })
  await expectConflict('patch', path + '/status', { status: 'DONE', expectedVersion: 0 })
  expect(await read(path)).toEqual(saved)
  expect(await read(path + '/activity')).toEqual(activity)

  const legacyCall = await write(owner.client, 'patch', path, 200, { title: 'Saved by an older client' })
  expect(legacyCall.body.data.version).toBe(2)
  await expectConflict('patch', path, { title: 'Stale client title', expectedVersion: 1 })
  const legacyMove = await write(owner.client, 'patch', path + '/status', 200, { status: 'TODO' })
  expect(legacyMove.body.data.version).toBe(3)
  await write(developer.client, 'patch', path + '/status', 403, { status: 'DONE', expectedVersion: 3 })
  await write(outsider.client, 'patch', path, 404, { title: 'Hidden from outsider', expectedVersion: 3 })
  expect((await read(path)).version).toBe(3)
}, 95_000)

it('accepts only one concurrent edit or move at the same version', async () => {
  const path = await task('Race for version', { assigneeId: developer.id })
  const writes = await Promise.all([
    prepare(owner.client, 'patch', path, { priority: 'HIGH', expectedVersion: 0 }),
    prepare(developer.client, 'patch', path + '/status', { status: 'IN_PROGRESS', expectedVersion: 0 }),
  ])
  const results = await Promise.all(writes.map(({ call }) => call))
  expect(results.map(({ status }) => status).sort()).toEqual([200, 409])
  expect(results.find(({ status }) => status === 409)?.body.error.code).toBe('STALE_VERSION')
  expect(await read(path)).toEqual(results.find(({ status }) => status === 200)?.body.data)
  expect((await read(path)).version).toBe(1)
  const activity = await read(path + '/activity')
  expect(activity).toHaveLength(2)
  expect(activity[0].changes).toHaveLength(1)
}, 55_000)

it('versions sprint membership, rollover, and project or workspace unassignment', async () => {
  const path = await task('Membership versions', { assigneeId: developer.id })
  const created = await write(owner.client, 'post', project + '/sprints', 201, {
    name: 'Version sprint', startDate: '2028-01-01', endDate: '2028-01-14',
  })
  const sprint = '/sprints/' + created.body.data.id
  const item = sprint + path
  await write(owner.client, 'post', item + '?expectedVersion=-1', 400)
  await expectConflict('post', item + '?expectedVersion=1')
  const added = await write(owner.client, 'post', item + '?expectedVersion=0', 200)
  expect(added.body.data.version).toBe(1)
  const entries = await read(path + '/activity')
  await expectConflict('delete', item + '?expectedVersion=0')
  expect(await read(path + '/activity')).toEqual(entries)
  const repeated = await write(owner.client, 'post', item + '?expectedVersion=1', 200)
  expect(repeated.body.data.version).toBe(1)
  await write(owner.client, 'delete', item + '?expectedVersion=1', 204)
  expect(await read(path)).toMatchObject({ sprintId: null, version: 2 })
  await write(owner.client, 'post', item, 200)
  expect((await read(path)).version).toBe(3)
  await write(owner.client, 'post', sprint + '/start', 200)
  await write(owner.client, 'post', sprint + '/complete', 200, { rolloverSprintId: null })
  expect(await read(path)).toMatchObject({ sprintId: null, version: 4 })
  await expectConflict('patch', path, { title: 'Before rollover', expectedVersion: 3 })

  await write(owner.client, 'delete', project + '/members/' + developer.id, 204)
  expect(await read(path)).toMatchObject({ assigneeId: null, version: 5 })
  await expectConflict('patch', path, { priority: 'LOW', expectedVersion: 4 })
  await write(owner.client, 'post', project + '/members', 201, { userId: developer.id })
  await write(owner.client, 'patch', path, 200, { assigneeId: developer.id, expectedVersion: 5 })
  await write(owner.client, 'delete', workspace + '/members/' + developer.id, 204)
  expect(await read(path)).toMatchObject({ assigneeId: null, version: 7 })
  await expectConflict('patch', path + '/status', { status: 'DONE', expectedVersion: 6 })
}, 100_000)
