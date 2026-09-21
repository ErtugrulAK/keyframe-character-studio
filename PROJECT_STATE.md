# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into main, and the grouped post-RC roadmap has completed milestones A–E plus the first implementation slice of Milestone F item 10.

Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

**Checkpoint `2026-09-18-after-lottie-core`** (`docs/checkpoints/2026-09-18-after-lottie-core/`) records this state: `main` / `origin/main` is at `47d3368a2b54…`, the Lottie import core (Milestone F item 10, first slice) was merged with `--no-ff` at `ff32d6c` and pushed, and its branch `feat/lottie-import-core` is kept at `f76ae6a` as the review artefact. The checkpoint folder carries the summary (`README.md`), the tasklist (`TASKLIST.md`), a copy-paste next-session prompt (`RESUME_PROMPT.md`) and a machine-readable summary (`STATE.json`); the task record is `reports/progress_124_checkpoint_after_lottie_core.md`. The Milestone F study is merged (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`); **item 11 (evaluator profiling) is implemented** on `chore/evaluator-profiling-harness` as measurement only (`reports/progress_118_evaluator_profiling.md`), **item 12’s first step (validated import boundary)** is merged at `44218a6` (`reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix executed as fixtures, the legacy migration report, and the autosave restore routed through the same boundary) is implemented on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design** is delivered in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`; item 10’s **first implementation slice (the import core)** is **merged into `main`** at `ff32d6c` (`reports/progress_123_lottie_import_core.md`), its **second slice — layer masks + track mattes — is merged at `8670b2a`** (`reports/progress_125_lottie_mask_matte_slice.md`), and its **third slice — text, image and precomp layers — is implemented on `feat/lottie-text-image-precomp-slice`** (`reports/progress_126_lottie_text_image_precomp_slice.md`): static text maps onto the KCS text fields, an embedded image asset maps onto the media layer fields while every external reference is reported without being read, and precomp layers stay *unsupported, preserved* with their cycles and nesting reported; the merge decision for that branch is with the user. The remaining item-10 slice is the import entry point with the report-before-replace UX.

- Task 105 (export diagnostics remediation UX): blocking OGraf export diagnostics carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.
- Task 107 (track-matte source selection affordance): the matte source relation, whichever model holds it, is resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps its self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers.
- **Milestone A (canvas tangent handle authoring) — MERGED.** Selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex reveals its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-clicking a vertex toggles corner ↔ smooth with neighbour-derived symmetric handles. One history entry per completed drag; `Escape` cancels a drag without recording one.
  - Integration path: the original branch `feat/canvas-tangent-authoring` was reviewed across six rounds (final verdict `READY`, all five findings closed) and replayed onto current `main` as `feat/canvas-tangent-authoring-replay`, then fast-forward merged. No rebase, no merge commit, no force push, no history rewrite.
  - Not covered: vertex add/remove, multi-vertex transforms, keyboard nudging, handle constraints, boolean or trim-enabled freeform layers, broadcast mode.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, the track-matte source selection affordance, and Milestone A canvas tangent handle authoring are present in the accepted main line. OMP tooling remains separate.

## Validation status

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 120 files / 1,773 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf` — offline against the vendored closure, every document pin-verified (`reports/progress_115_ograf_offline_schema_closure.md`) |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Playwright tests — latest run at `47d3368` on `main` at the `2026-09-18-after-lottie-core` checkpoint |
| Real-browser milestone smoke | PASS | `e2e/graph-accessibility.spec.ts` and the live editor smoke with port 5000 closed (layer authoring, readiness check, real export) |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` — 32 checks on `main` at the `2026-09-18-after-lottie-core` checkpoint (the total scales with the number of bundle documents scanned) |
| TypeScript | PASS | `npm run build` (`tsc -b && vite build`) — the gate CI runs; `npx tsc --noEmit` alone does not cover the same project program (see `reports/progress_122_ci_hotfix_import_boundary_types.md`) |
| Lint | PASS | clean — the Fast Refresh warning was removed in `reports/progress_113_warning_maintenance.md` |
| Production build | PASS | no chunk-size advisory — split into 382.19 kB app + react-vendor/icons/geometry chunks (see `reports/progress_113_warning_maintenance.md`) |
| Independent review | PASS | Milestone A `READY` in round 6 of six; the item-9 audit closed `READY WITH WARNINGS` in round 6 of six (`reports/progress_112_dependency_warning_audit.md` §12); the Option A change closed with `READY WITH WARNINGS` from the read-only `scout` round (the reviewer model hit a provider usage limit) after `reviewer-agent` rounds 1–3 closed every finding (`reports/progress_113_warning_maintenance.md` §2) |
| CI on `main` | PASS | runs `35355797739` (Lottie import core handoff) and `35355585227` (Lottie import core merge) — both success |

## Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed, and **Milestone A is merged**.
- **Milestone B (graph + keyboard accessibility, item 4) — MERGED** at `96e8f9d`: the timeline keyframe diamonds are named keyboard buttons with a lane-local arrow walk, the value graph exposes a labelled group with keyboard-editable points, decorative SVG geometry is hidden from assistive tech, and focus rings were added. One review round returned BLOCKED (3 findings, 6 over-claims), all closed; the re-review returned READY WITH WARNINGS.
- **Milestone C (first export / onboarding flow, item 5) — MERGED** at `c2dcb22` (final gate verdict READY WITH WARNINGS): an opt-in "First export help" panel, a readiness check that reads the same OGraf diagnostics authority the export reads, and one shared compile path used by the readiness check and both export actions. **Milestone D is complete** — item 6 and item 9 (audit, the approved Option A and the local SQLite repair) are merged at `3923141` (`reports/progress_112_dependency_warning_audit.md`, `reports/progress_113_warning_maintenance.md`). Milestone E (study plus items 7 and 8) is complete, and Milestone F is the active milestone: its study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`), item 11 is implemented as measurement only, item 12's first step and product half are merged, item 10's mapping design is delivered (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`) and **item 10's first implementation slice — the Lottie import core — is merged at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`). Remaining item-10 slice: the import entry point with the report-before-replace UX; masks + track mattes are merged at `8670b2a` and text/image/precomp sit on `feat/lottie-text-image-precomp-slice`. Follow-ups stay approval-gated before any `package.json`, lockfile, or workflow change: Option B, Option C, the `engines` declaration and the npm-12 `allowScripts` pin.
- Publish/finalize the GitHub draft only with further explicit user instruction.
- No npm publication occurred; package remains private at `1.1.0-rc.1`.
- Branch cleanup needs approval: `feat/canvas-tangent-authoring-replay` is identical to `main` and can be deleted whenever the user approves; `feat/canvas-tangent-authoring` is kept as the Milestone A review artefact.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` holds a minimal, task-specific upload bundle, refreshed for each ChatGPT response instead of accumulating context files.
- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. A historical handoff archive, if ever needed, is a separate explicitly named file under `chatgpt_handoff/archive/` and only after user approval.
- Every handoff document states one current truth: a correction is never appended on top of a stale section — the stale section is rewritten.
- Flattened source and test copies must not live there: the Vitest default include glob picks up files named `src__*test*`, which failed CI runs `35094144225` and `35095655446`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.

## Protected state

- The current main documentation commits are intentionally newer than the tag target; the tag remains on the workflow-tested code candidate.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- Candidate package version is `1.1.0-rc.1`; package remains private and unreleased.

## Milestone B merged — graph + keyboard accessibility

- Branch `feat/graph-accessibility` was fast-forward-merged into `main` at `96e8f9d0313cb81752c04fe58d6e7d00d700a6f4` (no merge commit, no rebase, no history rewrite).
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; the selected-keyframe panel is a group scoped to its frame; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- **Milestone D item 6 — state consistency check — MERGED** at `b91e8b9` (follow-up `be76df9`): `node scripts/check-state-consistency.mjs` fails when the live docs contradict the tag/`main` SHA, when the roadmap and the next action disagree, when the handoff upload instruction is superseded, or when the bundle carries source/test/binary copies, collapsed Windows paths or secret markers (see `reports/progress_111_state_hygiene_gate.md`).
- **Item 9 (dependency and warning maintenance) — MERGED at `3923141`** (audit, Option A warning maintenance and the local SQLite repair). The audit is complete (`reports/progress_112_dependency_warning_audit.md`, review closed READY WITH WARNINGS in round 6 of six) and the approved **Option A is implemented** on `chore/warning-maintenance` (`reports/progress_113_warning_maintenance.md`): W1 Fast Refresh split, W2 chunk splitting, W3 jsdom stubs, W4 honest dependency arrays, W5 `.gitattributes`, the D9-2 checker rule and the repair of **D9-1** (the local `sqlite3` NAPI binding is extracted; `node server/index.js` starts and `GET /api/health` returns 200 in this working copy). No dependency was updated and `package.json`, `package-lock.json` and the workflows are unchanged; nothing is merged. The 7 catalogued warnings are resolved except W6 (`e2e/**` outside the Vitest glob by design) and W7 (environment `NO_COLOR`/`FORCE_COLOR`). Still open by decision: 20 outdated rows over 21 package names (7 patch / 12 minor / 1 no-wanted-update; majors available for `typescript` 6→7 and the Vitest pair 4→5), the 7 `npm audit` findings (6 moderate, 1 high; `qs` and `undici` moderate in the production tree), the `engines` declaration and the npm-12 `allowScripts` pin.
