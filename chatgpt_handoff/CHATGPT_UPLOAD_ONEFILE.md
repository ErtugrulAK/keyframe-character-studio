# KCS ChatGPT One-File Handoff

## 0. Upload Instructions

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.

Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`. External QA folders are untouched.

---

## 1. OMP Final Response

# KCS Authoring Publication — 2026-10-05

## Scope

Publication starts from synchronized main at `703e45ab209530f20928cf5e13287b759276a33f`. The owner approved publication of the pending authoring changes, the active-sequence stage correction, six meaningful dated commits, fast-forward integration, and a normal push.

- Text Appearance supports stroke consistently in the canvas and OGraf renderer.
- Position-only layer bonds reuse the existing inspector/history pipeline. Text and freeform layers participate in Boolean geometry through the existing geometry authority.
- Opacity has an authoring control. Motion Curves edits the incoming segment selected by its end keyframe; a first keyframe has no incoming segment.
- Sidebar transitions, transport controls, and Media/Texts drawers are reconciled with the current UI.
- Same-frame property writes match the sequence identity. Edit-mode painted layers use the active sequence, matching their selection gizmos; Broadcast keeps its runtime sequence selection.
- Browser contracts select valid incoming segments. Obsolete inspector wording/field-absence assertions were removed. Matte region probes capture one image per exact sample grid without changing thresholds or parity assertions.

## Runtime evidence

A real browser drag moved the second-sequence circle by +100/+40 screen pixels while the default sequence retained x=-100. A bonded circle/text pair moved by the same -60/+20 screen-pixel delta. The named-sequence browser regression also checks painted geometry when switching sequences.

Current validation results are recorded in `PROJECT_STATE.md` and `NEXT_SESSION.md`. Historical Astra evidence in `progress_151_astra_remediation.md` remains a historical record, not this publication's verification report.

## Dating provenance

The six author dates are owner-approved retrospective metadata: August 29, September 5, 12, 19, 26, and October 5, 2026. Committer dates reflect actual creation. Earlier author dates do not represent earlier uploads or prove work occurred on those days. Every group contains real changes; there are no empty contribution-filling commits.

No old-branch patch replay, rebase, reset, shared-history rewrite, force push, or branch deletion is authorized by this publication. Historical review branches remain intact. Publication uses `feature/studio-authoring-fixes`, a fast-forward into main, and a normal push. Remote publication and its CI result are verified separately after the local gate; this document does not predict their success.

## Protected release state

H7 remains HOLD. Release tags, the draft prerelease, the private package, npm publication, external QA folders, `.hermes/desktop-attachments/`, and OMP configuration are unchanged.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.

---

## 2. Bundle README

# KCS Minimal ChatGPT Upload Bundle — Authoring Publication

This task-specific bundle covers the approved authoring publication from baseline `703e45a` on October 5, 2026. It is not an archive.

## Current scope

Text appearance/OGraf parity, layer bonds, Boolean text/freeform operands, opacity authoring, incoming-segment Motion Curves, sidebar/media/text presentation, and sequence write/render isolation are included. `OMP_FINAL_RESPONSE.md` explains runtime proof and retrospective author-date provenance; current local validation lives in the mirrored state documents. Remote publication and CI are checked after the local gate, not assumed here.

Six real change groups use owner-approved retrospective author dates from August 29 through October 5. Committer dates remain actual. No empty commits or published-history rewrite is used. Old local review branches are preserved rather than replayed.

H7 remains HOLD. No tag, draft release, package version, or npm publication action is included.

## Files

- `OMP_FINAL_RESPONSE.md` — this publication's scope, evidence, and dating provenance.
- `NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`, `CHANGELOG.md` — mirrored live documents.
- `progress_151_astra_remediation.md` — retained historical Astra record; not current validation.
- `manifest.txt` — inventory and boundaries.
- `README.md` — this guide.

The four mirrored documents match their repository sources after CRLF/LF normalization and whole-document trimming.

Source, tests, package files, workflows, binaries, archives, assets, caches, and QA output are not copied. Existing historical reports are not rewritten or deleted. External QA/workspace folders and OMP configuration are untouched.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. This folder contains its sources.

---

## 3. Bundle Manifest

# KCS ChatGPT Upload Manifest — Authoring Publication

Bundle scope: approved authoring publication, October 5, 2026; task-specific, not an archive
Publication baseline: 703e45ab209530f20928cf5e13287b759276a33f
Working branch: feature/studio-authoring-fixes
Validation authority: current PROJECT_STATE.md and NEXT_SESSION.md
Dating provenance: six owner-approved retrospective author dates; actual committer dates; no empty commits or shared-history rewrite
Historical record retained: reports/progress_151_astra_remediation.md (not current validation)
Release state: H7 HOLD; release tags, draft prerelease, private package and npm publication unchanged
Remote push and CI: verified separately after the local gate; no success presumed in this inventory

Bundle source files (8):
- CHANGELOG.md
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md
- NEXT_SESSION.md
- OMP_FINAL_RESPONSE.md
- PROJECT_STATE.md
- README.md
- manifest.txt
- progress_151_astra_remediation.md

Omitted: source, tests, package/lock files, workflows, binaries, archives, assets, caches, and QA output.
Protected: external QA/workspace folders; .hermes/desktop-attachments/; origin/without-mask; release artefacts; OMP configuration.

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md to ChatGPT. The files above are the sources of that one-file artifact.

---

## 4. Next Session

# Next Session Handoff

## Repository state

- Checkout: `main` at or after `8a4ca22`, matching `origin/main` after the Astra remediation run. That run closed the audit's findings F-01…F-10, one branch and one focused regression each (mixed legacy/channel round trips, legacy import validation, Lottie numeric property forms, the OGraf procedural-animation mismatch, archive size accounting, dropped-media persistence, preset storage boundaries, the naming dialog's focus lifecycle, the React `act` warnings, and the stale live-document claims) — see `reports/progress_151_astra_remediation.md`. Before it, the five-task maintenance run closed dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the exact API CORS allowlist (`2a313d7`), Oxlint 1.85 adoption (`feca773`), and the aligned TypeScript 7 / Vitest 5 upgrade (`37904fb`). Milestones A–G remain complete, Milestone H remains complete through H6, and its release decision remains held (H7). The historical checkpoint `docs/checkpoints/2026-09-18-after-lottie-core/` remains unchanged.
- Milestone A (canvas tangent handles) is integrated into `main` by approved replay + fast-forward; `main` is a strict superset of its previous state
- Task 105 (export diagnostics UX) and Task 107 (track-matte source selection) are integrated by fast-forward; both are retained
- Checkout after the item 12 merge: `main` at or after `a4f8642` (the OGraf package import and its handoff refresh), matching `origin/main`
- Milestone D item 9 **Option B is merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`) and `main` matches `origin/main`
- The **`engines` declaration and the npm-12 `allowScripts` question are answered on `chore/engines-allow-scripts`** (`reports/progress_131_engines_allow_scripts.md`): `engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"` (the locked toolchain's supported intersection) plus a version-pinned `allowScripts` approval for `sqlite3@6.0.1`; `package-lock.json` mirrors only the root engine metadata and its dependency graph is unchanged (**merged into `main` at `1a12d79`**)
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- Release tags: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged
- Branches kept: `feat/canvas-tangent-authoring` (Milestone A review artefact) and `feat/canvas-tangent-authoring-replay` (its replayed integration branch, now behind `main`; deleting it needs approval)

## Authoring publication — 2026-10-05

- The approved pending work is grouped into six commits: text appearance, layer authoring (bonds, Boolean text/freeform operands, opacity), timeline segment editing and transport, sidebar/media/text presentation, sequence write/render isolation, and documentation reconciliation.
- The circle/selection-border split is fixed at the stage evaluation boundary: Edit uses the selected sequence, while Broadcast keeps its runtime selection. Same-frame property keyframes remain isolated across sequences.
- Owner-approved author dates are retrospective metadata distributed across 2026-08-29, 2026-09-05, 2026-09-12, 2026-09-19, 2026-09-26, and 2026-10-05. Committer dates remain real. Do not interpret this as earlier uploads or proof of work on those dates; do not manufacture empty commits to fill the remaining days.
- Preserve historical local branches; do not replay the old tangent/presentation work or the obsolete mask-gizmo patch. Normal fast-forward publication only; no force push, rebase, tag change, draft release publication, or npm publication.

## Current result

Milestones A–E are complete, and Milestone F item 10 is complete (all four slices merged):

- Milestone F item 10, first slice — **the Lottie import core is merged into `main`** at `ff32d6c` (base `06a5dfcf`, `--no-ff`, pushed; branch `feat/lottie-import-core` kept at `f76ae6a`): `importLottieDocument(text)` maps document timing, shape/solid/null layers, transforms, paths, primitives and fill/stroke/trim, applies the segment-to-keyframe easing rules, and reports every construct it does not convert through the loss-report contract. 37 contract cases; five independent read-only review rounds (BLOCKED, BLOCKED, BLOCKED, READY WITH WARNINGS, READY WITH WARNINGS) plus a merge-eligibility review of the last delta. The importer has a user-facing entry point (`3b30bff`), which the unified import control later folded into the single `Import` button in the header: one control classifies the chosen file by its **content** (KCS project, legacy project, Lottie document, OGraf manifest/package), and a Lottie document still opens its report before anything is applied and applies only on an explicit confirm.

- Milestone A — canvas tangent authoring (`077911b`): vertex selection shows Bezier handles on the stage, dragging reshapes the path live, one history entry per completed drag, `Escape` cancels.
- Milestone B — graph + keyboard accessibility (`96e8f9d`): named keyframe diamonds with a lane-local arrow walk, a labelled value graph with keyboard-editable points, decorative SVG hidden from assistive tech, focus rings.
- Milestone C — first export / onboarding (`c2dcb22`): opt-in "First export help" panel, readiness check reading the same OGraf diagnostics authority as the export, one shared compile path for readiness and both export actions.
- Milestone D item 6 — state consistency check (`b91e8b9`, CI follow-up `be76df9`): `node scripts/check-state-consistency.mjs`.
- Milestone D item 9 and its maintenance follow-ups are closed. Option A is merged at `3923141`, Option B at `73426e5`, `engines`/npm-12 `allowScripts` at `1a12d79`, `jsdom` 30.1.1 at `c1431db`, Oxlint 1.85 at `feca773`, and Option C (TypeScript 7 plus Vitest and `@vitest/coverage-v8` 5) at `37904fb`. The runtime SQLite file is ignored rather than tracked, API browser origins are exact by default, and the two remaining dialogs restore opener focus.

The release stance is unchanged: annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate; nothing was published, finalized, or pushed to npm.

## Validation

Authoring publication local gate on October 5, 2026: `npm run check` passed lint, TypeScript build mode, 130 Vitest files / 2,008 tests, and the production build. `npx tsc --noEmit`, `npm run validate:ograf`, and `npm run qa:release` (2 Chromium tests) also passed. Full Chromium verification passed all 255 tests with `--retries=0`; `npm run qa:v6` passed all 3 tests. State consistency passed 35 checks. One incidental sidebar visual-dimension test was deleted; actual collapse/reopen geometry, hidden controls, and compact-viewport reachability remain covered. The dependency audit now reports one moderate `fast-uri` advisory (GHSA-hrr3-gc8f-f4qj); dependency/package changes are outside this approved scope. Remote CI is checked after the normal push; earlier remediation CI is historical evidence, not proof for this publication.

## Next scoped work

1. **Milestone H remains HELD at H7.** H1–H6 are complete, the release artefacts remain at `46d2a3e`, and no tag, GitHub release, or npm publication action was taken.
2. The Astra remediation findings F-01…F-10 are closed and merged with green CI, one branch per finding; `reports/progress_151_astra_remediation.md` records the reproduction evidence and the remaining limitations.
3. The five maintenance tasks that preceded the remediation are complete: focus restoration, SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5.
4. Preserve the tag and draft prerelease. Publishing, finalizing, or re-tagging requires a new explicit user instruction.
5. The GitHub Actions Node 20 deprecation annotation and the announced `ubuntu-latest` migration to Ubuntu 26 are non-blocking workflow-maintenance warnings; they do not change the held release decision.

## Guardrails

- Do not reset, force-push, rebase, tag, or delete branches/reports. Integrate by fast-forward, or by an approved replay.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml`, model roles, provider mappings, task concurrency, and global tooling unchanged.
- Keep `origin/without-mask` untouched and classified ARCHIVE.
- Production draft is not published; publish/finalize requires further explicit user instruction.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` is a per-response, task-specific upload bundle: clean it first, then place only the files that this specific ChatGPT conversation needs.
- Preferred upload artifact: `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. If a historical handoff archive is ever needed, create a separate explicitly named archive file under `chatgpt_handoff/archive/` only after user approval. The default ChatGPT upload is always this one file.
- Handoff documents must state one current truth: never append a correction block on top of stale sections — rewrite the stale section instead.
- Never store flattened source or test copies there. Those copies are separate files, and the ones named `src__*test*` are picked up by the Vitest default include glob, which breaks CI.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset folder, not a handoff dump. Never copy the bundle there unless the user explicitly asks.
- Omitted files are never deleted from the repository; they simply are not part of the bundle.

## Milestone B merged — graph + keyboard accessibility

- Branch `feat/graph-accessibility` was fast-forward-merged into `main` at `96e8f9d0313cb81752c04fe58d6e7d00d700a6f4` (no merge commit, no rebase, no history rewrite).
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- Roadmap status when this milestone landed: D was next (items 6 and 9) and C was merged. Current status: milestones A–G are complete, and Milestone H is complete through H6 with its release decision held (H7), see "Current result" above.

---

## 5. Project State

# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into `main`, the grouped post-RC roadmap has completed milestones A–G, and `main` is at or after `37904fb`. Milestone F and the post-review correctness follow-up are complete. Milestone H is complete through H6 with its release decision held (H7). The subsequent five-task maintenance run is also integrated: dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the exact API CORS allowlist (`2a313d7`), Oxlint 1.85 adoption (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`). The post-hold Astra remediation is integrated as well: findings F-01…F-10 are closed through `8a4ca22`, one branch and one focused regression per finding (`reports/progress_151_astra_remediation.md`).

Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

**Checkpoint `2026-09-18-after-lottie-core`** (`docs/checkpoints/2026-09-18-after-lottie-core/`) records the state it was written from: `main` stood at `47d3368a2b54…` then, the Lottie import core (Milestone F item 10, first slice) was merged with `--no-ff` at `ff32d6c` and pushed, and its branch `feat/lottie-import-core` is kept at `f76ae6a` as the review artefact. The checkpoint folder carries the summary (`README.md`), the tasklist (`TASKLIST.md`), a copy-paste next-session prompt (`RESUME_PROMPT.md`) and a machine-readable summary (`STATE.json`); the task record is `reports/progress_124_checkpoint_after_lottie_core.md`. The Milestone F study is merged (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`); **item 11 (evaluator profiling) is implemented** on `chore/evaluator-profiling-harness` as measurement only (`reports/progress_118_evaluator_profiling.md`), **item 12’s first step (validated import boundary)** is merged at `44218a6` (`reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix executed as fixtures, the legacy migration report, and the autosave restore routed through the same boundary) is implemented on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design** is delivered in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`; item 10’s **first implementation slice (the import core)** is **merged into `main`** at `ff32d6c` (`reports/progress_123_lottie_import_core.md`), its **second slice — layer masks + track mattes — is merged at `8670b2a`** (`reports/progress_125_lottie_mask_matte_slice.md`), its **third slice — text, image and precomp layers — is merged at `bda62cb`** (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **final slice — the import entry point with the report-before-replace UX — is merged at `3b30bff`** (`reports/progress_127_lottie_import_entry_report_ux.md`): the entry point that slice added was later folded into the single `Import` control in the header, which classifies the chosen file by its content — a Lottie document parses in memory, shows blockers and losses before anything is applied, cancels as a true no-op, applies only on an explicit confirm through the existing project authority, and reconciles imported layer types onto existing KCS types the OGraf export accepts; item 10 is therefore complete. Milestone F item 10 is then complete apart from the follow-ups listed below.

- Task 105 (export diagnostics remediation UX): blocking OGraf export diagnostics carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.
- Task 107 (track-matte source selection affordance): the matte source relation, whichever model holds it, is resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps its self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers.
- **Milestone A (canvas tangent handle authoring) — MERGED.** Selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex reveals its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-clicking a vertex toggles corner ↔ smooth with neighbour-derived symmetric handles. One history entry per completed drag; `Escape` cancels a drag without recording one.
  - Integration path: the original branch `feat/canvas-tangent-authoring` was reviewed across six rounds (final verdict `READY`, all five findings closed) and replayed onto current `main` as `feat/canvas-tangent-authoring-replay`, then fast-forward merged. No rebase, no merge commit, no force push, no history rewrite.
  - Not covered: vertex add/remove, multi-vertex transforms, keyboard nudging, handle constraints, boolean or trim-enabled freeform layers, broadcast mode.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Authoring publication — 2026-10-05

- The pending authoring work adds position-only layer bonds, text/freeform Boolean operands, text stroke parity between canvas and OGraf, and an opacity keyframe control. Timeline segment editing, transport layout, media/text drawers, and sidebar transitions are reconciled with the existing authorities.
- Same-frame property edits now match the sequence identity. Edit-mode stage rendering evaluates the active sequence instead of hardcoding `Sequence`; the selection gizmo and painted geometry follow the same authored pose. Broadcast retains its runtime sequence selection.
- Browser proof: a keyframed circle in the second sequence moves 100 screen pixels right and 40 down; the first sequence's x value remains -100. A bonded circle/text pair moves by the same -60/+20 screen-pixel delta.
- Six meaningful publication groups use owner-approved retrospective author dates: 2026-08-29, 2026-09-05, 2026-09-12, 2026-09-19, 2026-09-26, and 2026-10-05. Committer dates record actual creation; these dates do not claim uploads or development occurred on those earlier days. No empty commits, old-branch replay, shared-history rewrite, or force push is part of this publication.
- The old tangent and presentation review branches remain historical artefacts. The pre-architecture mask-gizmo patch is not replayed. Release tags, the held draft release, package publication, external QA folders, and OMP configuration remain unchanged.
- Remaining dependency warning: the current audit reports one moderate `fast-uri` vulnerability (GHSA-hrr3-gc8f-f4qj). Remediation requires a separately approved dependency change; this publication does not run `npm audit fix`.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, the track-matte source selection affordance, and Milestone A canvas tangent handle authoring are present in the accepted main line. OMP tooling remains separate.

## Validation status — authoring publication, 2026-10-05

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 130 files / 2,008 tests; `npm run check` |
| OGraf fixture validation | PASS | `npm run validate:ograf` — offline against the vendored closure |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Chromium tests |
| Full Chromium | PASS | 255 tests; `npx playwright test --project=chromium --retries=0`; V6 QA also passes its 3 tests |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` |
| TypeScript | PASS | TypeScript 7.0.2; `npx tsc -b --pretty false` and the build/check paths pass |
| Lint | PASS | Oxlint 1.85.0 clean, including unused-disable reporting at error severity |
| Production build | PASS | Vite 8.3.0 production bundle |
| Dependency audit | WARNING | `npm audit --audit-level=low`: one moderate `fast-uri` advisory, GHSA-hrr3-gc8f-f4qj; dependency changes are outside this approved publication scope |
| Publication CI | SEPARATE REMOTE GATE | Checked after normal push; inspect the publication tip's GitHub Actions run rather than treating earlier Astra/maintenance CI as current evidence |

## Post-review correctness follow-up (complete)

The full-project review's release-blocking findings are closed, one task at a time and one branch each: **H-01** at `0c19751`, **H-03/H-04/M-03** at `fc672f2`, **M-01/M-02/H-05** at `85c3929`, **H-02** at `ac3bda1`, **H-06** at `352d272`, **M-04** at `16e1610`, **M-05** at `2b0bba0`. The final correctness gate and finding map are in `reports/progress_141_astra_correctness_followup_summary.md`. Its later maintenance observations are now closed: the tracked runtime SQLite file at `b3f3c6c`, unrestricted browser CORS at `2a313d7`, and dialog opener focus restoration at `5cb8a45`.

## Post-hold Astra remediation (complete)

The Astra audit's findings are closed, one branch and one focused regression each: **F-01** mixed legacy/channel round trip at `2c6e013`; **F-02** legacy import validation at `b8718d2`; **F-03** Lottie numeric property forms at `e19b5fe`; **F-04** OGraf procedural animation at `8002659`; **F-05** archive size accounting at `3fa71ff`; **F-06** dropped-media persistence at `645927a`; **F-07** preset storage boundaries at `c12d773`; **F-08** naming-dialog focus lifecycle at `4cd276b`; **F-09** React `act` warnings at `8a4ca22`; **F-10** the stale live-document claims this reconciliation closes. The record, the reproduction evidence and the remaining limitations are in `reports/progress_151_astra_remediation.md`. An OGraf export now refuses a scene whose layer carries an in/out motion preset (`OGRAF_UNSUPPORTED_PROCEDURAL`) because the generated runtime renders the timeline only — that is a deliberate capability boundary, not a defect.

## Milestone H — release readiness (COMPLETE — H1–H6 merged; H7 held)

The controlled release-readiness pass ran end to end and its evidence is `reports/progress_142_release_readiness_audit.md` (audit), `reports/progress_144_oxlint_1_85_triage.md` and `reports/progress_145_jsdom_30_1_triage.md` (the two dependency triages), `reports/progress_143_ci_typecheck_step.md` (the audit's one required fix) and `reports/progress_146_final_release_gate.md` (the gate).

- **Audit verdict:** READY WITH REQUIRED FIXES — one required item, and it was fixed: the CI step named "TypeScript Type Check" ran `npx tsc --noEmit`, which builds no referenced project and therefore checked no project file, so its green tick meant nothing. The step and the `check` script now run `npx tsc -b --pretty false` (151 project files), committed at `b4bf3c0`.
- **Option C (TypeScript 6→7, Vitest 4→5): closed after the hold** — TypeScript 7.0.2, Vitest 5.0.2, and `@vitest/coverage-v8` 5.0.2 are merged at `37904fb`; the full local gate and CI pass.
- **Oxlint 1.85: closed after the hold** — adopted at `feca773`. Three genuine findings were fixed; deliberate latest-ref and synchronization-effect patterns carry only line-specific suppressions with adjacent rationale.
- **`jsdom` 30.1.x: closed** — the bump was taken at `c1431db` with one test-only object-URL shim in `src/tests/setup.ts`; jsdom implements neither `createObjectURL` nor `revokeObjectURL`, and 30.1.1's Blob no longer carries what Node's implementation follows.
- **Final release gate: RELEASE READY WITH DOCUMENTED DEFERRALS** on clean `main` at `c1431db` — build, type check, 126 files / 1,934 tests, lint, `validate:ograf`, `qa:release` (2 Chromium), the Lottie/matte/export browser specs (8), `qa:v6` (3), `npm run check`, the state check (35 checks at that commit — the total scales with the number of live and bundle documents scanned, so a later count is not comparable), `npm audit` (0), `git diff --check`, and the API health plus the sqlite3 binding on this machine.
- **H6 — the live documents and the handoff are reconciled** at `5b68543` (`reports/progress_147_milestone_h_docs_handoff.md`), and the final handoff refresh for the held state followed it (`reports/progress_148_final_handoff_after_hold.md`). That merge changed documents only: the code delta between the gated `c1431db` and `5b68543` is empty.
- **H7 — the release decision: HELD by user decision.** No tag, release or npm action was taken. `v1.1.0-rc.1` still points at `46d2a3e59e065816d972dcd56951803951b577f6`, the GitHub release is still a draft prerelease, the package is private at `1.1.0-rc.1`, and nothing was published. The decision is no longer open — it is a hold — and a future release still needs explicit user instruction.
- **Post-hold maintenance:** the five approved maintenance tasks are merged and green through `37904fb`; they do not alter H7, move the tag, publish the draft, or publish npm.

## Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed, and **Milestone A is merged**.
- **Milestone B (graph + keyboard accessibility, item 4) — MERGED** at `96e8f9d`: the timeline keyframe diamonds are named keyboard buttons with a lane-local arrow walk, the value graph exposes a labelled group with keyboard-editable points, decorative SVG geometry is hidden from assistive tech, and focus rings were added. One review round returned BLOCKED (3 findings, 6 over-claims), all closed; the re-review returned READY WITH WARNINGS.
- Milestones A–G and H1–H6 are complete. The release decision H7 remains held. The maintenance follow-ups previously listed as deferred or open are closed through `37904fb`: dialog focus restoration, SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5. No further package, workflow, tag, release, or npm action is implicit; each requires explicit approval.
- Publish/finalize the GitHub draft only with further explicit user instruction.
- No npm publication occurred; package remains private at `1.1.0-rc.1`.
- Branch cleanup needs approval: `feat/canvas-tangent-authoring-replay` was replayed into `main` at `077911b` and is now behind it (the branch is kept only as an artefact); `feat/canvas-tangent-authoring` is kept as the Milestone A review artefact.

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
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- **Milestone D item 6 — state consistency check — MERGED** at `b91e8b9` (follow-up `be76df9`): `node scripts/check-state-consistency.mjs` fails when the live docs contradict the tag/`main` SHA, when the roadmap and the next action disagree, when the handoff upload instruction is superseded, or when the bundle carries source/test/binary copies, collapsed Windows paths or secret markers (see `reports/progress_111_state_hygiene_gate.md`).
- **Item 9 (dependency and warning maintenance) — COMPLETE.** Option A merged at `3923141`; Option B merged at `73426e5` and brought `npm audit` to zero; `engines`/npm-12 `allowScripts` merged at `1a12d79`; `jsdom` 30.1.1 was taken at `c1431db`; Oxlint 1.85 was adopted at `feca773`; and TypeScript 7 plus Vitest and `@vitest/coverage-v8` 5 merged at `37904fb`.
- The original Option A preserved dependency versions while fixing the warning catalogue and local sqlite3 binding. Its approval-gated follow-ups were then handled on isolated branches with their own validation. The runtime database is now ignored rather than tracked, and the API starts from a clean checkout by creating and seeding it through the existing SQLite authority.

---

## 6. Grouped Roadmap

# KCS Grouped Roadmap Execution Plan

Orchestrator close-out for the grouped post-RC roadmap run. Milestones A–G are complete. Milestone H is complete through H6 and its release decision remains held at H7. The later approved maintenance run closed dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the API CORS allowlist (`2a313d7`), Oxlint 1.85 (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`) without moving any release artefact. The post-hold Astra remediation then closed findings F-01…F-10 through `8a4ca22` (see `reports/progress_151_astra_remediation.md`), also without moving any release artefact.

## Milestone map and status

| Milestone | Roadmap items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | `feat/canvas-tangent-authoring` (replayed as `feat/canvas-tangent-authoring-replay`) | **MERGED** — five review findings closed across six rounds (final verdict READY), fast-forward merged into `main` |
| B — Graph + keyboard accessibility | 4 | `feat/graph-accessibility` | **MERGED** — one review round returned BLOCKED (3 findings, 6 over-claims), all closed; re-review returned READY WITH WARNINGS; fast-forward merged at `96e8f9d` |
| C — First export / onboarding flow | 5 | `feat/export-onboarding` | **MERGED** — six review rounds; final gate verdict READY WITH WARNINGS; fast-forward merged into `main` at `c2dcb22` |
| D — State / CI / warning hygiene | 6, 9 | `chore/state-hygiene-gate`, dependency/toolchain maintenance branches | **COMPLETE** — the state checker, Option A, Option B, `engines`/npm-12 `allowScripts`, `jsdom` 30.1.1, Oxlint 1.85, and TypeScript 7 / Vitest 5 are merged. The later maintenance run also removed the runtime SQLite database from tracking, restricted API browser origins, and restored dialog opener focus. Latest maintenance commit: `37904fb` |
| E — OGraf QA / schema hardening study | 7, 8 | `docs/milestone-e-ograf-qa-study`, `chore/ograf-offline-schema-closure`, `test/ograf-folder-qa-automation` | **COMPLETE** — study and plan delivered (`docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`, `reports/progress_114_ograf_qa_study.md`); **item 7 (7-A) implemented and merged** on `chore/ograf-offline-schema-closure` (`reports/progress_115_ograf_offline_schema_closure.md`) and **item 8 implemented and merged** on `test/ograf-folder-qa-automation` (`reports/progress_116_ograf_folder_qa.md`), integrated at `22335a5` with green CI. **Plan only** for anything beyond those two approved scopes |
| F — Interop design and its approved slices | 10, 11, 12 | `docs/milestone-f-interop-study` | **COMPLETE** — the study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`, `reports/progress_117_interop_study.md`): item 10 Lottie mapping contract, item 11 evaluator profiling plan, item 12 editable-KCS-import product/security plan. **Plan only** for every slice that has not been approved yet. **Item 11 approved and implemented** on `chore/evaluator-profiling-harness` (`reports/progress_118_evaluator_profiling.md`): deterministic scenes, an on-demand harness and a first baseline; measurement only, no caching. **Item 12 first step implemented** on `fix/kcs-import-boundary-hardening` (`reports/progress_119_kcs_import_boundary.md`): a validated import boundary with stable refusal codes and limits; item 10 is designed in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, and **item 10's first implementation slice (the Lottie import core) is merged at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`); its **second slice (layer masks + track mattes) is merged at `8670b2a`** (`reports/progress_125_lottie_mask_matte_slice.md`), its **third slice (text, image and precomp layers) is merged at `bda62cb`** (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **final slice (the import entry point with the report-before-replace UX) is merged at `3b30bff`** (`reports/progress_127_lottie_import_entry_report_ux.md`) — **item 10 is complete**; **item 12 is complete and merged** (the unified import entry with its handoff refresh at `a4f8642`, the OGraf package/editable import at `419fc6a`); and **item 9 Option B** (dependency maintenance) is merged into `main` at `73426e5`. Checkpoint `2026-09-18-after-lottie-core` |
| G — Post-review correctness follow-up | review findings H-01…M-05 | one branch per task (`fix/modal-shortcut-isolation`, `fix/import-serialization-transaction-integrity`, `fix/lottie-structure-correctness`, `fix/ograf-inverse-alpha-matte`, `fix/api-network-trust-boundary`, `fix/evaluator-profile-fixtures`, `fix/state-consistency-live-docs`) | **COMPLETE** — the full-project review's release-blocking findings, taken one at a time: each gets its own branch, its own validation, a read-only self-review and an approval-gated fast-forward merge. H-01 (blocking dialogs left the editor's global commands live) is merged at `0c19751`; H-03/H-04/M-03 (import boundary validation, the track authoring-state round-trip and the document transaction) at `fc672f2`; M-01/M-02/H-05 (Lottie parent resolution, static hierarchy and multi-geometry loss) at `85c3929`; H-02 (the OGraf inverted track matte) at `ac3bda1`; H-06 (the unauthenticated API bound to every interface) at `352d272`; M-04 (the evaluator profile fixtures) at `16e1610`. **M-05** (the live-document reconciliation) is merged at `2b0bba0`, and the shallow-checkout CI regression it caused was fixed at `dcbf9f5`, and the final correctness gate ran on `main` after that fix (`reports/progress_141_astra_correctness_followup_summary.md`): every finding is closed. |
| H — Release finalization and approval-gated maintenance | review follow-up decisions | Milestone H branches plus the five maintenance branches plus the nine remediation branches | **NEXT (held)** — **H1–H6 are COMPLETE**, the post-hold maintenance tasks are merged through `37904fb`, and the Astra remediation findings F-01…F-10 are closed through `8a4ca22`. **H7 = HOLD** by user decision: no tag, release, or npm action; artefacts stay at `46d2a3e`. This row keeps the plan's single NEXT marker because the only remaining plan decision is a future explicitly authorized release action. |

Completed earlier: item 1 (export diagnostics remediation UX, Task 105), item 2 (track-matte source selection affordance, Task 107).

## Milestone A — the blocker list that was closed (historical record)

From `reports/progress_108_canvas_tangent_authoring.md` §7:

1. Normalize legacy points in `resolveFreeformPath` (`normalizeClosedPoints`) to match the contract.
2. Complete the §7 selection model: handle-selection state, empty-canvas "clear overlay selection only", and resetting the overlay selection when the selected layer changes.
3. Restrict the Escape listener to the drag lifetime and close the batch deterministically for a pointerdown-then-Escape with no move.
4. Build the contract's verification matrix: real-origin coordinate parity under rotation/non-uniform/negative scale; behaviour tests for every `StageCanvas` eligibility guard (extract the guard list into a pure predicate so it is testable); canonical-path priority; real `useHistory` undo/redo/cancel entry counts; serialization/import round-trip of a materialized path; OGraf byte-parity for an untouched canonical path; one manual editor smoke.
5. Decide the smooth-handle-at-anchor edge: dragging a handle exactly onto its anchor must not silently collapse the counterpart (`Math.hypot(...) || 1`).

All five items were closed, the focused re-review and its follow-up rounds returned READY, and the milestone was replayed and fast-forward merged into `main` (`077911b`) with a green CI run. This list is history, not open work.

## Milestone B — Graph + keyboard accessibility (roadmap item 4)

- Scope: keyboard reachability and screen-reader labelling for graph/path editing surfaces that already exist (`TemporalGraphPanel`, keyframe rows, selected-keyframe sections).
- Constraints: no graph engine rewrite, no broad style churn, reuse existing graph/value/channel authorities.
- Validation: focused keyboard/a11y tests, one Playwright smoke, full suite, independent review.
- Gate: stop if the work grows beyond narrow UI/accessibility.

## Milestone C — First export / onboarding flow (roadmap item 5)

- Scope: a short "first successful OGraf export" path for new users, reusing the Task 105 diagnostics, existing templates, and the existing export UI.
- Constraints: no host/vendor contract invention, no package format change, no `Desktop\KCS` interaction.
- Validation: onboarding/sample fixture tests, `qa:release`, full suite, independent review.

## Milestone D — State / CI / warning hygiene (roadmap items 6, 9)

- Item 6 (current-state consistency check) is a documentation/tooling task: a small script or CI check that fails when live docs contradict the tag/main SHA. No gate beyond normal review.
- Item 9 and its approved follow-ups are complete: Option A (`3923141`), Option B (`73426e5`), `engines`/npm-12 `allowScripts` (`1a12d79`), `jsdom` 30.1.1 (`c1431db`), Oxlint 1.85 (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`).

## Milestone E — OGraf QA / schema hardening study (roadmap items 7, 8)

- Item 7 (offline schema closure): **7-A approved and implemented** — the eight pinned documents (33,567 B) are vendored under `fixtures/ograf/schema/` with both upstream notices in `NOTICE.md`; `npm run validate:ograf` is offline and deterministic by default and verifies every pin, `--online` is the refresh path, and the existing CI step needed no change. Evidence: `reports/progress_115_ograf_offline_schema_closure.md`.
- Item 8 (downstream folder QA automation): **approved and implemented** — the generator, the ZIP/folder comparison and the host-limited report live on `test/ograf-folder-qa-automation` and reuse the canonical compiler and path-safety authorities, with the QA root as an explicit required argument. Evidence: `reports/progress_116_ograf_folder_qa.md`.

## Milestone F — Interop design and its approved slices (roadmap items 10, 11, 12)

The deliverables are the study, the Lottie import mapping design and the editable-KCS-import plan; implementation runs slice by slice, each slice behind its own approval. The study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`) and fixes each deliverable contract; **item 11 is implemented** (`perf/sceneBuilder.ts`, `perf/evaluator-profile.perf.ts`, `src/tests/evaluatorProfileScenes.test.ts`, `reports/progress_118_evaluator_profiling.md`) as measurement only — no caching, no threshold; **item 12’s first step (validated import boundary) is implemented** (`src/utils/importValidation.ts`, `reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix, migration report, autosave through the boundary) on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design is delivered** (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, `reports/progress_120_lottie_mapping_design.md`) with its four open questions settled by the user, and its **first implementation slice (the import core)** is **merged into `main` at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`): document timing, shape/solid/null layers, transforms, shapes and the segment-to-keyframe easing rules, with every unconverted construct reported; its **second slice (layer masks + track mattes)** is merged at `8670b2a` (`reports/progress_125_lottie_mask_matte_slice.md`) with the 8-mask limit restored, its **third slice (text, image and precomp layers)** is merged at `bda62cb` (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **import entry point with the report-before-replace UX** is merged at `3b30bff` (`reports/progress_127_lottie_import_entry_report_ux.md`), **item 12's unified import entry is merged** (`reports/progress_128_unified_import_entry.md`) — one control that classifies by content and keeps the existing `.kcs`, legacy and OGraf routing — and its **OGraf package/editable import** is merged into `main` at `419fc6a` (`reports/progress_129_ograf_editable_import.md`), with the handoff refresh at `a4f8642`; **no further implementation without a separate explicit approval**, and the design gate in §Approval gates applies before any code. The historical checkpoint `2026-09-18-after-lottie-core` records the state after the first slice only.

## Approval gates

- Package/lockfile/workflow/dependency changes: explicit user approval required before editing.
- Release/tag/draft-release/npm: explicit user approval required; unchanged by this run.
- Interchange work (Lottie, editable KCS import): design approval before code.
- Any milestone that grows into a broad refactor: stop and report.

## Handoff policy (unchanged)

`chatgpt_handoff/latest/` is a minimal, task-specific bundle: `README.md`, `manifest.txt`, the current report(s), `NEXT_SESSION.md`, `PROJECT_STATE.md`, and optionally the directly relevant contract/plan docs. Never source or test files — flattened copies named `src__*test*` matched Vitest's include glob and broke CI in runs `35094144225`/`35095655446`. Never copy the bundle into `C:\Users\ertugrul.ak\Desktop\KCS`.

## Recommended next prompt

"KCS RELEASE FINALIZATION (Milestone H, approval-gated — currently HELD). Milestone H is complete through H6, and the five approved post-hold maintenance tasks are merged with green CI through `37904fb`: dialog focus restoration, runtime SQLite repository hygiene, the exact API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5.

The release decision H7 remains a HOLD. `v1.1.0-rc.1`, the GitHub draft prerelease, and the private package metadata are unchanged at `46d2a3e59e065816d972dcd56951803951b577f6`; nothing was published. A future publish, finalization, or re-tag remains a separate explicit decision."

Historical notes: "KCS MILESTONE A COMPLETION …" was carried out (five items closed, READY, replayed and fast-forward merged at `077911b`); "KCS MILESTONE B — GRAPH + KEYBOARD ACCESSIBILITY …" was carried out (merged at `96e8f9d`); "KCS MILESTONE C — FIRST EXPORT / ONBOARDING FLOW …" was carried out: implemented on `feat/export-onboarding`, gate-reviewed (READY WITH WARNINGS) and fast-forward merged at `c2dcb22` (see `reports/progress_110_export_onboarding.md`).

---

## 7. Historical Astra Record

# KCS Development Report — Astra Correctness/Security Remediation

Metadata:
- Date: 2026-09-28
- Milestone: post-hold remediation of the Astra correctness/security findings F-01…F-10
- Starting HEAD: `7daacce46f0892649e15172d072d310ae4b4dbf0` (main, matching `origin/main`)
- Ending HEAD: the focused documentation commit named `docs: reconcile astra remediation state`; its hash cannot be embedded in its own content
- Integration: one branch per finding, fast-forward only; every implementation commit has a green `main` CI run
- Report number: 151

# 1. Executive Summary

Nine findings were reproduced first and fixed one at a time, each on its own branch with its own
focused regression test, then fast-forwarded into `main` and pushed. The tenth (stale live-document
claims) is this documentation task itself.

The six release-blocking findings were behavioural: a mixed legacy/channel animation lost the
channels the evaluator still resolved from the legacy composite on a save/load cycle; a legacy
project document could bypass the semantic validation that a scene receives; a standard Lottie
position/handle form was silently imported as zero; an OGraf export produced a different animation
than the editor; an OGraf package member could be admitted by under-declaring its size; and a file
dropped on the stage was persisted as a `blob:` URL that died with the page.

Two medium findings (preset storage exceptions, naming-dialog focus lifecycle) and the test-hygiene
finding (101 CI-reported React `act` warnings) were closed as well.

No release action was taken: H7 remains HOLD, the tag, the GitHub draft prerelease and the private
package metadata are unchanged.

# 2. Original Objectives

In scope: reproduce each finding, fix it narrowly on its own branch, add a consumer-visible
regression test, validate locally, fast-forward into `main`, push, confirm green CI, then reconcile
the live documents and the handoff. Out of scope: any release action, branch deletion, dependency or
workflow change, and any change to `C:\Users\ertugrul.ak\Desktop\KCS`,
`C:\Users\ertugrul.ak\Desktop\ograf-graphics`, `origin/without-mask` or the global OMP configuration.

# 3. Problems Discovered and Closed

1. **F-01 — mixed legacy/channel round trip lost the fallback.** `toSceneData` wrote the canonical
   channels *instead of* the legacy composite keyframes, but `evaluateTransform` reads a channel only
   when it carries keyframes for the active template and otherwise falls back to the composite. A
   track with a populated `x` channel and a legacy `y` animation therefore changed on save/load
   (`y = 150` became `0`). Fixed at `2c6e013`.
2. **F-02 — the legacy project format bypassed semantic validation.** A document whose
   `characterParts` array merely existed was accepted, so `{"characterParts":[null]}` imported
   "successfully", applied `[null]`, and crashed the evaluator on the first frame. Fixed at `b8718d2`.
3. **F-03 — Lottie numeric property forms were silently zeroed.** A split position
   (`p: {s: true, x: …, y: …}`) imported both axes as `0`, and a handle written per dimension
   (`o: {x: [0.25, 0.3], y: [0.1, 0.2]}`) became a `{x: 0, y: 0}` curve — both with no diagnostic.
   Fixed at `e19b5fe`.
4. **F-04 — the OGraf export did not reproduce procedural animation.** For `inAnimPreset: 'fade'` with
   `inAnimDuration: 60` at frame 15, the editor produced opacity `0.578125`, the OGraf evaluator
   `0.875` (it never received the duration) and the generated runtime `1` (it renders the timeline
   only). The export now refuses such a scene with `OGRAF_UNSUPPORTED_PROCEDURAL` instead of shipping
   a graphic that plays a different animation. Fixed at `8002659`.
5. **F-05 — the OGraf ZIP budget trusted one declared size.** A stored member of 33,554,433 bytes
   (limit 33,554,432) was admitted after its declared uncompressed size was tampered to `1`, because
   the budget counted the declaration while the reader copied the compressed size. Fixed at `3fa71ff`.
6. **F-06 — dropped media did not survive a reload.** The stage stored `URL.createObjectURL(file)` in
   the document, so the autosave persisted a page-scoped `blob:` URL and the image failed to load
   after a reload. Fixed at `645927a`.
7. **F-07 — preset storage exceptions escaped the hook.** A `getItem` `SecurityError` failed the
   mount and a `setItem` `QuotaExceededError` failed the write, because `localStorage` was used
   without the try/catch this project requires for external boundaries. Fixed at `c12d773`.
8. **F-08 — the naming dialog's focus lifecycle was incomplete.** Tab walked out of the modal, Cancel
   left focus on `body`, the dialog had a delayed focus callback that could target an unmounted node,
   and its icon-only close control had no accessible name. Fixed at `4cd276b`.
9. **F-09 — the suite reported 101 React `act` warnings on CI.** The serialization tests applied
   documents outside `act`, and the environment never declared React's act environment, so the
   warnings appeared only on a slower machine. Fixed at `8a4ca22`.
10. **F-10 — stale live-document claims.** `README.md` recommended `npx tsc --noEmit`, which checks no
    project file; `NEXT_SESSION.md` and `PROJECT_STATE.md` called the replay branch "identical to
    `main`" while it is 152 commits behind; and `NEXT_SESSION.md` still described a separate
    "Import Lottie" control that the unified import entry replaced. Fixed by this task.

# 4. Files Created

- `e2e/dropped-media-persistence.spec.ts` — real drop → autosave → reload proof for F-06.
- `e2e/new-item-modal-focus.spec.ts` — real keyboard smoke for the F-08 focus trap.
- `reports/progress_151_astra_remediation.md` — this record.

# 5. Files Modified

- `src/utils/legacyKeyframeConversion.ts`, `src/hooks/useSerialization.ts` — F-01: a
  `fillChannelsFromLegacyKeyframes` helper (channels the evaluator would resolve from the composite
  are written with those values) and its use in `toSceneData`; the hook also exports
  `UseSerializationApi`, its public surface as a named type.
- `src/utils/importValidation.ts`, `src/tests/importValidation.test.ts`,
  `src/tests/importCompatibilityMatrix.test.ts`, `src/tests/useSerialization.test.ts` — F-02: the
  legacy semantic pass (`legacyPartProblem`, `legacyProjectProblem`), the shared layer-value checks
  both shapes use, and the fixtures that had described unapplyable legacy documents.
- `src/interop/lottie/mapDocument.ts`, `src/interop/lottie/temporal.ts`,
  `src/tests/lottieImport.test.ts` — F-03: split positions, per-dimension handle components, and
  `LOTTIE_UNREADABLE_POSITION` / `LOTTIE_UNREADABLE_EASING` reports instead of fabricated zeros.
- `src/ograf/types.ts`, `src/ograf/diagnostics.ts`, `src/ograf/validation.ts`,
  `src/tests/ografDiagnostics.test.ts`, `src/tests/ografExport.test.ts`,
  `src/tests/ografGeneratedParity.test.ts` — F-04: the `OGRAF_UNSUPPORTED_PROCEDURAL` rule with its
  remediation, and the three-way editor/evaluator/runtime parity test for a supported scene.
- `src/ograf/packageImport.ts`, `src/tests/ografPackageImport.test.ts` — F-05: per-method size
  accounting, the stored-entry consistency rule and the unsupported-compression refusal.
- `src/components/Canvas/StageCanvas.tsx`, `src/tests/ografLegacyCompatibility.test.ts` — F-06: the
  drop handler stores the file's own bytes and the export resolves that form.
- `src/hooks/usePresets.ts`, `src/tests/usePresets.test.ts` — F-07: the storage boundary.
- `src/hooks/useDialogFocusRestoration.ts`, `src/components/Modal/NewItemModal.tsx`,
  `src/components/Modal/ConfirmationDialog.tsx`, `src/components/Modal/ImportReportDialog.tsx`,
  `src/tests/dialogFocusRestoration.test.tsx` — F-08: the shared focus trap and the dialog migrations.
- `src/tests/setup.ts`, `src/tests/importAtomicity.test.tsx` — F-09: the declared act environment and
  the document calls moved inside `act`.
- `README.md`, `CHANGELOG.md`, `NEXT_SESSION.md`, `PROJECT_STATE.md`,
  `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`, `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`,
  `docs/README_INDEX.md`, `reports/README.md` — F-10 and the record of the fixes.
- `chatgpt_handoff/latest/**`, `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — the bundle rebuilt from
  the current documents only.

# 6. Architecture Overview

```text
Editor document -> toSceneData -> channels (+ the composite values the evaluator would fall back for)
Legacy document -> importValidation (legacy semantic pass) -> the legacy apply path
Lottie document -> readNumericProperty/handle readers -> per-channel timing -> KCS channels
Scene -> validateSceneForOGraf -> compileOGrafPackage -> generated runtime (timeline only)
Untrusted archive -> admitPackageEntry (per method, materialised bytes) -> fflate -> guarded decode
Dropped file -> FileReader data URL -> document -> autosave -> reload
Dialog open -> shared focus restoration + shared focus trap -> close -> opener restored
```

No parallel geometry, animation, playback or serialization authority was introduced; each fix either
extended the authority that already owned the behaviour or made the export refuse what it cannot
reproduce.

# 7. Data Model Changes

No serialized field was added or removed. `SceneData` still writes channels and no `keyframes[]`
(`fillChannelsFromLegacyKeyframes` only fills channels the evaluator would otherwise resolve from the
composite), the Lottie keyframe type keeps the document's handle lists until the channel that maps a
dimension resolves its own component, and a dropped image now reaches the document as a `data:` URL
instead of a `blob:` URL.

# 8. Coordinate Space Model

Unchanged. No canvas, transform, selection, hit-test, drag, mask or animation coordinate space was
altered.

# 9. Component / Module Walkthrough

`fillChannelsFromLegacyKeyframes` states the evaluator's own precedence rule (a channel scope with
canonical keyframes wins; the others are filled from the converted composite). `legacyProjectProblem`
reuses the scene pass's layer-value checks and adds the part rules the verbatim legacy apply path
needs. `mapLottieSegmentTiming` now resolves each handle component for the dimension its channel
maps. `validateLayer` refuses a procedural preset the runtime cannot reproduce.
`admitPackageEntry` derives the budget from the compression method. `StageCanvas` reads the dropped
file once and stores its bytes. `useDialogFocusTrap` owns the keyboard contract the three modals
share.

# 10. Important Code Changes

F-02 split the layer-value checks out of `layerProblem` into `sharedLayerValueProblem` so the scene
and legacy passes cannot drift. F-04 added `OGRAF_UNSUPPORTED_PROCEDURAL` to the diagnostic contract
(a `Record<OGrafDiagnosticCode, …>` entry is required, so the code cannot be emitted without a
remediation). F-05 replaced "declared size" with "materialised bytes by method". F-06 removed
`URL.createObjectURL` from the drop path entirely, which also removed the object URL that had no
revocation.

# 11. Public Interfaces

- `useSerialization` now exports `UseSerializationApi`, the type of its return value (additive).
- New server-free diagnostics: `LOTTIE_UNREADABLE_POSITION`, `LOTTIE_UNREADABLE_EASING`,
  `OGRAF_PACKAGE_INCONSISTENT_SIZE`, `OGRAF_PACKAGE_UNSUPPORTED_COMPRESSION`,
  `OGRAF_UNSUPPORTED_PROCEDURAL`.
- `admitPackageEntry` takes the archive reader's full entry header (`name`, `size`, `originalSize`,
  `compression`); it is exported for tests only.
- No endpoint, response schema, saved-project format or component prop changed.

# 12. Algorithms and Geometry

F-01's fill is a per-channel set operation over `(channel, template scope)` covered by canonical
keyframes. F-05's accounting is O(entries). F-03's handle resolution is a per-dimension index with a
last-entry fallback, matching the value reader that already existed.

# 13. Interaction / UX Behavior

A dropped image now survives a reload. The naming dialog keeps the keyboard inside itself, names its
close control, and returns focus to its opener on Cancel, submit and Escape; the confirmation and
import-report dialogs use the same trap. An OGraf export of a scene whose layer carries an in/out
preset now reports a blocker with an actionable remedy instead of producing a graphic that plays a
different animation, and the first-export readiness check reports the same blocker because it reads
the same authority.

# 14. Design Decisions

- Fix the fallback by writing the values the evaluator would resolve, rather than by re-introducing
  `keyframes[]` to the file: the import path drops a legacy keyframe's `templateId`, so the canonical
  form is the one that survives a round trip faithfully.
- Validate legacy documents against the values the consumer dereferences, and only those, so a valid
  legacy file is never refused.
- Report an unreadable Lottie handle and keep the segment linear instead of inventing a zero curve.
- Refuse an export the runtime cannot reproduce instead of shipping a different animation; the
  alternative (porting a second preset engine into the generated runtime, or baking preset motion
  into `scene.kcs`) would either duplicate an authority or cost the package its editable scene.
- Measure the archive budget by the bytes the reader will materialise for that compression method,
  and refuse a method whose output cannot be bounded, rather than parsing the ZIP grammar a second
  time.
- Declare React's act environment in the test setup so the suite reports the defect on every machine.

# 15. Invariants That Must Be Preserved

- Canonical channels win where they carry data for a template scope; the composite fallback stays the
  fallback.
- The import boundary refuses before any state update; a refused document leaves the editor untouched.
- The generated OGraf runtime renders the timeline; anything it cannot reproduce is refused at
  validation, never silently dropped.
- An archive member is measured by the bytes it materialises, and the archive is decoded under the
  existing count, path, duplicate and prototype-key guards.
- A persisted document never depends on a page-scoped object URL.
- `localStorage` is an external boundary: a failure is contained, never propagated as a crash.
- Dialog focus is owned by one authority; a disabled action is not a focus stop.
- H7 remains HOLD until a new explicit release instruction.

# 16. Testing and Verification

Per finding: the focused files passed, then `npx tsc -b --pretty false`, `npm run lint`,
`npm run build`, `npm run validate:ograf`, the full Vitest suite, `node scripts/check-state-consistency.mjs`
and `git diff --check`; the OGraf-affecting tasks also ran `npm run qa:release`, `npm run qa:v6` and
the export/Lottie/matte browser specs, and the UI tasks ran their own browser smoke.

- F-01: 104 tests in `useSerialization.test.ts`; the suite reached 1,957 tests.
- F-02: 38 tests in `importValidation.test.ts`; `sequencer-project.json` and the server's seed project
  were verified to still validate.
- F-03: 103 tests in `lottieImport.test.ts` plus `e2e/lottie-import-report.spec.ts` (3 tests).
- F-04: `ografExport`/`ografGeneratedParity`/`ografSvg`/`ografV6Parity`/`ografDiagnostics` (114 tests),
  `qa:release` (2), `qa:v6` (3).
- F-05: 13 tests in `ografPackageImport.test.ts`: the tampered stored member end to end, the
  per-method size and total-budget rules through the reader's own seam, and the unsupported-method
  refusal. (The first version of these tests allocated ~150 MB of payloads, which made an unrelated
  allocation-heavy test in the same file time out under parallel load; the rule-level cases replaced
  the redundant end-to-end ones, and the file is now faster than before the fix.)
- F-06: `e2e/dropped-media-persistence.spec.ts` passed with the fix and was shown to fail against the
  pre-fix handler (it persisted `blob:http://127.0.0.1:5188/…`).
- F-07: 29 tests in `usePresets.test.ts`.
- F-08: 19 tests in `dialogFocusRestoration.test.tsx` plus `e2e/new-item-modal-focus.spec.ts`.
- F-09: full-suite `act` warnings measured 110 with the environment declared, 0 after the fix
  (128 files / 1,995 tests pass).
- F-10: `node scripts/check-state-consistency.mjs` PASS and `git diff --check` clean.

# 17. Manual QA Results

- PASS — a PNG dropped on the stage is stored as `data:image/png;base64,…`, and after a page reload
  the rendered `<image>` resolves with HTTP 200 from the document's own bytes.
- PASS — the naming dialog focuses its field, six Tabs and three Shift+Tabs never leave the modal,
  and `Escape` returns focus to the "Create New Sequence" opener.
- PASS — the OGraf editor/evaluator/runtime parity scene renders the same transform at frames
  0/15/30/45/60 through `evaluateOGrafScene`, `renderOGrafSvg` and the generated runtime.

# 18. Regression Risk Assessment

- F-01: LOW-MEDIUM — the fill is per template scope and the round-trip is pinned by six tests,
  including canonical precedence and stability across a second cycle.
- F-02: MEDIUM — it refuses documents that were previously accepted. The pass validates only the
  values the legacy apply path dereferences, and both real legacy samples in this repository still
  import; the risk is a legacy file that is genuinely unapplyable.
- F-03: LOW — the changed numbers are the ones the document actually describes.
- F-04: MEDIUM — an OGraf export of a preset-carrying scene is now blocked. That is the finding's
  remedy, and the readiness check reports it before the export is attempted.
- F-05: LOW — the budgets are the same constants, measured against materialised bytes.
- F-06: LOW — a data URL is the form the Media drawer already writes and the export already packages.
- F-07: LOW — a failure that previously escaped now stops at the boundary.
- F-08: LOW-MEDIUM — three dialogs share one trap; the existing dialog tests (44) still pass.
- F-09: LOW — the production change is a type-only export.

# 19. Performance Considerations

No measured regression. F-01 adds a bounded per-channel merge with a set lookup per keyframe;
F-05 adds one comparison per entry; F-06 replaces an object URL with a file read that the drawer
path already performs.

# 20. Dependencies

None added, removed or upgraded. No package, lockfile, workflow or dependency change was made.

# 21. Compatibility

Saved scenes, OGraf packages, manifests, Lottie documents and the API payloads keep their formats.
Legacy project documents are now checked before they are applied, and the two legacy samples in this
repository still import.

# 22. Known Limitations

- The OGraf export cannot carry procedural in/out preset motion; a scene that uses one is refused
  with a remedy (clear the preset and author keyframes, or do not export that scene as a graphic).
- `evaluateOGrafScene` applies the editor's procedural delta without the export gate only when a
  caller bypasses validation; the export path always validates first.
- The archive preflight cannot observe a local/central header disagreement through fflate's API, so
  the budget is bounded per compression method and the decoded scene still passes the KCS boundary.
- Full Vitest on this Windows machine needs a raised per-test timeout for the two tests that spawn
  `git` many times; with the default 5s they can time out under parallel load, which is a pre-existing
  property of those tests, not of this work.

# 23. Technical Debt

The GitHub Actions Node 20 runtime and Ubuntu 26 migration annotations remain (workflow maintenance,
not a product failure). The two CI-reported `act` warnings that originally motivated F-09 were a
symptom of an undeclared test environment; the environment is now declared, so the contract is
enforced on every machine.

# 24. Git Summary

Implementation commits, all fast-forwarded into `main` and pushed:

- `2c6e013` — `fix: preserve mixed channel animation round trips`
- `b8718d2` — `fix: validate legacy imports before apply`
- `e19b5fe` — `fix: preserve lottie numeric property forms`
- `8002659` — `fix: align ograf procedural animation runtime`
- `3fa71ff` — `fix: enforce ograf zip materialization budgets`
- `645927a` — `fix: persist dropped media across reloads`
- `c12d773` — `fix: contain preset storage failures`
- `4cd276b` — `fix: complete new item modal focus lifecycle`
- `8a4ca22` — `test: eliminate react act warnings`

Documentation branch: `docs/audit-state-reconciliation`; commit message
`docs: reconcile astra remediation state`. Integration policy: fast-forward only. No rebase, reset,
force push, branch deletion, tag, release or npm action.

# 25. Updated Project Tree

```text
e2e/
  dropped-media-persistence.spec.ts   [new]
  new-item-modal-focus.spec.ts        [new]
reports/
  progress_151_astra_remediation.md   [new]
chatgpt_handoff/
  CHATGPT_UPLOAD_ONEFILE.md           [rebuilt]
  latest/                             [clean rebuilt document bundle]
```

# 26. Self Review

Good: every finding was reproduced before it was fixed, each fix carries a consumer-visible
regression, the branches stayed small, and the integration was fast-forward only with green CI per
commit. F-04 is the one finding whose remedy is a refusal rather than a new capability, and that is
the contract the finding itself allows. Could improve: the F-05 preflight still cannot see a
local/central header disagreement; the OGraf procedural restriction deserves a dedicated product
decision (bake at export, or implement the presets in the runtime). Uncertainty: F-02 narrows what a
legacy document may contain, so an unapplyable legacy file that used to import and then break is now
refused. Score: 9/10.

# 27. Next Recommended Task

Run the full post-fix regression gate on `main` (this run's Task 11) and then a read-only
release-readiness audit for a future RC candidate; do not publish, finalize or retag.

# 28. Project Status

Milestones A–G are complete, Milestone H is complete through H6 with its release decision held (H7),
and the Astra remediation findings F-01…F-10 are closed. The release tag, draft prerelease, private
package version and npm state are unchanged.

# 29. AI Development Notes

The authorities to reuse: `fillChannelsFromLegacyKeyframes` for the evaluator's channel precedence;
`legacyProjectProblem` (with `sharedLayerValueProblem`) for legacy documents; `resolveHandle` for
Lottie handles; `validateSceneForOGraf`'s procedural rule for anything the generated runtime cannot
reproduce; `admitPackageEntry` for archive budgets; the Media drawer's data-URL form for dropped
media; `useDialogFocusTrap`/`useDialogFocusRestoration` for dialog focus.

---

## 8. Changelog

# Changelog

All notable changes to **Keyframe Character Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- A layer **OPACITY** field in the Transform section, shown as a percentage next to an **Add/Remove Keyframe** button. The field writes through the same `opacity` channel the timeline already animates: while the channel has no keyframe it sets the layer's static opacity, and once it has one, the edit lands on the current frame (adding a keyframe there when the frame is empty) — so an entrance fade is authored by setting 0% on one frame and 100% on another, and each keyframe keeps its own value. It works for every layer kind: shapes, text, images, freeform and cloners.
- Stroke controls for text: a text layer now owns the same fill/stroke paint as shapes, so the Appearance card and the Text card both expose its stroke colour, alpha, width and enable switch, and the canvas paints the authored outline instead of a fixed one. The outline defaults to the canonical 0.5 width text always had, the alignment control stays hidden for text (its renderer cannot split a centered stroke), and the OGraf export writes the authored stroke width, opacity and enabled state for text instead of a hardcoded 0.5.
- Layers can be bonded to each other: select two (or more) layers and press **Bind** in the Inspector, and a position change on either one — a stage drag, the Inspector's position fields, or a multiple selection — moves the others by the same world-space delta. Rotation, scale and opacity stay independent, so a bond is not a parent-child transform; **Unbind** releases it. A copy, a mirrored duplicate and a Boolean group never inherit a bond, and an ancestor/descendant pair is refused with an explanation instead of being moved twice. The bond is saved with the document.
- Boolean operations now accept more than the closed vector shapes: a freeform layer contributes its canonical path, and a text layer contributes its own traced outline — the letters themselves, counters included — so a text and a shape can be unioned, subtracted, intersected or excluded. A text the renderer draws differently (a staggered text animates per character) or an empty text is not offered as an operand, and an environment without a canvas reports the empty result instead of substituting a bounding box. The Inspector's Boolean hint and its section description name the operand kinds they now accept.
- OGraf packages are importable: selecting the `.zip`/`.ograf` the exporter wrote opens a report and, on confirm, replaces the project with the scene the package carries. The archive is decoded in memory with entry-count, entry-size and package-path guards, prototype keys and unsafe, duplicate or reserved paths are refused, and a package without a scene is refused rather than half-imported.
- One import control in the header instead of several: the selected file is classified by what it **contains**, so a KCS project, a legacy project, an OGraf manifest and a Lottie animation all import through the same button, each with its existing behaviour (and the Lottie animation still showing its report before anything is replaced).
- A Lottie (bodymovin) import path: selecting a Lottie file parses it in memory and opens a report that lists the blockers and the losses with their source paths and next steps **before** anything is applied — Cancel leaves the project untouched, and only "Import and replace project" applies the scene through the same validated path the project import uses. Imported layers keep the shapes, text and images they had: a path, a rectangle, a rounded rectangle, an ellipse and a solid all become a freeform whose own path draws exactly the imported geometry, while text and images keep their existing KCS types — so an imported scene neither loses its curves nor risks an export refusal caused only by the layer type the importer picked.
- A state consistency check for the repository: `node scripts/check-state-consistency.mjs` fails when the live documents contradict the tag/`main` SHA, when the roadmap and the next action disagree, or when the handoff bundle carries a stale status, a superseded upload instruction, source/test copies, collapsed Windows paths or secret markers.
- A first-export path for new users: a labelled "First export help" panel next to Export lists the three steps, offers a readiness check that reports what would block an OGraf export (reusing the existing export diagnostics), and states that nothing is written until you export. The readiness answer is a pre-flight summary; a scene changed afterwards is recompiled when the export runs.
- The timeline keyframe diamonds are keyboard operable: each one is a named button in the tab order, `Enter`/`Space` selects the keyframe and moves the playhead (and selects the part on the parent lane), and `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order.
- The value graph's keyframe points are announced with their frame and value, and its decorative axes and curve stay out of the accessibility tree.
- Bezier tangent handles can be authored directly on the stage: select a single freeform layer, click a vertex to reveal its handles, drag a handle to reshape the path live, and double-click a vertex to toggle corner ↔ smooth. Each drag is a single undo step and `Escape` cancels one without recording history.
- Track-matte source relationships are now visible in the outliner for both relationship models (`Mask → <source name>`), and unnamed layers fall back to their ids in the matte source pickers.
- The Track Matte V2 card's source select carries an accessible label.
- Actionable OGraf export diagnostics: every blocking diagnostic now reports a stable title, the failing layer or feature, the reason, and a concrete next step, and it never reports success while export is blocked.
- Non-blocking OGraf warnings are surfaced as a compact grouped notification instead of being silently dropped.
- Package materialization failures now carry stable failure codes; filesystem guidance states the trusted-directory requirement, the unsupported hostile-concurrency case, and avoids claiming perfect OS-level protection. Machine paths are reduced to a display-safe form.

### Changed
- The timeline's transport row is one control language instead of five: the timecode, the duration field with its `1s…10s` presets, the transport buttons, Crop, Motion Curves and the support pills all sit on the same 28px height, the same 4px control radius and one muted tone, the duration presets are a single segmented control, and the timecode uses tabular figures with a fixed width so the row no longer shifts as it counts. The inline styles that made the field 22px tall next to 28px buttons are gone, and the duration input still accepts typing (its `.duration-control-box` selector and behaviour are unchanged).
- The Texts drawer's presets are laid out as designed rows instead of uneven cards: each one carries a tinted icon badge in its own accent tone, previews its label in the font it will create (Bebas Neue, Playfair Display, Outfit, Inter, Montserrat), states the family and size underneath, and lifts on hover with a grab cursor because it is draggable. The inline presentation styles and the utility colour classes that did not exist are gone, so one stylesheet owns the look, and clicking or dragging a preset still adds the same text layer with the same font and size.
- The Motion Curves editor shapes exactly one segment, and says which one: it edits the curve that leads **into** the keyframe you picked from the keyframe before it, so with five keyframes the fourth opens `F60 → F90`. The header names the property and the two frames, each handle names the keyframe it belongs to (`P1 · leaves F60`, `P2 · arrives at F90`), and the curve is stored where the evaluator reads it — the segment's **start** keyframe — leaving the keyframe's own outgoing segment untouched. A keyframe with nothing before it (the first one, or the only one) and a playhead that sits between keyframes no longer fall back to some other keyframe's curve: the editor explains that there is no segment instead of editing one silently, and it no longer creates a keyframe as a side effect of opening or applying a curve.
- The Media drawer's upload card reads as a real drop target again: a rounded dashed card with a soft accent glow, a circular upload badge, the same title and hint, and a pill-shaped **Browse files** control, with a stronger (solid accent border + ring) feedback while a file is dragged over it. The recently added media tiles are square, keyboard-focusable previews that lift and reveal an add affordance on hover. The stylesheet override that had flattened the card into plain left-aligned text is gone, so one file owns the card's look, and clicking either the card or the button still opens the picker exactly once.
- The Appearance card reads tidier: the WIDTH and ALIGN controls share one equal-column row (previously a narrow field beside a wide one), a lone WIDTH field — text, which offers no alignment — no longer stretches across the panel, and a switched-off FILL or STROKE group keeps its authored values but is dimmed instead of looking active.
- Text no longer repaints its outline when it is selected: the canvas keeps the authored stroke colour and width and uses the selection highlight only while the outline itself is switched off, which is what shapes already did.
- The left toolbar and the right inspector collapse and expand as one motion: the panel's width, its 12px slide, its opacity and the handle that rides its edge all run over the same 240ms with the same `ease`, so the handle stays glued to the edge for the whole animation instead of racing ahead of it (the right handle used to leave the edge by more than 100px on the first frames and snap back, which read as a jump), the canvas gains and returns the space at the same pace, and the panel content fades over that same 240ms instead of vanishing on the first frame. The overshoot curve those layout transitions used is gone, and `prefers-reduced-motion` still makes both instant.
- An OGraf export now refuses a layer whose animation the exported graphic cannot reproduce: a layer carrying an in/out motion preset resolves to a different frame in the editor than in the generated runtime, which renders the timeline only, so the export reports `OGRAF_UNSUPPORTED_PROCEDURAL` and stops instead of shipping a graphic that plays a different animation. `none` and `custom_timeline` resolve to no delta in the evaluated mode and stay exportable, and the export's existing `OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL` rule for shake/random presets is unchanged.
- The dialog focus lifecycle lives in one authority: the naming dialog uses the shared opener restoration and the shared focus trap, so Tab and Shift+Tab wrap the dialog's own stops (a disabled action is not a stop) and Escape dismisses through the dialog's own handler; its close control has an accessible name. The confirmation and import-report dialogs use the same trap instead of their own two-stop copies.
- The test environment declares React's act environment for the whole run, so a state update outside `act` is reported on every machine instead of only on a slower one, and the serialization and import-atomicity tests make their document calls inside `act`. The suite went from 101 warnings reported by CI to none.
- The preset library treats `localStorage` as the external boundary it is: a blocked or full store no longer fails the mount or the edit that triggered the write, and the library keeps working in memory for the session.
- The value and speed graphs are exposed as labelled groups instead of images, and focus rings were added for the timeline diamonds and the graph keyframe points.
- Freeform paths that only carry legacy `points` normalize a repeated closing vertex before the editing overlay materializes a canonical `path` on first edit; the legacy array itself is preserved.
- Matte relationship resolution went through one shared helper that mirrors the rendered result, so the outliner indicator and the stage agree for enabled, disabled, missing, and unusable sources.
- The project now declares the locked toolchain's supported Node runtime intersection (`^22.22.2 || ^24.15.0 || >=26.0.0`) and approves the `sqlite3` install step for npm 12 with a version-pinned entry, so a fresh install fetches that package's prebuilt native binding instead of silently leaving the API server without a database driver; the lockfile mirrors only the root engine metadata and its dependency graph is unchanged.
- `jsdom` moved 30.0.1 → 30.1.1, whose `Blob` no longer carries what Node's `URL.createObjectURL` follows; the test environment now defines the two object-URL functions itself instead of depending on that pairing, so a jsdom patch can no longer change test behaviour.
- Runtime and toolchain dependencies were refreshed within their current major versions (React 19.3, Vite 8.3, Vitest 4.1.11, lucide-react 1.47 and the test-library patches) on an isolated branch. `jsdom` was taken to 30.1.1 later with a test-environment object-URL shim, and Oxlint was subsequently adopted at 1.85 with narrow, documented suppressions only at deliberate React synchronization patterns.
- TypeScript moved from 6.0 to 7.0, and Vitest plus `@vitest/coverage-v8` moved from 4.1 to 5.0 as one aligned toolchain upgrade. Type checking, the 1,951-test suite, production build, release gate, browser smoke set, V6 QA, and CI all pass on the upgraded versions.
- The embedded SQLite fallback remains runtime-generated, but `server/db/keyframe_studio.sqlite` is no longer tracked; a clean checkout creates and seeds it on first API start.

### Removed
- The timeline's "Selected Keyframe" property panel: selecting a keyframe in the timeline no longer opens it. The selection itself is unchanged — the diamond still highlights, `Delete`/`Backspace` still remove the selected frame group and undo restores it — and keyframe values stay editable through the Inspector's transform section and the timeline's own drag/duplicate/copy-paste actions.

### Fixed
- Edit-mode stage rendering now evaluates the selected sequence, matching the selection gizmo and Inspector. Dragging a keyframed circle or another layer in a named sequence moves its painted geometry instead of only its selection border; Broadcast keeps its existing runtime sequence selection.
- Adding a property keyframe now matches both frame and sequence identity. Authoring another sequence at the same frame no longer overwrites the first sequence's position, opacity, or other channel values; existing untagged keyframes still belong to the default sequence.
- An OGraf package's per-entry and total size budgets are taken from what the archive reader will actually materialise rather than from one declared field: a stored member is measured by the bytes it is copied from and must declare a single size, a deflated member is measured by the buffer it is inflated into, and a compression method whose output cannot be bounded is refused. A member can no longer be admitted by under-declaring its size.
- Dropped media is stored in the document as a self-contained source (the same durable form the Media drawer writes) instead of a `blob:` URL that dies with the page, so an image dropped on the stage survives a reload.
- A split Lottie position (`p: { s: true, x: …, y: … }`) is read as the two scalar properties it is, and a keyframe easing handle written per dimension (`o: { x: [0.25, 0.3], y: [0.1, 0.2] }`) resolves the component its channel maps. A handle with no readable value keeps its segment linear and is reported instead of becoming a fabricated zero curve.
- Legacy project documents are validated before they are applied: a part that is not an object, has no usable id or type, has no finite z-order, or carries a base transform the evaluator cannot multiply is refused with a stable code and the offending path, instead of importing "successfully" and failing on the stage. Valid legacy documents — including `sequencer-project.json` and the server's seed project — still import.
- A track whose canonical channels cover only part of its animation no longer loses the rest on a save/load round trip: the channels the evaluator would still resolve from the legacy composite keyframes are written with those values, so the animation a document produced before saving is the animation it produces after loading.
- The CI step named "TypeScript Type Check" now checks the project: it ran `npx tsc --noEmit`, which builds no referenced project and therefore verified no project file, so a broken type could have merged behind a green tick. The step and the `check` script run `npx tsc -b --pretty false` (151 project files).
- The editor's global commands no longer reach project state while a blocking dialog is open: the shortcut handler now reads the dialog's own `aria-modal` contract, so `Delete`/`Backspace`, undo/redo, copy/paste, duplicate and the tool and zoom keys stay inert until the import report, the confirmation dialog or the naming dialog closes. Each dialog keeps `Escape` for itself, and the naming dialog now handles it at the dialog level (and declares the dialog contract it was missing) so it works from its buttons too.
- Confirmation and import-report dialogs now focus their initial action on open and restore focus to the connected opener after Cancel, Confirm, or `Escape`; removing the opener while the dialog is open remains safe.
- An imported scene is now checked against the values the renderers and the evaluator read, not only the fields the apply path touches: a scene version this build does not know, a frame rate or timeline length that is not a positive number, a canvas size that is not a positive number, a non-text `textValue`, a layer without a usable id or z-order, duplicate layer ids, a freeform path the geometry builder cannot walk, a mask without a path, a channel that is not a keyframe list and a keyframe value that is not a finite number are refused with a stable code and the offending path before any state is touched. The legacy `layerId` track shape and every documented default stay accepted.
- A track's `visible`, `editVisible` and `locked` flags and its sequence link are written on export and read back on import, so a muted, canvas-hidden or locked track no longer returns visible after a save/load round-trip. The generated track name, its colour and its expanded flag remain session state and are not persisted.
- Undoing an import now restores the whole document — frame rate, timeline length, canvas size, coordinate contract, scene title and active sequence — together with the layers, animation and sequences, instead of leaving the imported settings on top of the restored scene.
- A Lottie layer's parent is now resolved through the layer index it names (`ind`) rather than through the position of the layer in the array, so a document whose indexes are not sequential, or whose child precedes its parent, imports its hierarchy correctly. A reference no imported layer declares, a layer that names itself, and an index two layers share are reported instead of guessed.
- A Lottie layer that carries more than one geometry item is now reported instead of silently keeping only the last one: KCS draws one path per layer, so the import names what it cannot represent and still imports the layer.
- A layer with no animation track now inherits its parent transform. The hierarchy is resolved for every layer; only the keyframe evaluation is skipped, so a static child is no longer placed at its local position while the same child with an empty track was placed correctly.
- An inverted track matte in an exported OGraf graphic now actually inverts: it is expressed as a luminance mask with a white backdrop and the source painted black, the technique the editor's own matte authority documents, instead of an alpha mask whose black source stayed opaque and left the target unmatted. The inverted luminance matte had the same defect — it had no backdrop, so the mask was transparent everywhere outside the source — and both modes now share one construction. Text matte sources are painted black for the hole as well, instead of keeping their own colour and emitting a duplicate, ignored `fill` attribute. The generated runtime mirrors all of it.
- The REST API now binds `127.0.0.1` instead of every interface, so the unauthenticated project store is reachable from this machine only. Publishing it to a network is an explicit opt-in (`KCS_API_HOST`), and the server warns with what it published and how to undo it. `README.md` and `docs/API.md` state that the API has no authentication and that CORS is not access control.
- Browser access to the REST API now uses an exact local-origin allowlist by default. Additional origins require `KCS_CORS_ORIGINS`; wildcard, credential-bearing, path, query, fragment, `"null"`, and malformed entries fail startup instead of widening access.
- The evaluator profile harness now builds the workload it measures: its scenes carry a real `baseTransform` and real layer masks (the previous builder wrote `transform` and `layers`, which the evaluator never reads, behind a cast that hid both), and the harness verifies the built scene — layer, track, mask and parent counts, finite transforms and masks, and visible layers — before anything is timed. The report carries that verification, and `KCS_PROFILE_OUT` writes it to a file (Vitest rejects the `--out` flag the harness previously expected).
- The state consistency check now covers the live documents instead of four of them: `LIVE_DOCUMENTS` names the documents that describe the current state, a missing one fails the check, and two new rules catch a live document that claims the wrong checkout, puts `main` at another revision, or ties the release tag to another candidate. The closed-programme documents (`SESSION.md`, `docs/KCS_CURRENT_STATE.md`, `docs/KCS_OPEN_TASKS.md`, `docs/KCS_BRANCH_STATUS.md`) are marked as historical records and reconciled where they were live, the roadmap records milestone F as complete with the post-review follow-up as NEXT, and the release summary no longer repeats validation counts that go stale within a task.
- The post-review correctness follow-up is complete: every release-blocking finding from the full-project review is closed, one task at a time and one branch each, and the final correctness gate ran on `main` (`reports/progress_141_astra_correctness_followup_summary.md`).

### Release candidate `1.1.0-rc.1` (unreleased package metadata)
- Consolidates the accepted Public Controls, OGraf packaging, filesystem hardening, schema-validation, and release-smoke work.
- The Git tag and GitHub draft prerelease exist; this changelog entry remains under `[Unreleased]` because the package is private and was not published.

### Security
- Hardened prototype-sensitive imported OGraf keys, package paths, MIME lookups, and generated runtime maps.
- Hardened SVG input boundaries, source-path handling, output filesystem checks, hierarchy, broadcast state, and mask/matte parity.
- The `1.1.0-rc.1` candidate records accepted operational warnings for hostile-concurrency filesystem mutation and network-dependent schema validation.
- `npm audit` reports no known vulnerabilities: the six moderate advisories and the high `nanoid` advisory were resolved by a bounded `npm audit fix` (no `--force`) together with the refreshed dependency set.

---


## [1.0.0] - 2026-08-02

### Added
- **Motion Design Sequencer**:
  - Multi-track timeline hierarchy supporting track lock, eye visibility, and z-index ordering.
  - Precision keyframing engine for position (`x`, `y`), scale (`scaleX`, `scaleY`), rotation, and opacity at 60 FPS.
  - Interactive Cubic Bezier Easing editor with velocity curve presets and real-time canvas preview.
  - Sequence management tabs with inline double-click renaming and deletion safety.
- **Directional Transform Gizmo**:
  - 8-handle transform controls featuring 4 corner square handles for uniform scaling and 4 midpoint circle handles for single-edge directional stretching.
  - Trigonometric matrix math for directional single-edge resizing preserving fixed opposite edge world coordinates.
  - 360° interactive rotation handle.
- **Media & Shape Masking Engine**:
  - Dynamic vector geometric clipping masks supporting 6 geometries: Circle, Pill/Capsule, Star, Hexagon, Heart, and Rectangle.
  - Interactive crop positioning and custom text caption overlays.
- **Live Broadcast Director Panel (Reji Mode)**:
  - Zero-latency broadcast triggers for streaming tools (OBS Studio, vMix, NDI).
  - Individual and global `PLAY IN` / `PLAY OUT` transition animations.
  - Live broadcast stunts including Bounce, Pulse, Wobble, Spin 360, Shake, Float, and custom keyframe loops.
- **Dual Database Architecture**:
  - Production-ready PostgreSQL database with schema (`schema.sql`) and seed data (`seed.sql`).
  - Zero-config local embedded SQLite database fallback (`keyframe_studio.sqlite`).
  - Express 5 REST API backend providing `/api/projects`, `/api/presets`, and `/api/health` endpoints.
- **Testing & Quality Infrastructure**:
  - Vitest test suite featuring 21 unit and integration test files (62 tests).
  - Playwright end-to-end (E2E) workflow test suite (`e2e/workflow.spec.ts`).
  - TypeScript strict mode compilation and Oxlint linting integration.
  - Agent governance guidelines, project context specification, and domain-driven branch strategy (`.agents/`).

---
