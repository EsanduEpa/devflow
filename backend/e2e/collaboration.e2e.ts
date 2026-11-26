import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { Types } from 'mongoose'
import { io } from 'socket.io-client'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowCollaborationFixturePassword!'
const legacyTitle = 'Prepare release'
const followupTitle = 'Publish release'

function bell(page: Page, count: number) {
  return page.getByRole('button', { name: `Notifications, ${count} unread`, exact: true })
}

async function postMention(page: Page, recipient: string, body: string) {
  const comments = page.getByRole('region', { name: 'Comments' })
  await comments.getByLabel('Write a comment').fill(body)
  await comments.getByRole('combobox', { name: 'Mention someone', exact: true }).selectOption(recipient)
  await comments.getByRole('button', { name: 'Post comment' }).click()
  await expect(comments.getByText(body, { exact: true })).toBeVisible()
}

test('completes the Stage 2 collaboration journey with independent sessions and legacy work', async ({ browser, page: manager }) => {
  test.setTimeout(180_000)
  const fixture = await startStage1App('browser')
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()])
  const [assignee, peer, outsider] = await Promise.all(contexts.map((context) => context.newPage()))

  async function write(client: APIRequestContext, path: string, status: number, data?: object, method = 'POST') {
    const { data: { csrfToken } } = await (await client.get(fixture.origin + api + '/auth/csrf')).json()
    const response = await client.fetch(fixture.origin + api + path, {
      method, headers: { Origin: fixture.origin, 'X-CSRF-Token': csrfToken }, data,
    })
    expect(response.status()).toBe(status)
    return status === 204 ? undefined : (await response.json())
  }

  async function account(client: APIRequestContext, name: string) {
    const credentials = { email: name.toLowerCase() + '@example.test', password }
    const { data } = await write(client, '/auth/register', 201, { name, ...credentials })
    await write(client, '/auth/login', 200, credentials)
    return data.id as string
  }

  try {
    const [managerId, assigneeId, peerId, outsiderId] = await Promise.all([
      account(manager.request, 'Manager'), account(assignee.request, 'Alice'), account(peer.request, 'Blake'), account(outsider.request, 'Outsider'),
    ])
    const { data: workspace } = await write(manager.request, '/workspaces', 201, { name: 'Collaboration workspace' })
    await fixture.database.collection(fixture.collections.workspace.members).insertMany(
      [assigneeId, peerId, outsiderId].map((id) => ({
        workspaceId: new Types.ObjectId(workspace.id), userId: new Types.ObjectId(id), role: 'DEVELOPER', joinedAt: new Date(),
      })),
    )
    const { data: project } = await write(manager.request, `/workspaces/${workspace.id}/projects`, 201, {
      name: 'Collaboration release', managerId,
    })
    const projectPath = '/projects/' + project.id
    const projectUrl = fixture.origin + projectPath
    for (const userId of [assigneeId, peerId]) {
      await write(manager.request, projectPath + '/members', 201, { userId })
    }
    const legacyId = new Types.ObjectId()
    const createdAt = new Date('2026-01-01T00:00:00Z')
    // This fixture predates sprint membership, versions, and persisted activity.
    await fixture.database.collection(fixture.collections.task.tasks).insertOne({
      _id: legacyId, title: legacyTitle, projectId: new Types.ObjectId(project.id), createdBy: new Types.ObjectId(managerId),
      status: 'TODO', priority: 'HIGH', createdAt, updatedAt: createdAt,
    })
    const legacyPath = '/tasks/' + legacyId
    const legacy = await manager.request.get(fixture.origin + api + legacyPath)
    expect((await legacy.json()).data).toMatchObject({ version: 0, sprintId: null })
    const { data: followup } = await write(manager.request, projectPath + '/tasks', 201, { title: followupTitle, priority: 'MEDIUM' })
    const followupPath = '/tasks/' + followup.id
    const { data: sprint } = await write(manager.request, projectPath + '/sprints', 201, {
      name: 'Current release', startDate: '2028-02-01', endDate: '2028-02-29',
    })
    const { data: nextSprint } = await write(manager.request, projectPath + '/sprints', 201, {
      name: 'Next release', startDate: '2028-03-01', endDate: '2028-03-14',
    })
    for (const id of [legacyId, followup.id]) {
      await write(manager.request, `/sprints/${sprint.id}/tasks/${id}`, 200)
    }
    await write(manager.request, `/sprints/${sprint.id}/start`, 200)

    function projectSocket(userId: string) {
      return [...fixture.realtimeServer!.sockets.sockets.values()]
        .find((socket) => socket.data.userId === userId && socket.data.projects.has(project.id))
    }
    const boardUrl = projectUrl + '/board'
    await Promise.all([assignee.goto(fixture.origin + '/workspaces'), peer.goto(boardUrl), outsider.goto(boardUrl)])
    await expect(outsider.getByRole('alert')).toContainText('access')
    const cookies = await outsider.context().cookies(fixture.origin)
    const session = cookies.find(({ name }) => name === 'devflow_session')!
    const unauthorizedSocket = io(fixture.origin, {
      transports: ['websocket'], reconnection: false,
      extraHeaders: { Origin: fixture.origin, Cookie: `${session.name}=${session.value}` },
    })
    try {
      await expect(unauthorizedSocket.timeout(10_000).emitWithAck('project:subscribe', { projectId: project.id }))
        .resolves.toMatchObject({ error: { code: 'NOT_FOUND' } })
      expect(projectSocket(outsiderId)).toBeUndefined()
    } finally {
      unauthorizedSocket.disconnect()
    }
    await expect.poll(() => projectSocket(peerId)?.id).toBeTruthy()
    await peer.getByRole('link', { name: legacyTitle, exact: true }).click()

    await write(manager.request, legacyPath, 200, { assigneeId }, 'PATCH')
    await bell(assignee, 1).click()
    const assignment = assignee.getByRole('listitem').filter({ has: assignee.getByRole('heading', { name: 'Task assigned to you' }) })
    await assignment.getByRole('link', { name: legacyTitle }).click()
    await postMention(assignee, peerId, 'Please check the release checklist.')
    await expect(peer.getByRole('region', { name: 'Comments' })).toContainText('Please check the release checklist.')
    await peer.getByRole('button', { name: 'Close task panel' }).click()
    await bell(peer, 1).click()
    const mention = peer.getByRole('listitem').filter({ has: peer.getByRole('heading', { name: 'You were mentioned' }) })
    await mention.getByRole('link', { name: legacyTitle }).click()
    await peer.getByRole('link', { name: 'Task board', exact: true }).click()
    await peer.getByRole('link', { name: legacyTitle, exact: true }).click()
    const peerTask = peer.getByRole('dialog', { name: 'Task details' })

    await write(manager.request, followupPath + '/dependencies/' + legacyId, 201)
    const cycle = await write(manager.request, legacyPath + '/dependencies/' + followup.id, 409)
    expect(cycle.error.code).toBe('DEPENDENCY_CYCLE')
    await manager.goto(fixture.origin + followupPath)
    await expect(manager.getByRole('region', { name: 'Dependencies' }).getByText('Blocked', { exact: true })).toBeVisible()

    await manager.goto(fixture.origin + legacyPath)
    await manager.getByRole('button', { name: 'Edit task' }).click()
    const description = manager.getByRole('region', { name: 'Edit task' }).locator('textarea[name="description"]')
    await description.fill('Keep this release handoff draft.')
    await assignee.goto(boardUrl)
    await assignee.getByLabel('Change status for ' + legacyTitle).selectOption('IN_PROGRESS')
    await expect(peerTask.getByText('In Progress', { exact: true })).toBeVisible()
    await manager.getByRole('button', { name: 'Save changes' }).click()
    await expect(manager.getByRole('region', { name: 'Task changed' })).toContainText('In Progress')
    await expect(description).toHaveValue('Keep this release handoff draft.')
    await manager.getByRole('button', { name: 'Retry my changes' }).click()
    await expect(manager.getByRole('region', { name: 'Description' })).toContainText('Keep this release handoff draft.')

    await assignee.reload()
    const statusControl = assignee.getByLabel('Change status for ' + legacyTitle)
    await expect(statusControl).toHaveValue('IN_PROGRESS')
    const connection = projectSocket(peerId)!
    await peer.context().setOffline(true)
    connection.client.conn.close()
    await expect.poll(() => projectSocket(peerId)?.id).toBeUndefined()
    await statusControl.selectOption('IN_REVIEW')
    await expect(assignee.getByRole('region', { name: 'In Review', exact: true }).getByRole('link', { name: legacyTitle })).toBeVisible()
    await assignee.getByRole('link', { name: legacyTitle, exact: true }).click()
    await postMention(assignee, peerId, 'The release is ready for review.')
    await expect(peerTask.getByText('In Progress', { exact: true })).toBeVisible()
    await peer.context().setOffline(false)
    await expect.poll(() => projectSocket(peerId)?.id).toBeTruthy()
    await expect(peerTask.getByText('In Review', { exact: true })).toBeVisible()
    await expect(peer.getByRole('region', { name: 'Activity' })).toContainText('changed from In Progress to In Review')
    await expect(peer.getByRole('region', { name: 'Comments' })).toContainText('The release is ready for review.')
    await peerTask.getByRole('button', { name: 'Close task panel' }).click()
    await expect(peer.getByRole('region', { name: 'In Review', exact: true }).getByRole('link', { name: legacyTitle })).toBeVisible()
    await expect(bell(peer, 2)).toBeVisible()
    await bell(manager, 1).click()
    await expect(manager.getByRole('heading', { name: 'Task ready for review' })).toBeVisible()
    await manager.keyboard.press('Escape')
    await manager.getByLabel('Change status for ' + legacyTitle).selectOption('DONE')
    await expect(manager.getByRole('region', { name: 'Activity' })).toContainText('completed the task')
    await write(manager.request, `/sprints/${sprint.id}/complete`, 200, { rolloverSprintId: nextSprint.id })

    await manager.goto(projectUrl)
    await expect(manager.getByText('1 of 2 tasks done at completion', { exact: true })).toBeVisible()
    await expect(manager.getByText('0 of 1 tasks done', { exact: true })).toBeVisible()
    await expect(manager.getByRole('link', { name: 'High priority, 1 task' })).toBeVisible()
    await manager.getByRole('link', { name: 'View tasks in Next release' }).click()
    await expect(manager.getByRole('list', { name: 'Matching tasks' }).getByRole('link')).toHaveText([followupTitle])
    const filtered = await manager.request.get(fixture.origin + api + projectPath + `/tasks?sprintId=${nextSprint.id}&blocked=true`)
    expect((await filtered.json()).pagination.total).toBe(0)

    await peer.getByRole('link', { name: legacyTitle, exact: true }).click()
    await expect(peer.getByRole('dialog', { name: 'Task details' })).toBeVisible()
    await expect.poll(() => projectSocket(peerId)?.id).toBeTruthy()
    await write(manager.request, projectPath + '/members/' + peerId, 204, undefined, 'DELETE')
    await expect(peer.getByText('You no longer have access to this project.', { exact: true })).toBeVisible()
    await expect(peer.getByRole('dialog', { name: 'Task details' })).toHaveCount(0)
    expect(projectSocket(peerId)).toBeUndefined()
    await bell(peer, 2).click()
    await expect(peer.getByRole('heading', { name: 'Item unavailable' })).toHaveCount(2)
    await expect(peer.getByRole('link', { name: legacyTitle, exact: true })).toHaveCount(0)
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
    await fixture.close()
  }
})
