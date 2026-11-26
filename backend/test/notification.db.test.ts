import mongoose, { Types } from 'mongoose'
import request from 'supertest'
import { io } from 'socket.io-client'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { startStage1App } from './fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowNotificationFixturePassword!'
let app: Awaited<ReturnType<typeof startStage1App>>
let owner: Awaited<ReturnType<typeof account>>
let developer: typeof owner
let outsider: typeof owner
let workspacePath: string
let projectPath: string

type Client = ReturnType<typeof request.agent>
type Item = { id: string; kind: string; task?: { id: string; title: string }; workspaceName?: string; unavailable: boolean; readAt: string | null }

async function write(client: Client, method: 'post' | 'patch' | 'delete', path: string, status: number, body?: object) {
  const { body: csrf } = await client.get(api + '/auth/csrf').expect(200)
  const call = client[method](api + path).set('Origin', app.origin).set('X-CSRF-Token', csrf.data.csrfToken)
  return (body ? call.send(body) : call).expect(status)
}
async function account(name: string) {
  const client = request.agent(app.origin)
  const email = name.toLowerCase() + '@example.test'
  const { body } = await write(client, 'post', '/auth/register', 201, { name, email, password })
  const session = await write(client, 'post', '/auth/login', 200, { email, password })
  const headers = session.headers['set-cookie'] as unknown as string[]
  const cookie = headers.find((header) => header.startsWith('devflow_session='))?.split(';', 1)[0]
  if (!cookie) throw Error('Expected a session cookie.')
  return { client, id: body.data.id as string, email, cookie }
}
async function inbox(client: Client): Promise<Item[]> {
  return (await client.get(api + '/notifications').expect(200)).body.data
}
async function unread(client: Client) {
  return (await client.get(api + '/notifications/unread-count').expect(200)).body.data.count
}
async function createTask(title: string, fields: object = {}, project = projectPath, status = 201) {
  return (await write(owner.client, 'post', project + '/tasks', status, { title, ...fields })).body.data
}
const collection = () => app.database.collection(app.collections.notification.notifications)

async function connect(cookie: string) {
  const socket = io(app.origin, {
    autoConnect: false, transports: ['websocket'], reconnection: false,
    extraHeaders: { Origin: app.origin, Cookie: cookie },
  })
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
    socket.connect()
  })
  return socket
}

beforeAll(async () => {
  app = await startStage1App('notifications')
  const accounts = await Promise.all(['Owner', 'Developer', 'Outsider'].map(account))
  owner = accounts[0]
  developer = accounts[1]
  outsider = accounts[2]
  const workspace = await write(owner.client, 'post', '/workspaces', 201, { name: 'Workspace for notifications' })
  const workspaceId = new Types.ObjectId(workspace.body.data.id)
  workspacePath = '/workspaces/' + workspaceId
  await app.database.collection(app.collections.workspace.members).insertOne({
    workspaceId, userId: new Types.ObjectId(developer.id), role: 'DEVELOPER', joinedAt: new Date(),
  })
  const project = await write(owner.client, 'post', workspacePath + '/projects', 201, { name: 'Notification project', managerId: owner.id })
  projectPath = '/projects/' + project.body.data.id
  await write(owner.client, 'post', projectPath + '/members', 201, { userId: developer.id })
}, 65_000)

afterAll(async () => { await app?.close() }, 35_000)

it('records assignment, review and new mention occurrences alongside their source writes', async () => {
  const [recipient, unrelated] = await Promise.all([connect(developer.cookie), connect(outsider.cookie)])
  const messages: unknown[][] = []
  const unrelatedMessages: unknown[][] = []
  recipient.on('notifications:changed', (...payload) => messages.push(payload))
  unrelated.on('notifications:changed', (...payload) => unrelatedMessages.push(payload))
  const task = await (async () => {
    try {
      const assigned = await createTask('Notify about review', { assigneeId: developer.id })
      await expect.poll(() => messages.length, { timeout: 5000 }).toBe(1)
      expect(messages).toEqual([[]])
      expect(unrelatedMessages).toEqual([])
      return assigned
    } finally {
      recipient.disconnect()
      unrelated.disconnect()
    }
  })()
  const path = '/tasks/' + task.id
  await write(owner.client, 'patch', path, 200, { assigneeId: developer.id })
  await write(developer.client, 'patch', path + '/status', 409, { status: 'IN_REVIEW', expectedVersion: 0 })
  expect(await unread(owner.client)).toBe(0)
  await write(developer.client, 'patch', path + '/status', 200, { status: 'IN_REVIEW', expectedVersion: 1 })
  await write(developer.client, 'patch', path + '/status', 200, { status: 'IN_REVIEW' })
  await write(owner.client, 'patch', path + '/status', 200, { status: 'IN_PROGRESS' })
  await write(developer.client, 'patch', path + '/status', 200, { status: 'IN_REVIEW' })
  expect((await inbox(owner.client)).map(({ kind }) => kind)).toEqual(['REVIEW', 'REVIEW'])
  expect(await unread(developer.client)).toBe(1)

  const comment = await write(owner.client, 'post', path + '/comments', 201, { body: 'Please review', mentionUserIds: [developer.id, owner.id] })
  const commentPath = path + '/comments/' + comment.body.data.id
  await write(owner.client, 'patch', commentPath, 200, { body: 'Review updated' })
  await write(owner.client, 'patch', commentPath, 200, { mentionUserIds: [] })
  await write(owner.client, 'patch', commentPath, 200, { mentionUserIds: [developer.id] })
  expect((await inbox(developer.client)).map(({ kind }) => kind)).toEqual(['MENTION', 'MENTION', 'ASSIGNMENT'])
  expect(await unread(owner.client)).toBe(2)

  const fail = vi.spyOn(mongoose.connection.model('Notification').collection, 'bulkWrite')
    .mockRejectedValueOnce(new Error('Intentional notification write failure'))
  try {
    await createTask('Assignment should roll back', { assigneeId: developer.id }, projectPath, 500)
    expect(await app.database.collection(app.collections.task.tasks).countDocuments({ title: 'Assignment should roll back' })).toBe(0)
    expect(await unread(developer.client)).toBe(3)
  } finally {
    fail.mockRestore()
  }
}, 90_000)

it('creates eligible deadline notifications within the UTC window and deduplicates overlapping scans', async () => {
  const assigned = { assigneeId: developer.id }
  const today = await createTask('Due today', { ...assigned, dueDate: '2028-03-01' })
  const dayTwo = await createTask('Due in two days', { ...assigned, dueDate: '2028-03-03' })
  await createTask('Overdue already', { ...assigned, dueDate: '2028-02-29' })
  await createTask('Due later', { ...assigned, dueDate: '2028-03-04' })
  await createTask('Finished already', { ...assigned, dueDate: '2028-03-01', status: 'DONE' })
  await createTask('Unassigned work', { dueDate: '2028-03-01' })

  const project = await write(owner.client, 'post', workspacePath + '/projects', 201, { name: 'Project to archive', managerId: owner.id })
  const path = '/projects/' + project.body.data.id
  await write(owner.client, 'post', path + '/members', 201, { userId: developer.id })
  await createTask('Archived deadline', { ...assigned, dueDate: '2028-03-01' }, path)
  await write(owner.client, 'patch', path, 200, { status: 'ARCHIVED' })

  const now = new Date('2028-03-01T23:59:00.000Z')
  await Promise.all([app.scanDeadlines(now), app.scanDeadlines(now)])
  await app.scanDeadlines(now)
  const reminders = (await inbox(developer.client)).filter(({ kind }) => kind === 'DEADLINE')
  expect(reminders.map(({ task }) => task?.id).sort()).toEqual([today.id, dayTwo.id].sort())
  const duplicates = await collection().countDocuments({ kind: 'DEADLINE', recipientId: new Types.ObjectId(developer.id) })
  expect(duplicates).toBe(2)
}, 105_000)

it('notifies only an existing matching invitee and keeps the acceptance URL out of inbox records', async () => {
  const invitation = (await write(owner.client, 'post', workspacePath + '/invitations', 201,
    { email: outsider.email, role: 'DEVELOPER' })).body.data
  await write(owner.client, 'post', workspacePath + '/invitations', 409, { email: outsider.email, role: 'DEVELOPER' })
  await write(owner.client, 'post', workspacePath + '/invitations', 201, { email: 'unknown@example.test', role: 'DEVELOPER' })
  expect(await collection().countDocuments({ kind: 'INVITATION' })).toBe(1)
  const [received] = await inbox(outsider.client)
  expect(received).toMatchObject({ kind: 'INVITATION', workspaceName: 'Workspace for notifications', unavailable: false })
  expect(received).not.toHaveProperty('acceptUrl')
  const stored = await collection().findOne({ _id: new Types.ObjectId(received.id) })
  expect(stored).not.toHaveProperty('token')
  expect(stored).not.toHaveProperty('tokenHash')
  expect(stored).not.toHaveProperty('email')

  await write(outsider.client, 'post', new URL(invitation.acceptUrl).pathname + '/accept', 200)
  expect((await inbox(outsider.client))[0]).toMatchObject({ id: received.id, unavailable: true })
  expect((await inbox(outsider.client))[0]).not.toHaveProperty('workspaceName')
}, 65_000)

it('notifies the current assignee once per reopening and skips self-reopens', async () => {
  const task = await createTask('Reopen completed work', { assigneeId: owner.id, status: 'DONE' })
  const path = '/tasks/' + task.id
  const unreadBefore = await unread(developer.client)
  const ownerUnreadBefore = await unread(owner.client)

  await write(owner.client, 'patch', path + '/status', 200, { status: 'TODO' })
  expect(await unread(owner.client)).toBe(ownerUnreadBefore)

  await write(owner.client, 'patch', path + '/status', 200, { status: 'DONE' })
  await write(owner.client, 'patch', path, 200, { assigneeId: developer.id })
  expect((await inbox(developer.client)).filter(({ task: link }) => link?.id === task.id).map(({ kind }) => kind)).toEqual(['ASSIGNMENT'])

  await write(owner.client, 'patch', path + '/status', 200, { status: 'TODO' })
  await write(owner.client, 'patch', path + '/status', 200, { status: 'TODO' })
  await write(owner.client, 'patch', path + '/status', 200, { status: 'IN_PROGRESS' })
  await write(owner.client, 'patch', path + '/status', 200, { status: 'DONE' })
  await write(owner.client, 'patch', path + '/status', 200, { status: 'IN_PROGRESS' })

  const entries = (await inbox(developer.client)).filter(({ task: link }) => link?.id === task.id)
  expect(entries.map(({ kind }) => kind)).toEqual(['REOPENED', 'REOPENED', 'ASSIGNMENT'])
  expect(entries[0]).toMatchObject({ task: { id: task.id, title: task.title }, readAt: null })
  expect(await unread(developer.client)).toBe(unreadBefore + 3)
}, 65_000)

it('isolates inboxes, preserves read timestamps and redacts links after project access is lost', async () => {
  const task = await createTask('Read privately', { assigneeId: developer.id })
  const entry = (await inbox(developer.client)).find(({ task: link }) => link?.id === task.id)!
  const path = '/notifications/' + entry.id
  await request(app.origin).get(api + '/notifications').expect(401)
  await write(outsider.client, 'patch', path, 404, { read: true })
  await write(developer.client, 'patch', path, 400, { read: false })
  const before = await unread(developer.client)
  const first = await write(developer.client, 'patch', path, 200, { read: true })
  const repeated = await write(developer.client, 'patch', path, 200, { read: true })
  expect(first.body.data.readAt).toEqual(repeated.body.data.readAt)
  expect(await unread(developer.client)).toBe(before - 1)
  const secondSession = request.agent(app.origin)
  await write(secondSession, 'post', '/auth/login', 200, { email: developer.email, password })
  expect(await unread(secondSession)).toBe(before - 1)

  const page = await developer.client.get(api + '/notifications?limit=1').expect(200)
  expect(page.body.pagination).toMatchObject({ page: 1, limit: 1, total: before })
  await write(owner.client, 'delete', projectPath + '/members/' + developer.id, 204)
  await developer.client.get(api + '/tasks/' + task.id).expect(404)
  const redacted = (await inbox(secondSession)).find(({ id }) => id === entry.id)
  expect(redacted).toMatchObject({ unavailable: true, readAt: first.body.data.readAt })
  expect(redacted).not.toHaveProperty('task')
}, 75_000)
