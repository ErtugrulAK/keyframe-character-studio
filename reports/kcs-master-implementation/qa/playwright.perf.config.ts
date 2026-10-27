import { defineConfig, devices } from '@playwright/test';

/**
 * Task-local performance configuration: a PRODUCTION build (dev-mode React
 * validation would dominate any profile) served by `vite preview` on a
 * dedicated port. KCS_PERF_ROOT selects the source tree (this worktree by
 * default, or the base copy for a before/after comparison); the build output
 * goes to KCS_PERF_OUT, outside the worktree. KCS_PERF_MODE=dev runs the
 * dev server instead, for the attribution probe (component names kept).
 */
const QA_HOST = '127.0.0.1';
const QA_PORT = 5199;
const ROOT = process.env.KCS_PERF_ROOT ?? '../../..';
const DEV = process.env.KCS_PERF_MODE === 'dev';
const OUT = process.env.KCS_PERF_OUT;
// KCS_PERF_SPEC picks another probe; KCS_PERF_MINIFY=0 keeps function names in the production bundle (attribution only).
const SPEC = process.env.KCS_PERF_SPEC;
const MINIFY = process.env.KCS_PERF_MINIFY === '0' ? ' --minify false' : '';
// KCS_PERF_SKIP_BUILD=1 serves the build already in KCS_PERF_OUT (repeated runs of one build).
const BUILD = process.env.KCS_PERF_SKIP_BUILD === '1' ? '' : `npx vite build --outDir "${OUT}" --emptyOutDir${MINIFY} && `;
if (!DEV && !OUT) throw new Error('KCS_PERF_OUT is required (a directory outside the worktree)');

export default defineConfig({
  outputDir: './out/perf-results',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://${QA_HOST}:${QA_PORT}`, trace: 'off' },
  projects: [{ name: 'perf', testDir: './evidence', testMatch: SPEC ? `**/${SPEC}` : DEV ? '**/c2-perf-attribution.evidence.ts' : '**/c2-perf-probe.evidence.ts', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: DEV
      ? `npx vite --host ${QA_HOST} --port ${QA_PORT} --strictPort`
      : `${BUILD}npx vite preview --outDir "${OUT}" --host ${QA_HOST} --port ${QA_PORT} --strictPort`,
    cwd: ROOT,
    url: `http://${QA_HOST}:${QA_PORT}`,
    reuseExistingServer: false,
    timeout: 240000,
  },
});
