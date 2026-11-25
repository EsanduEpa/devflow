import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { Types } from 'mongoose'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowKanbanBrowserPassword!'

function board(page: Page) {
  return page.getByRole('region', { name: 'Kanban board', exact: true })
}

function column(page: Page, name: string) {
  return board(page).getByRole('region', { name, exact: true })
}

function handle(page: Page, title: string) {
  return board(page).getByTitle(`Drag ${title}`, { exact: true })
}

async function setup(owner: Page, developer: Page, fixture: Awaited<ReturnType<typeof startStage1App>>) {
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

  const [ownerId, developerId] = await Promise.all([account(owner.request, 'Owner'), account(developer.request, 'Developer')])
  const workspace = await write(owner.request, '/workspaces', { name: 'Kanban test workspace' })
  await fixture.database.collection(fixture.collections.workspace.members).insertOne({
    workspaceId: new Types.ObjectId(workspace.id), userId: new Types.ObjectId(developerId), role: 'DEVELOPER', joinedAt: new Date(),
  })
  const project = await write(owner.request, `/workspaces/${workspace.id}/projects`, { name: 'Kanban test project', managerId: ownerId })
  const projectPath = `/projects/${project.id}`
  await write(owner.request, projectPath + '/members', { userId: developerId })
  return {
    boardUrl: fixture.origin + projectPath + '/board',
    createTask: (title: string, assigned = true) => write(owner.request, projectPath + '/tasks', {
      title, assigneeId: assigned ? developerId : null,
    }),
    async patchTask(id: string, fields: object, statusMove = false) {
      return write(owner.request, `/tasks/${id}${statusMove ? '/status' : ''}`, fields, 200, 'PATCH')
    },
  }
}

test('moves permitted cards by drag and preserves keyboard and touch status controls', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const fixture = await startStage1App('browser')
  const developer = await browser.newContext({ viewport: { width: 1500, height: 900 } })
  try {
    await page.setViewportSize({ width: 1500, height: 900 })
    const author = await developer.newPage()
    const scenario = await setup(page, author, fixture)
    const assigned = 'Assigned release draft'
    const keyboardTask = 'Keyboard status task'
    await scenario.createTask(assigned)
    await scenario.createTask(keyboardTask)
    await scenario.createTask('Unassigned task', false)

    const versions: number[] = []
    author.on('request', (request) => {
      if (request.method() === 'PATCH' && new URL(request.url()).pathname.endsWith('/status')) {
        versions.push(request.postDataJSON().expectedVersion)
      }
    })
    await author.goto(scenario.boardUrl)
    await expect(handle(author, assigned)).toBeVisible()
    await expect(handle(author, 'Unassigned task')).toHaveCount(0)
    await handle(author, assigned).dragTo(column(author, 'Backlog').getByRole('heading'))
    await handle(author, assigned).dragTo(column(author, 'Done').getByRole('heading'))
    await expect(column(author, 'Backlog').getByRole('link', { name: assigned })).toBeVisible()
    expect(versions).toEqual([])

    await handle(author, assigned).dragTo(column(author, 'In Progress').getByRole('heading'))
    await expect(author.getByText(`${assigned} moved to In Progress.`, { exact: true })).toBeVisible()
    await expect(column(author, 'In Progress').getByRole('link', { name: assigned })).toBeVisible()
    await handle(author, assigned).dragTo(column(author, 'In Review').getByRole('heading'))
    await expect(author.getByText(`${assigned} moved to In Review.`, { exact: true })).toBeVisible()
    expect(versions).toEqual([0, 1])

    const keyboard = author.getByLabel(`Change status for ${keyboardTask}`)
    await keyboard.focus()
    await author.keyboard.press('t')
    await author.keyboard.press('Enter')
    await expect(author.getByText(`${keyboardTask} moved to To Do.`, { exact: true })).toBeVisible()
    const movedKeyboardControl = column(author, 'To Do').getByLabel(`Change status for ${keyboardTask}`)
    await expect(movedKeyboardControl).toBeFocused()

    await page.goto(scenario.boardUrl)
    await handle(page, assigned).dragTo(column(page, 'Done').getByRole('heading'))
    await expect(page.getByText(`${assigned} moved to Done.`, { exact: true })).toBeVisible()
    await author.reload()
    await expect(column(author, 'Done').getByRole('link', { name: assigned })).toBeVisible()
    await expect(handle(author, assigned)).toHaveCount(0)
    await column(author, 'Done').getByRole('link', { name: assigned }).click()
    const drawer = author.getByRole('dialog', { name: 'Task details' })
    await expect(drawer.getByText('Done', { exact: true })).toBeVisible()
    await drawer.getByRole('button', { name: 'Close task panel' }).click()

    const mobile = await browser.newContext({ storageState: await developer.storageState(), hasTouch: true, isMobile: true,
      viewport: { width: 390, height: 844 } })
    try {
      const phone = await mobile.newPage()
      await phone.goto(scenario.boardUrl)
      const fallback = phone.getByLabel(`Change status for ${keyboardTask}`)
      await expect(fallback).toBeVisible()
      await expect(handle(phone, keyboardTask)).toBeHidden()
      await expect.poll(() => board(phone).evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
      await expect.poll(() => phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
        .toBeLessThanOrEqual(1)
      await fallback.selectOption('IN_PROGRESS')
      await expect(phone.getByText(`${keyboardTask} moved to In Progress.`, { exact: true })).toBeVisible()
      await expect(column(phone, 'In Progress').getByRole('link', { name: keyboardTask })).toBeVisible()
    } finally {
      await mobile.close()
    }
  } finally {
    await developer.close()
    await fixture.close()
  }
})

test('rolls back a failed drop and reconciles stale and forbidden moves', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const fixture = await startStage1App('browser')
  const developer = await browser.newContext({ viewport: { width: 1500, height: 900 } })
  let releaseFailure: () => void = () => {}
  try {
    const author = await developer.newPage()
    const scenario = await setup(page, author, fixture)
    const title = 'Conflict on drop'
    const task = await scenario.createTask(title)
    const path = `${api}/tasks/${task.id}/status`
    await author.goto(scenario.boardUrl)

    const fail = new Promise<void>((resolve) => { releaseFailure = resolve })
    await author.route((url) => url.pathname === path, async (route) => {
      await fail
      await route.abort('failed')
    }, { times: 1 })
    await handle(author, title).dragTo(column(author, 'In Progress').getByRole('heading'))
    await expect(author.getByText('Saving status…')).toBeVisible()
    await expect(column(author, 'In Progress').getByRole('link', { name: title })).toBeVisible()
    releaseFailure()
    await expect(author.getByRole('alert')).toHaveText('Could not reach DevFlow. Try again.')
    await expect(column(author, 'Backlog').getByRole('link', { name: title })).toBeVisible()
    await expect(column(author, 'In Progress').getByRole('link', { name: title })).toHaveCount(0)

    await author.route((url) => url.pathname === path, async (route) => {
      expect(route.request().postDataJSON().expectedVersion).toBe(0)
      await scenario.patchTask(task.id, { status: 'TODO' }, true)
      await route.continue()
    }, { times: 1 })
    await handle(author, title).dragTo(column(author, 'In Progress').getByRole('heading'))
    const conflict = author.getByRole('region', { name: 'Task changed' })
    await expect(conflict).toContainText('Latest status is To Do')
    await expect(column(author, 'To Do').getByRole('link', { name: title })).toBeVisible()
    await expect(column(author, 'In Progress').getByRole('link', { name: title })).toHaveCount(0)
    await conflict.getByRole('button', { name: 'Retry status change' }).click()
    await expect(author.getByText(`${title} moved to In Progress.`, { exact: true })).toBeVisible()

    await author.route((url) => url.pathname === path, async (route) => {
      await scenario.patchTask(task.id, { assigneeId: null })
      await route.continue()
    }, { times: 1 })
    await handle(author, title).dragTo(column(author, 'In Review').getByRole('heading'))
    await expect(author.getByRole('alert')).toContainText('task assignee')
    await expect(column(author, 'In Progress').getByRole('link', { name: title })).toBeVisible()
    await expect(handle(author, title)).toHaveCount(0)
    await expect(column(author, 'In Review').getByRole('link', { name: title })).toHaveCount(0)
  } finally {
    releaseFailure()
    await developer.close()
    await fixture.close()
  }
})
