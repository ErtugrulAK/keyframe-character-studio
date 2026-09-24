# KCS Milestone H Release Readiness — Final Response (the closing checkpoint)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** the release-readiness pass is complete. The audit ran, its one required fix is merged, both dependency decisions are recorded, and the final gate is green on clean `main` at `c1431db`.
- **Gate verdict:** **RELEASE READY WITH DOCUMENTED DEFERRALS** — `reports/progress_146_final_release_gate.md`.
- **Reports:** the audit (`progress_142_release_readiness_audit.md`), the fix (`progress_143_ci_typecheck_step.md`), the two triages (`progress_144_oxlint_1_85_triage.md`, `progress_145_jsdom_30_1_triage.md`), the gate (`progress_146_final_release_gate.md`) and this reconciliation (`progress_147_milestone_h_docs_handoff.md`).
- **Nothing was released:** the tag, the draft prerelease, the package metadata and npm are untouched. The release decision is the one open item, and it is the user's.

## 2) HOW IT RAN

| Task | Work | Branch | Merged at |
|---|---|---|---|
| H1 | release-readiness audit — 7 findings, 1 of them required | `docs/milestone-h-audit` | `cc1ce8e` |
| H2 | the required fix: the CI type-check step now checks the project | `chore/ci-typecheck-step` | `b4bf3c0` |
| H3 | `oxlint` 1.85 triage → **deferred** | `docs/milestone-h-triage` | `cc1ce8e` |
| H4 | `jsdom` 30.1.x triage → **taken**, with a test-only shim | `chore/jsdom-30-1` | `c1431db` |
| H5 | the final release gate on clean merged `main` | — (read-only) | — |
| H6 | live documents and this handoff reconciled | `docs/milestone-h-release-readiness` | awaiting the merge gate |

No rebase, no force push, no merge commit, no history rewrite. Every package/lockfile change and every
merge had explicit approval.

## 3) THE GATE (clean `main` at `c1431db`)

| Check | Result |
|---|---|
| `npm run build` (`tsc -b` + vite) | PASS |
| `npx tsc -b --pretty false` | exit 0 — 151 project files |
| `npm test` | PASS — 126 files / 1,934 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `c1431db` |
| export, Lottie and matte browser specs | PASS — 8 tests |
| `npm run qa:v6` | PASS — 3 tests |
| `npm run check` | PASS |
| `node scripts/check-state-consistency.mjs` | PASS — 35 checks |
| `npm audit` | 0 vulnerabilities |
| API health + `sqlite3` binding on this machine | 200 `online` / in-memory table created |
| `git diff --check` and the working tree | clean |

CI on `main` is green at `c1431db` (run `35988804952`, Node 22 with `npm ci`).

## 4) THE AUDIT'S ONE REQUIRED FINDING, AND HOW IT WAS CLOSED

The CI step named "TypeScript Type Check" ran `npx tsc --noEmit`. The root `tsconfig.json` is a solution
file, so that command builds no referenced project and checked **no project file**: a broken type could
have merged behind a green tick. The step and the `check` script now run `npx tsc -b --pretty false`,
which checks all 151 project files, committed at `b4bf3c0`.

## 5) DECISIONS AND DEFERRALS

- **Option C** (`typescript` 6→7, `vitest` + `@vitest/coverage-v8` 4→5): **deferred by decision.** The configuration surface is vanilla and the peer engines are satisfied, but the breakage surface cannot be measured without installing the majors, and the current toolchain is clean.
- **`oxlint` 1.85:** **deferred.** 34 new warnings, 31 of which flag patterns this codebase uses deliberately (the documented latest-ref mirror, and synchronisation effects the rule's own guidance allows); the three genuine ones would not make the run clean.
- **`jsdom` 30.1.x:** **closed.** The bump is taken at `c1431db`. jsdom implements neither `createObjectURL` nor `revokeObjectURL`, so the test environment pairs Node's `URL` with jsdom's `Blob`, and 30.1.1's Blob no longer carries what that implementation follows; one test was affected and the test environment now defines the two functions itself.
- **Carried follow-ups that need their own task:** unrestricted CORS, the tracked `server/db/keyframe_studio.sqlite`, and focus restoration for two dialogs. **Accepted and documented:** the constant `SceneLayer.visible` and `vite --host` publishing the dev frontend.
- **Stated limits of the gate:** CI runs no browser test (the 2-spec `release-smoke.yml` is manual), CI is `ubuntu-latest` only so this run is the Windows evidence, and `qa:release` is the only automated package round-trip.

## 6) RELEASE VIEW

The tag `v1.1.0-rc.1` still points at `46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub release is
still a draft, the package is private at `1.1.0-rc.1`, and npm publication did not occur. What remains is
a decision, not a fix: finalize the draft, re-tag at a newer `main`, or hold. The repository states no
default for that, and this pass took none.
