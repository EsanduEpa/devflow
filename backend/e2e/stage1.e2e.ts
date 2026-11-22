import { expect, test as base, type Page } from '@playwright/test'
import { startStage1App } from '../test/fixtures/stage1-app.js'

const test = base.extend<{}, { appOrigin: string }>({
  appOrigin: [async ({}, use) => {
    const app = await startStage1App('browser')
    try {
      await use(app.origin)
    } finally {
      await app.close()
    }
  }, { scope: 'worker', timeout: 60_000 }],
  baseURL: async ({ appOrigin }, use) => use(appOrigin),
})

const password = 'DevFlowBrowserTestPassword!'
const workspaceName = 'Stage 1 test workspace'
const projectName = 'Stage 1 test project'
const taskTitle = 'Prepare release notes'

async function registerAndLogIn(page: Page, name: string, email: string) {
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create an account' }).click()
  await expect(page.getByText('Your account is ready. Log in to continue.')).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}

async function expectPageFits(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1)
}

test('supports keyboard navigation, visible focus, and required-field validation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  const name = page.getByLabel('Full name')
  await page.keyboard.press('Tab')
  await expect(name).toBeFocused()
  expect(await name.evaluate((input) => {
    const { outlineStyle, outlineWidth } = getComputedStyle(input)
    return outlineStyle !== 'none' && Number.parseFloat(outlineWidth) > 0
  })).toBe(true)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Create an account' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(name).toBeFocused()
  expect(await name.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true)
  await expectPageFits(page)
  await page.getByRole('link', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
})

test('completes the invited Developer workflow through the dashboard', async ({ page, browser, appOrigin }) => {
  const developerName = 'Stage 1 Developer'
  const developerEmail = 'developer@example.test'
  const developerContext = await browser.newContext({ baseURL: appOrigin, timezoneId: 'UTC' })
  try {
    const developer = await developerContext.newPage()
    await page.goto('/register')
    await registerAndLogIn(page, 'Stage 1 Owner', 'owner@example.test')
    await expect(page.getByRole('heading', { name: 'Welcome, Stage 1 Owner' })).toBeVisible()
    await page.getByRole('link', { name: 'Workspaces', exact: true }).click()
    await expect(page.getByText('You don’t belong to any workspaces yet.', { exact: false })).toBeVisible()

    const openWorkspace = page.getByRole('button', { name: 'New workspace' })
    const workspaceDialog = page.getByRole('dialog', { name: 'Create a workspace' })
    await openWorkspace.press('Enter')
    await expect(workspaceDialog.getByLabel('Workspace name')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(workspaceDialog).toBeHidden()
    await expect(openWorkspace).toBeFocused()
    await openWorkspace.click()
    await workspaceDialog.getByLabel('Workspace name').fill(workspaceName)
    await workspaceDialog.getByRole('button', { name: 'Create workspace' }).click()
    await expect(page.getByRole('heading', { name: workspaceName })).toBeVisible()

    await page.getByRole('link', { name: 'Workspace settings' }).click()
    await page.getByLabel('Invitee email').fill(developerEmail)
    await page.getByRole('combobox', { name: 'Workspace role' }).selectOption('DEVELOPER')
    await page.getByRole('button', { name: 'Create invitation' }).click()
    const invitationLink = page.getByLabel('Share this invitation link')
    await expect(invitationLink).toHaveValue(/\/invitations\/[\w-]{43}$/)
    const invitationUrl = await invitationLink.inputValue()
    await developer.goto(invitationUrl)
    await expect(developer.getByRole('heading', { name: workspaceName })).toBeVisible()
    await developer.getByRole('link', { name: 'Create an account' }).click()
    await registerAndLogIn(developer, developerName, developerEmail)
    await developer.getByRole('button', { name: 'Accept invitation' }).click()
    await expect(developer.getByRole('heading', { name: workspaceName })).toBeVisible()

    await page.getByRole('link', { name: 'Back to workspace' }).click()
    await page.getByRole('link', { name: 'Create project' }).click()
    await page.getByLabel('Project name').fill(projectName)
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ACTIVE')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible()
    const projectPath = new URL(page.url()).pathname
    await expect(page.getByRole('progressbar', { name: 'Completion' })).toHaveAttribute('value', '0')

    await developer.goto(projectPath)
    await expect(developer.getByRole('alert')).toContainText('You don’t have access to this project.')
    await page.getByRole('link', { name: 'Project settings' }).click()
    await page.getByRole('combobox', { name: 'Workspace member' }).selectOption({ label: `${developerName} (Developer)` })
    await page.getByRole('button', { name: 'Add member' }).click()
    await expect(page.getByRole('list', { name: 'Project members' })).toContainText(developerName)
    await page.getByRole('link', { name: 'Back to project' }).click()

    let releaseResponse!: () => void
    const held = new Promise<void>((resolve) => { releaseResponse = resolve })
    await page.route((url) => url.pathname === `/api/v1${projectPath}/tasks`, async (route) => {
      await held
      await route.fulfill({ status: 503, json: { error: { message: 'The database is temporarily unavailable.' } } })
    }, { times: 1 })
    try {
      await page.getByRole('link', { name: 'Task board' }).click()
      await expect(page.getByRole('status')).toHaveText('Loading task board…')
    } finally {
      releaseResponse()
    }
    await expect(page.getByRole('alert')).toHaveText('The database is temporarily unavailable.')
    await page.getByRole('button', { name: 'Try again' }).press('Enter')
    await expect(page.getByText('This project has no tasks yet.')).toBeVisible()

    await page.getByRole('link', { name: 'Create task' }).click()
    await page.getByLabel('Task title').fill(taskTitle)
    await page.getByRole('combobox', { name: 'Assignee' }).selectOption({ label: developerName })
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('TODO')
    await page.getByRole('button', { name: 'Create task' }).click()
    await expect(page.getByRole('heading', { name: taskTitle })).toBeVisible()

    await developer.goto(`${projectPath}/board`)
    const developerStatus = developer.getByLabel(`Change status for ${taskTitle}`)
    await expect(developerStatus).toHaveValue('TODO')
    await expect(developerStatus.locator('option[value="DONE"]')).toHaveCount(0)
    await developerStatus.selectOption('IN_REVIEW')
    await expect(developer.getByRole('region', { name: 'In Review', exact: true })).toContainText(taskTitle)

    await page.getByRole('link', { name: 'Task board' }).click()
    const board = page.getByRole('region', { name: 'Kanban board' })
    await expect(board.getByRole('region', { name: 'In Review', exact: true })).toContainText(taskTitle)
    await page.getByLabel(`Change status for ${taskTitle}`).selectOption('DONE')
    await expect(board.getByRole('region', { name: 'Done', exact: true })).toContainText(taskTitle)

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expectPageFits(page)
      if (width === 390) {
        await board.focus()
        await expect(board).toBeFocused()
        await expect.poll(() => board.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
      }
    }

    await page.getByRole('link', { name: projectName }).click()
    const progress = page.getByRole('region', { name: 'Project progress' })
    await expect(progress.getByRole('progressbar', { name: 'Completion' })).toHaveAttribute('value', '100')
    await expect(progress.locator('dd')).toHaveText(['1', '1', '0', '0'])
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expectPageFits(page)
    }
  } finally {
    await developerContext.close()
  }
})
