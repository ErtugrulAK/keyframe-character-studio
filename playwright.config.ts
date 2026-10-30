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
  // V1: the @visual screenshot suite is opt-in via npm run qa:visual (the
  // runner script sets KCS_VISUAL=1); no default behavior run ever asserts
  // pixels. Baselines are per-platform ({-platform} template) — see
  // docs/guides/VISUAL_QA.md. Portability honesty (V6): the COMMITTED baselines
  // are win32-only, CI does not run @visual, and no CI job generates them;
  // a different OS/browser build must regenerate with
  // `npx playwright test --update-snapshots` after enabling KCS_VISUAL.
  // The settle predicate (fonts.ready + layer count + two-frame layout
  // equality, V6) improves cross-machine determinism but does not promise
  // pixel identity across platform text-rasterizer differences.
  grepInvert: process.env.KCS_VISUAL === '1' ? undefined : /@visual/,
  snapshotPathTemplate: '{testDir}/visual/{arg}{-platform}{ext}',
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
