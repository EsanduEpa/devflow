import { expect, test, type APIRequestContext } from '@playwright/test'
import { Types } from 'mongoose'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowCommentBrowserPassword!'

test('discusses a task in two sessions and keeps editing with the author', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const fixture = await startStage1App('browser')
  const developer = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const outsider = await browser.newContext()

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
    const [ownerId, developerId] = await Promise.all([
      account(page.request, 'Owner'), account(developer.request, 'Developer'), account(outsider.request, 'Outsider'),
    ])
    const workspace = await post(page.request, '/workspaces', { name: 'Comment browser workspace' })
    await fixture.database.collection(fixture.collections.workspace.members).insertOne({
      workspaceId: new Types.ObjectId(workspace.id), userId: new Types.ObjectId(developerId), role: 'DEVELOPER', joinedAt: new Date(),
    })
    const project = await post(page.request, `/workspaces/${workspace.id}/projects`, { name: 'Comment browser project', managerId: ownerId })
    const projectPath = `/projects/${project.id}`
    await post(page.request, projectPath + '/members', { userId: developerId })
    const task = await post(page.request, projectPath + '/tasks', { title: 'Discuss release' })
    const taskUrl = `${fixture.origin}/tasks/${task.id}`

    await page.goto(fixture.origin + projectPath + '/board')
    await page.getByRole('link', { name: task.title, exact: true }).click()
    const comments = page.getByRole('dialog', { name: 'Task details' }).getByRole('region', { name: 'Comments' })
    await expect(comments.getByText('No comments yet.')).toBeVisible()
    const literalText = '<b>Ready for review</b>'
    await comments.getByLabel('Write a comment').fill(literalText)
    const picker = comments.getByLabel('Mention someone')
    await expect(picker.getByRole('option', { name: 'Developer', exact: true })).toHaveCount(1)
    await expect(picker.getByRole('option', { name: 'Outsider', exact: true })).toHaveCount(0)
    await picker.selectOption(developerId)
    await comments.getByRole('button', { name: 'Post comment' }).click()
    await expect(comments.getByText(literalText, { exact: true })).toBeVisible()
    await expect(comments.locator('b')).toHaveCount(0)
    await expect(comments.getByText('@Developer', { exact: true })).toBeVisible()
    await expect(comments.getByLabel('Write a comment')).toHaveValue('')

    const reader = await developer.newPage()
    await reader.goto(taskUrl)
    const discussion = reader.getByRole('region', { name: 'Comments' })
    await expect(discussion.getByText(literalText, { exact: true })).toBeVisible()
    await expect(discussion.getByRole('button', { name: 'Edit comment' })).toHaveCount(0)
    await expect(discussion.getByRole('button', { name: 'Delete comment' })).toHaveCount(0)
    await expect.poll(() => reader.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1)
    await discussion.getByLabel('Write a comment').fill('I can take a look.')
    await discussion.getByRole('button', { name: 'Post comment' }).click()
    await expect(discussion.getByText('I can take a look.', { exact: true })).toBeVisible()

    await comments.getByRole('button', { name: 'Edit comment' }).click()
    await comments.getByLabel('Edit comment text').fill('Updated review request')
    await comments.getByRole('button', { name: 'Remove mention of Developer' }).click()
    await comments.getByRole('button', { name: 'Save comment' }).click()
    await expect(comments.getByText('Updated review request', { exact: true })).toBeVisible()
    await expect(comments.getByText('Edited', { exact: true })).toBeVisible()
    await expect(comments.getByText('@Developer', { exact: true })).toHaveCount(0)
    await comments.getByRole('button', { name: 'Delete comment', exact: true }).click()
    await comments.getByRole('button', { name: 'Confirm deletion' }).click()
    await expect(comments.getByText('Updated review request', { exact: true })).toHaveCount(0)

    await reader.reload()
    await expect(discussion.getByText('I can take a look.', { exact: true })).toBeVisible()
    await expect(discussion.getByText('Updated review request', { exact: true })).toHaveCount(0)
    const outsiderPage = await outsider.newPage()
    await outsiderPage.goto(taskUrl)
    await expect(outsiderPage.getByRole('alert')).toHaveText('You don’t have access to this task.')
  } finally {
    await outsider.close()
    await developer.close()
    await fixture.close()
  }
})
