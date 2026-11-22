import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  use: { browserName: 'chromium', timezoneId: 'UTC', actionTimeout: 15_000 },
})
