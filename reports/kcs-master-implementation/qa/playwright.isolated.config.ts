import { defineConfig, devices } from '@playwright/test';

/**
 * Task-local QA configuration for the KCS master implementation worktree.
 *
 * - Starts ONLY the Vite frontend of this worktree on a dedicated port with
 *   --strictPort; the backend (server/index.js) and its SQLite file are never
 *   started (the frontend does not call /api).
 * - Never reuses an existing server, so a user's running dev server cannot be
 *   picked up by accident.
 * - Every test gets a disposable browser context; storage is per-origin, and
 *   the dedicated port is a fresh origin.
 * - All output stays inside this report directory.
 */
const QA_HOST = '127.0.0.1';
const QA_PORT = 5196;

export default defineConfig({
  outputDir: './out/test-results',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  // List only: an HTML report would drop generated trace-viewer JS into the
  // worktree, where the repository's lint run would scan it.
  reporter: [['list']],
  grepInvert: /@visual/,
  snapshotPathTemplate: '../../../e2e/visual/{arg}{-platform}{ext}',
  use: {
    baseURL: `http://${QA_HOST}:${QA_PORT}`,
    trace: 'retain-on-failure',
    contextOptions: {
      permissions: ['clipboard-read', 'clipboard-write'],
    },
  },
  projects: [
    // Task evidence specs (assertions + screenshots into ../evidence).
    // Named *.evidence.ts so the repository's Vitest run never collects them.
    {
      name: 'evidence',
      testDir: './evidence',
      testMatch: '**/*.evidence.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    // The repository's own E2E suite, run against this worktree only.
    {
      name: 'e2e',
      testDir: '../../../e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx vite --host ${QA_HOST} --port ${QA_PORT} --strictPort`,
    cwd: '../../..',
    url: `http://${QA_HOST}:${QA_PORT}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
