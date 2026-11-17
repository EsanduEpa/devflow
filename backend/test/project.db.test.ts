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
  auth: { users: `m7_users_${suffix}`, sessions: `m7_sessions_${suffix}`, resetTokens: `m7_resets_${suffix}` },
  workspace: { workspaces: `m7_workspaces_${suffix}`, members: `m7_workspace_members_${suffix}`, invitations: `m7_invites_${suffix}` },
  project: { projects: `m7_projects_${suffix}`, members: `m7_project_members_${suffix}` },
}
const origin = 'http://127.0.0.1:5173'
const authUrl = '/api/v1/auth'
const workspacesUrl = '/api/v1/workspaces'
const projectsUrl = '/api/v1/projects'
const password = 'DevFlowProjectPassword!'
let app: ReturnType<typeof createApp>
let owner: Awaited<ReturnType<typeof account>>
let manager: Awaited<ReturnType<typeof account>>
let secondManager: Awaited<ReturnType<typeof account>>
let developer: Awaited<ReturnType<typeof account>>
let outsider: Awaited<ReturnType<typeof account>>

function agent() {
  return request.agent(app)
}

async function post(client: ReturnType<typeof agent>, url: string, body: object, code: number) {
  const csrf = await client.get(`${authUrl}/csrf`).expect(200)
  return client.post(url).set('Origin', origin).set('X-CSRF-Token', csrf.body.data.csrfToken).send(body).expect(code)
}

async function account(name: string) {
  const client = agent()
  const email = `${name}@example.test`
  const created = await post(client, `${authUrl}/register`, { name, email, password }, 201)
  await post(client, `${authUrl}/login`, { email, password }, 200)
  return { client, id: created.body.data.id as string, objectId: new Types.ObjectId(created.body.data.id) }
}

function db() {
  return mongoose.connection.db!
}

async function createWorkspace(name: string, workspaceOwner = owner, withTeam = true) {
  const result = await post(workspaceOwner.client, workspacesUrl, { name }, 201)
  const id = new Types.ObjectId(result.body.data.id)
  if (withTeam) {
    await db().collection(collections.workspace.members).insertMany([
      { workspaceId: id, userId: manager.objectId, role: 'MANAGER', joinedAt: new Date() },
      { workspaceId: id, userId: secondManager.objectId, role: 'MANAGER', joinedAt: new Date() },
      { workspaceId: id, userId: developer.objectId, role: 'DEVELOPER', joinedAt: new Date() },
    ])
  }
  return { id, projectList: `${workspacesUrl}/${id}/projects` }
}

function projectMemberships() {
  return db().collection(collections.project.members)
}

async function createProject(url: string, name: string, managerId = owner.id, status = 'PLANNED') {
  const response = await post(owner.client, url, { name, managerId, status }, 201)
  return response.body.data
}

beforeAll(async () => {
  const uri = process.env.MONGODB_TEST_URI?.trim() || process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Set MONGODB_TEST_URI or MONGODB_URI in backend/.env to run database tests.')
  const connection = await connectDatabase(uri, 'devflow_test')
  const config = authConfig({ APP_ORIGINS: origin, CSRF_SECRET: randomBytes(32).toString('hex') })
  const email = { origin, async sendResetEmail() { throw new Error('Project tests do not send email.') } }
  app = createApp(await createApi(connection, config, email, collections))
  const accounts = await Promise.all(['owner', 'manager', 'second-manager', 'developer', 'outsider'].map(account))
  owner = accounts[0]
  manager = accounts[1]
  secondManager = accounts[2]
  developer = accounts[3]
  outsider = accounts[4]
}, 30_000)

afterAll(async () => {
  try {
    const connection = mongoose.connection
    if (connection.db && connection.readyState === 1) {
      for (const name of Object.values(collections).flatMap((group) => Object.values(group))) {
        if (await connection.db.listCollections({ name }, { nameOnly: true }).hasNext()) await connection.db.dropCollection(name)
      }
    }
  } finally {
    await mongoose.disconnect()
  }
}, 30_000)

describe('Project creation and access', () => {
  it('validates dates and project fields, stores UTC dates, and creates the manager membership', async () => {
    const team = await createWorkspace('Date validation')
    const body = { name: ' Build project ', description: ' A planned release ', managerId: manager.id.toUpperCase() }
    for (const fields of [
      { name: ' x ' },
      { name: 'x'.repeat(151) },
      { description: 'x'.repeat(2001) },
      { managerId: 'invalid' },
      { startDate: '2025-02-29' },
      { startDate: '2028-04-31' },
      { startDate: '2028-02-29T00:00:00Z' },
      { startDate: '2028-02-29', targetDate: '2028-02-28' },
      { status: 'PENDING' },
      { workspaceId: new Types.ObjectId() },
    ]) {
      await post(owner.client, team.projectList, { ...body, ...fields }, 400)
    }
    await post(owner.client, team.projectList, { name: 'No manager provided' }, 400)
    const created = await post(owner.client, team.projectList, {
      ...body, startDate: '2028-02-29', targetDate: '2028-03-01',
    }, 201)
    const project = created.body.data
    expect(project).toMatchObject({
      name: 'Build project', description: 'A planned release', workspaceId: team.id.toString(), managerId: manager.id,
      startDate: '2028-02-29', targetDate: '2028-03-01', status: 'PLANNED',
    })
    const stored = await db().collection(collections.project.projects).findOne({ _id: new Types.ObjectId(project.id) })
    expect(stored?.startDate).toEqual(new Date('2028-02-29T00:00:00.000Z'))
    expect(await projectMemberships().find({ projectId: new Types.ObjectId(project.id) }).toArray()).toEqual([
      expect.objectContaining({ userId: manager.objectId, joinedAt: expect.any(Date) }),
    ])
    await expect(projectMemberships().insertOne({
      projectId: new Types.ObjectId(project.id), userId: manager.objectId, joinedAt: new Date(),
    })).rejects.toMatchObject({ code: 11000 })
    await owner.client.get(`${projectsUrl}/${project.id}`).expect('Cache-Control', 'no-store').expect(200, created.body)
  }, 25_000)

  it('allows Owners to choose eligible managers and limits Managers to assigning themselves', async () => {
    const team = await createWorkspace('Create permissions')
    await request(app).get(team.projectList).expect(401)
    await request(app).get(`${projectsUrl}/${new Types.ObjectId()}`).expect(401)
    await owner.client.post(team.projectList).send({ name: 'No CSRF', managerId: owner.id }).expect(403)
    await post(outsider.client, team.projectList, { name: 'No workspace access', managerId: outsider.id }, 404)
    await post(developer.client, team.projectList, { name: 'No create permission', managerId: owner.id }, 403)
    await post(manager.client, team.projectList, { name: 'Assign someone else', managerId: secondManager.id }, 403)
    for (const managerId of [outsider.id, developer.id, new Types.ObjectId().toString()]) {
      const error = await post(owner.client, team.projectList, { name: 'Invalid manager', managerId }, 400)
      expect(error.body.error.details).toContainEqual(expect.objectContaining({ field: 'body.managerId' }))
    }
    const selfAssigned = await post(manager.client, team.projectList, {
      name: 'My project', managerId: manager.id.toUpperCase(), startDate: null,
    }, 201)
    expect(selfAssigned.body.data).toMatchObject({ managerId: manager.id, startDate: null, targetDate: null, status: 'PLANNED' })
    await post(owner.client, `${workspacesUrl}/${new Types.ObjectId()}/projects`, { name: 'Missing workspace', managerId: owner.id }, 404)
    await owner.client.get(`${workspacesUrl}/invalid/projects`).expect(400)
  }, 25_000)

  it('applies project and workspace access before filtering or counting any page', async () => {
    const team = await createWorkspace('Visibility')
    const separate = await createWorkspace('Separate workspace', owner, false)
    const assigned = await createProject(team.projectList, 'Assigned project', manager.id, 'ACTIVE')
    const shared = await createProject(team.projectList, 'Shared project', owner.id, 'ACTIVE')
    const privateProject = await createProject(team.projectList, 'Owner project')
    const archived = await createProject(team.projectList, 'Archived project', manager.id, 'ARCHIVED')
    const separateProject = await createProject(separate.projectList, 'Other workspace project')
    const sharedId = new Types.ObjectId(shared.id)
    await projectMemberships().insertMany([
      { projectId: sharedId, userId: manager.objectId, joinedAt: new Date() },
      { projectId: sharedId, userId: developer.objectId, joinedAt: new Date() },
      { projectId: new Types.ObjectId(separateProject.id), userId: secondManager.objectId, joinedAt: new Date() },
    ])
    // The assigned Manager can still reach the project if their project membership is missing.
    await projectMemberships().deleteOne({ projectId: new Types.ObjectId(assigned.id), userId: manager.objectId })

    const all = await owner.client.get(team.projectList).expect(200)
    expect(all.body).toEqual({ data: [privateProject, shared, assigned], pagination: { page: 1, limit: 20, total: 3, totalPages: 1 } })
    const secondPage = await manager.client.get(`${team.projectList}?status=ACTIVE&page=2&limit=1`).expect(200)
    expect(secondPage.body).toEqual({ data: [assigned], pagination: { page: 2, limit: 1, total: 2, totalPages: 2 } })
    const firstPage = await manager.client.get(`${team.projectList}?status=ACTIVE&limit=1`).expect(200)
    expect(firstPage.body.data).toEqual([shared])
    const archive = await manager.client.get(`${team.projectList}?status=ARCHIVED`).expect(200)
    expect(archive.body.data).toEqual([archived])
    const limited = await developer.client.get(team.projectList).expect(200)
    expect(limited.body).toEqual({ data: [shared], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } })
    const noAssignments = await secondManager.client.get(team.projectList).expect(200)
    expect(noAssignments.body).toEqual({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })
    await secondManager.client.get(separate.projectList).expect(404)
    await outsider.client.get(team.projectList).expect(404)

    await manager.client.get(`${projectsUrl}/${assigned.id}`).expect(200, { data: assigned })
    await manager.client.get(`${projectsUrl}/${shared.id}`).expect(200, { data: shared })
    await manager.client.get(`${projectsUrl}/${archived.id}`).expect(200, { data: archived })
    await developer.client.get(`${projectsUrl}/${shared.id}`).expect(200, { data: shared })
    await developer.client.get(`${projectsUrl}/${assigned.id}`).expect(404)
    const hidden = await manager.client.get(`${projectsUrl}/${privateProject.id}`).expect(404)
    await secondManager.client.get(`${projectsUrl}/${separateProject.id}`).expect(404, hidden.body)
    await outsider.client.get(`${projectsUrl}/${shared.id}`).expect(404, hidden.body)
    await owner.client.get(`${projectsUrl}/${new Types.ObjectId()}`).expect(404, hidden.body)
    await owner.client.get(`${projectsUrl}/invalid`).expect(400)
  }, 25_000)

  it('rejects unsupported project filters and invalid pagination', async () => {
    const team = await createWorkspace('Pagination', owner, false)
    for (const query of [
      'page=0', 'page=1.5', 'page=1&page=2', 'page=9007199254740991&limit=100', 'limit=101',
      'limit=-1', 'status=UNKNOWN', 'workspaceId=ignored',
    ]) {
      await owner.client.get(`${team.projectList}?${query}`).expect(400)
    }
    const empty = await owner.client.get(`${team.projectList}?page=2&limit=100`).expect(200)
    expect(empty.body).toEqual({ data: [], pagination: { page: 2, limit: 100, total: 0, totalPages: 0 } })
  }, 20_000)

  it('rolls back creation if saving the project manager membership fails', async () => {
    const team = await createWorkspace('Rollback', outsider, false)
    const existing = await post(outsider.client, team.projectList, { name: 'Existing project', managerId: outsider.id }, 201)
    await projectMemberships().createIndex({ userId: 1 }, {
      name: 'test_force_project_membership_failure',
      unique: true,
      partialFilterExpression: { userId: outsider.objectId },
    })
    await post(outsider.client, team.projectList, { name: 'Rolled back project', managerId: outsider.id }, 500)
    expect(await db().collection(collections.project.projects).countDocuments({ workspaceId: team.id })).toBe(1)
    expect(await projectMemberships().countDocuments({ userId: outsider.objectId })).toBe(1)
    const list = await outsider.client.get(team.projectList).expect(200)
    expect(list.body.data).toEqual([existing.body.data])
  }, 20_000)
})
