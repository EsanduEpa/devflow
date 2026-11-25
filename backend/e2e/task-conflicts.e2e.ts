import { expect, test, type APIRequestContext } from '@playwright/test'
import { Types } from 'mongoose'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowConflictBrowserPassword!'

test('keeps a draft and lets users retry edits, status moves, and sprint changes deliberately', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const fixture = await startStage1App('browser')
  const manager = await browser.newContext({ viewport: { width: 390, height: 844 } })

  async function write(client: APIRequestContext, path: string, data: object, status = 201, method = 'POST') {
    const csrf = await client.get(fixture.origin + api + '/auth/csrf')
    expect(csrf.status()).toBe(200)
    const { data: { csrfToken } } = await csrf.json()
    const response = await client.fetch(fixture.origin + api + path, {
      method, headers: { Origin: fixture.origin, 'X-CSRF-Token': csrfToken }, data,
    })
    expect(response.status()).toBe(status)
    return (await response.json()).data
  }

  async function account(client: APIRequestContext, name: string) {
    const credentials = { email: name.toLowerCase() + '@example.test', password }
    const user = await write(client, '/auth/register', { name, ...credentials })
    await write(client, '/auth/login', credentials, 200)
    return user.id as string
  }

  try {
    const [, managerId] = await Promise.all([account(page.request, 'Owner'), account(manager.request, 'Manager')])
    const workspace = await write(page.request, '/workspaces', { name: 'Conflict browser workspace' })
    await fixture.database.collection(fixture.collections.workspace.members).insertOne({
      workspaceId: new Types.ObjectId(workspace.id), userId: new Types.ObjectId(managerId), role: 'MANAGER', joinedAt: new Date(),
    })
    const project = await write(page.request, `/workspaces/${workspace.id}/projects`, { name: 'Conflict browser project', managerId })
    const projectPath = `/projects/${project.id}`
    const task = await write(page.request, projectPath + '/tasks', { title: 'Original project note', description: 'Original detail' })
    const taskPath = `/tasks/${task.id}`
    const taskUrl = fixture.origin + taskPath

    const editor = await manager.newPage()
    await editor.goto(taskUrl)
    await editor.getByRole('button', { name: 'Edit task' }).click()
    await editor.getByLabel('Task title').fill('Manager draft title')
    const draftDescription = editor.getByRole('region', { name: 'Edit task' }).locator('textarea[name="description"]')
    await draftDescription.fill('Manager draft detail')

    await page.goto(taskUrl)
    await page.getByRole('button', { name: 'Edit task' }).click()
    await page.getByLabel('Task title').fill('Owner saved title')
    await page.getByLabel('Priority').selectOption('HIGH')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: 'Owner saved title' })).toBeVisible()

    await editor.getByRole('button', { name: 'Save changes' }).click()
    const editConflict = editor.getByRole('region', { name: 'Task changed' })
    await expect(editConflict).toContainText('Owner saved title')
    await expect(editConflict).toContainText('High')
    await expect(editor.getByLabel('Task title')).toHaveValue('Manager draft title')
    await expect(draftDescription).toHaveValue('Manager draft detail')
    await expect.poll(() => editor.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1)
    await editor.getByRole('button', { name: 'Retry my changes' }).click()
    await expect(editor.getByRole('heading', { name: 'Manager draft title' })).toBeVisible()
    await expect(editor.getByRole('region', { name: 'Task properties' })).toContainText('High')
    await expect(editor.getByRole('region', { name: 'Description' })).toContainText('Manager draft detail')

    // Commit from the other session after each control has captured its version.
    await editor.route('**/api/v1' + taskPath + '/status', async (route) => {
      await write(page.request, taskPath + '/status', { status: 'TODO' }, 200, 'PATCH')
      await route.continue()
    }, { times: 1 })
    const statusControl = editor.getByLabel('Change status for Manager draft title')
    await statusControl.selectOption('IN_PROGRESS')
    const statusConflict = editor.getByRole('region', { name: 'Task changed' })
    await expect(statusConflict).toContainText('Your requested status was In Progress')
    await expect(statusConflict).toContainText('Latest status is To Do')
    await statusConflict.getByRole('button', { name: 'Retry status change' }).click()
    await expect(statusConflict).toHaveCount(0)
    await expect(statusControl).toHaveValue('IN_PROGRESS')

    const sprint = await write(page.request, projectPath + '/sprints', {
      name: 'Conflict sprint', startDate: '2028-01-01', endDate: '2028-01-14',
    })
    await editor.goto(`${fixture.origin}${projectPath}/sprints/${sprint.id}`)
    await editor.getByRole('button', { name: 'Add tasks', exact: true }).click()
    await editor.route((url) => url.pathname === `${api}/sprints/${sprint.id}/tasks/${task.id}`, async (route) => {
      await write(page.request, taskPath, { title: 'Latest sprint candidate' }, 200, 'PATCH')
      await route.continue()
    }, { times: 1 })
    await editor.getByRole('button', { name: 'Add Manager draft title' }).click()
    const sprintConflict = editor.getByRole('region', { name: 'Task changed' })
    await expect(sprintConflict).toContainText('Latest sprint candidate')
    await expect(sprintConflict).toContainText('project backlog')
    await sprintConflict.getByRole('button', { name: 'Retry adding task' }).click()
    await expect(editor.getByRole('button', { name: 'Remove Latest sprint candidate' })).toBeVisible()

    const saved = await page.request.get(fixture.origin + api + taskPath)
    expect((await saved.json()).data).toMatchObject({
      title: 'Latest sprint candidate', description: 'Manager draft detail', priority: 'HIGH', status: 'IN_PROGRESS', sprintId: sprint.id,
    })
  } finally {
    await manager.close()
    await fixture.close()
  }
})
