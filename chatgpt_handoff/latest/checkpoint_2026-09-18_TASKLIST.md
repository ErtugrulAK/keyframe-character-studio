# KCS Tasklist — 2026-09-18 After Lottie Import Core

## 1. Done

| Item | State | Evidence |
|---|---|---|
| Milestone A — canvas path authoring UX (tangent handles) | MERGED at `077911b` | `reports/progress_108_canvas_tangent_authoring.md` |
| Milestone B — graph + keyboard accessibility | MERGED at `96e8f9d` | `reports/progress_109_graph_accessibility.md` |
| Milestone C — first export / onboarding flow | MERGED at `c2dcb22` | `reports/progress_110_export_onboarding.md` |
| Milestone D item 6 — state consistency check | MERGED at `b91e8b9` (+ `be76df9`) | `reports/progress_111_state_hygiene_gate.md` |
| Milestone D item 9 — dependency/warning audit and the approved Option A | MERGED at `3923141` | `reports/progress_112_dependency_warning_audit.md`, `reports/progress_113_warning_maintenance.md` |
| Milestone E study + item 7 (7-A) + item 8 | MERGED | `reports/progress_114_ograf_qa_study.md`, `reports/progress_115_ograf_offline_schema_closure.md`, `reports/progress_116_ograf_folder_qa.md` |
| Milestone F study | delivered | `docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`, `reports/progress_117_interop_study.md` |
| Milestone F item 11 — evaluator profiling (measurement only) | implemented on `chore/evaluator-profiling-harness` | `reports/progress_118_evaluator_profiling.md` |
| Milestone F item 12 first step — validated import boundary | merged | `reports/progress_119_kcs_import_boundary.md` |
| Milestone F item 12 product half | merged | `reports/progress_121_kcs_import_product_half.md` |
| Milestone F item 10 design — Lottie mapping contract | delivered | `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` |
| **Milestone F item 10 first slice — Lottie import core** | **MERGED at `ff32d6c`** (branch `feat/lottie-import-core` at `f76ae6a`, kept) | `reports/progress_123_lottie_import_core.md` |
| CI hotfix — import boundary types | MERGED | `reports/progress_122_ci_hotfix_import_boundary_types.md` |
| This checkpoint | `docs/checkpoints/2026-09-18-after-lottie-core/` | `reports/progress_124_checkpoint_after_lottie_core.md` |

## 2. Active

Nothing is in progress. `main` is at `47d3368` with a clean working tree and green CI; the next
action is a new approval.

## 3. Next recommended task

**Milestone F item 10 — masks + track matte slice.** Branch `feat/lottie-mask-matte-slice`, base
`main` at or after `47d3368`. Scope: extend `src/interop/lottie/**` so Lottie masks and track mattes
are either converted through the existing KCS mask/matte authority or reported through the same
loss-report contract, and restore the mask limit that the first slice deliberately left out. Out of
scope: any UI entry point, any package/lock/workflow change.

## 4. Remaining backlog

Priority order:

1. Milestone F item 10 — masks + track matte slice.
2. Milestone F item 10 — text/image/precomp slice.
3. Milestone F item 10 — the import entry point with the report-before-replace UX.
4. Milestone F item 12 — unified import entry.
5. Milestone D item 9 Option B — 7 patch + 12 minor dependency updates and a bounded `npm audit fix`.
6. The `engines` declaration and the npm-12 `allowScripts` decision.
7. Option C — TypeScript 7 / Vitest 5 major upgrades on their own branch.
8. OGraf package / editable import expansion.

## 5. Approval-gated tasks

Anything that touches the following needs explicit user approval before work starts:

- `package.json`, lockfiles, dependency versions, `.github/workflows/**` (backlog items 5, 6 and 7).
- Release, tag, draft-release or npm actions of any kind.
- Branch deletion (`feat/lottie-import-core`, `feat/canvas-tangent-authoring`,
  `feat/canvas-tangent-authoring-replay` are all retained today).
- Any merge that is not a fast-forward, and any history rewrite.

## 6. Do-not-touch list

- `origin/without-mask` — preserved ARCHIVE, untouched.
- `.omp/config.yml` — `memory.backend` stays `mnemopi`; model roles, provider mappings and
  `task.maxConcurrency` (8) stay unchanged.
- `C:\Users\ertugrul.ak\Desktop\KCS` — user project/asset workspace, never a handoff destination.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` — corpus, untouched.
- Secret material of any kind — never printed, copied or committed.
- Source/test files are never copied into `chatgpt_handoff/latest/`.
