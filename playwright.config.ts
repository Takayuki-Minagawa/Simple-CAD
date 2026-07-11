import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/Simple-CAD/',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command:
      'GITHUB_PAGES=true npm run build && GITHUB_PAGES=true npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/Simple-CAD/',
    reuseExistingServer: !process.env.CI,
  },
});
