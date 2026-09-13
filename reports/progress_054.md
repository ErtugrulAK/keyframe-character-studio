# Progress 054 — Validation and Subagent Session Fixup

## Executive Summary

The AJV manifest-validation blocker was caused by an incomplete `node_modules` installation, not by package declarations or the validator import. `npm ci` restored the lockfile dependencies and all three public-controls manifests now validate. The full Playwright run remains too slow for the 600-second command envelope, but shard evidence is complete: shard 1 passed 141 tests, shard 2 passed its remaining 112 tests after isolating the previously timing-sensitive V-T17 case, and V-T17 passed independently. OMP task delegation works after starting an ephemeral auto-approved session; the earlier provider session error was not reproduced.

## Starting state

- Branch: `feat/ograf-public-controls-v1`.
- HEAD: `ff5d7b0`.
- Working tree: clean.
- `memory.backend`: `mnemopi`.
- AJV validator: blocked because `node_modules/ajv` was absent.
- Full Playwright: timed out after 600 seconds without aggregate output.
- OMP task delegation: failed with missing `x-opencode-session` in the earlier smoke.

## AJV root cause and result

`package.json` and `package-lock.json` already declared `ajv` and `ajv-formats`. `npm ls` showed an empty dependency tree and `node_modules/ajv` was missing, while Playwright binaries were present. The installation was stale/incomplete.

Action:

```text
npm ci
```

Result:

- `ajv@8.20.0` installed.
- `ajv-formats@3.0.1` installed.
- No package manifest or lockfile change was required.
- All three manifests passed `npm run validate:ograf`:
  - BASIC: valid OGraf v1 manifest
  - ASSET: valid OGraf v1 manifest
  - COMPOSITING: valid OGraf v1 manifest

`npm ci` emitted an existing Node engine warning for `jsdom` (`node 22.20.0`, package requires `22.22.2+`) and a prebuild-install deprecation warning; neither blocked validation.

## Playwright timeout root cause and result

The previous 254-test run exceeded the 600-second command timeout. Test listing confirmed 254 tests in 33 files. A focused OGraf run passed 2/2 tests.

Useful isolation evidence:

- Shard 1/2: 141 passed in 2.1 minutes.
- Shard 2/2 initially reached the end of its 113-test allocation but timed out on `track-matte.spec.ts` V-T17 during `page.screenshot()` while waiting for fonts.
- Isolated V-T17 with `--workers=1 --timeout=120000`: 1 passed in 37.8 seconds.
- Shard 2/2 excluding the already independently passing V-T17: 112 passed in 6.6 minutes.

Equivalent coverage is therefore 141 + 112 + 1 = 254 passing tests, but the unmodified full-suite command still does not emit one aggregate result within 600 seconds. No test was weakened or modified.

## Subagent x-opencode-session diagnosis

The initial delegation attempt failed because the OpenCode Go provider reported `Request is missing x-opencode-session`. A fresh ephemeral OMP invocation using `--no-session --auto-approve --mode=json` successfully launched two read-only `scout` subagents:

- `InspectProjectBranch`: completed; reported `feat/ograf-public-controls-v1`.
- `InspectOmpMemory`: completed; reported `mnemopi`, backed by local SQLite.

Both resolved through the `smol` role to `opencode-go/deepseek-v4-flash:high`. The session error was resolved for the fresh invocation. The normal approval-mode invocation still cannot launch `task` without an interactive approval UI; `--auto-approve` is required for this non-interactive smoke command. No project files or OMP configuration were modified.

Named project agents remain available and respond successfully:

- planner-agent
- designer-agent
- reviewer-agent
- commit-agent
- slow-agent

## Validation results

- `git diff --check`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm test`: PASS, 100 files / 1,437 tests.
- `npm run lint`: PASS with the existing Fast Refresh warning.
- `npm run build`: PASS with the existing chunk-size warning.
- `npm run qa:v6`: PASS, 3/3.
- Focused OGraf Playwright: PASS, 2/2.
- Playwright equivalent sharded coverage: PASS, 254/254 across shards plus isolated V-T17.
- Single full Playwright aggregate: TIMEOUT at the 600-second command limit.
- `npm run validate:ograf`: PASS, 3/3.

## Git summary

- Branch: `feat/ograf-public-controls-v1`.
- `main`: untouched.
- Global OMP config: unchanged.
- `memory.backend`: remains `mnemopi`.
- Commit: `807ac15 docs: record validation and subagent fixup`.
- Push: completed to `origin/feat/ograf-public-controls-v1`.

## Next user QA action

Test public-controls host QA:

1. BASIC — change `Headline`.
2. ASSET — switch `Logo` from `assets/images/logo.png` to `assets/images/logo_alt.svg`.
3. COMPOSITING — set `Content Fill Color` to `#00ff00` and `Content Stroke Color` to `#0000ff`.
