import { expect, test, type APIRequestContext } from '@playwright/test'
import { Types } from 'mongoose'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowActivityBrowserPassword!'

test('shows who created, updated, and completed a task in the activity timeline', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const fixture = await startStage1App('browser')
  const developer = await browser.newContext({ viewport: { width: 390, height: 844 } })

  async function post(client: APIRequestContext, path: string, data: object, status = 201) {
    const csrf = await client.get(fixture.origin + api + '/auth/csrf')
    expect(csrf.status()).toBe(200)
    const { data: { csrfToken } } = await csrf.json()
    const response = await client.post(fixture.origin + api + path, {
      headers: { Origin: fixture.origin, 'X-CSRF-Token': csrfToken }, data,
    })
    expect(response.status()).toBe(status)
    return (await response.json()).data
  }

  async function account(client: APIRequestContext, name: string) {
    const credentials = { email: name.toLowerCase() + '@example.test', password }
    const user = await post(client, '/auth/register', { name, ...credentials })
    await post(client, '/auth/login', credentials, 200)
    return user.id as string
  }

  try {
    const [ownerId, developerId] = await Promise.all([account(page.request, 'Owner'), account(developer.request, 'Developer')])
    const workspace = await post(page.request, '/workspaces', { name: 'Activity browser workspace' })
    await fixture.database.collection(fixture.collections.workspace.members).insertOne({
      workspaceId: new Types.ObjectId(workspace.id), userId: new Types.ObjectId(developerId), role: 'DEVELOPER', joinedAt: new Date(),
    })
    const project = await post(page.request, `/workspaces/${workspace.id}/projects`, { name: 'Activity browser project', managerId: ownerId })
    const projectPath = `/projects/${project.id}`
    await post(page.request, projectPath + '/members', { userId: developerId })
    const task = await post(page.request, projectPath + '/tasks', { title: 'Review release draft', assigneeId: developerId })
    const taskUrl = `${fixture.origin}/tasks/${task.id}`

    const reader = await developer.newPage()
    await reader.goto(taskUrl)
    const timeline = reader.getByRole('region', { name: 'Activity', exact: true })
    await expect(timeline).toContainText('Owner')
    await expect(timeline).toContainText('created the task')
    await expect(timeline).toContainText('Assignee set to Developer')
    await reader.getByLabel('Change status for Review release draft').selectOption('IN_REVIEW')
    await expect(timeline).toContainText('Status changed from Backlog to In Review')
    await expect(timeline.locator('time')).toHaveCount(2)
    await expect.poll(() => reader.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1)

    await page.goto(fixture.origin + projectPath + '/board')
    await page.getByRole('link', { name: task.title, exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Task details' })
    const drawerTimeline = drawer.getByRole('region', { name: 'Activity', exact: true })
    await drawer.getByRole('button', { name: 'Edit task' }).click()
    await drawer.getByLabel('Priority').selectOption('HIGH')
    await drawer.getByRole('button', { name: 'Save changes' }).click()
    await expect(drawerTimeline).toContainText('Priority changed from Medium to High')
    await drawer.getByLabel('Change status for Review release draft').selectOption('DONE')
    await expect(drawerTimeline).toContainText('completed the task')

    await reader.reload()
    await expect(timeline).toContainText('Status changed from In Review to Done')
    await expect(timeline.locator('time').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/)
    await expect(timeline.getByText('completed the task', { exact: true })).toHaveCount(1)
    await expect(timeline.locator('time')).toHaveCount(4)
    await expect(timeline.locator('ol > li').first()).toContainText('Owner')
  } finally {
    await developer.close()
    await fixture.close()
  }
})
