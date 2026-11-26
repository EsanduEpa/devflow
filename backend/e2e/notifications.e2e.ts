import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { Types } from 'mongoose'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowNotificationBrowserPassword!'

function bell(page: Page, count: number) {
  return page.getByRole('button', { name: count ? `Notifications, ${count} unread` : 'Notifications', exact: true })
}

function inbox(page: Page) {
  return page.getByRole('dialog', { name: 'Notifications', exact: true })
}

test('opens the inbox over the current page, refreshes across sessions and hides revoked links', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const fixture = await startStage1App('browser')
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mirror = await browser.newContext()

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
    const dev = await phone.newPage()
    const other = await mirror.newPage()
    const [ownerId, developerId] = await Promise.all([account(page.request, 'Owner'), account(dev.request, 'Developer')])
    await write(other.request, '/auth/login', 200, 'POST', { email: 'developer@example.test', password })
    const workspace = await write(page.request, '/workspaces', 201, 'POST', { name: 'Inbox browser workspace' })
    await fixture.database.collection(fixture.collections.workspace.members).insertOne({
      workspaceId: new Types.ObjectId(workspace.id), userId: new Types.ObjectId(developerId), role: 'DEVELOPER', joinedAt: new Date(),
    })
    const project = await write(page.request, `/workspaces/${workspace.id}/projects`, 201, 'POST', { name: 'Inbox browser project', managerId: ownerId })
    const projectPath = `/projects/${project.id}`
    await write(page.request, projectPath + '/members', 201, 'POST', { userId: developerId })
    const task = await write(page.request, projectPath + '/tasks', 201, 'POST', { title: 'Inbox browser task' })
    const taskPath = '/tasks/' + task.id

    const connections = () => [...fixture.realtimeServer!.sockets.sockets.values()]
      .filter((socket) => socket.data.userId === developerId)
    await dev.goto(fixture.origin + '/workspaces')
    await expect(bell(dev, 0)).toBeVisible()
    await expect.poll(() => connections().length).toBe(1)
    await write(page.request, taskPath, 200, 'PATCH', { assigneeId: developerId })
    await expect(bell(dev, 1)).toBeVisible()

    await bell(dev, 1).focus()
    await dev.keyboard.press('Enter')
    await expect(inbox(dev).getByRole('heading', { name: 'Notifications', exact: true })).toBeFocused()
    await expect(bell(dev, 1)).toHaveAttribute('aria-expanded', 'true')
    await expect(dev).toHaveURL(fixture.origin + '/workspaces')
    await expect(dev.getByRole('main')).toBeVisible()
    const bounds = await inbox(dev).boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
    await dev.keyboard.press('Escape')
    await expect(inbox(dev)).toBeHidden()
    await expect(bell(dev, 1)).toBeFocused()
    await bell(dev, 1).click()
    await expect(inbox(dev).getByRole('heading', { name: 'Task assigned to you' })).toBeVisible()
    await write(page.request, taskPath + '/comments', 201, 'POST', { body: 'An inbox mention', mentionUserIds: [developerId] })
    await expect(bell(dev, 2)).toBeVisible()
    await expect(dev.getByRole('heading', { name: 'You were mentioned' })).toBeVisible()

    const firstSocket = connections()[0]
    await phone.setOffline(true)
    firstSocket.client.conn.close()
    await write(page.request, taskPath + '/comments', 201, 'POST', { body: 'Mention while offline', mentionUserIds: [developerId] })
    await expect(bell(dev, 2)).toBeVisible()
    await phone.setOffline(false)
    await expect.poll(() => connections().some(({ id }) => id !== firstSocket.id)).toBe(true)
    await expect(bell(dev, 3)).toBeVisible()

    await other.goto(fixture.origin + '/workspaces')
    await bell(other, 3).click()
    await expect.poll(() => connections().length).toBe(2)
    const assignment = dev.getByRole('listitem').filter({ has: dev.getByRole('heading', { name: 'Task assigned to you' }) })
    await assignment.getByRole('button', { name: 'Mark as read' }).click()
    await expect(bell(dev, 2)).toBeVisible()
    await expect(bell(other, 2)).toBeVisible()
    await other.reload()
    await bell(other, 2).click()
    await expect(inbox(other).getByRole('heading', { name: 'Task assigned to you' })).toBeVisible()

    await page.goto(fixture.origin + '/workspaces')
    await bell(page, 0).click()
    await expect(inbox(page)).toBeVisible()
    await page.getByRole('main').click({ position: { x: 8, y: 8 } })
    await expect(inbox(page)).toBeHidden()
    await bell(page, 0).click()
    await assignment.getByRole('link', { name: task.title }).click()
    await expect(dev).toHaveURL(fixture.origin + taskPath)
    await expect(inbox(dev)).toBeHidden()
    await expect(dev.getByRole('heading', { name: task.title })).toBeVisible()
    await dev.getByLabel('Change status for ' + task.title).selectOption('IN_REVIEW')
    await expect(inbox(page).getByRole('heading', { name: 'Task ready for review' })).toBeVisible()
    await expect(bell(page, 1)).toBeVisible()

    await write(page.request, projectPath + '/members/' + developerId, 204, 'DELETE')
    await expect(other.getByRole('heading', { name: 'Item unavailable' })).toHaveCount(3)
    await expect(other.getByRole('link', { name: task.title })).toHaveCount(0)
    await expect(bell(other, 2)).toBeVisible()
    await expect.poll(() => dev.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  } finally {
    await phone.close()
    await mirror.close()
    await fixture.close()
  }
})
