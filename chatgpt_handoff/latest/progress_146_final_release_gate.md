# Progress 146 — H5 final release gate

Milestone H, task H5. Run on **clean merged `main`** only.

## 1. What it ran on

| Fact | Value |
|---|---|
| `git rev-parse HEAD` | `c1431dba88238063ce49e97d611e69313cf3f42b` |
| `git rev-parse origin/main` | `c1431dba88238063ce49e97d611e69313cf3f42b` (equal) |
| `git status --short --branch` | `## main...origin/main` — clean before and after every command below |
| CI on this commit | `35988804952` — **success** (Node 22, `npm ci`) |
| Local platform | Windows 11, Node `v24.18.0`, npm `12.0.2` |

Milestone H changed three things before this gate, so the release evidence is traceable:

| Commit | Change |
|---|---|
| `b4bf3c0` | the CI type-check step and the `check` script now run `npx tsc -b --pretty false` (the old `--noEmit` checked no project file) |
| `cc1ce8e` | the H3/H4 triage reports |
| `c1431db` | `jsdom` 30.0.1 → 30.1.1 with the test-environment object-URL shim |

## 2. The gate

| Check | Command | Result |
|---|---|---|
| Production build | `npm run build` (`tsc -b` + vite) | **PASS** |
| Type gate | `npx tsc -b --pretty false` | **exit 0** (151 project files) |
| Full suite | `npm test` | **PASS — 126 files / 1,934 tests** |
| Lint | `npm run lint` | **clean** (0 warnings) |
| OGraf fixture gate | `npm run validate:ograf` | **PASS** |
| Release smoke | `npm run qa:release` | **PASS — 2 Chromium tests**, candidate `c1431db` |
| Lottie import + OGraf matte pixels | `npx playwright test e2e/lottie-import-report.spec.ts e2e/ograf-matte-visual.spec.ts` | **PASS — 7 tests** |
| Export download path | `npx playwright test e2e/export-onboarding.spec.ts` | **PASS — 1 test** |
| V6 QA | `npm run qa:v6` | **PASS — 3 tests** |
| Developer gate | `npm run check` (lint → type check → test → build) | **PASS** |
| State consistency | `node scripts/check-state-consistency.mjs` | **PASS — 35 checks** |
| Dependency audit | `npm audit` | **0 vulnerabilities** |
| Whitespace / conflict check | `git diff --check` | **clean** |
| API health | `node server/index.js`, then `GET /api/health` | **200** — `status: online`, `SQLite (Embedded Local DB)` |
| API project route | `GET /api/projects` | `success: true`, `source: sqlite` |
| Native binding | fresh `require('sqlite3')` + in-memory `CREATE TABLE` | **OK** |
| Working tree after the gate | `git status --short` | **clean** (the tracked database file was not written) |

## 3. What this gate does *not* prove

Stated so the verdict is not read as more than it is:

1. **CI runs no browser test.** The 38 Playwright specs run here on Windows; in CI the only automated
   browser gate is the *manual* `release-smoke.yml` (2 specs).
2. **No Windows job.** CI is `ubuntu-latest` only; this run is the Windows/local evidence.
3. **`qa:release` is the only automated package round-trip.** The full E2E set is on demand.

These are the coverage gaps the H1 audit recorded (§4). They are unchanged by this milestone.

## 4. Deferrals carried into the release

| Item | Status | Evidence |
|---|---|---|
| **Option C** (`typescript` 6→7, `vitest` + `@vitest/coverage-v8` 4→5) | **Deferred by user decision** in this milestone; not a blocker | H2 audit: the config surface is vanilla and the peer engines are satisfied, but the breakage surface is unmeasurable without installing, and the current toolchain is clean |
| **`oxlint` 1.85** | **Deferred**, with a corrected triage | `reports/progress_144_oxlint_1_85_triage.md`: 34 new warnings, 31 of them flagging patterns this codebase uses deliberately; the three genuine ones would not make the run clean |
| **jsdom 30.1.x** | **Closed** — the bump was taken at `c1431db` | `reports/progress_145_jsdom_30_1_triage.md`: one test needed a test-only shim; 1,934/1,934 green and CI green after the merge |
| Residual: unrestricted CORS | **Deferred follow-up** | H1 §5.3 |
| Residual: tracked `server/db/keyframe_studio.sqlite` | **Deferred follow-up** | H1 §5.4 |
| Residual: no focus restoration on two dialogs | **Deferred follow-up** | H1 §5.6 |
| Residual: constant `SceneLayer.visible` | **Accepted, documented** | H1 §5.2 |
| Residual: `vite --host` publishes the dev frontend | **Accepted, documented** | H1 §5.5 |
| Residual: one unreproduced Task B suite failure | **Accepted, monitored** | H1 §5.7; six clean full runs since |
| Residual: the CI type-check step verified nothing | **FIXED** at `b4bf3c0` | `reports/progress_143_ci_typecheck_step.md` |

## 5. Verdict

# READY WITH DOCUMENTED DEFERRALS

Every gate above is green on clean, merged `main` at `c1431db`, whose CI run is also green, and the one
required fix from the H1 audit is applied. Nothing outstanding is a product-correctness or security
blocker: the deferrals are two dependency decisions the user owns (Option C, `oxlint` 1.85), three
follow-ups that need their own task, and three documented behaviours.

**No release/tag/npm action was taken.** `v1.1.0-rc.1` still points at
`46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub release is still a draft, the package is still
private at `1.1.0-rc.1`, and nothing was published. Whether to finalize, re-tag or publish is H7's
question and the user's decision.
