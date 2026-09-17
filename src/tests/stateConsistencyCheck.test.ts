import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Milestone D item 6 — the state consistency check.
 *
 * The checker runs against a fixture root (`--root`) so the text, bundle,
 * upload-instruction and hygiene rules can be exercised without touching the
 * real repository; the git-dependent checks report themselves as skipped when
 * the fixture is not a repository.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = path.join(repoRoot, 'scripts', 'check-state-consistency.mjs');

const ROADMAP = `# KCS Grouped Roadmap Execution Plan

Intro line that states the current milestone positions.

| Milestone | Items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX | 3 | \`feat/a\` | **MERGED** at \`077911b\` |
| B — Graph + keyboard accessibility | 4 | \`feat/b\` | **MERGED** at \`96e8f9d\` |
| C — First export / onboarding flow | 5 | \`feat/c\` | **MERGED** at \`c2dcb22\` |
| D — State / CI / warning hygiene | 6, 9 | — | **NEXT — plan only**; item 9 requires explicit approval |
| E — OGraf QA / schema hardening study | 7, 8 | Plan only |
| F — Architecture exploration only | 10, 11, 12 | Plan only |
`;

const NEXT_SESSION_GOOD = `# Next Session Handoff

## Next scoped work

1. Start **Milestone D — state / CI / warning hygiene** — the current next action.

## Guardrails

- Keep \`.omp/config.yml\` unchanged.
`;

const PROJECT_STATE_GOOD = `# KCS Project State

## Current position

Milestone C is merged at \`c2dcb22\`.

## Remaining work

- Next roadmap milestone: **D — state / CI / warning hygiene**.
`;

const README_GOOD = `# Bundle

Upload only \`chatgpt_handoff\\CHATGPT_UPLOAD_ONEFILE.md\` to ChatGPT.
`;

const MANIFEST_GOOD = `# Manifest

Upload only chatgpt_handoff\\CHATGPT_UPLOAD_ONEFILE.md to ChatGPT.
`;

const ONEFILE_GOOD = `# KCS ChatGPT One-File Handoff

## 0. Upload Instructions

- Upload only \`chatgpt_handoff\\CHATGPT_UPLOAD_ONEFILE.md\` to ChatGPT.

## 1. OMP Final Response

Milestone C is merged.
`;

const dirs: string[] = [];

function makeFixture(overrides: Record<string, string> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'kcs-state-'));
  dirs.push(root);
  mkdirSync(path.join(root, 'chatgpt_handoff', 'latest'), { recursive: true });
  const files: Record<string, string> = {
    'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': ROADMAP,
    'NEXT_SESSION.md': NEXT_SESSION_GOOD,
    'PROJECT_STATE.md': PROJECT_STATE_GOOD,
    'chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md': ONEFILE_GOOD,
    'chatgpt_handoff/latest/README.md': README_GOOD,
    'chatgpt_handoff/latest/manifest.txt': MANIFEST_GOOD,
    ...overrides,
  };
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, 'utf8');
  }
  return root;
}

function runCheck(root: string): { status: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('check-state-consistency', () => {
  it('passes on a consistent fixture and skips git checks outside a repository', () => {
    const { status, output } = runCheck(makeFixture());

    expect(status).toBe(0);
    expect(output).toContain('KCS state consistency: PASS');
    expect(output).toContain('git checks skipped');
  });

  it('fails when an active document still says a milestone is not merged', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/progress_99_example.md': '# Report\n\n## Merge status\n\n**NOT MERGED — awaiting the user\'s decision**\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('KCS state consistency: FAIL');
  });

  it('allows the same wording when the section is explicitly historical', () => {
    const { status } = runCheck(makeFixture({
      'chatgpt_handoff/latest/progress_99_example.md': '# Report\n\n## Merge status (historical record)\n\n**NOT MERGED — awaiting the user\'s decision** at that time.\n',
    }));

    expect(status).toBe(0);
  });

  it('fails when the roadmap no longer marks a merged milestone as MERGED', () => {
    const { status, output } = runCheck(makeFixture({
      'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': ROADMAP.replace('| C — First export / onboarding flow | 5 | `feat/c` | **MERGED** at `c2dcb22` |', '| C — First export / onboarding flow | 5 | `feat/c` | Implemented, awaiting merge |'),
    }));

    expect(status).toBe(1);
    expect(output).toContain('roadmap status rows');
  });

  it('fails when the next action points at a milestone the roadmap does not mark NEXT', () => {
    const { status, output } = runCheck(makeFixture({
      'NEXT_SESSION.md': NEXT_SESSION_GOOD.replace('Milestone D', 'Milestone C'),
    }));

    expect(status).toBe(1);
    expect(output).toContain('next action does not match');
  });

  it('fails when the handoff tells the reader to upload the whole latest folder', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/README.md': '# Bundle\n\nUpload the contents of chatgpt_handoff/latest/ to ChatGPT.\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('upload instruction');
  });

  it('fails when a source or test copy lands in the handoff bundle', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/src__freeform.test.ts': 'export const x = 1;\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('source/test/binary copies');
  });

  it('fails on a collapsed Windows path and on a secret marker', () => {
    const collapsed = runCheck(makeFixture({
      'chatgpt_handoff/latest/README.md': `${README_GOOD}\n- \`C:Usersertugrul.akDesktopKCS\` is not a handoff destination.\n`,
    }));
    expect(collapsed.status).toBe(1);
    expect(collapsed.output).toContain('collapsed Windows paths');

    const secret = runCheck(makeFixture({
      'chatgpt_handoff/latest/README.md': `${README_GOOD}\nexport GITHUB_TOKEN=abc\n`,
    }));
    expect(secret.status).toBe(1);
    expect(secret.output).toContain('secret markers');
  });

  it('passes on the real repository', () => {
    const output = execFileSync(process.execPath, [script, '--quiet'], { cwd: repoRoot, encoding: 'utf8' });
    expect(output).toContain('KCS state consistency: PASS');
  });
});
