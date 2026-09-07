import { spawn } from 'node:child_process';

const child = spawn(process.execPath, [
  './node_modules/@playwright/test/cli.js',
  'test',
  'e2e/v6-motion-core.spec.ts',
  '--project=chromium',
], {
  env: { ...process.env, KCS_V6_QA: '1' },
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
