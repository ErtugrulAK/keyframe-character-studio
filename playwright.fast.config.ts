import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * The same end-to-end suite, faster (`npm run test:e2e:fast`): most specs run
 * against a production build served by `vite preview`, where a page loads its
 * bundle instead of transforming modules on demand, with more workers. The
 * specs that import editor source modules into the page (`/src/...`) need the
 * dev server, so they run there, in parallel with the rest.
 *
 * `npm run test:e2e` (the dev server for everything) stays the reference run.
 */
const host = '127.0.0.1';
const buildPort = 5191;
const devPort = 5192;
const DEV_ONLY = [
  '**/text-baseline-parity.spec.ts',
  '**/text-fonts.spec.ts',
  '**/text-outline-font-lifecycle.spec.ts',
];

export default defineConfig({
  ...base,
  forbidOnly: true,
  retries: 2,
  workers: 12,
  projects: [
    {
      name: 'build',
      testIgnore: DEV_ONLY,
      use: { ...devices['Desktop Chrome'], baseURL: `http://${host}:${buildPort}` },
    },
    {
      name: 'dev',
      testMatch: DEV_ONLY,
      use: { ...devices['Desktop Chrome'], baseURL: `http://${host}:${devPort}` },
    },
  ],
  webServer: [
    {
      command: `vite build --outDir node_modules/.cache/kcs-e2e-dist --emptyOutDir && vite preview --outDir node_modules/.cache/kcs-e2e-dist --host ${host} --port ${buildPort} --strictPort`,
      url: `http://${host}:${buildPort}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `vite --host ${host} --port ${devPort} --strictPort`,
      url: `http://${host}:${devPort}`,
      reuseExistingServer: false,
    },
  ],
});
