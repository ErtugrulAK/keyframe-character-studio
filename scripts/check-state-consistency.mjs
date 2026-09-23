#!/usr/bin/env node
/**
 * KCS state consistency check (roadmap Milestone D, item 6).
 *
 * Catches the class of failure this project hit repeatedly: live/current-state
 * documents drifting away from the actual repository state — docs that still say
 * "not merged" after the merge, a next action that points at finished work, a
 * handoff bundle that still carries the previous milestone's status or the wrong
 * upload artifact, a changed tag target, a missing milestone commit, source/test
 * copies inside the handoff bundle, or collapsed Windows paths.
 *
 * Node built-ins only. No network, no dependency, no repo mutation: the script
 * reads git facts and files and prints a report. Exit code 0 on PASS, 1 on FAIL.
 *
 *   node scripts/check-state-consistency.mjs [--root <dir>] [--quiet]
 *
 * `--root` points the check at a fixture directory (used by the focused tests).
 * Git-dependent checks report themselves as skipped when that root is not a
 * repository, so the text rules stay testable without a repository.
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
/** Milestones that must exist and stay plan-only until their own task starts. */
const PLAN_ONLY_MILESTONES = ['E', 'F'];

const ROADMAP = 'docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md';
const NEXT_SESSION = 'NEXT_SESSION.md';
const PROJECT_STATE = 'PROJECT_STATE.md';
const RELEASE_SUMMARY = 'docs/KCS_RELEASE_CANDIDATE_SUMMARY.md';
const README_INDEX = 'docs/README_INDEX.md';
const DOCS_CLEANUP_MAP = 'docs/KCS_DOCS_CLEANUP_MAP.md';

/**
 * The documents that describe the **current** state — the only ones whose claims
 * are checked against the repository.
 *
 * Everything else is a record: `reports/` is the audit trail, `docs/checkpoints/`
 * holds point-in-time snapshots, `docs/design/` and `docs/research/` hold studies,
 * and the closed-programme documents (`SESSION.md`, `docs/KCS_CURRENT_STATE.md`,
 * `docs/KCS_OPEN_TASKS.md`, `docs/KCS_BRANCH_STATUS.md`,
 * `docs/KCS_BRANCH_CONSOLIDATION_PLAN.md`) are marked historical records. An old
 * revision, branch or task claim in any of those is history, not a contradiction,
 * and must not fail this check.
 *
 * Adding a document here is how it becomes checked; the list is the authority, so
 * a rename cannot silently drop coverage (see `checkLiveDocuments`).
 */
const LIVE_DOCUMENTS = [
  PROJECT_STATE,
  NEXT_SESSION,
  ROADMAP,
  RELEASE_SUMMARY,
  README_INDEX,
  DOCS_CLEANUP_MAP,
];

/**
 * A claim about the checked-out branch: the first backticked token on a labelled
 * line. Later tokens on the same line are other branches, not the checkout.
 */
const BRANCH_CLAIM = /^[-*\s]*(?:Checkout|Current branch)\s*:\s*`([^`]+)`/iu;
/**
 * A claim about the revision `main` is at, in the two forms the documents use:
 * "`main` is at `<sha>`" (that revision) and "`main` at or after `<sha>`" (an
 * ancestor). A past merge — "merged into `main` at `<sha>`" — is history about
 * that merge and is deliberately not matched.
 */
const MAIN_AT_CLAIM = /`?main`?(?:\s*\/\s*`?origin\/main`?)?\s+is\s+at\s+`?([0-9a-f]{7,40})/iu;
const MAIN_ANCESTOR_CLAIM = /`?main`?\s+at\s+or\s+after\s+`?([0-9a-f]{7,40})/iu;
/** A claim about which revision a release tag points at. */
const RELEASE_TAG_CLAIM = /tag target|v1\.1\.0-rc\.1/iu;
const HEX_TOKEN = /[0-9a-f]{7,40}/giu;
const ONEFILE = 'chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md';
const LATEST_DIR = 'chatgpt_handoff/latest';
/** Bundle documents that must exist for the handoff to be usable at all. */
const REQUIRED_BUNDLE_DOCS = ['README.md', 'manifest.txt', 'OMP_FINAL_RESPONSE.md'];

/**
 * Stale phrasing that must not appear as current state. Each entry carries the
 * remediation the reader needs.
 */
const STALE_ACTIVE_PATTERNS = [
  { pattern: /NOT MERGED/u, reason: 'says a milestone is not merged; update the status or mark the section historical' },
  { pattern: /awaiting the user'?s decision/u, reason: 'says a decision is still pending; update the next action' },
  { pattern: /awaiting (?:the review gate and a )?(?:review gate and )?merge/u, reason: 'says a merge is still pending' },
  { pattern: /implemented on `feat\/export-onboarding`, await/u, reason: 'stale Milestone C pre-merge status' },
  { pattern: /awaits the merge decision/u, reason: 'stale pending-merge claim' },
  { pattern: /plan-only, not started/u, reason: 'stale "not started" status for a started/merged milestone' },
  { pattern: /milestones B–F are unchanged/u, reason: 'stale roadmap intro phrase that contradicted its own table' },
  // Item-level status drift: a handoff that keeps a finished roadmap item open
  // (the class D9-2 recorded — "Item 9 … is not started" survived a PASS).
  { pattern: /item\s+\d+[^\n]{0,60}?(?:is|has|had|was)\s+not\s+(?:yet\s+)?(?:been\s+)?(?:started|begun|began)/iu, reason: 'says a roadmap item has not started; record its real state or mark the section historical' },
  { pattern: /item\s+\d+[^\n]{0,60}?not\s+implemented\s+yet/iu, reason: 'says a roadmap item is not implemented yet; record its real state or mark the section historical' },
];

/** The upload instruction the handoff must carry. */
const UPLOAD_REQUIRED = /Upload only/u;
const UPLOAD_TARGET = 'chatgpt_handoff\\CHATGPT_UPLOAD_ONEFILE.md';
const UPLOAD_FORBIDDEN = [
  /Upload the contents of/iu,
  /Upload contents of/iu,
  /Upload (?:all|every|the entire|everything in)\b[^\n]*latest/iu,
];

/** Handoff hygiene. */
const FORBIDDEN_BUNDLE_NAME = [
  /^src__/iu,
  /\.(?:test|spec)\.(?:c|m)?[jt]sx?$/iu,
  /\.(?:zip|png|jpg|jpeg|webp|gif|svg|ico|pdf|7z|rar)$/iu,
];
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

/** Any markdown heading, any level, so nested historical sections are honoured. */
const HEADING = /^(#{1,6}) /u;
/**
 * A section counts as historical only when its own heading says so. The word
 * "history" alone is deliberately NOT accepted: a heading like
 * "## History and current next action" still carries active state.
 */
const HISTORICAL_MARKER = /historical|superseded/iu;

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
  try {
    const absolute = path.join(root, relative);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) return null;
    // Line endings are normalised here so every parser sees the same text on a
    // Windows (CRLF) checkout and on a POSIX one.
    return readFileSync(absolute, 'utf8').replace(/\r\n/gu, '\n');
  } catch {
    return null;
  }
}

/** Every file inside the bundle, recursively, with bundle-relative names. */
function listBundleFiles(root) {
  const base = path.join(root, LATEST_DIR);
  if (!existsSync(base)) return [];
  try {
    if (!statSync(base).isDirectory()) return [];
  } catch {
    return [];
  }
  const found = [];
  const walk = (directory, prefix) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative);
      else if (entry.isFile()) found.push(relative);
    }
  };
  walk(base, '');
  return found.sort();
}

/** True when the matched line lives under a heading marked as historical. */
function insideHistoricalSection(lines, lineIndex) {
  for (let index = lineIndex; index >= 0; index -= 1) {
    const heading = HEADING.exec(lines[index]);
    if (heading) return HISTORICAL_MARKER.test(lines[index]);
  }
  return false;
}

/** Lines that are not part of a historical section, with their 1-based numbers. */
function activeLines(text) {
  const lines = text.split(/\r?\n/u);
  return lines
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ number }) => !insideHistoricalSection(lines, number - 1));
}

/** Every live document, plus the one-file plus every bundle document. */
function currentStateDocuments(root) {
  return [
    ...LIVE_DOCUMENTS,
    ONEFILE,
    ...listBundleFiles(root).map((name) => `${LATEST_DIR}/${name}`),
  ];
}

function checkStaleActivePhrases(root) {
  const violations = [];
  for (const relative of currentStateDocuments(root)) {
    const text = readText(root, relative);
    if (text === null) {
      fail(`${relative} exists`, 'file not found');
      continue;
    }
    for (const { line, number } of activeLines(text)) {
      for (const { pattern, reason } of STALE_ACTIVE_PATTERNS) {
        if (pattern.test(line)) violations.push(`${relative}:${number} ${reason} → "${line.trim().slice(0, 120)}"`);
      }
    }
  }
  if (violations.length === 0) pass('current-state documents carry no stale active claims');
  else fail('current-state documents carry stale active claims', violations.join(' | '));
}

/**
 * Reads the roadmap status table. Rows are `| X — title | items | branch | status |`,
 * where the title uses an em dash and the status cell carries the state words.
 */
function readRoadmapRows(text) {
  const rows = new Map();
  for (const { line } of activeLines(text)) {
    const match = /^\|\s*([A-H])\s—[^|]*\|[^|]*\|[^|]*\|\s*(.+?)\s*\|\s*$/u.exec(line);
    if (match) rows.set(match[1], match[2]);
  }
  return rows;
}

function checkRoadmapStatus(root, relative) {
  const text = readText(root, relative);
  if (text === null) {
    fail(`roadmap status (${relative})`, 'file not found');
    return null;
  }
  const rows = readRoadmapRows(text);
  const problems = [];
  for (const letter of MERGED_MILESTONES) {
    const status = rows.get(letter);
    if (!status) problems.push(`milestone ${letter} row missing`);
    else if (!/MERGED/u.test(status)) problems.push(`milestone ${letter} is not marked MERGED ("${status.slice(0, 80)}")`);
  }
  for (const letter of PLAN_ONLY_MILESTONES) {
    const status = rows.get(letter);
    if (!status) problems.push(`milestone ${letter} row missing`);
    else if (!/plan[- ]only/iu.test(status)) problems.push(`milestone ${letter} should stay plan-only ("${status.slice(0, 60)}")`);
  }
  const nextLetters = [...rows.entries()].filter(([, status]) => /NEXT/u.test(status)).map(([letter]) => letter);
  if (nextLetters.length !== 1) problems.push(`expected exactly one NEXT milestone, found ${nextLetters.length ? nextLetters.join(', ') : 'none'}`);
  if (problems.length === 0) pass(`roadmap status rows (${relative})`, `A/B/C merged, ${nextLetters[0]} next, E/F plan-only`);
  else fail(`roadmap status rows (${relative})`, problems.join(' | '));
  return nextLetters[0] ?? null;
}

/** The first numbered item of the "Next scoped work" section, if present. */
function firstNextScopedItem(text) {
  const block = /## Next scoped work\n([\s\S]*?)(?:\n## |$)/u.exec(text)?.[1];
  if (!block) return null;
  const match = /^\s*1\.\s+([\s\S]*?)(?=\n\s*\d+\.\s|\n*$)/mu.exec(block);
  return match ? match[1].replace(/\s+/gu, ' ').trim() : null;
}

function checkNextAction(root, nextMilestone) {
  const sources = [
    { relative: NEXT_SESSION, label: NEXT_SESSION },
    { relative: `${LATEST_DIR}/NEXT_SESSION.md`, label: `${LATEST_DIR}/NEXT_SESSION.md` },
  ];
  const problems = [];
  let checked = 0;
  for (const { relative, label } of sources) {
    const text = readText(root, relative);
    if (text === null) continue;
    const firstItem = firstNextScopedItem(text);
    if (!firstItem) {
      problems.push(`${label} has no "Next scoped work" first item`);
      continue;
    }
    checked += 1;
    if (!nextMilestone) continue;
    if (!firstItem.includes(`Milestone ${nextMilestone}`)) {
      problems.push(`${label} first next-scoped item does not name Milestone ${nextMilestone}: "${firstItem.slice(0, 100)}"`);
    }
  }
  if (checked === 0) {
    fail('next action', problems.length === 0
      ? 'no NEXT_SESSION.md to check'
      : 'no parseable first item in the "Next scoped work" section');
    return;
  }
  if (problems.length === 0) pass('next action matches the roadmap NEXT milestone', `Milestone ${nextMilestone} in ${checked} document(s)`);
  else fail('next action does not match the roadmap NEXT milestone', problems.join(' | '));
}

function checkUploadInstruction(root) {
  const problems = [];
  const missing = REQUIRED_BUNDLE_DOCS.filter((name) => readText(root, `${LATEST_DIR}/${name}`) === null);
  if (missing.length > 0) problems.push(`bundle documents missing: ${missing.join(', ')}`);

  for (const relative of [ONEFILE, ...REQUIRED_BUNDLE_DOCS.map((name) => `${LATEST_DIR}/${name}`)]) {
    const text = readText(root, relative);
    if (text === null) continue;
    for (const { line, number } of activeLines(text)) {
      if (UPLOAD_FORBIDDEN.some((pattern) => pattern.test(line))) {
        problems.push(`${relative}:${number} tells the reader to upload the whole latest folder`);
      }
    }
    const active = activeLines(text).map(({ line }) => line).join('\n');
    if (relative !== `${LATEST_DIR}/OMP_FINAL_RESPONSE.md` && !UPLOAD_REQUIRED.test(active)) {
      problems.push(`${relative} has no active "Upload only" instruction`);
    }
  }
  const onefile = readText(root, ONEFILE);
  if (onefile !== null && !activeLines(onefile).map(({ line }) => line).join('\n').includes(UPLOAD_TARGET)) {
    problems.push(`${ONEFILE} does not name ${UPLOAD_TARGET}`);
  }
  if (problems.length === 0) pass('handoff upload instruction points at the one-file artifact');
  else fail('handoff upload instruction', problems.join(' | '));
}

function checkBundleHygiene(root) {
  const names = listBundleFiles(root);
  if (names.length === 0) {
    fail('handoff bundle exists', `${LATEST_DIR} is missing, empty or not a directory`);
    return;
  }
  const offending = names.filter((name) => FORBIDDEN_BUNDLE_NAME.some((pattern) => pattern.test(path.basename(name))));
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
  // A shallow CI checkout (actions/checkout defaults to fetch-depth: 1) has no
  // tags and no older history, so those checks are reported as skipped instead
  // of failing on facts the checkout simply does not contain.
  const shallow = git(['rev-parse', '--is-shallow-repository'], root) === 'true';
  const head = git(['rev-parse', 'HEAD'], root);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  const mainRef = git(['rev-parse', 'main'], root);
  const originMain = git(['rev-parse', 'origin/main'], root);

  if (head) pass('repository HEAD resolved', `${head.slice(0, 12)}${branch ? ` on ${branch}` : ''}`);
  else fail('repository HEAD resolved', 'git rev-parse HEAD failed');

  // The state documents describe `main`, so `main` — not the checked-out HEAD —
  // is what has to match origin/main. Feature branches are legitimately ahead.
  if (mainRef && originMain) {
    if (mainRef === originMain) pass('main matches origin/main', mainRef.slice(0, 12));
    else {
      const aheadOfOrigin = git(['merge-base', '--is-ancestor', originMain, mainRef], root) !== null;
      fail(
        'main and origin/main differ',
        `${mainRef.slice(0, 12)} vs ${originMain.slice(0, 12)}${aheadOfOrigin ? ' (main is ahead; push it)' : ' (main is behind; pull it)'}`,
      );
    }
  } else {
    pass('main/origin comparison skipped', 'this checkout has no main or origin/main ref');
  }
  if (head && originMain && head !== originMain && mainRef) {
    const ahead = git(['rev-list', '--count', `${originMain}..${head}`], root);
    pass('checked-out branch position', `${branch ?? 'HEAD'} is ${ahead ?? '?'} commit(s) ahead of origin/main`);
  }

  const tagTarget = git(['rev-parse', `${EXPECTED_RC_TAG}^{commit}`], root);
  if (shallow && !tagTarget) {
    pass('release tag check skipped', 'shallow checkout: the tag is not fetched here');
  } else if (!tagTarget) fail('release tag present', `${EXPECTED_RC_TAG} not found`);
  else if (tagTarget === EXPECTED_RC_TAG_TARGET) pass('release tag target unchanged', EXPECTED_RC_TAG_TARGET);
  else fail('release tag target changed', `${EXPECTED_RC_TAG} points at ${tagTarget}, expected ${EXPECTED_RC_TAG_TARGET}`);

  for (const { label, sha } of REQUIRED_MILESTONE_COMMITS) {
    if (git(['rev-parse', `${sha}^{commit}`], root) === null) {
      if (shallow) pass(`${label} ancestry check skipped`, 'shallow checkout: the commit is not fetched here');
      else fail(`${label} commit reachable`, `${sha.slice(0, 12)} not found in this checkout`);
      continue;
    }
    if (git(['merge-base', '--is-ancestor', sha, 'HEAD'], root) !== null) {
      pass(`${label} commit is an ancestor of HEAD`, sha.slice(0, 12));
    } else {
      fail(`${label} commit is not an ancestor of HEAD`, sha);
    }
  }
}

/**
 * The bundle holds copies of the root state documents, so each copy must equal
 * its source byte-for-byte. This is the precise form of the drift this check
 * exists for: a bundled copy that still carries the previous milestone's status.
 */
const MIRRORED_DOCS = [
  { root: NEXT_SESSION, bundle: `${LATEST_DIR}/NEXT_SESSION.md` },
  { root: PROJECT_STATE, bundle: `${LATEST_DIR}/PROJECT_STATE.md` },
  { root: ROADMAP, bundle: `${LATEST_DIR}/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` },
  { root: 'CHANGELOG.md', bundle: `${LATEST_DIR}/CHANGELOG.md` },
];

function checkBundleMirrors(root) {
  const problems = [];
  let checked = 0;
  for (const { root: source, bundle } of MIRRORED_DOCS) {
    const sourceText = readText(root, source);
    const bundleText = readText(root, bundle);
    if (sourceText === null) {
      // The bundle must not keep a copy of a document the repository dropped.
      if (bundleText !== null) problems.push(`${bundle} has no source document ${source}`);
      else pass(`mirror skipped (${source})`, 'neither the root document nor its copy exists');
      continue;
    }
    checked += 1;
    if (bundleText === null) {
      problems.push(`${bundle} is missing: the bundle must carry a copy of ${source}`);
      continue;
    }
    const normalized = (value) => value.replace(/\r\n/gu, '\n').trim();
    if (normalized(sourceText) !== normalized(bundleText)) {
      problems.push(`${bundle} is out of sync with ${source} (re-copy it and rebuild the one-file)`);
    }
  }
  if (checked === 0) {
    pass('bundle mirrors checked', 'no mirrored documents present');
    return;
  }
  if (problems.length === 0) pass('bundle copies match their root documents', `${checked} mirrored document(s)`);
  else fail('bundle copies are out of sync with the root documents', problems.join(' | '));
}

/**
 * Every live document must exist: a rename that is not reflected here would
 * silently drop it from the checks instead of failing.
 */
function checkLiveDocuments(root) {
  const missing = LIVE_DOCUMENTS.filter((relative) => readText(root, relative) === null);
  if (missing.length === 0) pass('live documents present', `${LIVE_DOCUMENTS.length} document(s)`);
  else fail('live documents missing', `${missing.join(', ')} — add the new name to LIVE_DOCUMENTS`);
}

/**
 * The claims a live document makes about the repository itself: the branch that is
 * checked out and the revision `main` is at. Only these two need git facts, and
 * only the live documents are read, so a checkpoint or an audit report may keep
 * whatever revision it recorded.
 */
function checkLiveRevisionClaims(root) {
  if (!isGitRepo(root)) {
    pass('live revision claims skipped', 'the checked root is not a git repository (fixture mode)');
    return;
  }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  const mainRef = git(['rev-parse', 'main'], root);
  const problems = [];

  for (const relative of LIVE_DOCUMENTS) {
    const text = readText(root, relative);
    if (text === null) continue;
    for (const { line, number } of activeLines(text)) {
      const where = `${relative}:${number}`;

      // The checked-out branch: `main`, or whatever is really checked out.
      const checkout = BRANCH_CLAIM.exec(line);
      if (checkout) {
        const claimed = checkout[1].trim();
        if (claimed !== 'main' && claimed !== branch) {
          problems.push(`${where} says the checkout is "${claimed}"; HEAD is on "${branch ?? 'unknown'}"`);
        }
      }

      // The revision `main` is at. "at or after" is an ancestor claim.
      const atClaim = MAIN_AT_CLAIM.exec(line);
      if (atClaim && mainRef && !mainRef.toLowerCase().startsWith(atClaim[1].toLowerCase())) {
        problems.push(`${where} says main is at ${atClaim[1]}; main is ${mainRef.slice(0, 12)}`);
      }
      const ancestorClaim = MAIN_ANCESTOR_CLAIM.exec(line);
      if (ancestorClaim && mainRef && git(['merge-base', '--is-ancestor', ancestorClaim[1], mainRef], root) === null) {
        problems.push(`${where} says main is at or after ${ancestorClaim[1]}, which is not an ancestor of ${mainRef.slice(0, 12)}`);
      }
    }
  }

  if (problems.length === 0) pass('live documents agree with the checked-out branch and main');
  else fail('live documents contradict the repository', problems.join(' | '));
}

/**
 * The revision a live document says a release tag points at. This needs no git
 * facts: the expected target is the release decision itself, so a document that
 * moves the tag to another candidate is caught even in a fixture.
 */
function checkLiveReleaseClaims(root) {
  const problems = [];
  for (const relative of [...LIVE_DOCUMENTS, 'CHANGELOG.md']) {
    const text = readText(root, relative);
    if (text === null) continue;
    for (const { line, number } of activeLines(text)) {
      if (!RELEASE_TAG_CLAIM.test(line)) continue;
      for (const token of line.match(HEX_TOKEN) ?? []) {
        if (!EXPECTED_RC_TAG_TARGET.startsWith(token.toLowerCase())) {
          problems.push(`${relative}:${number} ties ${EXPECTED_RC_TAG} to ${token}; its target is ${EXPECTED_RC_TAG_TARGET.slice(0, 12)}`);
        }
      }
    }
  }
  if (problems.length === 0) pass('live documents agree with the release tag target');
  else fail('live documents tie the release tag to another revision', problems.join(' | '));
}

function runChecks(root) {
  checkGitFacts(root);
  checkLiveDocuments(root);
  checkLiveRevisionClaims(root);
  checkLiveReleaseClaims(root);
  const nextMilestone = checkRoadmapStatus(root, ROADMAP);
  if (readText(root, `${LATEST_DIR}/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`) !== null) {
    const bundleNext = checkRoadmapStatus(root, `${LATEST_DIR}/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`);
    if (nextMilestone && bundleNext && nextMilestone !== bundleNext) {
      fail('bundled roadmap agrees with the root roadmap', `bundle says ${bundleNext}, root says ${nextMilestone}`);
    } else if (nextMilestone && bundleNext) {
      pass('bundled roadmap agrees with the root roadmap', `next = ${nextMilestone}`);
    }
  }
  checkNextAction(root, nextMilestone);
  checkBundleMirrors(root);
  checkStaleActivePhrases(root);
  checkUploadInstruction(root);
  checkBundleHygiene(root);
  for (const name of listBundleFiles(root)) {
    scanText(root, `${LATEST_DIR}/${name}`, MALFORMED_PATH_PATTERNS, `no collapsed Windows paths in ${name}`);
    scanText(root, `${LATEST_DIR}/${name}`, SECRET_PATTERNS, `no secret markers in ${name}`);
  }
  scanText(root, ONEFILE, MALFORMED_PATH_PATTERNS, 'no collapsed Windows paths in the one-file');
  scanText(root, ONEFILE, SECRET_PATTERNS, 'no secret markers in the one-file');
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

  try {
    runChecks(root);
  } catch (error) {
    fail('checker completed', `unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }

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
