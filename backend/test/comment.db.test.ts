import { Types } from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { startStage1App } from './fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowCommentTestPassword!'
let app: Awaited<ReturnType<typeof startStage1App>>
let owner: Awaited<ReturnType<typeof account>>
let manager: typeof owner
let developer: typeof owner
let outsider: typeof owner
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

async function task(title: string) {
  const { body } = await write(manager.client, 'post', project + '/tasks', 201, { title })
  return '/tasks/' + body.data.id
}

beforeAll(async () => {
  app = await startStage1App('comment')
  const accounts = await Promise.all(['Owner', 'Manager', 'Developer', 'Outsider'].map(account))
  owner = accounts[0]
  manager = accounts[1]
  developer = accounts[2]
  outsider = accounts[3]
  const workspace = await write(owner.client, 'post', '/workspaces', 201, { name: 'Comment tests' })
  const workspaceId = new Types.ObjectId(workspace.body.data.id)
  await app.database.collection(app.collections.workspace.members).insertMany([
    { userId: new Types.ObjectId(manager.id), role: 'MANAGER', workspaceId, joinedAt: new Date() },
    { userId: new Types.ObjectId(developer.id), role: 'DEVELOPER', workspaceId, joinedAt: new Date() },
    { userId: new Types.ObjectId(outsider.id), role: 'DEVELOPER', workspaceId, joinedAt: new Date() },
  ])
  const created = await write(owner.client, 'post', '/workspaces/' + workspaceId + '/projects', 201, {
    name: 'Comment project', managerId: manager.id,
  })
  project = '/projects/' + created.body.data.id
  await write(manager.client, 'post', project + '/members', 201, { userId: developer.id })
}, 65_000)

afterAll(async () => { await app?.close() }, 35_000)

it('restricts comments to the task, protects author ownership and checks mention eligibility', async () => {
  const path = await task('Access checks')
  const route = path + '/comments'
  await request(app.origin).get(api + route).expect(401)
  await developer.client.post(api + route).send({ body: 'No security token' }).expect(403)
  await outsider.client.get(api + route).expect(404)
  await outsider.client.get(api + route + '/mention-options').expect(404)
  await write(outsider.client, 'post', route, 404, { body: 'Outsider' })

  const options = await developer.client.get(api + route + '/mention-options').expect(200)
  expect(options.body.data).toEqual([
    { id: developer.id, name: 'Developer' }, { id: manager.id, name: 'Manager' }, { id: owner.id, name: 'Owner' },
  ])
  for (const fields of [
    { body: '   ' }, { body: 'a'.repeat(5001) },
    { body: 'Invalid', mentionUserIds: [outsider.id] },
    { body: 'Duplicate', mentionUserIds: [owner.id, owner.id.toUpperCase()] },
    { body: 'Too many', mentionUserIds: Array.from({ length: 21 }, () => new Types.ObjectId().toString()) },
  ]) {
    await write(developer.client, 'post', route, 400, fields)
  }

  const result = await write(developer.client, 'post', route, 201, { body: '  <b>Ready</b>\nPlease review.  ', mentionUserIds: [owner.id] })
  const comment = result.body.data
  expect(comment).toMatchObject({
    author: { id: developer.id, name: 'Developer' }, body: '<b>Ready</b>\nPlease review.',
    mentionUserIds: [owner.id], mentions: [{ id: owner.id, name: 'Owner' }], revision: 1,
  })
  expect(comment).not.toHaveProperty('introducedMentionUserIds')
  const commentPath = route + '/' + comment.id
  await write(owner.client, 'patch', commentPath, 403, { body: 'Owner cannot edit' })
  await write(manager.client, 'delete', commentPath, 403)
  await write(outsider.client, 'patch', commentPath, 404, { body: 'Hidden' })
  const other = await task('Unrelated task')
  await write(developer.client, 'patch', other + '/comments/' + comment.id, 404, { body: 'Wrong parent' })

  await write(owner.client, 'patch', project, 200, { status: 'ARCHIVED' })
  const archived = await manager.client.get(api + route).expect(200)
  expect(archived.body.data).toEqual([comment])
  await write(developer.client, 'patch', commentPath, 409, { body: 'Archived' })
  await write(developer.client, 'delete', commentPath, 409)
  await write(developer.client, 'post', route, 409, { body: 'Archived' })
  await write(owner.client, 'patch', project, 200, { status: 'ACTIVE' })
  await write(developer.client, 'delete', commentPath, 204)
  expect((await manager.client.get(api + route).expect(200)).body.data).toEqual([])
}, 110_000)

it('commits mention deltas by revision and revalidates retained recipients after removal', async () => {
  const route = (await task('Revision checks')) + '/comments'
  const result = await write(manager.client, 'post', route, 201, { body: 'First draft', mentionUserIds: [owner.id] })
  const id = result.body.data.id
  const item = route + '/' + id
  const comments = app.database.collection(app.collections.comment.comments)
  const read = () => comments.findOne({ _id: new Types.ObjectId(id) })
  const introduced = async () => (await read())?.introducedMentionUserIds.map(String)
  expect(await introduced()).toEqual([owner.id])

  const edited = await write(manager.client, 'patch', item, 200, { body: 'Wording only' })
  expect(edited.body.data).toMatchObject({ revision: 2, mentionUserIds: [owner.id], createdAt: result.body.data.createdAt })
  expect(await introduced()).toEqual([])

  await write(manager.client, 'patch', item, 200, { mentionUserIds: [owner.id, developer.id] })
  expect(await introduced()).toEqual([developer.id])
  await write(manager.client, 'patch', item, 200, { mentionUserIds: [developer.id] })
  expect(await introduced()).toEqual([])
  await write(manager.client, 'patch', item, 200, { mentionUserIds: [developer.id, owner.id] })
  expect(await introduced()).toEqual([owner.id])

  await write(manager.client, 'delete', project + '/members/' + developer.id, 204)
  try {
    await developer.client.get(api + route).expect(404)
    await write(manager.client, 'patch', item, 400, { body: 'Retains revoked mention' })
    expect((await read())?.revision).toBe(5)
    expect(await introduced()).toEqual([owner.id])
    const replaced = await write(manager.client, 'patch', item, 200, { mentionUserIds: [owner.id] })
    expect(replaced.body.data.revision).toBe(6)
    expect(await introduced()).toEqual([])
  } finally {
    await write(manager.client, 'post', project + '/members', 201, { userId: developer.id })
  }
}, 80_000)

it('paginates tied timestamps and cleans up comments when the task is permanently deleted', async () => {
  const path = await task('Paginated discussion')
  const route = path + '/comments'
  const created = []
  for (const text of ['Oldest first', 'Second entry', 'Third entry']) {
    created.push((await write(manager.client, 'post', route, 201, { body: text })).body.data.id as string)
  }
  const collection = app.database.collection(app.collections.comment.comments)
  const taskId = new Types.ObjectId(path.split('/').at(-1))
  await collection.updateMany({ taskId }, { $set: { createdAt: new Date('2027-02-03T04:05:06Z') } })
  const first = await developer.client.get(api + route).query({ limit: 2 }).expect(200)
  const second = await developer.client.get(api + route).query({ limit: 2, page: 2 }).expect(200)
  expect(first.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 })
  expect([...first.body.data, ...second.body.data].map(({ id }) => id)).toEqual(created.sort().reverse())

  const deletion = await prepare(manager.client, 'delete', path)
  const newComment = await prepare(developer.client, 'post', route, { body: 'Concurrent comment' })
  const [, attempted] = await Promise.all([deletion.call.expect(204), newComment.call])
  expect([201, 404]).toContain(attempted.status)
  expect(await collection.countDocuments({ taskId })).toBe(0)
  await developer.client.get(api + route).expect(404)
}, 65_000)
