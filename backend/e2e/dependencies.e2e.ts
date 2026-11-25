import { expect, test, type APIRequestContext } from '@playwright/test'
import { Types } from 'mongoose'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const api = '/api/v1'
const password = 'DevFlowDependencyBrowserPassword!'

test('manages task prerequisites and displays blocked work to project readers', async ({ browser, page }) => {
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
    const workspace = await post(page.request, '/workspaces', { name: 'Dependency browser workspace' })
    await fixture.database.collection(fixture.collections.workspace.members).insertOne({
      workspaceId: new Types.ObjectId(workspace.id), userId: new Types.ObjectId(developerId), role: 'DEVELOPER', joinedAt: new Date(),
    })
    const project = await post(page.request, `/workspaces/${workspace.id}/projects`, { name: 'Dependency browser project', managerId: ownerId })
    const projectPath = `/projects/${project.id}`
    await post(page.request, projectPath + '/members', { userId: developerId })
    const publish = await post(page.request, projectPath + '/tasks', { title: 'Publish release' })
    const review = await post(page.request, projectPath + '/tasks', { title: 'Review release' })
    const publishUrl = `${fixture.origin}/tasks/${publish.id}`
    const reviewUrl = `${fixture.origin}/tasks/${review.id}`

    await page.goto(fixture.origin + projectPath + '/board')
    await page.getByRole('link', { name: 'Publish release', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Task details' })
    const dependencies = drawer.getByRole('region', { name: 'Dependencies', exact: true })
    await dependencies.getByRole('button', { name: 'Add prerequisite', exact: true }).click()
    await dependencies.getByLabel('Find a prerequisite').fill('Review')
    await dependencies.getByRole('button', { name: 'Search tasks' }).click()
    await dependencies.getByRole('button', { name: 'Add prerequisite Review release' }).click()
    await expect(dependencies.getByText('Blocked', { exact: true })).toBeVisible()
    await expect(dependencies.getByRole('region', { name: 'Prerequisites', exact: true }).getByRole('link', { name: 'Review release' })).toBeVisible()

    const reader = await developer.newPage()
    await reader.goto(publishUrl)
    const readerDependencies = reader.getByRole('region', { name: 'Dependencies', exact: true })
    await expect(readerDependencies.getByText('Blocked', { exact: true })).toBeVisible()
    await expect(readerDependencies.getByRole('button', { name: 'Add prerequisite' })).toHaveCount(0)
    await expect(readerDependencies.getByRole('button', { name: 'Remove prerequisite Review release' })).toHaveCount(0)
    await expect.poll(() => reader.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(1)

    await page.goto(reviewUrl)
    const reviewDependencies = page.getByRole('region', { name: 'Dependencies', exact: true })
    await expect(reviewDependencies.getByRole('region', { name: 'Dependent tasks' }).getByRole('link', { name: 'Publish release' })).toBeVisible()
    await reviewDependencies.getByRole('button', { name: 'Add prerequisite', exact: true }).click()
    await reviewDependencies.getByRole('button', { name: 'Add prerequisite Publish release' }).click()
    await expect(reviewDependencies.getByRole('alert')).toHaveText('Adding this prerequisite would create a dependency cycle.')

    const status = page.getByLabel('Change status for Review release')
    await status.selectOption('DONE')
    await expect(status).toBeEnabled()
    await reader.reload()
    await expect(readerDependencies.getByRole('region', { name: 'Prerequisites', exact: true }).getByText('Done', { exact: true })).toBeVisible()
    await expect(readerDependencies.getByText('Blocked', { exact: true })).toHaveCount(0)

    await status.selectOption('TODO')
    await expect(status).toBeEnabled()
    await reader.reload()
    await expect(readerDependencies.getByText('Blocked', { exact: true })).toBeVisible()
    await page.goto(publishUrl)
    const publishDependencies = page.getByRole('region', { name: 'Dependencies', exact: true })
    await publishDependencies.getByRole('button', { name: 'Remove prerequisite Review release' }).click()
    await expect(publishDependencies.getByRole('region', { name: 'Prerequisites', exact: true }).getByText('None')).toBeVisible()
    await expect(publishDependencies.getByText('Blocked', { exact: true })).toHaveCount(0)
  } finally {
    await developer.close()
    await fixture.close()
  }
})
