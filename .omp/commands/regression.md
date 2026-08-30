---
description: Run the complete repository validation workflow and classify every failure.
---

# Keyframe Character Studio Regression

Run the standard validation workflow. Do not commit, push, branch, or modify product code/tests to make validation pass.

## Safety and scope

1. Read repository-root `AGENTS.md` first and obey it as the main authority.
2. Record the current branch, HEAD, upstream, ahead/behind counts, `git status --short`, staged/unstaged diffs, and untracked files.
3. Treat already-present, task-unrelated files under `.hermes/desktop-attachments/` as local artifacts only. Never modify, move, stage, delete, stash, reset, or commit them. Stop and report every other unexpected working-tree change.
4. Determine the changed scope from Git state and the approved task. Recalculate test collection from the current HEAD; do not reuse historical counts.

## Validation order

Run every applicable command and record its exact command, exit status, and essential output. The package scripts are canonical. If this host's global `npm`/`npx` wrapper fails before invoking the tool, use the verified repository-local executable shown below and classify the wrapper failure as environment/tooling.

1. When a changed scope exists, run the smallest relevant focused tests first:
   - Vitest: `node ./node_modules/vitest/vitest.mjs run <relevant-test-files>`
   - Playwright when the changed behavior has an E2E contract: `node ./node_modules/@playwright/test/cli.js test <relevant-spec-files>`
   - If no focused test maps to the scope, state why; do not invent one.
2. Full Vitest: `npm test`
   - Local fallback: `node ./node_modules/vitest/vitest.mjs run`
3. Full Playwright Chromium E2E: `npm run test:e2e`
   - Local fallback: `node ./node_modules/@playwright/test/cli.js test`
4. TypeScript no-emit: `node ./node_modules/typescript/bin/tsc --noEmit`
5. Project-reference TypeScript build (`tsconfig.json` uses references): `node ./node_modules/typescript/bin/tsc -b`
6. Production Vite build: `node ./node_modules/vite/bin/vite.js build`
   - The canonical combined script is `npm run build` (`tsc -b && vite build`). Do not claim it passed unless it was actually run; report the two direct steps separately when using local executables.
7. Oxlint: `npm run lint`
   - Local fallback: `node ./node_modules/oxlint/bin/oxlint`
8. Whitespace/error-marker check: `git diff --check`
9. Re-run the Git scope/status inspection and confirm validation did not create unexpected project changes.

## Failure policy

Never weaken assertions, skip tests, add or increase retries, add arbitrary sleeps, widen thresholds/tolerances, introduce fallback behavior, or hide output to obtain a pass. Playwright already owns its configured CI retry policy; do not change it.

### Diagnosis versus final validation

Controlled reproduction may use explicitly scoped stress or repeated triggering when necessary to increase the chance of observing an intermittent failure. Keep that technique inside diagnosis evidence only.

Final validation remains deterministic. It must not rely on arbitrary sleeps, retry loops, widened tolerances, weakened assertions, hidden fallbacks, or random thresholds. Do not reorder the validation commands or change their failure classifications to accommodate diagnosis behavior.

Classify every failure as one of:

- product regression;
- test defect or stale contract, with evidence;
- pre-existing failure, reproduced against credible baseline evidence;
- environment/tooling failure;
- working-tree/scope safety failure;
- unresolved, when evidence is insufficient.

A browser launch failure before test assertions, including `spawn EPERM`, is an environment/tooling failure unless evidence proves a product cause. It is not a product-test pass and must remain visible.

## Final report

Return:

- working-tree summary;
- focused test result;
- full Vitest result;
- full Playwright result;
- TypeScript no-emit and project-reference results;
- production build result;
- lint result;
- `git diff --check` result;
- failure classification with evidence;
- commit readiness: `READY`, `NOT READY`, or `BLOCKED` with the exact reason.

Do not commit or push.
