import { expect, test, type APIRequestContext } from '@playwright/test'
import { Types } from 'mongoose'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowRealtimeBrowserPassword!'

test('syncs assignment, board movements and comments, catches up after reconnect, and clears revoked access', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const fixture = await startStage1App('browser')
  const teammate = await browser.newContext()
  let joined = 0
  const signals: string[] = []

  async function write(client: APIRequestContext, path: string, status: number, method = 'POST', data?: object) {
    const csrf = await client.get(fixture.origin + api + '/auth/csrf')
    expect(csrf.status()).toBe(200)
    const { data: { csrfToken } } = await csrf.json()
    const response = await client.fetch(fixture.origin + api + path, {
      method, headers: { Origin: fixture.origin, 'X-CSRF-Token': csrfToken }, data,
    })
    expect(response.status()).toBe(status)
    return status === 204 ? undefined : (await response.json()).data
  }

  async function account(client: APIRequestContext, name: string) {
    const credentials = { email: name.toLowerCase() + '@example.test', password }
    const user = await write(client, '/auth/register', 201, 'POST', { name, ...credentials })
    await write(client, '/auth/login', 200, 'POST', credentials)
    return user.id as string
  }

  try {
    const viewer = await teammate.newPage()
    const [ownerId, developerId] = await Promise.all([account(page.request, 'Owner'), account(viewer.request, 'Developer')])
    const workspace = await write(page.request, '/workspaces', 201, 'POST', { name: 'Live browser workspace' })
    await fixture.database.collection(fixture.collections.workspace.members).insertOne({
      workspaceId: new Types.ObjectId(workspace.id), userId: new Types.ObjectId(developerId), role: 'DEVELOPER', joinedAt: new Date(),
    })
    const project = await write(page.request, `/workspaces/${workspace.id}/projects`, 201, 'POST', { name: 'Live browser project', managerId: ownerId })
    const projectPath = `/projects/${project.id}`
    await write(page.request, projectPath + '/members', 201, 'POST', { userId: developerId })
    const task = await write(page.request, projectPath + '/tasks', 201, 'POST', { title: 'Follow a live task' })
    const taskPath = '/tasks/' + task.id

    viewer.on('websocket', (socket) => {
      if (!new URL(socket.url()).pathname.startsWith('/socket.io/')) return
      socket.on('framereceived', ({ payload }) => {
        const frame = String(payload)
        if (frame.startsWith('43') && frame.includes(`"data":{"projectId":"${project.id}"`)) joined++
        if (frame.includes('"project:changed"')) signals.push(frame)
      })
    })

    const boardUrl = fixture.origin + projectPath + '/board'
    await viewer.goto(boardUrl)
    await expect.poll(() => joined).toBe(1)
    const board = viewer.getByRole('region', { name: 'Kanban board' })
    await expect(board.getByRole('link', { name: task.title })).toBeVisible()
    await write(page.request, taskPath, 200, 'PATCH', { assigneeId: developerId })
    await expect(board.getByText('Developer', { exact: true })).toBeVisible()

    await page.goto(boardUrl)
    await page.getByTitle('Drag ' + task.title, { exact: true }).dragTo(
      page.getByRole('region', { name: 'In Progress', exact: true }).getByRole('heading'),
    )
    await expect(board.getByRole('region', { name: 'In Progress', exact: true }).getByRole('link', { name: task.title })).toBeVisible()

    await board.getByRole('link', { name: task.title }).click()
    const drawer = viewer.getByRole('dialog', { name: 'Task details' })
    const comments = drawer.getByRole('region', { name: 'Comments' })
    await expect(comments.getByText('No comments yet.')).toBeVisible()
    await write(page.request, taskPath + '/comments', 201, 'POST', { body: 'Live message to a teammate' })
    await expect(comments.getByText('Live message to a teammate', { exact: true })).toBeVisible()

    const connection = [...fixture.realtimeServer!.sockets.sockets.values()]
      .find((socket) => socket.data.userId === developerId)
    expect(connection).toBeDefined()
    await teammate.setOffline(true)
    connection?.client.conn.close()
    await write(page.request, taskPath + '/status', 200, 'PATCH', { status: 'IN_REVIEW' })
    await write(page.request, taskPath + '/comments', 201, 'POST', { body: 'Saved while disconnected' })
    await expect(comments.getByText('Saved while disconnected', { exact: true })).toHaveCount(0)
    await teammate.setOffline(false)
    await expect.poll(() => joined, { timeout: 12_000 }).toBeGreaterThan(1)
    await expect(comments.getByText('Saved while disconnected', { exact: true })).toBeVisible()
    await expect(drawer.getByLabel('Change status for ' + task.title)).toHaveValue('IN_REVIEW')

    await write(page.request, projectPath + '/members/' + developerId, 204, 'DELETE')
    await expect(viewer.getByRole('alert')).toHaveText('You no longer have access to this project.')
    await expect(drawer).toHaveCount(0)
    await expect(board).toHaveCount(0)
    const afterRevocation = signals.length
    await write(page.request, taskPath + '/status', 200, 'PATCH', { status: 'DONE' })
    expect(signals).toHaveLength(afterRevocation)
    await expect(viewer.getByRole('alert')).toHaveText('You no longer have access to this project.')
  } finally {
    await teammate.close()
    await fixture.close()
  }
})
