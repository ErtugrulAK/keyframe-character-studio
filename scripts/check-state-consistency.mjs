#!/usr/bin/env node
/**
 * KCS state consistency check (roadmap Milestone D, item 6).
 *
 * Catches the class of failure this project hit repeatedly: live/current-state
 * documents drifting away from the actual repository state — docs that still say
 * "not merged" after the merge, stale next actions, a handoff bundle that points
 * at the wrong upload artifact, a changed tag target, a missing milestone commit,
 * source/test copies inside the handoff bundle, or collapsed Windows paths.
 *
 * Node built-ins only. No network, no dependency, no mutation: the script reads
 * git facts and files and prints a report. Exit code 0 on PASS, 1 on FAIL.
 *
 *   node scripts/check-state-consistency.mjs [--root <dir>] [--quiet]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Expected release state. Update only with an explicit release decision. */
const EXPECTED_RC_TAG = 'v1.1.0-rc.1';
const EXPECTED_RC_TAG_TARGET = '46d2a3e59e065816d972dcd56951803951b577f6';

/** Milestone commits that must be ancestors of the checked revision. */
const REQUIRED_MILESTONE_COMMITS = [
  { label: 'Milestone A integration', sha: '077911b469bf7026364c0335e748114bf8df05c0' },
  { label: 'Milestone B integration', sha: '96e8f9d0313cb81752c04fe58d6e7d00d700a6f4' },
  { label: 'Milestone C integration', sha: 'c2dcb22352f1f4ad9102624309a0d92cf206046b' },
];

/** Milestones the roadmap must show as merged once their integration commit is in. */
const MERGED_MILESTONES = ['A', 'B', 'C'];

const ROADMAP = 'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md';
const NEXT_SESSION = 'NEXT_SESSION.md';
const PROJECT_STATE = 'PROJECT_STATE.md';
const ONEFILE = 'chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md';
const LATEST_DIR = 'chatgpt_handoff/latest';

/** Documents that must not carry active stale claims: the root state documents,
 * the one-file artifact and every document in the handoff bundle — a stale claim
 * inside a bundled copy is exactly the drift this check exists to catch.
 * A match is tolerated when it sits under a heading marked as historical. */
const currentStateDocuments = (root) => [
  ROADMAP,
  NEXT_SESSION,
  PROJECT_STATE,
  ONEFILE,
  ...listBundleFiles(root).map((name) => `${LATEST_DIR}/${name}`),
];

/**
 * Stale phrasing that must not appear as current state. Each entry is reported
 * with the remediation the reader needs.
 */
const STALE_ACTIVE_PATTERNS = [
  { pattern: /NOT MERGED/u, reason: 'says a milestone is not merged; update the status or mark the section historical' },
  { pattern: /awaiting the user'?s decision/u, reason: 'says a decision is still pending; update the next action' },
  { pattern: /awaiting (?:the review gate and a )?(?:review gate and )?merge/u, reason: 'says a merge is still pending' },
  { pattern: /implemented on `feat\/export-onboarding`, awaiting/u, reason: 'stale Milestone C pre-merge status' },
  { pattern: /plan-only, not started/u, reason: 'stale "not started" status for a started/merged milestone' },
  { pattern: /milestones B–F are unchanged/u, reason: 'stale roadmap intro phrase that contradicted its own table' },
];

/** The upload instruction the handoff must carry. */
const UPLOAD_REQUIRED = 'Upload only';
const UPLOAD_TARGET = 'chatgpt_handoff\\CHATGPT_UPLOAD_ONEFILE.md';
const UPLOAD_FORBIDDEN = [/Upload the contents of chatgpt_handoff\/latest/u, /Upload contents of chatgpt_handoff\/latest/u];

/** Handoff hygiene. */
const FORBIDDEN_BUNDLE_NAME = [/^src__/iu, /\.(?:test|spec)\.(?:c|m)?[jt]sx?$/iu, /\.(?:zip|png|jpg|jpeg|webp|gif|svg|ico|pdf)$/iu];
const MALFORMED_PATH_PATTERNS = [
  { pattern: /C:Users/u, label: 'collapsed "C:Users" path' },
  { pattern: /DesktopKCS/u, label: 'collapsed "DesktopKCS" path' },
  { pattern: /Desktopograf/u, label: 'collapsed "Desktopograf" path' },
];
const SECRET_PATTERNS = [
  { pattern: /OPENAI_API_KEY/u, label: 'OPENAI_API_KEY' },
  { pattern: /ANTHROPIC_API_KEY/u, label: 'ANTHROPIC_API_KEY' },
  { pattern: /GITHUB_TOKEN/u, label: 'GITHUB_TOKEN' },
  { pattern: /ghp_[A-Za-z0-9]{20,}/u, label: 'GitHub personal access token' },
  { pattern: /sk-[A-Za-z0-9]{20,}/u, label: 'API key literal' },
  { pattern: /BEGIN [A-Z ]*PRIVATE KEY/u, label: 'private key block' },
  { pattern: /PASSWORD=/u, label: 'PASSWORD=' },
  { pattern: /SECRET=/u, label: 'SECRET=' },
  { pattern: /TOKEN=/u, label: 'TOKEN=' },
];

const HEADING = /^#{2,4} /u;
const HISTORICAL_MARKER = /historical|history|superseded/u;

const results = [];
let quiet = false;

const record = (ok, title, detail) => {
  results.push({ ok, title, detail });
  if (!quiet) console.log(`${ok ? 'PASS' : 'FAIL'}  ${title}${detail ? ` — ${detail}` : ''}`);
};

const fail = (title, detail) => record(false, title, detail);
const pass = (title, detail) => record(true, title, detail);

function git(args, root) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function isGitRepo(root) {
  return git(['rev-parse', '--git-dir'], root) !== null;
}

function readText(root, relative) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return null;
  return readFileSync(absolute, 'utf8');
}

function listBundleFiles(root) {
  const absolute = path.join(root, LATEST_DIR);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).filter((name) => statSync(path.join(absolute, name)).isFile());
}

/** True when the matched line lives under a heading marked as historical. */
function insideHistoricalSection(lines, lineIndex) {
  for (let index = lineIndex; index >= 0; index -= 1) {
    if (HEADING.test(lines[index])) return HISTORICAL_MARKER.test(lines[index]);
  }
  return false;
}

function checkStaleActivePhrases(root) {
  const files = currentStateDocuments(root);
  const violations = [];
  for (const relative of files) {
    const text = readText(root, relative);
    if (text === null) {
      fail(`${relative} exists`, 'file not found');
      continue;
    }
    const lines = text.split(/\r?\n/u);
    lines.forEach((line, index) => {
      for (const { pattern, reason } of STALE_ACTIVE_PATTERNS) {
        if (!pattern.test(line)) continue;
        if (insideHistoricalSection(lines, index)) continue;
        violations.push(`${relative}:${index + 1} ${reason} → "${line.trim().slice(0, 120)}"`);
      }
    });
  }
  if (violations.length === 0) pass('current-state documents carry no stale active claims');
  else fail('current-state documents carry stale active claims', violations.join(' | '));
}

function checkRoadmapStatus(root) {
  const text = readText(root, ROADMAP);
  if (text === null) {
    fail('roadmap status', `${ROADMAP} not found`);
    return;
  }
  const rows = new Map();
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\|\s*([A-F])\s—[^|]*\|[^|]*\|[^|]*\|\s*(.+?)\s*\|$/u.exec(line);
    if (match) rows.set(match[1], match[2]);
  }
  const problems = [];
  for (const letter of MERGED_MILESTONES) {
    const status = rows.get(letter);
    if (!status) problems.push(`milestone ${letter} row missing`);
    else if (!/MERGED/u.test(status)) problems.push(`milestone ${letter} is not marked MERGED ("${status.slice(0, 80)}")`);
  }
  const nextLetters = [...rows.entries()].filter(([, status]) => /NEXT/u.test(status)).map(([letter]) => letter);
  if (nextLetters.length !== 1) problems.push(`expected exactly one NEXT milestone, found ${nextLetters.length ? nextLetters.join(', ') : 'none'}`);
  for (const letter of ['E', 'F']) {
    const status = rows.get(letter);
    if (status && !/plan[- ]only/iu.test(status)) problems.push(`milestone ${letter} should stay plan-only ("${status.slice(0, 60)}")`);
  }
  if (problems.length === 0) pass('roadmap status rows', `A/B/C merged, ${nextLetters[0]} next, E/F plan-only`);
  else fail('roadmap status rows', problems.join(' | '));
  return nextLetters[0] ?? null;
}

function checkNextAction(root, nextMilestone) {
  const text = readText(root, NEXT_SESSION);
  if (text === null) {
    fail('next action', `${NEXT_SESSION} not found`);
    return;
  }
  const nextWorkBlock = /## Next scoped work\n([\s\S]*?)(?:\n## |$)/u.exec(text)?.[1] ?? '';
  if (!nextWorkBlock.trim()) {
    fail('next action', 'NEXT_SESSION.md has no "Next scoped work" section');
    return;
  }
  if (!nextMilestone) {
    pass('next action', 'roadmap NEXT milestone unknown; skipped the cross-check');
    return;
  }
  if (nextWorkBlock.includes(`Milestone ${nextMilestone}`)) pass('next action matches the roadmap NEXT milestone', `Milestone ${nextMilestone}`);
  else fail('next action does not match the roadmap NEXT milestone', `expected "Milestone ${nextMilestone}" in the first next-scoped-work block`);
}

function checkUploadInstruction(root) {
  const files = [ONEFILE, `${LATEST_DIR}/README.md`, `${LATEST_DIR}/manifest.txt`, `${LATEST_DIR}/OMP_FINAL_RESPONSE.md`];
  const problems = [];
  for (const relative of files) {
    const text = readText(root, relative);
    if (text === null) continue;
    const lines = text.split(/\r?\n/u);
    lines.forEach((line, index) => {
      if (insideHistoricalSection(lines, index)) return;
      if (UPLOAD_FORBIDDEN.some((pattern) => pattern.test(line))) problems.push(`${relative}:${index + 1} tells the reader to upload the whole latest folder`);
    });
    if (!text.includes(UPLOAD_REQUIRED) && relative !== `${LATEST_DIR}/OMP_FINAL_RESPONSE.md`) {
      problems.push(`${relative} has no "${UPLOAD_REQUIRED}" instruction`);
    }
  }
  const onefile = readText(root, ONEFILE);
  if (onefile !== null && !onefile.includes(UPLOAD_TARGET)) problems.push(`${ONEFILE} does not name ${UPLOAD_TARGET}`);
  if (problems.length === 0) pass('handoff upload instruction points at the one-file artifact');
  else fail('handoff upload instruction', problems.join(' | '));
}

function checkBundleHygiene(root) {
  const names = listBundleFiles(root);
  if (names.length === 0) {
    fail('handoff bundle exists', `${LATEST_DIR} is missing or empty`);
    return;
  }
  const offending = names.filter((name) => FORBIDDEN_BUNDLE_NAME.some((pattern) => pattern.test(name)));
  if (offending.length === 0) pass('handoff bundle carries no source/test/binary copies', `${names.length} documents`);
  else fail('handoff bundle carries source/test/binary copies', offending.join(', '));
}

function scanText(root, relative, patterns, title) {
  const text = readText(root, relative);
  if (text === null) return;
  const hits = [];
  text.split(/\r?\n/u).forEach((line, index) => {
    for (const { pattern, label } of patterns) {
      if (pattern.test(line)) hits.push(`${relative}:${index + 1} ${label}`);
    }
  });
  if (hits.length === 0) pass(title);
  else fail(title, hits.join(' | '));
}

function checkGitFacts(root) {
  if (!isGitRepo(root)) {
    pass('git checks skipped', 'the checked root is not a git repository (fixture mode)');
    return;
  }
  const head = git(['rev-parse', 'HEAD'], root);
  const originMain = git(['rev-parse', 'origin/main'], root);
  if (head) pass('repository HEAD resolved', head);
  else fail('repository HEAD resolved', 'git rev-parse HEAD failed');

  if (originMain) {
    if (head === originMain) pass('main matches origin/main');
    else {
      const behind = git(['merge-base', '--is-ancestor', head, originMain], root) === null;
      fail('main and origin/main differ', `${head.slice(0, 12)} vs ${originMain.slice(0, 12)}${behind ? ' (local is behind)' : ''}`);
    }
  } else {
    pass('origin/main check skipped', 'no origin/main ref in this checkout');
  }

  const tagTarget = git(['rev-parse', `${EXPECTED_RC_TAG}^{commit}`], root);
  if (!tagTarget) fail('release tag present', `${EXPECTED_RC_TAG} not found`);
  else if (tagTarget === EXPECTED_RC_TAG_TARGET) pass('release tag target unchanged', EXPECTED_RC_TAG_TARGET);
  else fail('release tag target changed', `${EXPECTED_RC_TAG} points at ${tagTarget}, expected ${EXPECTED_RC_TAG_TARGET}`);

  for (const { label, sha } of REQUIRED_MILESTONE_COMMITS) {
    const exists = git(['cat-file', '-e', `${sha}^{commit}`], root) !== null || git(['rev-parse', `${sha}^{commit}`], root) !== null;
    if (!exists) {
      fail(`${label} commit reachable`, `${sha.slice(0, 12)} not found in this checkout`);
      continue;
    }
    const ancestor = git(['merge-base', '--is-ancestor', sha, 'HEAD'], root) !== null;
    if (ancestor) pass(`${label} commit is an ancestor of HEAD`, sha.slice(0, 12));
    else fail(`${label} commit is not an ancestor of HEAD`, sha);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex >= 0 && argv[rootIndex + 1]
    ? path.resolve(argv[rootIndex + 1])
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  quiet = argv.includes('--quiet');

  if (!quiet) {
    console.log('KCS state consistency check');
    console.log(`root: ${root}`);
    console.log('');
  }

  checkGitFacts(root);
  const nextMilestone = checkRoadmapStatus(root);
  checkNextAction(root, nextMilestone);
  checkStaleActivePhrases(root);
  checkUploadInstruction(root);
  checkBundleHygiene(root);
  for (const name of listBundleFiles(root)) {
    scanText(root, `${LATEST_DIR}/${name}`, MALFORMED_PATH_PATTERNS, `no collapsed Windows paths in ${name}`);
  }
  scanText(root, ONEFILE, MALFORMED_PATH_PATTERNS, 'no collapsed Windows paths in the one-file');
  for (const name of listBundleFiles(root)) {
    scanText(root, `${LATEST_DIR}/${name}`, SECRET_PATTERNS, `no secret markers in ${name}`);
  }
  scanText(root, ONEFILE, SECRET_PATTERNS, 'no secret markers in the one-file');

  const failures = results.filter((entry) => !entry.ok);
  if (!quiet) console.log('');
  if (failures.length === 0) {
    console.log(`KCS state consistency: PASS (${results.length} checks)`);
    process.exit(0);
  }
  console.log(`KCS state consistency: FAIL (${failures.length} of ${results.length} checks)`);
  for (const entry of failures) console.log(` - ${entry.title}: ${entry.detail}`);
  process.exit(1);
}

main();
