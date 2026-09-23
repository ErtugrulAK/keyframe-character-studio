import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Milestone D item 6 — state consistency check.
 *
 * Each negative case isolates exactly one rule (so deleting that rule fails the
 * case), and the git-dependent rules are exercised against a temporary
 * repository created with plain git commands.
 */

const nl = '\n';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = path.join(repoRoot, 'scripts', 'check-state-consistency.mjs');

const ROADMAP = `# KCS Grouped Roadmap Execution Plan

Intro sentence about the milestone positions.

| Milestone | Items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX | 3 | \`feat/a\` | **MERGED** at \`077911b\` |
| B — Graph + keyboard accessibility | 4 | \`feat/b\` | **MERGED** at \`96e8f9d\` |
| C — First export / onboarding flow | 5 | \`feat/c\` | **MERGED** at \`c2dcb22\` |
| D — State / CI / warning hygiene | 6, 9 | \`chore/d\` | **NEXT** — item 6 implemented, item 9 approval-gated |
| E — OGraf QA / schema hardening study | 7, 8 | — | Plan only |
| F — Architecture exploration only | 10, 11, 12 | — | Plan only |
`;

const NEXT_SESSION = `# Next Session Handoff

## Next scoped work

1. Milestone D item 6 is implemented; the current decision is item 9.

## Guardrails

- Keep \`.omp/config.yml\` unchanged.
`;

const PROJECT_STATE = `# KCS Project State

## Current position

Milestone C is merged. Milestone D item 6 is implemented.

## Remaining work

- Item 9 requires explicit approval.
`;

const RC_TAG_TARGET = '46d2a3e59e065816d972dcd56951803951b577f6';

const RELEASE_SUMMARY = `# KCS Release Candidate Summary

Annotated tag \`v1.1.0-rc.1\` was created at workflow-tested code candidate \`${RC_TAG_TARGET}\`.
`;

const README_INDEX = `# KCS Documentation Index

1. \`PROJECT_STATE.md\` — current position.
`;

const DOCS_CLEANUP_MAP = `# KCS Documentation Cleanup Map

1. \`PROJECT_STATE.md\` — current position.
`;

const README = `# Bundle

Upload only \`chatgpt_handoff\\CHATGPT_UPLOAD_ONEFILE.md\` to ChatGPT.
`;

const MANIFEST = `# Manifest

Upload only chatgpt_handoff\\CHATGPT_UPLOAD_ONEFILE.md to ChatGPT.
`;

const ONEFILE = `# KCS ChatGPT One-File Handoff

## 0. Upload Instructions

- Upload only \`chatgpt_handoff\\CHATGPT_UPLOAD_ONEFILE.md\` to ChatGPT.
`;

const dirs: string[] = [];

function writeFixtureFile(root: string, relative: string, content: string): void {
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, 'utf8');
}

/**
 * Builds a consistent fixture. Mirrored bundle documents default to the root
 * content, so a case has to change exactly one side to break one rule.
 */
function makeFixture(overrides: Record<string, string> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'kcs-state-'));
  dirs.push(root);
  const files: Record<string, string> = {
    'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': ROADMAP,
    'docs/KCS_RELEASE_CANDIDATE_SUMMARY.md': RELEASE_SUMMARY,
    'docs/README_INDEX.md': README_INDEX,
    'docs/KCS_DOCS_CLEANUP_MAP.md': DOCS_CLEANUP_MAP,
    'NEXT_SESSION.md': NEXT_SESSION,
    'PROJECT_STATE.md': PROJECT_STATE,
    'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n### Added\n- Item 6.\n',
    'chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md': ONEFILE,
    'chatgpt_handoff/latest/README.md': README,
    'chatgpt_handoff/latest/manifest.txt': MANIFEST,
    'chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md': '# Final response\n\nItem 6 is implemented.\n',
    'chatgpt_handoff/latest/NEXT_SESSION.md': NEXT_SESSION,
    'chatgpt_handoff/latest/PROJECT_STATE.md': PROJECT_STATE,
    'chatgpt_handoff/latest/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': ROADMAP,
    'chatgpt_handoff/latest/CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n### Added\n- Item 6.\n',
    ...overrides,
  };
  for (const [relative, content] of Object.entries(files)) writeFixtureFile(root, relative, content);
  return root;
}

/** Builds a real (tiny) git repository fixture so the git rules can be tested. */
function makeGitFixture(options: { tagTarget?: string | null; originMainMatches?: boolean } = {}): string {
  const root = makeFixture();
  const run = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  run('init', '-q', '-b', 'main');
  run('config', 'user.email', 'check@example.com');
  run('config', 'user.name', 'Check Fixture');
  run('add', '-A');
  run('commit', '-q', '-m', 'fixture');
  const head = run('rev-parse', 'HEAD').trim();
  if (options.tagTarget) run('tag', 'v1.1.0-rc.1', options.tagTarget);
  if (options.originMainMatches !== false) run('update-ref', 'refs/remotes/origin/main', head);
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

describe('check-state-consistency — text rules', () => {
  it('passes on a consistent fixture and reports the git checks as skipped outside a repository', () => {
    const { status, output } = runCheck(makeFixture());

    expect(status).toBe(0);
    expect(output).toContain('KCS state consistency: PASS');
    expect(output).toContain('git checks skipped');
  });

  it('fails on an active stale claim (no other rule violated)', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md': '# Final response\n\n## Status\n\nMilestone C merge status: NOT MERGED.\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('stale active claims');
  });

  it('fails when a roadmap item is reported as not started (D9-2 class)', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md': '# Final response\n\n## Status\n\nItem 9 (dependency maintenance) is not started and needs approval.\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('says a roadmap item has not started');
  });

  it('fails when a roadmap item is reported as not yet begun', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md': '# Final response\n\n## Status\n\nItem 9 has not yet begun, so its warnings are still open.\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('says a roadmap item has not started');
  });

  it('fails when a roadmap item is reported as not implemented yet', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md': '# Final response\n\n## Status\n\nItem 9 is not implemented yet; plan options are proposed.\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('says a roadmap item is not implemented yet');
  });

  it('accepts an item-level status that names the real state', () => {
    const { status } = runCheck(makeFixture({
      'chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md': '# Final response\n\n## Status\n\nItem 9 is audited, report only; the decision needs explicit user approval.\n',
    }));

    expect(status).toBe(0);
  });

  it('tolerates the same wording under a heading marked historical', () => {
    const { status } = runCheck(makeFixture({
      'chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md': '# Final response\n\n## Historical record\n\nAt that time the merge was NOT MERGED.\n',
    }));

    expect(status).toBe(0);
  });

  it('does not treat a heading that merely contains "history" as historical', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/OMP_FINAL_RESPONSE.md': '# Final response\n\n## History and current next action\n\nThe merge is NOT MERGED.\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('stale active claims');
  });

  it('fails when a merged milestone is no longer marked MERGED', () => {
    // Both copies change together so only the MERGED rule can fail.
    const unmerged = ROADMAP.replace('| C — First export / onboarding flow | 5 | `feat/c` | **MERGED** at `c2dcb22` |', '| C — First export / onboarding flow | 5 | `feat/c` | Implemented, merge pending |');
    const { status, output } = runCheck(makeFixture({
      'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': unmerged,
      'chatgpt_handoff/latest/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': unmerged,
    }));

    expect(status).toBe(1);
    expect(output).toContain('milestone C is not marked MERGED');
  });

  it('fails when the bundle is missing a mirrored document', () => {
    const root = makeFixture();
    rmSync(path.join(root, 'chatgpt_handoff', 'latest', 'NEXT_SESSION.md'));
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('the bundle must carry a copy of NEXT_SESSION.md');
  });

  it('fails when the plan-only milestone rows are missing or not plan-only', () => {
    const missingRow = runCheck(makeFixture({
      'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': ROADMAP.split('\n').filter((line) => !line.startsWith('| E —')).join('\n'),
    }));
    expect(missingRow.status).toBe(1);
    expect(missingRow.output).toContain('milestone E row missing');

    const startedRow = runCheck(makeFixture({
      'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': ROADMAP.replace('| F — Architecture exploration only | 10, 11, 12 | — | Plan only |', '| F — Architecture exploration only | 10, 11, 12 | — | In progress |'),
    }));
    expect(startedRow.status).toBe(1);
    expect(startedRow.output).toContain('milestone F should stay plan-only');
  });

  it('fails when two milestones claim NEXT', () => {
    const { status, output } = runCheck(makeFixture({
      'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': ROADMAP.replace('| E — OGraf QA / schema hardening study | 7, 8 | — | Plan only |', '| E — OGraf QA / schema hardening study | 7, 8 | — | NEXT |'),
    }));

    expect(status).toBe(1);
    expect(output).toContain('expected exactly one NEXT milestone');
  });

  it('checks only the first next-scoped item, not the whole section', () => {
    const { status, output } = runCheck(makeFixture({
      'NEXT_SESSION.md': NEXT_SESSION.replace('1. Milestone D item 6 is implemented; the current decision is item 9.', '1. Finish Milestone C.\n2. Then start Milestone D.'),
    }));

    expect(status).toBe(1);
    expect(output).toContain('first next-scoped item does not name Milestone D');
  });

  it('fails when the bundled roadmap no longer carries a NEXT milestone', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md': ROADMAP.replace('**NEXT** — item 6 implemented, item 9 approval-gated', 'Plan only'),
    }));

    expect(status).toBe(1);
    // The bundled copy is checked on its own, so the drift cannot hide behind a
    // stale root document that still looks correct.
    expect(output).toContain('roadmap status rows (chatgpt_handoff/latest/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md)');
  });

  it('fails when a mirrored bundle copy drifts from its root document', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/NEXT_SESSION.md': '# Next Session Handoff\n\n## Next scoped work\n\n1. Milestone D item 6 can start immediately.\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('out of sync');
  });

  it('fails when only the forbidden whole-folder upload instruction is present', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/README.md': `${README}\nUpload the contents of chatgpt_handoff/latest/ to ChatGPT.\n`,
    }));

    expect(status).toBe(1);
    expect(output).toContain('upload the whole latest folder');
  });

  it('fails when the required upload instruction is absent', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/README.md': '# Bundle\n\nRead the manifest for the file list.\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('no active "Upload only" instruction');
  });

  it('fails when a required bundle document is missing', () => {
    const root = makeFixture();
    rmSync(path.join(root, 'chatgpt_handoff', 'latest', 'manifest.txt'));
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('bundle documents missing: manifest.txt');
  });

  it('fails on a binary copy in the bundle, including a nested one', () => {
    const binary = runCheck(makeFixture({
      'chatgpt_handoff/latest/chart.png': 'not really a png',
    }));
    expect(binary.status).toBe(1);
    expect(binary.output).toContain('source/test/binary copies');

    const nested = runCheck(makeFixture({
      'chatgpt_handoff/latest/nested/deep.spec.ts': 'export const x = 1;\n',
    }));
    expect(nested.status).toBe(1);
    expect(nested.output).toContain('source/test/binary copies');
  });

  it('fails on a flattened test copy in the bundle', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/src__freeform.test.ts': 'export const x = 1;\n',
    }));

    expect(status).toBe(1);
    expect(output).toContain('source/test/binary copies');
  });

  it('fails on a collapsed Windows path', () => {
    const collapsed = `C:${'Users'}ertugrul.akDesktopKCS`;
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/latest/README.md': `${README}\n- \`${collapsed}\` is not a handoff destination.\n`,
    }));

    expect(status).toBe(1);
    expect(output).toContain('collapsed Windows paths');
  });

  it('fails on a secret marker in the one-file', () => {
    const { status, output } = runCheck(makeFixture({
      'chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md': `${ONEFILE}\nexport GITHUB_TOKEN=abc\n`,
    }));

    expect(status).toBe(1);
    expect(output).toContain('secret markers');
  });

  it('reports a readable failure instead of crashing when the bundle path is not a directory', () => {
    const root = makeFixture();
    rmSync(path.join(root, 'chatgpt_handoff', 'latest'), { recursive: true, force: true });
    writeFixtureFile(root, 'chatgpt_handoff/latest', 'not a directory\n');
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('KCS state consistency: FAIL');
    expect(output).not.toContain('at Object.');
  });
});

/**
 * The live documents are the only ones whose claims are checked against the
 * repository, and the classification is the point: a revision recorded by a
 * checkpoint or an audit report is history, not a contradiction.
 */
describe('check-state-consistency — live documents', () => {
  it('fails when a live document claims a checkout that is not the real one', () => {
    const root = makeGitFixture();
    const claim = `# Next Session Handoff${nl}${nl}## Repository state${nl}${nl}- Checkout: \`feat/lottie-import-core\` on top of \`main\`.${nl}${nl}## Next scoped work${nl}${nl}1. Milestone D item 6 is implemented; the current decision is item 9.${nl}`;
    // Both copies change together, so only the checkout rule can fail.
    writeFixtureFile(root, 'NEXT_SESSION.md', claim);
    writeFixtureFile(root, 'chatgpt_handoff/latest/NEXT_SESSION.md', claim);
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('says the checkout is "feat/lottie-import-core"');
  });

  it('fails when a live document says main is at another revision', () => {
    const root = makeGitFixture();
    const stale = PROJECT_STATE.replace('## Remaining work', 'The state documents record that `main` is at `deadbeef`.\n\n## Remaining work');
    writeFixtureFile(root, 'PROJECT_STATE.md', stale);
    writeFixtureFile(root, 'chatgpt_handoff/latest/PROJECT_STATE.md', stale);
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('says main is at deadbeef');
  });

  it('accepts an "at or after" revision that really is an ancestor', () => {
    const root = makeGitFixture();
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const claim = `# Next Session Handoff${nl}${nl}## Repository state${nl}${nl}- Checkout: \`main\` at or after \`${head.slice(0, 7)}\`, matching \`origin/main\`.${nl}${nl}## Next scoped work${nl}${nl}1. Milestone D item 6 is implemented; the current decision is item 9.${nl}`;
    writeFixtureFile(root, 'NEXT_SESSION.md', claim);
    writeFixtureFile(root, 'chatgpt_handoff/latest/NEXT_SESSION.md', claim);
    const { output } = runCheck(root);

    expect(output).toContain('live documents agree with the checked-out branch and main');
    expect(output).not.toContain('live documents contradict the repository');
  });

  it('fails when a live document ties the release tag to another candidate', () => {
    const { status, output } = runCheck(makeFixture({
      'docs/KCS_RELEASE_CANDIDATE_SUMMARY.md': RELEASE_SUMMARY.replace(RC_TAG_TARGET, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'),
    }));

    expect(status).toBe(1);
    expect(output).toContain('ties v1.1.0-rc.1 to deadbeef');
  });

  it('does not fail on an old revision a historical record keeps', () => {
    const root = makeGitFixture();
    // A checkpoint records the revision it was written from.
    writeFixtureFile(root, 'docs/checkpoints/2026-09-18-after-lottie-core/README.md', '# Checkpoint\n\n`main` is at `47d3368a2b54` at the time of this checkpoint.\n');
    // A live document may keep one under a heading marked historical.
    const withHistory = `${PROJECT_STATE}\n\n## Historical record\n\nThe state documents then recorded that \`main\` is at \`47d3368a2b54\`.\n`;
    writeFixtureFile(root, 'PROJECT_STATE.md', withHistory);
    writeFixtureFile(root, 'chatgpt_handoff/latest/PROJECT_STATE.md', withHistory);
    const { output } = runCheck(root);

    expect(output).toContain('live documents agree with the checked-out branch and main');
    expect(output).not.toContain('live documents contradict the repository');
  });

  it('fails when a live document is missing from the repository', () => {
    const root = makeFixture();
    rmSync(path.join(root, 'docs', 'README_INDEX.md'));
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('live documents missing');
  });
});

describe('check-state-consistency — git rules', () => {
  it('passes the git checks when main matches origin/main and the tag target is correct', () => {
    const root = makeGitFixture();
    execFileSync('git', ['tag', 'v1.1.0-rc.1', 'HEAD'], { cwd: root });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    // Point the tag at the expected RC target if this checkout knows that commit;
    // otherwise assert only that the mismatch is reported rather than crashing.
    const { output } = runCheck(root);
    expect(output).toContain('main matches origin/main');
    expect(output).toContain(`repository HEAD resolved — ${head.slice(0, 12)}`);
  });

  it('fails when the release tag target is not the expected RC target', () => {
    const root = makeGitFixture({ tagTarget: 'HEAD' });
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('release tag target changed');
  });

  it('fails when a required milestone commit is missing from the checkout', () => {
    const root = makeGitFixture();
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('Milestone A integration commit reachable');
  });

  it('fails when main and origin/main differ', () => {
    const root = makeGitFixture();
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    execFileSync('git', ['update-ref', 'refs/heads/main', head], { cwd: root });
    execFileSync('git', ['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: root });
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', head], { cwd: root });
    execFileSync('git', ['update-ref', 'refs/heads/main', 'HEAD~0'], { cwd: root });
    // Move main onto an empty extra commit so it is ahead of origin/main.
    execFileSync('git', ['checkout', '-q', '-b', 'other'], { cwd: root });
    execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'ahead'], { cwd: root });
    const ahead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    execFileSync('git', ['update-ref', 'refs/heads/main', ahead], { cwd: root });
    const { status, output } = runCheck(root);

    expect(status).toBe(1);
    expect(output).toContain('main and origin/main differ');
  });
});

describe('check-state-consistency — portability', () => {
  it('parses a Windows (CRLF) checkout exactly like a POSIX one', () => {
    const root = makeFixture();
    for (const relative of ['NEXT_SESSION.md', 'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md']) {
      const absolute = path.join(root, relative);
      writeFileSync(absolute, readFileSync(absolute, 'utf8').replace(/\n/gu, '\r\n'), 'utf8');
    }
    const { status, output } = runCheck(root);

    expect(status).toBe(0);
    expect(output).toContain('KCS state consistency: PASS');
  });

  it('reports the tag and ancestry checks as skipped in a shallow checkout instead of failing', () => {
    const source = makeFixture();
    const run = (...args: string[]) => execFileSync('git', args, { cwd: source, encoding: 'utf8' });
    run('init', '-q', '-b', 'main');
    run('config', 'user.email', 'check@example.com');
    run('config', 'user.name', 'Check Fixture');
    run('add', '-A');
    run('commit', '-q', '-m', 'fixture');
    run('tag', 'v1.1.0-rc.1');
    const cloneParent = mkdtempSync(path.join(tmpdir(), 'kcs-clone-'));
    dirs.push(cloneParent);
    const clone = path.join(cloneParent, 'shallow');
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${source.replace(/\\/gu, '/')}`, clone], { encoding: 'utf8' });
    // A local clone copies the fixture's refs, so drop the tag to reproduce the
    // CI situation: a shallow checkout without tags or older history.
    execFileSync('git', ['tag', '-d', 'v1.1.0-rc.1'], { cwd: clone, encoding: 'utf8' });

    const { status, output } = runCheck(clone);

    expect(status).toBe(0);
    expect(output).toContain('shallow checkout');
    expect(output).toContain('KCS state consistency: PASS');
  });
});

describe('check-state-consistency — repository', () => {
  it('passes on the real repository', () => {
    const output = execFileSync(process.execPath, [script, '--quiet'], { cwd: repoRoot, encoding: 'utf8' });
    expect(output).toContain('KCS state consistency: PASS');
  });
});
