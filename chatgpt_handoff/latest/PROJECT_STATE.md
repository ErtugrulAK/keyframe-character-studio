# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into main. Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

Task 105 (export diagnostics remediation UX) was integrated into main by fast-forward at `9fdbf0fe59c28d3d6f07c8ee37081fc93f2ff6db`. Current `main`/`origin/main` HEAD is `9f7114877e111527e8757668237e41fde8388a99`, which adds docs and handoff commits only and is therefore newer than the integration commit. Blocking OGraf export diagnostics now carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; and user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.

Task 107 (track-matte source selection affordance) is integrated into main by fast-forward. The matte source relation, whichever model holds it, is now resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps the existing self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers. No new matte, rendering, evaluator, validation, or state engine was introduced, and the canvas/export validators were left untouched.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, and the track-matte source selection affordance are present in the accepted main line. OMP tooling remains separate.

## Validation status

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 103 files / 1,575 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf`; committed minimal fixture |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Playwright tests |
| TypeScript | PASS | `npx tsc --noEmit` and build typecheck |
| Lint | PASS | Existing Fast Refresh warning only |
| Production build | PASS | Existing Vite chunk-size warning only |
| Independent review | PASS | `READY` at the Task 107 merge gate (three review rounds) |

## Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed.
- Milestone A (canvas tangent handles) is implemented and validated on `feat/canvas-tangent-authoring` (`c7ae7bc`) but **not merged**: the independent review returned BLOCKED with five concrete items, listed in `reports/progress_108_canvas_tangent_authoring.md`.
- Milestones B–F are planned only; dependency/workflow/release changes require explicit approval.
- Publish/finalize the GitHub draft only with further explicit user instruction.
- No npm publication occurred; package remains private at `1.1.0-rc.1`.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` holds a minimal, task-specific upload bundle, refreshed for each ChatGPT response instead of accumulating context files.
- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. A historical handoff archive, if ever needed, is a separate explicitly named file under `chatgpt_handoff/archive/` and only after user approval.
- Flattened source and test copies must not live there: the Vitest default include glob picks up files named `src__*test*`, which failed CI runs `35094144225` and `35095655446`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.

## Protected state

- The current main documentation commits are intentionally newer than the tag target; the tag remains on the workflow-tested code candidate.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- Candidate package version is `1.1.0-rc.1`; package remains private and unreleased.

## Milestone A merged — direct canvas tangent handle authoring

- Branch `feat/canvas-tangent-authoring-replay` was fast-forward-merged into `main`; the milestone is now part of `main` (no merge commit, no rebase, no history rewrite).
- What it adds: selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex shows its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-click toggles corner ↔ smooth with neighbour-derived symmetric handles. One undo entry per drag; `Escape` cancels a drag and records nothing.
- Review: six rounds; final verdict READY (five findings closed: verification matrix, legacy points normalization, selection model, Escape/batch lifecycle, smooth-handle/extreme-coordinate edge).
- Validation: 108 files / 1,641 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the permanent real-browser spec `e2e/canvas-tangent-authoring.spec.ts`.
- Still out of scope: vertex add/remove, multi-vertex transforms, keyboard nudging, handle constraints, boolean/trim-enabled freeform layers.
- Next roadmap milestone: **B — graph + keyboard accessibility (item 4)**; untouched.
