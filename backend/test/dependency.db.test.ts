import mongoose, { Types } from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { startStage1App } from './fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowDependencyTestPassword!'
let app: Awaited<ReturnType<typeof startStage1App>>
let owner: Awaited<ReturnType<typeof account>>
let manager: typeof owner
let developer: typeof owner
let outsider: typeof owner
let workspace: string
let project: string
let otherProject: string

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

async function task(title: string, projectPath = project) {
  const { body } = await write(owner.client, 'post', projectPath + '/tasks', 201, { title })
  const id = body.data.id as string
  return { id, path: '/tasks/' + id, links: '/tasks/' + id + '/dependencies' }
}

type Task = Awaited<ReturnType<typeof task>>
const edge = (from: Task, to: Task) => from.links + '/' + to.id
const collection = () => app.database.collection(app.collections.dependency.dependencies)

async function read(item: Task, client = owner.client) {
  const result = await client.get(api + item.links).expect(200)
  return result.body.data
}

beforeAll(async () => {
  app = await startStage1App('dependency')
  const accounts = await Promise.all(['Owner', 'Manager', 'Developer', 'Outsider'].map(account))
  owner = accounts[0]
  manager = accounts[1]
  developer = accounts[2]
  outsider = accounts[3]
  const created = await write(owner.client, 'post', '/workspaces', 201, { name: 'Dependency test workspace' })
  workspace = '/workspaces/' + created.body.data.id
  const workspaceId = new Types.ObjectId(created.body.data.id)
  await app.database.collection(app.collections.workspace.members).insertMany([
    { userId: new Types.ObjectId(manager.id), role: 'MANAGER', workspaceId, joinedAt: new Date() },
    { userId: new Types.ObjectId(developer.id), role: 'DEVELOPER', workspaceId, joinedAt: new Date() },
    { userId: new Types.ObjectId(outsider.id), role: 'DEVELOPER', workspaceId, joinedAt: new Date() },
  ])
  const createdProject = await write(owner.client, 'post', workspace + '/projects', 201, { name: 'Dependency project', managerId: manager.id })
  project = '/projects/' + createdProject.body.data.id
  await write(manager.client, 'post', project + '/members', 201, { userId: developer.id })
  const other = await write(owner.client, 'post', workspace + '/projects', 201, { name: 'Private project', managerId: owner.id })
  otherProject = '/projects/' + other.body.data.id
}, 65_000)

afterAll(async () => { await app?.close() }, 35_000)

it('enforces project access, management roles, valid endpoints and archive rules', async () => {
  const a = await task('Permission source')
  const b = await task('Permission prerequisite')
  const foreign = await task('Foreign prerequisite', otherProject)

  expect(await read(a, developer.client)).toEqual({ prerequisites: [], dependents: [], blocked: false })
  await request(app.origin).get(api + a.links).expect(401)
  await manager.client.post(api + edge(a, b)).expect(403)
  await outsider.client.get(api + a.links).expect(404)
  await write(outsider.client, 'post', edge(a, b), 404)
  await write(developer.client, 'post', edge(a, b), 403)
  await write(owner.client, 'post', edge(a, a), 400)
  await write(owner.client, 'post', edge(a, foreign), 400)
  const hidden = await write(manager.client, 'post', edge(a, foreign), 404)
  const missing = await write(manager.client, 'post', a.links + '/' + new Types.ObjectId(), 404)
  expect(hidden.body).toEqual(missing.body)
  await write(manager.client, 'post', a.links + '/invalid', 400)

  const created = await write(manager.client, 'post', edge(a, b), 201)
  expect(created.body.data).toEqual({ taskId: a.id, prerequisiteId: b.id })
  const duplicate = await write(owner.client, 'post', edge(a, b), 409)
  expect(duplicate.body.error.code).toBe('DEPENDENCY_EXISTS')
  await expect(collection().insertOne({
    projectId: new Types.ObjectId(project.split('/').at(-1)),
    taskId: new Types.ObjectId(a.id), prerequisiteId: new Types.ObjectId(b.id),
  })).rejects.toHaveProperty('code', 11000)
  await write(developer.client, 'delete', edge(a, b), 403)

  await write(owner.client, 'patch', project, 200, { status: 'ARCHIVED' })
  expect((await read(a, developer.client)).blocked).toBe(true)
  await write(manager.client, 'post', edge(b, a), 409)
  await write(manager.client, 'delete', edge(a, b), 409)
  await write(owner.client, 'patch', project, 200, { status: 'ACTIVE' })
  await write(manager.client, 'delete', edge(a, b), 204)
  await write(manager.client, 'delete', edge(a, b), 404)
}, 95_000)

it('rejects indirect cycles and serializes concurrent reverse links', async () => {
  const a = await task('Chain A')
  const b = await task('Chain B')
  const c = await task('Chain C')
  await write(manager.client, 'post', edge(a, b), 201)
  await write(owner.client, 'post', edge(b, c), 201)
  const indirect = await write(manager.client, 'post', edge(c, a), 409)
  expect(indirect.body.error.code).toBe('DEPENDENCY_CYCLE')
  expect((await read(c)).prerequisites).toEqual([])
  expect((await read(c)).dependents).toEqual([{ id: b.id, title: 'Chain B', status: 'BACKLOG' }])

  const x = await task('Race X')
  const y = await task('Race Y')
  const writes = await Promise.all([prepare(owner.client, 'post', edge(x, y)), prepare(manager.client, 'post', edge(y, x))])
  const results = await Promise.all(writes.map(({ call }) => call))
  expect(results.map(({ status }) => status).sort()).toEqual([201, 409])
  expect(results.find(({ status }) => status === 409)?.body.error.code).toBe('DEPENDENCY_CYCLE')
  const [left, right] = await Promise.all([read(x), read(y)])
  expect(left.prerequisites.length + right.prerequisites.length).toBe(1)
  expect(left.dependents.length + right.dependents.length).toBe(1)
}, 70_000)

it('uses only direct prerequisite statuses and removes both edge directions with task deletion', async () => {
  const a = await task('Blocked work')
  const b = await task('First prerequisite')
  const c = await task('Second prerequisite')
  await write(owner.client, 'post', edge(a, b), 201)
  await write(owner.client, 'post', edge(a, c), 201)
  await write(owner.client, 'post', edge(b, c), 201)
  expect((await read(a)).blocked).toBe(true)

  await write(owner.client, 'patch', b.path + '/status', 200, { status: 'DONE' })
  expect((await read(a)).blocked).toBe(true)
  await write(owner.client, 'delete', edge(a, c), 204)
  expect((await read(a)).blocked).toBe(false)
  expect((await read(b)).blocked).toBe(true)
  await write(owner.client, 'patch', b.path + '/status', 200, { status: 'TODO' })
  expect((await read(a)).blocked).toBe(true)

  const failCleanup = vi.spyOn(mongoose.connection.model('TaskDependency').collection, 'deleteMany')
    .mockRejectedValueOnce(new Error('Intentional dependency cleanup failure'))
  try {
    await write(owner.client, 'delete', b.path, 500)
    await owner.client.get(api + b.path).expect(200)
    expect((await read(a)).prerequisites.map(({ id }: { id: string }) => id)).toEqual([b.id])
    expect((await read(c)).dependents.map(({ id }: { id: string }) => id)).toEqual([b.id])
  } finally {
    failCleanup.mockRestore()
  }

  await write(owner.client, 'delete', b.path, 204)
  const restored = await read(a)
  expect(restored).toEqual({ prerequisites: [], dependents: [], blocked: false })
  expect((await read(c)).dependents).toEqual([])
  const deletedId = new Types.ObjectId(b.id)
  expect(await collection().countDocuments({ $or: [{ taskId: deletedId }, { prerequisiteId: deletedId }] })).toBe(0)
}, 85_000)

it('keeps the graph free of orphaned links when adding a prerequisite races deletion', async () => {
  const a = await task('Race dependent')
  const b = await task('Race prerequisite')
  const [add, remove] = await Promise.all([
    prepare(manager.client, 'post', edge(a, b)),
    prepare(owner.client, 'delete', b.path),
  ])
  const [added] = await Promise.all([add.call, remove.call.expect(204)])
  expect([201, 404]).toContain(added.status)
  expect(await collection().countDocuments({ prerequisiteId: new Types.ObjectId(b.id) })).toBe(0)
  expect(await read(a)).toEqual({ prerequisites: [], dependents: [], blocked: false })
}, 55_000)
