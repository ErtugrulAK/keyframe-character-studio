#!/usr/bin/env node
// V1 visual-diff runner: the single authorized entry point for the opt-in
// @visual suite. It only sets the opt-in flag and delegates to the normal
// Playwright CLI, so extra arguments (--update-snapshots, --grep) pass through.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', 'node_modules', 'playwright', 'cli.js');

const result = spawnSync(process.execPath, [cli, 'test', 'e2e/visual-regression.spec.ts', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, KCS_VISUAL: '1' },
});
process.exit(result.status ?? 1);
