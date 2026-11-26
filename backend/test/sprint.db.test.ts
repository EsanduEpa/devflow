import { Types } from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { startStage1App } from './fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowSprintTestPassword!'
const dates = { startDate: '2028-02-01', endDate: '2028-02-29' }
const futureDates = { startDate: '2028-03-01', endDate: '2028-03-14' }

let app: Awaited<ReturnType<typeof startStage1App>>
let workspace: string
let owner: Awaited<ReturnType<typeof account>>
let manager: typeof owner
let developer: typeof owner
let otherManager: typeof owner
let outsider: typeof owner

type Client = ReturnType<typeof request.agent>
type Method = 'post' | 'patch' | 'delete'

async function write(client: Client, method: Method, path: string, body?: object) {
  const { body: csrf } = await client.get(api + '/auth/csrf').expect(200)
  const call = client[method](api + path).set('Origin', app.origin).set('X-CSRF-Token', csrf.data.csrfToken)
  return { call: body ? call.send(body) : call }
}

async function account(name: string) {
  const client = request.agent(app.origin)
  const email = name.toLowerCase() + '@example.test'
  const { body } = await (await write(client, 'post', '/auth/register', { name, email, password })).call.expect(201)
  await (await write(client, 'post', '/auth/login', { email, password })).call.expect(200)
  return { client, id: body.data.id as string }
}

async function project(name: string) {
  const { body } = await (await write(owner.client, 'post', workspace + '/projects', { name, managerId: manager.id })).call.expect(201)
  return '/projects/' + body.data.id
}

async function sprint(projectPath: string, name: string, schedule = dates) {
  const { body } = await (await write(owner.client, 'post', projectPath + '/sprints', { name, ...schedule })).call.expect(201)
  const id = body.data.id as string
  return { id, path: '/sprints/' + id, data: body.data }
}

async function task(projectPath: string, title: string, status = 'TODO') {
  const { body } = await (await write(owner.client, 'post', projectPath + '/tasks', { title, status })).call.expect(201)
  const id = body.data.id as string
  return { id, path: '/tasks/' + id }
}

async function add(sprintPath: string, taskId: string, status = 200) {
  return (await write(manager.client, 'post', sprintPath + '/tasks/' + taskId)).call.expect(status)
}

beforeAll(async () => {
  app = await startStage1App('sprint')
  const accounts = await Promise.all(
    ['Owner', 'Manager', 'Developer', 'OtherManager', 'Outsider'].map(account),
  )
  owner = accounts[0]
  manager = accounts[1]
  developer = accounts[2]
  otherManager = accounts[3]
  outsider = accounts[4]
  const { body } = await (await write(owner.client, 'post', '/workspaces', { name: 'Sprint test workspace' })).call.expect(201)
  workspace = '/workspaces/' + body.data.id
  const workspaceId = new Types.ObjectId(body.data.id)
  await app.database.collection(app.collections.workspace.members).insertMany([
    { userId: new Types.ObjectId(manager.id), role: 'MANAGER', workspaceId, joinedAt: new Date() },
    { userId: new Types.ObjectId(developer.id), role: 'DEVELOPER', workspaceId, joinedAt: new Date() },
    { userId: new Types.ObjectId(otherManager.id), role: 'MANAGER', workspaceId, joinedAt: new Date() },
    { userId: new Types.ObjectId(outsider.id), role: 'DEVELOPER', workspaceId, joinedAt: new Date() },
  ])
}, 60_000)

afterAll(async () => { await app?.close() }, 35_000)

it('checks dates, access and archive rules and paginates sprint reads', async () => {
  const path = await project('Sprint permissions')
  const list = path + '/sprints'
  for (const { id } of [developer, otherManager]) {
    await (await write(manager.client, 'post', path + '/members', { userId: id })).call.expect(201)
  }
  const fields = { name: 'Planning sprint', ...dates }
  await request(app.origin).get(api + list).expect(401)
  await owner.client.post(api + list).send(fields).expect(403)
  for (const actor of [developer, otherManager, outsider]) {
    await (await write(actor.client, 'post', list, fields)).call.expect(actor === outsider ? 404 : 403)
  }
  for (const body of [{ ...fields, name: ' x ' }, { ...fields, startDate: '2027-02-29' }, { ...fields, endDate: '2028-01-31' }]) {
    await (await write(owner.client, 'post', list, body)).call.expect(400)
  }
  const earlier = await sprint(path, 'Planning sprint')
  const later = await sprint(path, 'Future sprint', futureDates)
  const page = await developer.client.get(api + list).query({ limit: 1 }).expect(200)
  expect(page.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 })
  expect(page.body.data[0].id).toBe(later.id)
  const second = await otherManager.client.get(api + list).query({ page: 2, limit: 1 }).expect(200)
  expect(second.body.data[0].id).toBe(earlier.id)
  await outsider.client.get(api + list).expect(404)
  const hidden = await outsider.client.get(api + earlier.path).expect(404)
  await outsider.client.get(api + '/sprints/' + new Types.ObjectId()).expect(404, hidden.body)
  await (await write(outsider.client, 'post', earlier.path + '/start')).call.expect(404)
  await (await write(developer.client, 'post', earlier.path + '/start')).call.expect(403)
  await (await write(manager.client, 'post', earlier.path + '/complete', { rolloverSprintId: null })).call.expect(409)
  await (await write(manager.client, 'post', earlier.path + '/start')).call.expect(200)
  await (await write(manager.client, 'post', earlier.path + '/start')).call.expect(409)
  await (await write(owner.client, 'patch', path, { status: 'ARCHIVED' })).call.expect(200)
  await developer.client.get(api + earlier.path).expect(200)
  await (await write(manager.client, 'post', earlier.path + '/complete', { rolloverSprintId: null })).call.expect(409)
  await (await write(owner.client, 'post', list, fields)).call.expect(409)
  await (await write(owner.client, 'patch', path, { status: 'ACTIVE' })).call.expect(200)
  const completed = await (await write(manager.client, 'post', earlier.path + '/complete', { rolloverSprintId: null })).call.expect(200)
  expect(completed.body.data.progress).toEqual({ totalTasks: 0, completedTasks: 0, unfinishedTasks: 0, completionPercentage: 0 })
}, 85_000)

it('allows one concurrent start per project and one concurrent membership per task', async () => {
  const path = await project('Concurrent sprints')
  const another = await project('Independent project')
  const first = await sprint(path, 'Sprint one')
  const second = await sprint(path, 'Sprint two')
  const third = await sprint(another, 'Independent sprint')
  const work = await task(path, 'Race for membership')
  const calls = await Promise.all([
    write(manager.client, 'post', first.path + '/tasks/' + work.id),
    write(owner.client, 'post', second.path + '/tasks/' + work.id),
  ])
  const memberships = await Promise.all(calls.map(({ call }) => call))
  expect(memberships.map(({ status }) => status).sort()).toEqual([200, 409])

  const starts = await Promise.all([
    write(manager.client, 'post', first.path + '/start'),
    write(owner.client, 'post', second.path + '/start'),
    write(manager.client, 'post', third.path + '/start'),
  ])
  const [a, b, c] = await Promise.all(starts.map(({ call }) => call))
  expect([a.status, b.status].sort()).toEqual([200, 409])
  expect((a.status === 409 ? a : b).body.error.code).toBe('ACTIVE_SPRINT_EXISTS')
  expect(c.status).toBe(200)
  const stored = await app.database.collection(app.collections.sprint.sprints).countDocuments({ status: 'ACTIVE' })
  expect(stored).toBe(2)
}, 75_000)

it('rolls back partially written tasks and freezes progress after valid rollover', async () => {
  const path = await project('Rollover transaction')
  const another = await project('Foreign rollover project')
  const original = await sprint(path, 'Current sprint')
  const target = await sprint(path, 'Next sprint', futureDates)
  const overlap = await sprint(path, 'Overlapping sprint')
  const foreign = await sprint(another, 'Foreign sprint', futureDates)
  const done = await task(path, 'Done work', 'DONE')
  const first = await task(path, 'First unfinished', 'IN_PROGRESS')
  const second = await task(path, 'Second unfinished', 'IN_REVIEW')
  const foreignTask = await task(another, 'Foreign task')
  await app.database.collection(app.collections.task.tasks).updateOne({ _id: new Types.ObjectId(first.id) }, { $unset: { sprintId: '' } })
  const legacy = await manager.client.get(api + first.path).expect(200)
  expect(legacy.body.data.sprintId).toBeNull()
  const backlog = await manager.client.get(api + path + '/tasks?sprintId=none').expect(200)
  expect(backlog.body.data.map(({ id }: { id: string }) => id)).toContain(first.id)
  for (const item of [done, first, second]) await add(original.path, item.id)
  await add(original.path, first.id)
  await add(target.path, first.id, 409)
  await add(original.path, foreignTask.id, 400)
  await (await write(manager.client, 'post', original.path + '/start')).call.expect(200)
  const unfinished = await manager.client.get(api + path + '/tasks').query({ sprintId: original.id, unfinished: 'true' }).expect(200)
  expect(unfinished.body.data.map(({ id }: { id: string }) => id).sort()).toEqual([first.id, second.id].sort())

  for (const invalid of [original, overlap, foreign]) {
    await (await write(manager.client, 'post', original.path + '/complete', { rolloverSprintId: invalid.id })).call.expect(400)
  }
  await (await write(manager.client, 'post', original.path + '/complete', { rolloverSprintId: new Types.ObjectId().toString() })).call.expect(404)

  const tasks = app.database.collection(app.collections.task.tasks)
  const index = await tasks.createIndex({ sprintId: 1 }, {
    name: 'force_rollover_rollback', unique: true, partialFilterExpression: { sprintId: new Types.ObjectId(target.id) },
  })
  try {
    await (await write(manager.client, 'post', original.path + '/complete', { rolloverSprintId: target.id })).call.expect(500)
    expect(await tasks.countDocuments({ sprintId: new Types.ObjectId(target.id) })).toBe(0)
    expect(await tasks.countDocuments({ sprintId: new Types.ObjectId(original.id) })).toBe(3)
    const current = await manager.client.get(api + original.path).expect(200)
    expect(current.body.data).toMatchObject({ status: 'ACTIVE', completionSnapshot: null })
  } finally {
    await tasks.dropIndex(index)
  }

  const result = await (await write(manager.client, 'post', original.path + '/complete', { rolloverSprintId: target.id })).call.expect(200)
  expect(result.body.data).toMatchObject({
    status: 'COMPLETED', completionSnapshot: { totalTasks: 3, completedTasks: 1 },
    progress: { totalTasks: 3, completedTasks: 1, unfinishedTasks: 2, completionPercentage: 33.33 },
  })
  for (const [item, status] of [[first, 'IN_PROGRESS'], [second, 'IN_REVIEW']] as const) {
    const read = await owner.client.get(api + item.path).expect(200)
    expect(read.body.data).toMatchObject({ sprintId: target.id, status })
  }
  const completedTask = await owner.client.get(api + done.path).expect(200)
  expect(completedTask.body.data.sprintId).toBe(original.id)
  await (await write(manager.client, 'delete', original.path + '/tasks/' + done.id)).call.expect(409)
  await (await write(manager.client, 'patch', done.path + '/status', { status: 'TODO' })).call.expect(200)
  await (await write(manager.client, 'delete', done.path)).call.expect(204)
  const saved = await manager.client.get(api + original.path).expect(200)
  expect(saved.body.data.progress).toEqual(result.body.data.progress)
  const dashboard = (await manager.client.get(api + path + '/dashboard').expect(200)).body.data
  expect(dashboard.sprintProgress.find(({ id }: { id: string }) => id === original.id).progress).toEqual(saved.body.data.progress)
  expect(dashboard.sprintProgress.find(({ id }: { id: string }) => id === target.id).progress).toMatchObject({ totalTasks: 2, completedTasks: 0 })
}, 100_000)

it('combines sprint, dependency and existing filters before pagination and matches live dashboard totals', async () => {
  const path = await project('Filtered dashboard')
  const selected = await sprint(path, 'Release sprint')
  const foreign = await sprint(await project('Foreign filter project'), 'Foreign sprint')
  await (await write(manager.client, 'post', path + '/members', { userId: developer.id })).call.expect(201)
  const createReleaseTask = async (title: string) => {
    const response = await (await write(manager.client, 'post', path + '/tasks', {
      title, priority: 'HIGH', status: 'TODO', assigneeId: developer.id,
    })).call.expect(201)
    return response.body.data.id as string
  }
  const prerequisite = await task(path, 'Staging environment')
  const first = await createReleaseTask('Release frontend')
  const second = await createReleaseTask('Release backend')
  const ready = await createReleaseTask('Release database')
  for (const id of [first, second, ready]) await add(selected.path, id)
  for (const id of [first, second]) {
    await (await write(manager.client, 'post', `/tasks/${id}/dependencies/${prerequisite.id}`)).call.expect(201)
  }
  await (await write(manager.client, 'post', selected.path + '/start')).call.expect(200)
  const list = api + path + '/tasks'
  const filters = { sprintId: selected.id, status: 'TODO', priority: 'HIGH', assigneeId: developer.id, search: 'release' }
  const read = async (query: object) => (await developer.client.get(list).query(query).expect(200)).body
  const page = await read({ ...filters, blocked: 'true', limit: 1 })
  const next = await read({ ...filters, blocked: 'true', limit: 1, page: 2 })
  expect(page.pagination).toMatchObject({ total: 2, totalPages: 2 })
  expect([page.data[0].id, next.data[0].id]).toEqual([second, first])
  expect((await read({ ...filters, blocked: 'false' })).data.map(({ id }: { id: string }) => id)).toEqual([ready])
  expect((await read({ sprintId: 'none', blocked: 'false' })).data[0].id).toBe(prerequisite.id)
  await developer.client.get(list).query({ blocked: 'yes' }).expect(400)
  await developer.client.get(list).query({ sprintId: foreign.id, blocked: 'true' }).expect(404)
  await outsider.client.get(list).query(filters).expect(404)

  await (await write(manager.client, 'patch', prerequisite.path + '/status', { status: 'DONE' })).call.expect(200)
  expect((await read({ ...filters, blocked: 'true' })).pagination.total).toBe(0)
  expect((await read({ ...filters, blocked: 'false' })).pagination.total).toBe(3)
  const progress = (await developer.client.get(api + selected.path).expect(200)).body.data.progress
  const dashboard = (await developer.client.get(api + path + '/dashboard').expect(200)).body.data
  expect(dashboard.priorityCounts).toEqual({ LOW: 0, MEDIUM: 1, HIGH: 3, URGENT: 0 })
  expect(dashboard.priorityCounts.HIGH).toBe((await read({ priority: 'HIGH' })).pagination.total)
  expect(dashboard.sprintProgress[0]).toMatchObject({ id: selected.id, progress })
  expect(progress.totalTasks).toBe((await read({ sprintId: selected.id })).pagination.total)
  await outsider.client.get(api + path + '/dashboard').expect(404)
}, 90_000)

it('removes membership and serializes backlog rollover with competing task status changes', async () => {
  const path = await project('Backlog rollover')
  const current = await sprint(path, 'Current sprint')
  const first = await task(path, 'Race for completion', 'IN_PROGRESS')
  const second = await task(path, 'Still unfinished', 'IN_REVIEW')
  for (const item of [first, second]) await add(current.path, item.id)
  await (await write(manager.client, 'delete', current.path + '/tasks/' + second.id)).call.expect(204)
  await (await write(manager.client, 'delete', current.path + '/tasks/' + second.id)).call.expect(404)
  expect((await owner.client.get(api + second.path)).body.data).toMatchObject({ sprintId: null, status: 'IN_REVIEW' })
  await add(current.path, second.id)
  await (await write(manager.client, 'post', current.path + '/start')).call.expect(200)

  const [complete, changeStatus] = await Promise.all([
    write(manager.client, 'post', current.path + '/complete', { rolloverSprintId: null }),
    write(owner.client, 'patch', first.path + '/status', { status: 'DONE' }),
  ])
  const [closed, updated] = await Promise.all([complete.call.expect(200), changeStatus.call.expect(200)])
  expect(updated.body.data.status).toBe('DONE')
  const snapshot = closed.body.data.completionSnapshot
  expect(snapshot.totalTasks).toBe(2)
  expect([0, 1]).toContain(snapshot.completedTasks)
  expect((await owner.client.get(api + first.path)).body.data.sprintId).toBe(snapshot.completedTasks ? current.id : null)
  expect((await owner.client.get(api + second.path)).body.data).toMatchObject({ sprintId: null, status: 'IN_REVIEW' })
}, 75_000)
