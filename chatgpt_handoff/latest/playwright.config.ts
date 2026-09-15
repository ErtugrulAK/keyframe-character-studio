import { defineConfig, devices } from '@playwright/test';

const isCiRun = Boolean(process.env.CI);
const isReleaseGateRun = process.env.KCS_RELEASE_GATE === '1';
const isV6MotionCoreRun = process.env.KCS_V6_QA === '1';
const isIsolatedQaRun = isV6MotionCoreRun || isReleaseGateRun || isCiRun;
const qaPort = isV6MotionCoreRun ? 5187 : isReleaseGateRun ? 5189 : isIsolatedQaRun ? 5188 : 5173;
const qaHost = '127.0.0.1';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCiRun,
  retries: isCiRun ? 2 : 0,
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
