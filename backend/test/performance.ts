import { Types, type PipelineStage } from 'mongoose'
import request from 'supertest'
import { io, type Socket } from 'socket.io-client'
import { dashboardTaskPipeline } from '../src/modules/dashboard/dashboard.repository.js'
import { taskPriorities } from '../src/modules/tasks/task.model.js'
import { taskListPipeline } from '../src/modules/tasks/task.repository.js'
import { startStage1App } from './fixtures/stage1-app.js'

const warmups = 2
const samples = 20
const app = await startStage1App('performance')

function winningIndexes(plan: unknown): string[] {
  const indexes = new Set<string>()
  function visit(stage: unknown) {
    if (!stage || typeof stage !== 'object') return
    if ('indexName' in stage && typeof stage.indexName === 'string') indexes.add(stage.indexName)
    for (const child of Object.values(stage)) visit(child)
  }
  visit(plan)
  return [...indexes]
}

function nextSignal(socket: Socket, event: string, matches: (payload: unknown) => boolean = () => true) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, receive)
      reject(new Error(`Timed out waiting for ${event}.`))
    }, 15_000)
    function receive(payload: unknown) {
      if (!matches(payload)) return
      clearTimeout(timer)
      socket.off(event, receive)
      resolve()
    }
    socket.on(event, receive)
  })
}

try {
  const client = request.agent(app.origin)
  const api = '/api/v1'
  const auth = `${api}/auth`
  async function csrf() {
    const response = await client.get(`${auth}/csrf`).expect(200)
    return response.body.data.csrfToken as string
  }
  async function post(path: string, body: object, status = 201) {
    const token = await csrf()
    return client.post(path).set('Origin', app.origin).set('X-CSRF-Token', token).send(body).expect(status)
  }

  const credentials = { email: 'benchmark@example.test', password: 'DevFlowPerformancePassword!' }
  const userResponse = await post(`${auth}/register`, { name: 'Benchmark Owner', ...credentials })
  const ownerId = new Types.ObjectId(userResponse.body.data.id)
  await post(`${auth}/login`, credentials, 200)
  const workspaceResponse = await post(`${api}/workspaces`, { name: 'Performance workspace' })
  const workspaceId = new Types.ObjectId(workspaceResponse.body.data.id)
  const projectsPath = `${api}/workspaces/${workspaceId}/projects`
  const projectResponse = await post(projectsPath, { name: 'Measured project', status: 'ACTIVE', managerId: ownerId.toString() })
  const projectId = new Types.ObjectId(projectResponse.body.data.id)
  const projectIds = [projectId, ...Array.from({ length: 23 }, () => new Types.ObjectId())]
  const baseDate = new Date('2026-01-01T00:00:00.000Z')
  await app.database.collection(app.collections.project.projects).insertMany(projectIds.slice(1).map((_id, index) => ({
    _id, workspaceId, managerId: ownerId, name: `Fixture project ${index + 1}`, status: 'ACTIVE', createdAt: baseDate, updatedAt: baseDate,
  })))

  const tasks = app.database.collection(app.collections.task.tasks)
  const sprintId = new Types.ObjectId()
  const sprints = app.database.collection(app.collections.sprint.sprints)
  await sprints.insertOne({ _id: sprintId, projectId, name: 'Measured sprint', status: 'ACTIVE', startDate: baseDate, endDate: baseDate,
    createdAt: baseDate, updatedAt: baseDate })
  const rows = projectIds.flatMap((id, projectIndex) =>
    Array.from({ length: projectIndex === 0 ? 800 : 400 }, (_, index) => ({
      _id: new Types.ObjectId(), projectId: id, createdBy: ownerId,
      title: index % 10 === 0 ? `Release checklist ${index}` : `Maintenance task ${index}`,
      status: index % 16 === 0 ? 'DONE' : 'TODO',
      priority: index % 11 === 0 ? 'URGENT' : 'MEDIUM',
      assigneeId: index % 7 === 0 ? ownerId : null,
      sprintId: projectIndex === 0 && index % 3 === 0 ? sprintId : null,
      dueDate: new Date(baseDate.getTime() + index % 90 * 86_400_000),
      createdAt: new Date(baseDate.getTime() + index), updatedAt: baseDate,
    })))
  await tasks.insertMany(rows)
  const edges = rows.flatMap((row, index) => index % 4 === 0 ? [{
    projectId: row.projectId, taskId: row._id, prerequisiteId: rows[index + 1]._id,
  }] : [])
  const dependencies = app.database.collection(app.collections.dependency.dependencies)
  await dependencies.insertMany(edges)
  const collections = { tasks: tasks.collectionName, dependencies: dependencies.collectionName }

  const projectPath = `${api}/projects/${projectId}`
  const taskPath = `${api}/tasks/${rows[333]._id}`
  const tasksPath = `${projectPath}/tasks`
  const token = await csrf()
  let nextStatus = 'IN_REVIEW'
  const operations = {
    'List workspace projects': () => client.get(projectsPath).expect(200),
    'Open project overview': () => client.get(projectPath).expect(200),
    'Open task details': () => client.get(taskPath).expect(200),
    'Load the first task page': () => client.get(tasksPath).expect(200),
    'Filter tasks by Done': () => client.get(`${tasksPath}?status=DONE`).expect(200),
    'Search title and filter priority': () => client.get(`${tasksPath}?search=release&priority=URGENT`).expect(200),
    'Filter sprint and blocked status': () => client.get(`${tasksPath}?sprintId=${sprintId}&blocked=true&status=TODO`).expect(200),
    'Load dashboard': () => client.get(`${projectPath}/dashboard`).expect(200),
    'Change task status': () => {
      const status = nextStatus
      nextStatus = status === 'IN_REVIEW' ? 'TODO' : 'IN_REVIEW'
      return client.patch(`${taskPath}/status`).set('Origin', app.origin).set('X-CSRF-Token', token).send({ status }).expect(200)
    },
  }
  const timings: { operation: string; medianMs: number; p95Ms: number; maxMs: number }[] = []
  async function measure(operation: string, run: () => PromiseLike<unknown>) {
    for (let index = 0; index < warmups; index++) await run()
    const elapsed = []
    for (let index = 0; index < samples; index++) {
      const start = performance.now()
      await run()
      elapsed.push(performance.now() - start)
    }
    elapsed.sort((left, right) => left - right)
    const midpoint = samples / 2
    timings.push({
      operation,
      medianMs: Math.round((elapsed[midpoint - 1] + elapsed[midpoint]) / 2),
      p95Ms: Math.round(elapsed[Math.ceil(samples * 0.95) - 1]),
      maxMs: Math.round(elapsed[samples - 1]),
    })
  }
  for (const [operation, run] of Object.entries(operations)) await measure(operation, run)

  const observer = request.agent(app.origin)
  const viewerCredentials = { email: 'observer@example.test', password: credentials.password }
  async function observerPost(path: string, data: object, status: number) {
    const { body } = await observer.get(`${auth}/csrf`).expect(200)
    return observer.post(path).set('Origin', app.origin).set('X-CSRF-Token', body.data.csrfToken).send(data).expect(status)
  }
  const { body: { data: { id: observerId } } } = await observerPost(`${auth}/register`, { name: 'Benchmark Developer', ...viewerCredentials }, 201)
  const login = await observerPost(`${auth}/login`, viewerCredentials, 200)
  const sessionCookies = login.headers['set-cookie'] as unknown as string[]
  const session = sessionCookies.find((cookie) => cookie.startsWith('devflow_session='))?.split(';', 1)[0]
  if (!session) throw new Error('Expected a benchmark observer session.')
  await app.database.collection(app.collections.workspace.members).insertOne({
    workspaceId, userId: new Types.ObjectId(observerId), role: 'DEVELOPER', joinedAt: baseDate,
  })
  await post(`${projectPath}/members`, { userId: observerId })
  const socket = io(app.origin, {
    transports: ['websocket'], reconnection: false,
    extraHeaders: { Origin: app.origin, Cookie: session },
  })
  try {
    const subscription = await socket.timeout(10_000).emitWithAck('project:subscribe', { projectId: projectId.toString() })
    if (subscription.data?.projectId !== projectId.toString()) throw new Error('Could not subscribe the benchmark observer.')
    await measure('Move task, receive project signal, refresh task list', async () => {
      const status = nextStatus
      await Promise.all([
        nextSignal(socket, 'project:changed', (event) => !!event && typeof event === 'object'
          && 'taskId' in event && event.taskId === rows[333]._id.toString() && 'kind' in event && event.kind === 'task.changed'),
        operations['Change task status'](),
      ])
      const { body } = await observer.get(`${tasksPath}?search=${rows[333]._id}&status=${status}`).expect(200)
      if (body.data[0]?.status !== status) throw new Error('The observer did not read the committed move.')
    })
    await measure('Post mention, receive private signal, refresh inbox', async () => {
      await Promise.all([
        nextSignal(socket, 'notifications:changed'),
        client.post(`${taskPath}/comments`).set('Origin', app.origin).set('X-CSRF-Token', token)
          .send({ body: 'Benchmark collaboration mention', mentionUserIds: [observerId] }).expect(201),
      ])
      const { body } = await observer.get(`${api}/notifications?limit=1`).expect(200)
      const notification = body.data[0]
      if (notification?.kind !== 'MENTION' || notification.task?.id !== rows[333]._id.toString()) {
        throw new Error('The observer did not read the committed mention.')
      }
    })
  } finally {
    socket.disconnect()
  }

  const plans: Awaited<ReturnType<typeof taskPlan>>[] = []
  async function taskPlan(operation: string, pipeline: PipelineStage[], hint?: string) {
    const explanation = await tasks.aggregate(pipeline, { hint }).explain('executionStats')
    const cursor = explanation.stages?.find((stage: { $cursor?: unknown }) => stage.$cursor)?.$cursor ?? explanation
    const lookup = explanation.stages?.find((stage: { $lookup?: unknown }) => stage.$lookup)
    return {
      operation,
      indexes: winningIndexes(cursor.queryPlanner.winningPlan),
      keysExamined: cursor.executionStats.totalKeysExamined,
      documentsExamined: cursor.executionStats.totalDocsExamined,
      ...(lookup && { lookup: {
        indexes: lookup.indexesUsed, keysExamined: lookup.totalKeysExamined,
        documentsExamined: lookup.totalDocsExamined, collectionScans: lookup.collectionScans,
      } }),
    }
  }
  for (const [operation, filters] of [
    ['Default task page', {}],
    ['Done filter', { status: 'DONE' }],
    ['Assignee filter', { assigneeId: ownerId.toString() }],
    ['Title + priority', { search: 'release', priority: 'URGENT' }],
    ['Exact task ID', { search: rows[333]._id.toString() }],
    ['Sprint + status, before adding blocked filter', { sprintId: sprintId.toString(), status: 'TODO' }],
    ['Sprint + status + blocked', { sprintId: sprintId.toString(), status: 'TODO', blocked: true }],
    ['Blocked only', { blocked: true }],
  ] as const) {
    const pipeline = taskListPipeline(projectId.toString(), { page: 1, limit: 20, ...filters }, collections)
    plans.push(await taskPlan(operation, pipeline))
  }
  const combined = taskListPipeline(projectId.toString(), { page: 1, limit: 20, sprintId: sprintId.toString(), status: 'TODO', blocked: true }, collections)
  plans.push(await taskPlan('Sprint + status + blocked with general project sort index', combined, 'projectId_1_createdAt_-1__id_-1'))
  const dashboard = dashboardTaskPipeline(projectId.toString(), baseDate)
  const [match, group] = dashboard
  const legacyGroup = { ...group.$group }
  for (const priority of taskPriorities) Reflect.deleteProperty(legacyGroup, priority)
  plans.push(await taskPlan('Dashboard totals before priority breakdown', [match, { $group: legacyGroup }, { $project: { _id: 0 } }]))
  plans.push(await taskPlan('Dashboard totals with priority breakdown', dashboard))

  console.log(JSON.stringify({
    node: process.version, platform: process.platform, architecture: process.arch, samples, warmups,
    projects: projectIds.length, tasks: rows.length, tasksInMeasuredProject: 800, dependencies: edges.length, timings, plans,
  }, null, 2))
} finally {
  await app.close()
}
