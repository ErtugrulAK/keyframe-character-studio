import { defineConfig } from 'vitest/config';

/**
 * Configuration for the on-demand evaluator profile harness.
 *
 * The default suite only picks up `*.test.*` files, so
 * `perf/evaluator-profile.perf.ts` never runs in CI. This config exists purely
 * to run that harness with the repository's own TS/Vite resolution:
 *
 *   npx vitest run --config perf/vitest.perf.config.ts
 *
 * It is intentionally separate from the root config: no jsdom, no test setup,
 * one file, and a long timeout because a profile pass is heavier than a unit
 * test.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['perf/**/*.perf.ts'],
    testTimeout: 120_000,
    globals: true,
  },
});
