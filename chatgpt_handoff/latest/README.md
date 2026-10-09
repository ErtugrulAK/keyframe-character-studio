# KCS Minimal ChatGPT Upload Bundle — OGraf Runtime Parity Phase A

Task-specific handoff for the Phase A runtime-parity branch, validated in an isolated worktree. This is not an archive.

## Current truth

Branch `fix/ograf-runtime-parity-phase-a` (`3f41400`) removes the generated runtime's hand copies of KCS's stacking-order and matte-precedence rules by embedding the canonical helpers' own source. `ografRuntimeParity.test.ts` protects the arrangement and asserts editor, static renderer and runtime agreement.

Validated only on isolated ports (UI 5187/5188/5189, API 5001): `qa:release` 2, `qa:v6` 3, full Chromium 265, plus tsc, lint, 138 Vitest files / 2,102 tests, build, `validate:ograf`, `npm run check`, state consistency and a clean audit. The stable QA checkout stayed at `c46e698` and its 5173/5000 services kept the same PIDs throughout.

Merge is withheld: the user's QA session is active. Remote CI is pending a PR or approval; branch pushes do not trigger `ci.yml`. A fresh exact-SHA Release Smoke Gate is required on the final candidate SHA as a separate zero-modification task.

## Evidence and files

- OMP_FINAL_RESPONSE.md: the change, the validation and the state.
- progress_159_ograf_runtime_parity_phase_a_closeout.md: the closeout record — port isolation proof, browser results, the `sourceVisible` and drift-gate decisions.
- PROJECT_STATE.md and NEXT_SESSION.md: current state and continuation constraints.
- CHANGELOG.md and KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md: mirrored live documents.
- manifest.txt: inventory and protected boundaries.

The four mirrored documents match their repository sources after CRLF/LF normalization and whole-document trimming. Source, tests, package files, workflows, binaries, assets, caches and QA output are omitted. Historical reports remain in `reports/` and are linked from the indexes.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder holds its sources.
