import { defineConfig, devices } from '@playwright/test';

const isV6MotionCoreRun = process.env.KCS_V6_QA === '1';
const isIsolatedQaRun = isV6MotionCoreRun || process.env.CI === 'true';
const qaPort = isV6MotionCoreRun ? 5187 : isIsolatedQaRun ? 5188 : 5173;
const qaHost = '127.0.0.1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://${qaHost}:${qaPort}`,
    trace: 'on-first-retry',
    contextOptions: {
      permissions: ['clipboard-read', 'clipboard-write']
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: isIsolatedQaRun
      ? `concurrently "node server/index.js" "vite --host ${qaHost} --port ${qaPort}"`
      : 'npm run dev',
    url: `http://${qaHost}:${qaPort}`,
    reuseExistingServer: isIsolatedQaRun ? false : true,
  },
});
