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

function watchBrowserErrors(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text())
  })
}

test('supports keyboard navigation, visible focus, and required-field validation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  const name = page.getByLabel('Full name')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /Switch to Studio/ })).toBeFocused()
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

test('keeps the Studio theme across public routes and handles password recovery feedback', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.screenshot({ path: testInfo.outputPath('studio-light-mobile-login.png') })
  await page.getByRole('button', { name: 'Switch to Studio Dark' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { name: 'Forgot password' })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill('missing@example.test')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('status')).toContainText(/reset/i)
  await page.goto('/reset-password#token=invalid')
  await expect(page.getByRole('alert')).toHaveText('The reset link is invalid or incomplete.')
  await expectPageFits(page)
  await page.screenshot({ path: testInfo.outputPath('studio-dark-mobile-recovery.png') })
})

test('completes the invited Developer workflow through the dashboard', async ({ page, browser, appOrigin }, testInfo) => {
  const developerName = 'Stage 1 Developer'
  const developerEmail = 'developer@example.test'
  const developerContext = await browser.newContext({ baseURL: appOrigin, timezoneId: 'UTC' })
  const errors: string[] = []
  watchBrowserErrors(page, errors)
  const sidebar = page.getByRole('navigation', { name: 'Main navigation' })
  try {
    const developer = await developerContext.newPage()
    watchBrowserErrors(developer, errors)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/register')
    await registerAndLogIn(page, 'Stage 1 Owner', 'owner@example.test')
    await expect(page.getByRole('heading', { name: 'Workspaces', exact: true })).toBeVisible()
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
    await sidebar.getByRole('link', { name: 'Members', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Workspace members', exact: true })).toBeVisible()
    await sidebar.getByRole('link', { name: 'Projects', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()

    await sidebar.getByRole('link', { name: 'Workspace settings' }).click()
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
    await sidebar.getByRole('link', { name: 'Project settings' }).click()
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
      await sidebar.getByRole('link', { name: 'Board', exact: true }).click()
      await expect(page.getByRole('status')).toHaveText('Loading task board…')
    } finally {
      releaseResponse()
    }
    await expect(page.getByRole('alert')).toHaveText('The database is temporarily unavailable.')
    await page.getByRole('button', { name: 'Try again' }).press('Enter')
    await expect(page.getByText('This project has no tasks yet.')).toBeVisible()

    await page.getByRole('link', { name: 'Create task' }).click()
    const creation = page.getByRole('dialog', { name: 'New task' })
    await creation.getByLabel('Task title').fill(taskTitle)
    await creation.getByRole('combobox', { name: 'Assignee' }).selectOption({ label: developerName })
    await creation.getByRole('combobox', { name: 'Status', exact: true }).selectOption('TODO')
    await page.route((url) => url.pathname === `/api/v1${projectPath}/tasks` && !url.search, async (route) => {
      await route.fulfill({ status: 400, json: { error: {
        code: 'VALIDATION_ERROR', message: 'Check the task title.',
        details: [{ field: 'body.title', message: 'Use a title that describes the work.' }],
      } } })
    }, { times: 1 })
    await creation.getByRole('button', { name: 'Create task' }).click()
    await expect(creation.getByLabel('Task title')).toHaveAttribute('aria-invalid', 'true')
    await expect(creation.getByLabel('Task title')).toHaveValue(taskTitle)
    await expect(creation.getByRole('combobox', { name: 'Assignee' })).toHaveValue(/^[0-9a-f]{24}$/)
    await creation.getByRole('button', { name: 'Create task' }).click()
    const details = page.getByRole('dialog', { name: 'Task details' })
    await expect(details.getByRole('heading', { name: taskTitle })).toBeVisible()
    const taskPath = new URL(page.url()).pathname
    await expect(details.getByRole('button', { name: 'Edit task' })).toBeVisible()
    await details.getByRole('button', { name: 'Close task panel' }).click()

    await developer.goto(`${projectPath}/board`)
    await expect(developer.getByRole('link', { name: 'Project settings' })).toHaveCount(0)
    const developerStatus = developer.getByLabel(`Change status for ${taskTitle}`)
    await expect(developerStatus).toHaveValue('TODO')
    await expect(developerStatus.locator('option[value="DONE"]')).toHaveCount(0)
    await developerStatus.selectOption('IN_REVIEW')
    await expect(developer.getByRole('region', { name: 'In Review', exact: true })).toContainText(taskTitle)

    await page.reload()
    const board = page.getByRole('region', { name: 'Kanban board' })
    await expect(board.getByRole('region', { name: 'In Review', exact: true })).toContainText(taskTitle)
    const ownerStatus = page.getByLabel(`Change status for ${taskTitle}`)
    await page.route((url) => url.pathname === `/api/v1${taskPath}/status`, async (route) => {
      await route.fulfill({ status: 409, json: { error: { message: 'The status could not be saved.' } } })
    }, { times: 1 })
    await ownerStatus.selectOption('DONE')
    await expect(board.getByRole('alert')).toHaveText('The status could not be saved.')
    await expect(ownerStatus).toHaveValue('IN_REVIEW')
    await ownerStatus.selectOption('DONE')
    await expect(board.getByRole('region', { name: 'Done', exact: true })).toContainText(taskTitle)
    await page.getByRole('searchbox', { name: 'Search task titles or ID' }).fill('release')
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(/\/board\?search=release$/)
    await expect(page.getByRole('list', { name: 'Applied filters' })).toContainText('Search: release')
    const taskLink = board.getByRole('link', { name: taskTitle })
    await expect(taskLink).toBeVisible()
    await expect(board.getByText(developerName)).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('studio-light-desktop-board.png') })

    const account = page.getByLabel('Account menu')
    await account.click()
    await page.getByRole('button', { name: 'Switch to Studio Dark' }).click()
    await page.keyboard.press('Escape')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await taskLink.click()
    await expect(details.getByRole('heading', { name: taskTitle })).toBeVisible()
    await expect(details.getByRole('button', { name: 'Edit task' })).toBeVisible()
    const desktopDrawer = await details.boundingBox()
    expect(desktopDrawer?.width).toBeLessThan(600)
    expect(desktopDrawer?.x).toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath('studio-dark-desktop-task.png') })
    await page.keyboard.press('Escape')
    await expect(details).toBeHidden()
    await expect(taskLink).toBeFocused()
    await expect(page).toHaveURL(/\/board\?search=release$/)

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expectPageFits(page)
      if (width === 390) {
        await board.focus()
        await expect(board).toBeFocused()
        await expect.poll(() => board.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
        await taskLink.scrollIntoViewIfNeeded()
        const scroll = await board.evaluate((element) => element.scrollLeft)
        expect(scroll).toBeGreaterThan(0)
        await taskLink.click()
        await expect(details.getByRole('heading', { name: taskTitle })).toBeVisible()
        expect((await details.boundingBox())?.width).toBe(390)
        await page.screenshot({ path: testInfo.outputPath('studio-dark-mobile-task.png') })
        await details.getByRole('button', { name: 'Close task panel' }).click()
        await expect.poll(() => board.evaluate((element) => element.scrollLeft)).toBe(scroll)
        const openNavigation = page.getByRole('button', { name: 'Open navigation' })
        await openNavigation.click()
        const mobileNavigation = page.getByRole('dialog', { name: 'Navigation' })
        await expect(mobileNavigation.getByRole('link', { name: 'Board', exact: true })).toHaveAttribute('aria-current', 'page')
        await page.keyboard.press('Escape')
        await expect(openNavigation).toBeFocused()
      }
    }

    await sidebar.getByRole('link', { name: 'Task list', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Search task titles or ID' }).fill(taskPath.split('/').at(-1)!)
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page.getByRole('list', { name: 'Matching tasks' }).getByRole('link', { name: taskTitle })).toBeVisible()
    await sidebar.getByRole('link', { name: 'Dashboard', exact: true }).click()
    const progress = page.getByRole('region', { name: 'Project progress' })
    await expect(progress.getByRole('progressbar', { name: 'Completion' })).toHaveAttribute('value', '100')
    await expect(progress.locator('dd')).toHaveText(['1', '1', '0', '0'])
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expectPageFits(page)
    }
    await page.screenshot({ path: testInfo.outputPath('studio-dark-desktop-dashboard.png') })

    await page.goto(taskPath)
    await expect(page.getByRole('heading', { name: taskTitle })).toBeVisible()
    await expect(details).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit task' }).click()
    await page.getByLabel('Description').fill('List the user-facing changes for the release.')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Description', exact: true })).toContainText('List the user-facing changes')

    await sidebar.getByRole('link', { name: 'Project settings' }).click()
    await page.getByRole('button', { name: `Remove ${developerName} from project` }).click()
    const confirm = page.getByRole('dialog', { name: 'Remove project member?' })
    await expect(confirm).toContainText('become unassigned')
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('list', { name: 'Project members' })).toContainText(developerName)
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ARCHIVED')
    await page.getByRole('button', { name: 'Archive project', exact: true }).click()
    await page.getByRole('dialog', { name: 'Archive project?' }).getByRole('button', { name: 'Archive project' }).click()
    await expect(page.getByText('Project archived.')).toBeVisible()
    await sidebar.getByRole('link', { name: 'Board', exact: true }).click()
    await expect(page.getByText('Restore this project before changing task statuses.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create task' })).toHaveCount(0)
    await sidebar.getByRole('link', { name: 'Project settings' }).click()
    await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('ACTIVE')
    await page.getByRole('button', { name: 'Restore project', exact: true }).click()
    await expect(page.getByText('Project restored.')).toBeVisible()

    await page.goto(taskPath)
    await page.getByRole('button', { name: 'Delete task', exact: true }).click()
    await page.getByRole('dialog', { name: 'Delete task?' }).getByRole('button', { name: 'Delete permanently' }).click()
    await expect(progress.getByRole('progressbar', { name: 'Completion' })).toHaveAttribute('value', '0')

    await developer.getByLabel('Account menu').click()
    await developer.getByRole('button', { name: 'Log out', exact: true }).click()
    await expect(developer.getByRole('heading', { name: 'Log in', exact: true })).toBeVisible()

    await account.click()
    await page.getByRole('link', { name: 'Profile settings', exact: true }).click()
    await page.getByLabel('Bio').fill('Working on the Stage 1 release.')
    await page.getByRole('button', { name: 'Save profile' }).click()
    await expect(page.getByText('Profile saved.')).toBeVisible()
    const security = page.getByRole('region', { name: 'Change password' })
    await security.getByLabel('Current password', { exact: true }).fill(password)
    await security.getByLabel('New password', { exact: true }).fill('DevFlowBrowserUpdatedPassword!')
    await security.getByRole('button', { name: 'Change password', exact: true }).click()
    await expect(page.getByText('Your password was updated. Log in with your new password.')).toBeVisible()
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('owner@example.test')
    await page.getByLabel('Password', { exact: true }).fill('DevFlowBrowserUpdatedPassword!')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Workspaces', exact: true })).toBeVisible()
    await openWorkspace.click()
    const secondWorkspace = 'Documentation workspace'
    await workspaceDialog.getByLabel('Workspace name').fill(secondWorkspace)
    await workspaceDialog.getByRole('button', { name: 'Create workspace' }).click()
    await expect(page.getByRole('heading', { name: secondWorkspace })).toBeVisible()
    const switcher = sidebar.getByRole('combobox', { name: 'Workspace', exact: true })
    await switcher.selectOption({ label: workspaceName })
    await expect(page.getByRole('heading', { name: workspaceName })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(projectName) })).toBeVisible()
    await switcher.selectOption({ label: secondWorkspace })
    await expect(page.getByRole('heading', { name: secondWorkspace })).toBeVisible()
    await expect(page.getByText('No unarchived projects are visible in this workspace yet.')).toBeVisible()
    await page.context().clearCookies()
    await switcher.selectOption({ label: workspaceName })
    await expect(page.getByText('Your session ended. Log in to continue.')).toBeVisible()
    expect(errors).toEqual([])
  } finally {
    await developerContext.close()
  }
})
