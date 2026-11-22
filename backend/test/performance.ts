import { Types } from 'mongoose'
import request from 'supertest'
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
  const rows = projectIds.flatMap((id, projectIndex) =>
    Array.from({ length: projectIndex === 0 ? 800 : 400 }, (_, index) => ({
      _id: new Types.ObjectId(), projectId: id, createdBy: ownerId,
      title: index % 10 === 0 ? `Release checklist ${index}` : `Maintenance task ${index}`,
      status: index % 16 === 0 ? 'DONE' : 'TODO',
      priority: index % 11 === 0 ? 'URGENT' : 'MEDIUM',
      assigneeId: index % 7 === 0 ? ownerId : null,
      dueDate: new Date(baseDate.getTime() + index % 90 * 86_400_000),
      createdAt: new Date(baseDate.getTime() + index), updatedAt: baseDate,
    })))
  await tasks.insertMany(rows)

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
    'Load dashboard': () => client.get(`${projectPath}/dashboard`).expect(200),
    'Change task status': () => {
      const status = nextStatus
      nextStatus = status === 'IN_REVIEW' ? 'TODO' : 'IN_REVIEW'
      return client.patch(`${taskPath}/status`).set('Origin', app.origin).set('X-CSRF-Token', token).send({ status }).expect(200)
    },
  }
  const timings = []
  for (const [operation, run] of Object.entries(operations)) {
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

  const plans = []
  for (const [operation, filters] of [
    ['Default task page', {}],
    ['Done filter', { status: 'DONE' }],
    ['Assignee filter', { assigneeId: ownerId.toString() }],
    ['Title + priority', { search: 'release', priority: 'URGENT' }],
    ['Exact task ID', { search: rows[333]._id.toString() }],
  ] as const) {
    const pipeline = taskListPipeline(projectId.toString(), { page: 1, limit: 20, ...filters })
    const explanation = await tasks.aggregate(pipeline).explain('executionStats')
    const cursor = explanation.stages?.find((stage: { $cursor?: unknown }) => stage.$cursor)?.$cursor ?? explanation
    plans.push({
      operation,
      indexes: winningIndexes(cursor.queryPlanner.winningPlan),
      keysExamined: cursor.executionStats.totalKeysExamined,
      documentsExamined: cursor.executionStats.totalDocsExamined,
    })
  }

  console.log(JSON.stringify({
    node: process.version, platform: process.platform, architecture: process.arch, samples, warmups,
    projects: projectIds.length, tasks: rows.length, tasksInMeasuredProject: 800, timings, plans,
  }, null, 2))
} finally {
  await app.close()
}
