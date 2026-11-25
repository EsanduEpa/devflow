import { Types } from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { startStage1App } from './fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowActivityTestPassword!'
let app: Awaited<ReturnType<typeof startStage1App>>
let owner: Awaited<ReturnType<typeof account>>
let developer: typeof owner
let outsider: typeof owner
let workspace: string
let project: string

type Client = ReturnType<typeof request.agent>
async function write(client: Client, method: 'post' | 'patch' | 'delete', path: string, status: number, body?: object) {
  const { body: csrf } = await client.get(api + '/auth/csrf').expect(200)
  const call = client[method](api + path).set('Origin', app.origin).set('X-CSRF-Token', csrf.data.csrfToken)
  return (body ? call.send(body) : call).expect(status)
}

async function account(name: string) {
  const client = request.agent(app.origin)
  const email = name.toLowerCase() + '@example.test'
  const { body } = await write(client, 'post', '/auth/register', 201, { name, email, password })
  await write(client, 'post', '/auth/login', 200, { email, password })
  return { client, id: body.data.id as string }
}

async function task(title: string, fields: object = {}, projectPath = project) {
  const { body } = await write(owner.client, 'post', projectPath + '/tasks', 201, { title, ...fields })
  return { id: body.data.id as string, path: '/tasks/' + body.data.id }
}

async function sprint(name: string, startDate = '2028-01-01', endDate = '2028-01-14') {
  const { body } = await write(owner.client, 'post', project + '/sprints', 201, { name, startDate, endDate })
  return { id: body.data.id as string, path: '/sprints/' + body.data.id }
}

const stored = () => app.database.collection(app.collections.activity.activity)
const history = (path: string) => owner.client.get(api + path + '/activity').expect(200)

beforeAll(async () => {
  app = await startStage1App('activity')
  const accounts = await Promise.all(['Owner', 'Developer', 'Outsider'].map(account))
  owner = accounts[0]
  developer = accounts[1]
  outsider = accounts[2]
  const created = await write(owner.client, 'post', '/workspaces', 201, { name: 'Activity test workspace' })
  workspace = '/workspaces/' + created.body.data.id
  const workspaceId = new Types.ObjectId(created.body.data.id)
  await app.database.collection(app.collections.workspace.members).insertMany([developer, outsider].map(({ id }) => ({
    userId: new Types.ObjectId(id), role: 'DEVELOPER', workspaceId, joinedAt: new Date(),
  })))
  const team = await write(owner.client, 'post', workspace + '/projects', 201, { name: 'Activity project', managerId: owner.id })
  project = '/projects/' + team.body.data.id
  await write(owner.client, 'post', project + '/members', 201, { userId: developer.id })
}, 65_000)

afterAll(async () => { await app?.close() }, 35_000)

it('records task facts, keeps completion in its status event, paginates and requires task access', async () => {
  const { id, path } = await task('Timeline coverage')
  const initial = await history(path)
  expect(initial.body.data).toMatchObject([{
    taskId: id, actor: { id: owner.id, name: 'Owner' }, action: 'TASK_CREATED', completed: false,
    changes: [{ field: 'priority', from: null, to: 'MEDIUM' }, { field: 'status', from: null, to: 'BACKLOG' }],
  }])
  const changed = await write(owner.client, 'patch', path, 200, { assigneeId: developer.id, priority: 'HIGH' })
  expect(changed.body.data).toMatchObject({ assigneeId: developer.id, priority: 'HIGH' })
  await write(owner.client, 'patch', path, 200, { assigneeId: developer.id, priority: 'HIGH' })
  await write(owner.client, 'patch', path, 200, { title: 'Renamed outside tracked fields' })
  await write(developer.client, 'patch', path + '/status', 200, { status: 'IN_REVIEW' })
  await write(developer.client, 'patch', path + '/status', 403, { status: 'DONE' })
  await write(owner.client, 'patch', path + '/status', 200, { status: 'DONE' })
  await write(owner.client, 'patch', path + '/status', 200, { status: 'DONE' })

  const entries = (await history(path)).body.data
  expect(entries).toHaveLength(4)
  expect(entries[0]).toMatchObject({
    actor: { id: owner.id, name: 'Owner' }, action: 'TASK_UPDATED', completed: true,
    changes: [{ field: 'status', from: 'IN_REVIEW', to: 'DONE' }],
  })
  expect(entries[1]).toMatchObject({ actor: { id: developer.id, name: 'Developer' }, completed: false,
    changes: [{ field: 'status', from: 'BACKLOG', to: 'IN_REVIEW' }],
  })
  expect(entries[2].changes).toEqual([
    { field: 'assigneeId', from: null, to: developer.id, fromLabel: null, toLabel: 'Developer' },
    { field: 'priority', from: 'MEDIUM', to: 'HIGH' },
  ])
  expect(entries[0].actor).not.toHaveProperty('email')
  const hidden = await outsider.client.get(api + path + '/activity').expect(404)
  await outsider.client.get(api + '/tasks/' + new Types.ObjectId() + '/activity').expect(404, hidden.body)
  await request(app.origin).get(api + path + '/activity').expect(401)

  await stored().updateMany({ taskId: new Types.ObjectId(id) }, { $set: { createdAt: new Date('2027-02-03T04:05:06Z') } })
  const first = await developer.client.get(api + path + '/activity?limit=2').expect(200)
  const second = await developer.client.get(api + path + '/activity?limit=2&page=2').expect(200)
  expect(first.body.pagination).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 })
  expect([...first.body.data, ...second.body.data].map((entry) => entry.id))
    .toEqual(entries.map((entry: { id: string }) => entry.id).sort().reverse())

  await write(owner.client, 'patch', project, 200, { status: 'ARCHIVED' })
  await developer.client.get(api + path + '/activity').expect(200)
  await write(owner.client, 'patch', project, 200, { status: 'ACTIVE' })
}, 90_000)

it('records sprint moves and rolls back both ordinary updates and rollover when history cannot be written', async () => {
  const current = await sprint('January sprint')
  const target = await sprint('February sprint', '2028-02-01', '2028-02-14')
  const work = await task('Roll forward', { status: 'IN_PROGRESS' })
  const done = await task('Reviewed', { status: 'DONE' })
  const membership = current.path + '/tasks/' + work.id
  await write(owner.client, 'post', membership, 200)
  await write(owner.client, 'post', membership, 200)
  const firstMove = (await history(work.path)).body.data
  expect(firstMove).toHaveLength(2)
  expect(firstMove[0].changes).toEqual([
    { field: 'sprintId', from: null, to: current.id, fromLabel: null, toLabel: 'January sprint' },
  ])

  const index = await stored().createIndex({ taskId: 1 }, {
    name: 'force_activity_failure', unique: true,
    partialFilterExpression: { action: 'TASK_UPDATED', taskId: new Types.ObjectId(work.id) },
  })
  try {
    await write(owner.client, 'patch', work.path, 500, { priority: 'HIGH' })
    await write(owner.client, 'post', current.path + '/tasks/' + done.id, 200)
    await write(owner.client, 'post', current.path + '/start', 200)
    await write(owner.client, 'post', current.path + '/complete', 500, { rolloverSprintId: target.id })

    const saved = await owner.client.get(api + work.path).expect(200)
    expect(saved.body.data).toMatchObject({ priority: 'MEDIUM', sprintId: current.id, status: 'IN_PROGRESS' })
    expect((await history(work.path)).body.data).toEqual(firstMove)
    const active = await owner.client.get(api + current.path).expect(200)
    expect(active.body.data).toMatchObject({ status: 'ACTIVE', completionSnapshot: null })
  } finally {
    await stored().dropIndex(index)
  }

  await write(owner.client, 'post', current.path + '/complete', 200, { rolloverSprintId: target.id })
  const rollover = (await history(work.path)).body.data[0]
  expect(rollover.changes).toEqual([
    { field: 'sprintId', from: current.id, to: target.id, fromLabel: 'January sprint', toLabel: 'February sprint' },
  ])
  expect((await history(done.path)).body.data).toHaveLength(2)
  await write(owner.client, 'delete', target.path + '/tasks/' + work.id, 204)
  expect((await history(work.path)).body.data[0].changes[0]).toMatchObject({ field: 'sprintId', from: target.id, to: null })
}, 90_000)

it('keeps activity for former actors, records roster-driven unassignment and removes history with its task', async () => {
  const legacy = await task('Legacy task', { assigneeId: developer.id })
  await stored().deleteMany({ taskId: new Types.ObjectId(legacy.id) })
  expect((await history(legacy.path)).body.data).toEqual([])
  await write(developer.client, 'patch', legacy.path + '/status', 200, { status: 'TODO' })
  await write(owner.client, 'delete', project + '/members/' + developer.id, 204)
  const removed = (await history(legacy.path)).body.data
  expect(removed).toHaveLength(2)
  expect(removed[0]).toMatchObject({ actor: { id: owner.id }, changes: [{ field: 'assigneeId', from: developer.id, to: null }] })
  expect(removed[1].actor).toEqual({ id: developer.id, name: 'Developer' })
  await developer.client.get(api + legacy.path + '/activity').expect(404)

  await write(owner.client, 'post', project + '/members', 201, { userId: developer.id })
  const other = await write(owner.client, 'post', workspace + '/projects', 201, { name: 'Second activity project', managerId: owner.id })
  const otherPath = '/projects/' + other.body.data.id
  await write(owner.client, 'post', otherPath + '/members', 201, { userId: developer.id })
  await write(owner.client, 'patch', legacy.path, 200, { assigneeId: developer.id })
  const second = await task('Second assigned task', { assigneeId: developer.id }, otherPath)
  await write(owner.client, 'delete', workspace + '/members/' + developer.id, 204)
  for (const item of [legacy, second]) {
    expect((await history(item.path)).body.data[0].changes[0]).toMatchObject({ field: 'assigneeId', from: developer.id, to: null })
  }

  await app.database.collection(app.collections.auth.users).deleteOne({ _id: new Types.ObjectId(developer.id) })
  expect((await history(legacy.path)).body.data.find((entry: { actor: { id: string } }) => entry.actor.id === developer.id).actor)
    .toEqual({ id: developer.id, name: null })
  await write(owner.client, 'delete', legacy.path, 204)
  expect(await stored().countDocuments({ taskId: new Types.ObjectId(legacy.id) })).toBe(0)
  await owner.client.get(api + legacy.path + '/activity').expect(404)
}, 100_000)
