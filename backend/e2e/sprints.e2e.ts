import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { Types } from 'mongoose'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowSprintBrowserPassword!'

test('lets the assigned Manager run a sprint and a Developer verify the saved progress', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const fixture = await startStage1App('browser')
  const owner = await browser.newContext()
  const developer = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC' })

  async function post(client: APIRequestContext, path: string, body: object, status = 201) {
    const csrf = await client.get(fixture.origin + api + '/auth/csrf')
    expect(csrf.status()).toBe(200)
    const { data: { csrfToken } } = await csrf.json()
    const response = await client.post(fixture.origin + api + path, {
      headers: { Origin: fixture.origin, 'X-CSRF-Token': csrfToken }, data: body,
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

  async function planSprint(ui: Page, name: string, start: string, end: string) {
    await ui.getByRole('button', { name: 'New sprint' }).click()
    await ui.getByLabel('Sprint name').fill(name)
    await ui.getByLabel('Start date').fill(start)
    await ui.getByLabel('End date').fill(end)
    await ui.getByRole('button', { name: 'Create sprint' }).click()
    await expect(ui.getByRole('heading', { name, exact: true })).toBeVisible()
    return ui.url()
  }

  try {
    const [, managerId, developerId] = await Promise.all([
      account(owner.request, 'Owner'),
      account(page.request, 'Manager'),
      account(developer.request, 'Developer'),
    ])
    const workspace = await post(owner.request, '/workspaces', { name: 'Sprint browser workspace' })
    const workspaceId = new Types.ObjectId(workspace.id)
    await fixture.database.collection(fixture.collections.workspace.members).insertMany([
      { workspaceId, userId: new Types.ObjectId(managerId), role: 'MANAGER', joinedAt: new Date() },
      { workspaceId, userId: new Types.ObjectId(developerId), role: 'DEVELOPER', joinedAt: new Date() },
    ])
    const project = await post(owner.request, `/workspaces/${workspace.id}/projects`, { name: 'Release project', managerId })
    const path = `/projects/${project.id}`
    await post(page.request, path + '/members', { userId: developerId })
    await post(page.request, path + '/tasks', { title: 'Finish documentation', status: 'IN_PROGRESS' })
    await post(page.request, path + '/tasks', { title: 'Approved review', status: 'DONE' })

    await page.goto(fixture.origin + path)
    await page.getByRole('navigation').getByRole('link', { name: 'Sprints' }).click()
    const future = await planSprint(page, 'Next release sprint', '2028-03-01', '2028-03-14')
    await page.getByRole('link', { name: 'All sprints' }).click()
    const current = await planSprint(page, 'Current release sprint', '2028-02-15', '2028-02-29')
    await page.getByRole('button', { name: 'Add tasks', exact: true }).click()
    await page.getByRole('button', { name: 'Add Finish documentation' }).click()
    await expect(page.getByRole('button', { name: 'Remove Finish documentation' })).toBeVisible()
    await page.getByRole('button', { name: 'Remove Finish documentation' }).click()
    await expect(page.getByRole('button', { name: 'Add Finish documentation' })).toBeVisible()
    await page.getByRole('button', { name: 'Add Finish documentation' }).click()
    await page.getByRole('button', { name: 'Add Approved review' }).click()
    await expect(page.getByText('1 of 2 tasks done · 50%')).toBeVisible()
    await page.getByRole('button', { name: 'Start sprint' }).click()

    const reader = await developer.newPage()
    await reader.goto(current)
    await expect(reader.getByText('1 of 2 tasks done · 50%')).toBeVisible()
    await expect(reader.getByRole('button', { name: 'Complete sprint' })).toHaveCount(0)
    await expect(reader.getByRole('button', { name: 'Add tasks' })).toHaveCount(0)
    await expect.poll(() => reader.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1)

    await page.getByRole('button', { name: 'Complete sprint' }).click()
    await expect(page.getByLabel('Unfinished only')).toBeChecked()
    const sprintTasks = page.getByRole('region', { name: 'Sprint tasks' })
    await expect(sprintTasks.getByRole('link', { name: 'Finish documentation' })).toBeVisible()
    await expect(sprintTasks.getByRole('link', { name: 'Approved review' })).toHaveCount(0)
    await expect(page.getByRole('option', { name: /Next release sprint/ })).toHaveCount(1)
    await page.getByLabel('Move unfinished tasks to').selectOption(new URL(future).pathname.split('/').at(-1)!)
    await page.getByRole('button', { name: 'Confirm completion' }).click()
    await expect(page.getByRole('heading', { name: 'Progress at completion' })).toBeVisible()

    await reader.reload()
    await expect(reader.getByRole('heading', { name: 'Progress at completion' })).toBeVisible()
    await expect(reader.getByText('1 of 2 tasks done · 50%')).toBeVisible()
    await expect(reader.getByRole('link', { name: 'Approved review' })).toBeVisible()
    await expect(reader.getByRole('link', { name: 'Finish documentation' })).toHaveCount(0)
    await reader.goto(future)
    await expect(reader.getByRole('link', { name: 'Finish documentation' })).toBeVisible()
    await expect(reader.getByText('In Progress', { exact: true })).toBeVisible()
  } finally {
    await developer.close()
    await owner.close()
    await fixture.close()
  }
})
