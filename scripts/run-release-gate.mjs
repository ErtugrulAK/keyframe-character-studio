#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const runNode = (script, args, options = {}) => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), ...args], {
    ...options,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

console.log(`Release gate candidate SHA: ${candidateSha}`);
runNode('./validate-ograf-manifest.mjs', []);
runNode('../node_modules/playwright/cli.js', [
  'test',
  'e2e/ograf-phase2d-interoperability.spec.ts',
  'e2e/ograf-editor-export.spec.ts',
  '--project=chromium',
], { env: { ...process.env, KCS_RELEASE_GATE: '1' } });
console.log(`Release gate passed for candidate SHA: ${candidateSha}`);
