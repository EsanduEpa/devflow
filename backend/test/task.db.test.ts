import { randomBytes, randomUUID } from 'node:crypto'
import mongoose, { Types } from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApi } from '../src/api.js'
import { createApp } from '../src/app.js'
import { authConfig } from '../src/config/auth.js'
import { connectDatabase } from '../src/config/database.js'

const suffix = randomUUID().replaceAll('-', '')
const collections = {
  auth: { users: `m10_users_${suffix}`, sessions: `m10_sessions_${suffix}`, resetTokens: `m10_resets_${suffix}` },
  workspace: { workspaces: `m10_workspaces_${suffix}`, members: `m10_workspace_members_${suffix}`, invitations: `m10_invites_${suffix}` },
  project: { projects: `m10_projects_${suffix}`, members: `m10_project_members_${suffix}` },
  task: { tasks: `m10_tasks_${suffix}` },
}
const origin = 'http://127.0.0.1:5173'
const api = '/api/v1'
const password = 'DevFlowTaskPassword!'
let app: ReturnType<typeof createApp>
let owner: Awaited<ReturnType<typeof account>>
let manager: Awaited<ReturnType<typeof account>>
let developer: Awaited<ReturnType<typeof account>>
let outsider: Awaited<ReturnType<typeof account>>

function db() {
  return mongoose.connection.db!
}

async function protectedRequest(client: ReturnType<typeof request.agent>, method: 'post' | 'patch' | 'delete', url: string, body?: object) {
  const csrf = await client.get(`${api}/auth/csrf`).expect(200)
  const call = client[method](url).set('Origin', origin).set('X-CSRF-Token', csrf.body.data.csrfToken)
  return { call: body ? call.send(body) : call }
}

async function mutate(client: ReturnType<typeof request.agent>, method: 'post' | 'patch' | 'delete', url: string, status: number, body?: object) {
  const { call } = await protectedRequest(client, method, url, body)
  return call.expect(status)
}

async function account(name: string) {
  const client = request.agent(app)
  const email = `${name}@example.test`
  const created = await mutate(client, 'post', `${api}/auth/register`, 201, { name, email, password })
  await mutate(client, 'post', `${api}/auth/login`, 200, { email, password })
  return { client, id: created.body.data.id as string, objectId: new Types.ObjectId(created.body.data.id) }
}

async function workspace(name: string) {
  const created = await mutate(owner.client, 'post', `${api}/workspaces`, 201, { name })
  const workspaceId = new Types.ObjectId(created.body.data.id)
  const joinedAt = new Date()
  await db().collection(collections.workspace.members).insertMany([
    { workspaceId, userId: manager.objectId, role: 'MANAGER', joinedAt },
    { workspaceId, userId: developer.objectId, role: 'DEVELOPER', joinedAt },
  ])
  return `${api}/workspaces/${workspaceId}`
}

async function project(workspaceUrl: string, name: string, addDeveloper = true) {
  const result = await mutate(owner.client, 'post', `${workspaceUrl}/projects`, 201, { name, managerId: manager.id, status: 'ACTIVE' })
  const id = result.body.data.id as string
  const url = `${api}/projects/${id}`
  if (addDeveloper) await mutate(owner.client, 'post', `${url}/members`, 201, { userId: developer.id })
  return { id, url }
}

async function createTask(projectUrl: string, fields: object) {
  const result = await mutate(owner.client, 'post', `${projectUrl}/tasks`, 201, fields)
  const id = result.body.data.id as string
  return { id, url: `${api}/tasks/${id}`, data: result.body.data }
}

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI?.trim() || process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Configure the MongoDB test connection.')
  const connection = await connectDatabase(uri, 'devflow_test')
  const config = authConfig({ APP_ORIGINS: origin, CSRF_SECRET: randomBytes(32).toString('hex') })
  const email = { origin, async sendResetEmail() { throw new Error('Task tests do not send email.') } }
  app = createApp(await createApi(connection, config, email, collections))
  const accounts = await Promise.all(['owner', 'manager', 'developer', 'outsider'].map(account))
  owner = accounts[0]
  manager = accounts[1]
  developer = accounts[2]
  outsider = accounts[3]
}, 35_000)

afterAll(async () => {
  try {
    const database = mongoose.connection.db
    if (database && mongoose.connection.readyState === 1) {
      for (const name of Object.values(collections).flatMap((group) => Object.values(group))) {
        if (await database.listCollections({ name }, { nameOnly: true }).hasNext()) await database.dropCollection(name)
      }
    }
  } finally {
    await mongoose.disconnect()
  }
}, 30_000)

describe('Task management', () => {
  it('validates task input, applies Developer defaults, and protects private tasks', async () => {
    const team = await workspace('Task permissions')
    const accessible = await project(team, 'Accessible project')
    const restricted = await project(team, 'Restricted project', false)
    const create = `${accessible.url}/tasks`
    await request(app).post(create).send({ title: 'Not signed in' }).expect(401)
    await owner.client.post(create).send({ title: 'Missing CSRF' }).expect(403)
    await mutate(developer.client, 'post', `${restricted.url}/tasks`, 404, { title: 'Outside project' })
    await mutate(developer.client, 'post', create, 403, { title: 'Forbidden priority', priority: 'URGENT' })
    await mutate(owner.client, 'post', `${restricted.url}/tasks`, 400, { title: 'Invalid assignee', assigneeId: developer.id })
    for (const fields of [
      { title: ' x ' }, { description: 'x'.repeat(5001) }, { dueDate: '2027-02-29' },
      { priority: 'OTHER' }, { status: 'ACTIVE' }, { createdBy: outsider.id }, { projectId: restricted.id },
    ]) {
      await mutate(owner.client, 'post', create, 400, { title: 'Valid title', ...fields })
    }
    const result = await mutate(developer.client, 'post', create, 201, { title: '  Developer task ', description: ' Basic report ' })
    const task = result.body.data
    expect(task).toMatchObject({
      projectId: accessible.id, title: 'Developer task', description: 'Basic report',
      priority: 'MEDIUM', status: 'BACKLOG', assigneeId: null, dueDate: null, createdBy: developer.id, updatedBy: null,
    })
    const url = `${api}/tasks/${task.id}`
    await developer.client.get(url).expect('Cache-Control', 'no-store').expect(200, result.body)
    await request(app).get(url).expect(401)
    const hidden = await outsider.client.get(url).expect(404)
    await owner.client.get(`${api}/tasks/${new Types.ObjectId()}`).expect(404, hidden.body)
    await mutate(developer.client, 'patch', url, 403, { title: 'Forbidden edit' })
    await mutate(developer.client, 'delete', url, 403)
  }, 50_000)

  it('allows authorized editing and deletion but blocks all task writes while archived', async () => {
    const team = await workspace('Task editing')
    const target = await project(team, 'Archive flow')
    const task = await createTask(target.url, {
      title: 'Original task', assigneeId: developer.id.toUpperCase(), dueDate: '2028-02-29', status: 'TODO', priority: 'HIGH',
    })
    expect(task.data).toMatchObject({ assigneeId: developer.id, dueDate: '2028-02-29', status: 'TODO', createdBy: owner.id })
    const stored = await db().collection(collections.task.tasks).findOne({ _id: new Types.ObjectId(task.id) })
    expect(stored?.dueDate).toEqual(new Date('2028-02-29T00:00:00.000Z'))
    await mutate(manager.client, 'patch', task.url, 400, { assigneeId: outsider.id })
    await mutate(manager.client, 'patch', task.url, 400, { status: 'DONE' })
    const edit = await mutate(manager.client, 'patch', task.url, 200, {
      title: 'Edited task', priority: 'URGENT', dueDate: null, assigneeId: null,
    })
    expect(edit.body.data).toMatchObject({
      title: 'Edited task', priority: 'URGENT', dueDate: null, assigneeId: null, updatedBy: manager.id, status: 'TODO', createdBy: owner.id,
    })
    expect(new Date(edit.body.data.updatedAt).getTime()).toBeGreaterThan(new Date(task.data.updatedAt).getTime())
    await mutate(owner.client, 'patch', target.url, 200, { status: 'ARCHIVED' })
    await mutate(manager.client, 'post', `${target.url}/tasks`, 409, { title: 'Blocked new task' })
    await mutate(owner.client, 'patch', task.url, 409, { title: 'Blocked edit' })
    await mutate(owner.client, 'delete', task.url, 409)
    await developer.client.get(task.url).expect(200, edit.body)
    await mutate(owner.client, 'patch', target.url, 200, { status: 'ACTIVE' })
    await manager.client.delete(task.url).expect(403)
    await mutate(manager.client, 'delete', task.url, 204)
    await manager.client.get(task.url).expect(404)
    await owner.client.get(target.url).expect(200)
  }, 50_000)

  it('keeps tasks and unassigns them only within the affected project or workspace', async () => {
    const first = await workspace('First cleanup workspace')
    const second = await workspace('Second cleanup workspace')
    const one = await project(first, 'Project removal')
    const two = await project(first, 'Workspace removal')
    const other = await project(second, 'Separate workspace')
    const firstTask = await createTask(one.url, { title: 'Project cleanup', assigneeId: developer.id })
    const secondTask = await createTask(two.url, { title: 'Workspace cleanup', assigneeId: developer.id })
    const otherTask = await createTask(other.url, { title: 'Assignment stays', assigneeId: developer.id })
    await mutate(manager.client, 'delete', `${one.url}/members/${developer.id}`, 204)
    const projectCleanup = await owner.client.get(firstTask.url).expect(200)
    expect(projectCleanup.body.data).toMatchObject({ id: firstTask.id, assigneeId: null, updatedBy: manager.id })
    await developer.client.get(firstTask.url).expect(404)
    await developer.client.get(secondTask.url).expect(200, { data: secondTask.data })
    await mutate(owner.client, 'patch', two.url, 200, { status: 'ARCHIVED' })
    await mutate(owner.client, 'delete', `${first}/members/${developer.id}`, 204)
    const workspaceCleanup = await owner.client.get(secondTask.url).expect(200)
    expect(workspaceCleanup.body.data).toMatchObject({ id: secondTask.id, assigneeId: null, updatedBy: owner.id })
    await developer.client.get(secondTask.url).expect(404)
    await developer.client.get(otherTask.url).expect(200, { data: otherTask.data })
  }, 60_000)

  it('rolls back both membership and task changes if cleanup fails', async () => {
    const team = await workspace('Member cleanup rollback')
    const target = await project(team, 'Task rollback project')
    const task = await createTask(target.url, { title: 'Assignment must stay', assigneeId: developer.id })
    const unassign = vi.spyOn(mongoose.connection.model('Task').collection, 'updateMany')
      .mockRejectedValueOnce(new Error('Intentional task update failure'))
    try {
      await mutate(owner.client, 'delete', `${target.url}/members/${developer.id}`, 500)
      expect(unassign).toHaveBeenCalledOnce()
    } finally {
      unassign.mockRestore()
    }
    await developer.client.get(task.url).expect(200, { data: task.data })

    const removal = vi.spyOn(mongoose.connection.model('WorkspaceMember').collection, 'deleteOne')
      .mockRejectedValueOnce(new Error('Intentional workspace membership removal failure'))
    try {
      await mutate(owner.client, 'delete', `${team}/members/${developer.id}`, 500)
      expect(removal).toHaveBeenCalledOnce()
    } finally {
      removal.mockRestore()
    }
    await developer.client.get(task.url).expect(200, { data: task.data })
    const membership = await db().collection(collections.project.members)
      .findOne({ projectId: new Types.ObjectId(target.id), userId: developer.objectId })
    expect(membership).not.toBeNull()
  }, 45_000)

  it('keeps the task unassigned if assignment races with project membership removal', async () => {
    const team = await workspace('Concurrent cleanup')
    const target = await project(team, 'Assignment race')
    const task = await createTask(target.url, { title: 'Unassigned task' })
    const assignment = await protectedRequest(owner.client, 'patch', task.url, { assigneeId: developer.id })
    const removal = await protectedRequest(owner.client, 'delete', `${target.url}/members/${developer.id}`)
    const [assigned, removed] = await Promise.all([assignment.call, removal.call])
    expect([200, 400]).toContain(assigned.status)
    expect(removed.status).toBe(204)
    const result = await owner.client.get(task.url).expect(200)
    expect(result.body.data.assigneeId).toBeNull()
    await developer.client.get(task.url).expect(404)
  }, 45_000)
})

describe('Kanban task lists and status changes', () => {
  it('paginates tasks in stable order within the authorized project', async () => {
    const team = await workspace('Board pagination')
    const boardProject = await project(team, 'Board with two pages')
    const other = await project(team, 'Separate board', false)
    await createTask(other.url, { title: 'Another project task' })
    const createdAt = new Date()
    const rows = Array.from({ length: 23 }, (_, index) => ({
      _id: new Types.ObjectId(), projectId: new Types.ObjectId(boardProject.id),
      title: `Task ${index + 1}`, status: 'BACKLOG', priority: 'MEDIUM',
      createdBy: owner.objectId, createdAt, updatedAt: createdAt,
    }))
    await db().collection(collections.task.tasks).insertMany(rows)
    const route = `${boardProject.url}/tasks`

    await request(app).get(route).expect(401)
    await outsider.client.get(route).expect(404)
    await developer.client.get(`${other.url}/tasks`).expect(404)
    const first = await developer.client.get(route).expect('Cache-Control', 'no-store').expect(200)
    const second = await developer.client.get(`${route}?page=2`).expect(200)
    expect(first.body.pagination).toEqual({ page: 1, limit: 20, total: 23, totalPages: 2 })
    expect(second.body.pagination).toEqual({ page: 2, limit: 20, total: 23, totalPages: 2 })
    const all = [...first.body.data, ...second.body.data]
    expect(all.map(({ id }) => id)).toEqual([...rows].reverse().map(({ _id }) => _id.toString()))
    expect(all.every(({ projectId }) => projectId === boardProject.id)).toBe(true)
    const beyond = await owner.client.get(`${route}?page=3`).expect(200)
    expect(beyond.body).toEqual({ data: [], pagination: { page: 3, limit: 20, total: 23, totalPages: 2 } })
    const larger = await owner.client.get(`${route}?limit=100`).expect(200)
    expect(larger.body.data).toHaveLength(23)
    for (const query of ['page=0', 'page=1.5', 'limit=101', 'page=1&page=2']) {
      await owner.client.get(`${route}?${query}`).expect(400)
    }
  }, 45_000)

  it('allows assigned Developers to move work for review and reserves Done and reopening for management', async () => {
    const team = await workspace('Status permissions')
    const boardProject = await project(team, 'Review board')
    const task = await createTask(boardProject.url, { title: 'Assigned to Developer', assigneeId: developer.id })
    const route = `${task.url}/status`
    await request(app).patch(route).send({ status: 'TODO' }).expect(401)
    await developer.client.patch(route).send({ status: 'TODO' }).expect(403)
    await mutate(outsider.client, 'patch', route, 404, { status: 'TODO' })
    await mutate(owner.client, 'patch', route, 400, { status: 'ACTIVE' })
    await mutate(owner.client, 'patch', route, 400, { status: 'TODO', updatedBy: outsider.id })
    for (const status of ['TODO', 'IN_PROGRESS', 'BACKLOG', 'IN_REVIEW']) {
      const updated = await mutate(developer.client, 'patch', route, 200, { status })
      expect(updated.body.data).toMatchObject({ id: task.id, status, updatedBy: developer.id, title: 'Assigned to Developer' })
    }
    await mutate(developer.client, 'patch', route, 403, { status: 'DONE' })
    const approved = await mutate(manager.client, 'patch', route, 200, { status: 'DONE' })
    expect(approved.body.data).toMatchObject({ status: 'DONE', updatedBy: manager.id })
    await mutate(developer.client, 'patch', route, 403, { status: 'TODO' })
    const reopened = await mutate(owner.client, 'patch', route, 200, { status: 'TODO' })
    expect(reopened.body.data).toMatchObject({ status: 'TODO', updatedBy: owner.id, createdBy: owner.id })
    await mutate(manager.client, 'patch', task.url, 200, { assigneeId: null })
    await mutate(developer.client, 'patch', route, 403, { status: 'IN_PROGRESS' })
    await developer.client.get(task.url).expect(200)
  }, 55_000)

  it('shows archived boards and rejects status changes until the project is restored', async () => {
    const team = await workspace('Archived board workspace')
    const boardProject = await project(team, 'Archived board')
    const task = await createTask(boardProject.url, { title: 'Preserved task', assigneeId: developer.id })
    const route = `${task.url}/status`
    await mutate(owner.client, 'patch', boardProject.url, 200, { status: 'ARCHIVED' })
    await mutate(owner.client, 'patch', route, 409, { status: 'DONE' })
    await mutate(developer.client, 'patch', route, 409, { status: 'IN_REVIEW' })
    const archived = await developer.client.get(`${boardProject.url}/tasks`).expect(200)
    expect(archived.body.data).toEqual([task.data])
    await mutate(manager.client, 'patch', boardProject.url, 200, { status: 'ACTIVE' })
    await mutate(developer.client, 'patch', route, 200, { status: 'IN_REVIEW' })
  }, 45_000)
})

describe('Task search and filters', () => {
  it('searches title words or an exact ID without leaking results across projects and workspaces', async () => {
    const current = await project(await workspace('Task search workspace'), 'Current tasks')
    const elsewhere = await project(await workspace('Private search workspace'), 'Other workspace tasks', false)
    const match = await createTask(current.url, { title: 'Release Checklist', description: 'Confirm the build.' })
    const descriptionOnly = await createTask(current.url, { title: 'Other work', description: 'Release checklist' })
    const otherMatch = await createTask(elsewhere.url, { title: 'Release Checklist' })
    const route = `${current.url}/tasks`

    const search = await developer.client.get(route).query({ search: '  RELEASE  ' }).expect(200)
    expect(search.body).toEqual({ data: [match.data], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })
    const exact = await owner.client.get(route).query({ search: descriptionOnly.id.toUpperCase() }).expect(200)
    expect(exact.body.data).toEqual([descriptionOnly.data])
    const includesBlankSearch = await owner.client.get(route).query({ search: '   ' }).expect(200)
    expect(includesBlankSearch.body.pagination.total).toBe(2)

    for (const query of [{ search: 'leas' }, { search: '---' }, { search: otherMatch.id }, { search: match.id, status: 'DONE' }]) {
      const excluded = await owner.client.get(route).query(query).expect(200)
      expect(excluded.body).toEqual({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    }
    await outsider.client.get(route).query({ search: match.id }).expect(404)
    await developer.client.get(`${elsewhere.url}/tasks`).query({ search: 'Release' }).expect(404)
  }, 45_000)

  it('combines filters, validates query strings, and paginates a larger dataset with stable totals', async () => {
    const team = await workspace('Larger task search workspace')
    const boardProject = await project(team, 'Tasks to filter')
    const otherProject = await project(team, 'Unrelated project')
    const baseTime = Date.now()
    function records(projectId: string, count: number) {
      return Array.from({ length: count }, (_, index) => ({
        _id: new Types.ObjectId(),
        projectId: new Types.ObjectId(projectId),
        title: `${index % 5 ? 'Release' : 'Maintenance'} task ${index}`,
        status: index % 4 ? 'TODO' : 'DONE',
        priority: index % 3 ? 'HIGH' : 'LOW',
        assigneeId: index % 2 ? null : developer.objectId,
        createdBy: owner.objectId,
        createdAt: new Date(baseTime + Math.floor(index / 4)),
        updatedAt: new Date(baseTime + Math.floor(index / 4)),
      }))
    }
    const target = records(boardProject.id, 340)
    await db().collection(collections.task.tasks).insertMany([...target, ...records(otherProject.id, 170)])
    const route = `${boardProject.url}/tasks`
    const filters = { status: 'TODO', priority: 'HIGH', assigneeId: 'unassigned', search: 'release', limit: 20 }
    const expected = target.filter(({ title, status, priority, assigneeId }) =>
      title.startsWith('Release') && status === 'TODO' && priority === 'HIGH' && assigneeId === null).reverse()
    const totalPages = Math.ceil(expected.length / filters.limit)
    expect(totalPages).toBeGreaterThan(1)
    expect(expected.length % filters.limit).toBeGreaterThan(0)

    const first = await developer.client.get(route).query(filters).expect(200)
    expect(first.body.pagination).toEqual({ page: 1, limit: 20, total: expected.length, totalPages })
    expect(first.body.data.map(({ id }: { id: string }) => id)).toEqual(expected.slice(0, 20).map(({ _id }) => _id.toString()))
    const last = await developer.client.get(route).query({ ...filters, page: totalPages }).expect(200)
    expect(last.body.data.map(({ id }: { id: string }) => id)).toEqual(expected.slice((totalPages - 1) * 20).map(({ _id }) => _id.toString()))
    expect(last.body.pagination).toMatchObject({ page: totalPages, total: expected.length, totalPages })
    const beyond = await developer.client.get(route).query({ ...filters, page: totalPages + 1 }).expect(200)
    expect(beyond.body).toEqual({ data: [], pagination: { page: totalPages + 1, limit: 20, total: expected.length, totalPages } })
    const assigned = await developer.client.get(route).query({ assigneeId: developer.id.toUpperCase(), limit: 100 }).expect(200)
    expect(assigned.body.pagination.total).toBe(170)
    expect(assigned.body.data).toHaveLength(100)
    expect(assigned.body.data.every(({ assigneeId }: { assigneeId: string }) => assigneeId === developer.id)).toBe(true)

    for (const query of [
      'status=ACTIVE', 'priority=OTHER', 'assigneeId=missing', 'search=a&search=b',
      'status=TODO&status=DONE', 'limit=101', 'page=-1', 'projectId=ignored', `search=${'x'.repeat(201)}`,
    ]) {
      await owner.client.get(`${route}?${query}`).expect(400)
    }
  }, 55_000)
})

describe('Project dashboard', () => {
  it('returns zero counts for an empty project and enforces project access', async () => {
    const team = await workspace('Dashboard access workspace')
    const empty = await project(team, 'Empty dashboard')
    const restricted = await project(team, 'Restricted dashboard', false)
    const route = `${empty.url}/dashboard`
    const expected = { data: {
      projectId: empty.id, totalTasks: 0, completedTasks: 0, inProgressTasks: 0, overdueTasks: 0, completionPercentage: 0,
    } }

    await owner.client.get(route).expect('Cache-Control', 'no-store').expect(200, expected)
    await manager.client.get(route).expect(200, expected)
    await developer.client.get(route).expect(200, expected)
    await request(app).get(route).expect(401)
    const denied = await outsider.client.get(route).expect(404)
    await developer.client.get(`${restricted.url}/dashboard`).expect(404, denied.body)
    await owner.client.get(`${api}/projects/${new Types.ObjectId()}/dashboard`).expect(404, denied.body)
    await owner.client.get(`${api}/projects/invalid/dashboard`).expect(400)
  }, 45_000)

  it('derives counts and rounded percentages using UTC dates and reflects task changes and archiving', async () => {
    const team = await workspace('Dashboard statistics workspace')
    const current = await project(team, 'Current dashboard')
    const other = await project(team, 'Other dashboard', false)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const yesterday = new Date(today.getTime() - 86_400_000)
    const tomorrow = new Date(today.getTime() + 86_400_000)
    const active = await createTask(current.url, {
      title: 'Overdue active task', status: 'IN_PROGRESS', dueDate: yesterday.toISOString().slice(0, 10),
    })
    const base = { projectId: new Types.ObjectId(current.id), priority: 'MEDIUM', createdBy: owner.objectId, createdAt: today, updatedAt: today }
    await db().collection(collections.task.tasks).insertMany([
      { ...base, title: 'Finished yesterday', status: 'DONE', dueDate: yesterday },
      { ...base, title: 'Due today', status: 'TODO', dueDate: today },
      { ...base, title: 'Due tomorrow', status: 'TODO', dueDate: tomorrow },
      { ...base, title: 'Unscheduled task', status: 'BACKLOG' },
      { ...base, title: 'Overdue review', status: 'IN_REVIEW', dueDate: yesterday },
      { ...base, projectId: new Types.ObjectId(other.id), title: 'Unrelated task', status: 'IN_PROGRESS', dueDate: yesterday },
    ])

    const route = `${current.url}/dashboard`
    const initial = { projectId: current.id, totalTasks: 6, completedTasks: 1, inProgressTasks: 1, overdueTasks: 2, completionPercentage: 16.67 }
    await developer.client.get(route).expect(200, { data: initial })

    await mutate(owner.client, 'patch', `${active.url}/status`, 200, { status: 'DONE' })
    const updated = { ...initial, completedTasks: 2, inProgressTasks: 0, overdueTasks: 1, completionPercentage: 33.33 }
    await owner.client.get(route).expect(200, { data: updated })
    await mutate(owner.client, 'patch', current.url, 200, { status: 'ARCHIVED' })
    await developer.client.get(route).expect(200, { data: updated })

    await mutate(owner.client, 'patch', current.url, 200, { status: 'ACTIVE' })
    await mutate(owner.client, 'delete', active.url, 204)
    await owner.client.get(route).expect(200, { data: { ...updated, totalTasks: 5, completedTasks: 1, completionPercentage: 20 } })
  }, 55_000)
})
