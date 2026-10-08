# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into `main`, the grouped post-RC roadmap has completed milestones A–G, and `main` is at or after `37904fb`. Milestone F and the post-review correctness follow-up are complete. Milestone H is complete through H6 with its release decision held (H7). The subsequent five-task maintenance run is also integrated: dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the exact API CORS allowlist (`2a313d7`), Oxlint 1.85 adoption (`feca773`), and TypeScript 7 / Vitest 5 (`37904fb`). The post-hold Astra remediation is integrated as well: findings F-01…F-10 are closed through `8a4ca22`, one branch and one focused regression per finding (`reports/progress_151_astra_remediation.md`). The post-compaction Astra review of the uncommitted authoring work then closed all 16 of its findings (A-01…A-05, B-01…B-04, C-01…C-03, D-01…D-03, DOC-01) and published them as six commits on `main` on 2026-10-07; see the section below and `reports/progress_152_post_astra_focused_remediation.md`.

Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

**Checkpoint `2026-09-18-after-lottie-core`** (`docs/checkpoints/2026-09-18-after-lottie-core/`) records the state it was written from: `main` stood at `47d3368a2b54…` then, the Lottie import core (Milestone F item 10, first slice) was merged with `--no-ff` at `ff32d6c` and pushed, and its branch `feat/lottie-import-core` is kept at `f76ae6a` as the review artefact. The checkpoint folder carries the summary (`README.md`), the tasklist (`TASKLIST.md`), a copy-paste next-session prompt (`RESUME_PROMPT.md`) and a machine-readable summary (`STATE.json`); the task record is `reports/progress_124_checkpoint_after_lottie_core.md`. The Milestone F study is merged (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`); **item 11 (evaluator profiling) is implemented** on `chore/evaluator-profiling-harness` as measurement only (`reports/progress_118_evaluator_profiling.md`), **item 12’s first step (validated import boundary)** is merged at `44218a6` (`reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix executed as fixtures, the legacy migration report, and the autosave restore routed through the same boundary) is implemented on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design** is delivered in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`; item 10’s **first implementation slice (the import core)** is **merged into `main`** at `ff32d6c` (`reports/progress_123_lottie_import_core.md`), its **second slice — layer masks + track mattes — is merged at `8670b2a`** (`reports/progress_125_lottie_mask_matte_slice.md`), its **third slice — text, image and precomp layers — is merged at `bda62cb`** (`reports/progress_126_lottie_text_image_precomp_slice.md`), and its **final slice — the import entry point with the report-before-replace UX — is merged at `3b30bff`** (`reports/progress_127_lottie_import_entry_report_ux.md`): the entry point that slice added was later folded into the single `Import` control in the header, which classifies the chosen file by its content — a Lottie document parses in memory, shows blockers and losses before anything is applied, cancels as a true no-op, applies only on an explicit confirm through the existing project authority, and reconciles imported layer types onto existing KCS types the OGraf export accepts; item 10 is therefore complete. Milestone F item 10 is then complete apart from the follow-ups listed below.

- Task 105 (export diagnostics remediation UX): blocking OGraf export diagnostics carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.
- Task 107 (track-matte source selection affordance): the matte source relation, whichever model holds it, is resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps its self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers.
- **Milestone A (canvas tangent handle authoring) — MERGED.** Selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex reveals its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-clicking a vertex toggles corner ↔ smooth with neighbour-derived symmetric handles. One history entry per completed drag; `Escape` cancels a drag without recording one.
  - Integration path: the original branch `feat/canvas-tangent-authoring` was reviewed across six rounds (final verdict `READY`, all five findings closed) and replayed onto current `main` as `feat/canvas-tangent-authoring-replay`, then fast-forward merged. No rebase, no merge commit, no force push, no history rewrite.
  - Not covered: vertex add/remove, multi-vertex transforms, keyboard nudging, handle constraints, boolean or trim-enabled freeform layers, broadcast mode.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Post-Astra focused remediation publication — 2026-10-07

The Astra post-compaction review found 16 concrete defects in the authoring work that was sitting uncommitted on `main` (3 HIGH, 12 MEDIUM, 1 LOW; no BLOCKER). All 16 are closed, published as six commits on `main`, and covered by focused regressions.

- Commit groups: text Boolean geometry `a3f5b09`; bonded layer movement `78450f5`; timeline curve targeting `0a20dd6`; Playfair OGraf portability `aa392a9`; the pre-existing visual-only editor refresh `fb8ed96`; this documentation reconciliation.
- HIGH: a quoted or fallback-list font family traced no Boolean geometry; a parented bonded layer dragged by a local-space delta (buddy 300 -> 210 instead of 310); the Motion Curves modal wrote a curve into the wrong layer when the selected layer had no canonical channel data.
- MEDIUM: the text-outline cache kept a pre-load raster; a failed operand was silently dropped so a three-operand Subtract ran as a two-box Subtract; a closed freeform ring closed on the wrong vertex; SVG/Canvas whitespace disagreed; a multi-selection propagated only the primary bond; a moving ancestor applied its delta twice; an X-only bond edit rewrote the partner's Y animation; mask curve edits never reached persisted mask state; a zero-duration segment was offered as editable; a fallback-list family produced an invalid `@font-face` identity; the legacy single-file export dropped its packaged font and license; a 4-byte sfnt signature was accepted as a valid owned font.
- LOW: live documents listed the no-op root `npx tsc --noEmit` as project type-check evidence.
- The Playfair Display correction and the visual-only editor refresh from the previous working tree are now committed unchanged in substance; the three owned Playfair files (normal TTF, italic TTF, OFL.txt) are tracked.
- Real Chromium proof: family matrix and whitespace parity for the text trace, the font load -> settled retrace, an untraceable operand refusing the Boolean, a parented bonded drag against a calibration group, and the legacy single-file export refusing an asset-dependent graphic while an asset-free graphic still exports.
- This publication added no dependency, workflow, package, tag, release, or npm change; at that point the release artefacts were still at `46d2a3e`.
- The dependency advisories recorded here were then resolved in a separate bounded maintenance run: `proxy-addr`, `source-map-js` and `fast-uri` by lock refreshes inside their parents' declared ranges, and `shell-quote` by a scoped `overrides` entry under `concurrently` (which pins the exact vulnerable version and has no newer release). `npm audit --audit-level=low` now reports 0 vulnerabilities; see `reports/progress_153_dependency_advisory_maintenance.md`.

## Authoring publication — 2026-10-05

- The pending authoring work adds position-only layer bonds, text/freeform Boolean operands, text stroke parity between canvas and OGraf, and an opacity keyframe control. Timeline segment editing, transport layout, media/text drawers, and sidebar transitions are reconciled with the existing authorities.
- Same-frame property edits now match the sequence identity. Edit-mode stage rendering evaluates the active sequence instead of hardcoding `Sequence`; the selection gizmo and painted geometry follow the same authored pose. Broadcast retains its runtime sequence selection.
- Browser proof: a keyframed circle in the second sequence moves 100 screen pixels right and 40 down; the first sequence's x value remains -100. A bonded circle/text pair moves by the same -60/+20 screen-pixel delta.
- Six meaningful publication groups use owner-approved retrospective author dates: 2026-08-29, 2026-09-05, 2026-09-12, 2026-09-19, 2026-09-26, and 2026-10-05. Committer dates record actual creation; these dates do not claim uploads or development occurred on those earlier days. No empty commits, old-branch replay, shared-history rewrite, or force push is part of this publication.
- The old tangent and presentation review branches remain historical artefacts. The pre-architecture mask-gizmo patch is not replayed. Release tags, the held draft release, package publication, external QA folders, and OMP configuration remain unchanged.
- Dependency warning at that time: one moderate `fast-uri` advisory (GHSA-hrr3-gc8f-f4qj), subsequently resolved with the other advisories in `reports/progress_153_dependency_advisory_maintenance.md`. No `npm audit fix` was run in this publication.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, the track-matte source selection affordance, and Milestone A canvas tangent handle authoring are present in the accepted main line. OMP tooling remains separate.

## v1.1.0-rc.2 PUBLIC PRERELEASE published — 2026-10-08

- The existing `v1.1.0-rc.2` draft was published as a **public prerelease**: release id `RE_kwDOTexJrc4YPnCt`, `isDraft: false`, `isPrerelease: true`, `publishedAt` 2026-10-08T13:11:16Z, public at https://github.com/ErtugrulAK/keyframe-character-studio/releases/tag/v1.1.0-rc.2. The same release object was transitioned; no release was recreated, no tag was created or moved, and nothing was marked latest-stable.
- The candidate is the exact smoke-tested code commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01` (Release Smoke Gate run `37752015020`). Its annotated release still dereferences to that commit, with the same tag object.
- `v1.1.0-rc.1` is unchanged at `46d2a3e59e065816d972dcd56951803951b577f6` and its draft prerelease is untouched. The package remains private at metadata version `1.1.0-rc.1`; npm returns 404.
- **This is NOT a stable release.** The next input is the user QA pass against this prerelease. A stable release, a further candidate, or any code-affecting commit remains a separate explicit decision, and any code-affecting commit requires a new exact-SHA smoke run.
- Record: `reports/progress_156_rc2_prerelease_publish.md` (publication + post-publish verification + the QA checklist).

## H7 GO — v1.1.0-rc.2 release candidate — 2026-10-08

- The approved H7 GO decision was executed: a NEW release candidate was cut from the exact smoke-tested code commit. The candidate commit is `6c27ef35d48d61a5e1163d2c91734c864fcafa01`, verified by Release Smoke Gate run `37752015020`.
- The annotated candidate `v1.1.0-rc.2` dereferences to exactly that commit. Its GitHub release entry was created as a draft prerelease with `targetCommitish` pinned to the same commit, and was then PUBLISHED AS A PUBLIC PRERELEASE on 2026-10-08 (release id `RE_kwDOTexJrc4YPnCt`, `publishedAt` 2026-10-08T13:11:16Z, still `prerelease: true`, never a stable release).
- The earlier candidate is untouched: `v1.1.0-rc.1` still dereferences to `46d2a3e59e065816d972dcd56951803951b577f6` and its draft prerelease is unmodified.
- Package metadata decision (PATH A): the package stays private at the metadata version `1.1.0-rc.1`. The candidate is the exact smoke-tested commit, and no untested metadata commit was introduced; npm remains unpublished.
- The documentation tip `c650da18c731dfac85d31ba00d059a8430c40b43` is newer than the candidate and is docs-only — no source, test, workflow, package, lock or asset byte differs — so the candidate identity is unchanged and the docs tip is NOT itself smoke-tested.
- Record: `reports/progress_155_h7_rc2_release.md`. The state checker still pins `v1.1.0-rc.1` to `46d2a3e` (that candidate must never move); adding rc.2 to the checker is a separate tooling change requiring approval.

## Exact-SHA release smoke gate — 2026-10-08

- The manual `Release Smoke Gate` workflow was dispatched against the exact candidate and passed: run `37752015020`, **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`**, 46 s, every step `success`.
- The workflow is verification-only (`permissions: contents: read`, checks out the `candidate_sha` input, asserts `git rev-parse HEAD == EXPECTED_SHA`, then `npm ci` + Chromium + `npm run qa:release`). It cannot tag, release or publish.
- Independently read from the run log: the runner's `EXPECTED_SHA` was the candidate, the gate printed `Release gate candidate SHA: 6c27ef3…`, the OGraf fixture validated, both Chromium specs passed (`2 passed`), and the gate printed `Release gate passed for candidate SHA: 6c27ef3…`.
- What it proves: the candidate installs from its own lockfile on a fresh runner, the OGraf fixture validates offline, a materialized KCS OGraf package interoperates with Chromium, and the editor exports an OGraf ZIP through the UI. What it does not prove: the Vitest suite, the full Chromium suite, the API/SQLite/CORS posture, or any other SHA — including this documentation tip.
- **Candidate identity:** `6c27ef3` is the tested CODE sha. This documentation commit moves the tip forward without changing a source, test, workflow, package or asset byte, and is not itself smoke-tested. A later release decision must treat `6c27ef3` as the tested candidate and re-run the gate on any later SHA that changes code.
- Record: `reports/progress_154_exact_sha_release_smoke.md`. That run changed no tag, release, package version or npm state.

## Dependency advisory maintenance — 2026-10-08

- A fresh `npm audit --audit-level=low` reported five advisories (3 critical, 1 high, 1 moderate). All are resolved without a direct dependency, script, engine, workflow or source change: `proxy-addr` 2.0.7 -> 2.0.8, `source-map-js` 1.2.1 -> 1.2.2 and `fast-uri` 3.1.7 -> 3.1.8 are lock refreshes inside their parents' declared ranges, and `shell-quote` 1.9.0 -> 1.12.0 uses a scoped `overrides` entry under `concurrently` (exact pin, no newer release).
- Reachability was proven from code, not assumed: Express only evaluates the proxy chain through `req.ip`/`req.ips` and KCS never sets `trust proxy`, and concurrently's only `quote()` consumer requires additional CLI arguments the `dev` script never passes.
- The runtime checks after the install confirm the security posture is unchanged: the API still binds `127.0.0.1` by default, the exact CORS allowlist is unchanged, `/api/health` answers on loopback, and the `sqlite3` native binding round-trips.
- The full gate is green: 135 Vitest files / 2,055 tests, 268 Chromium tests with `--retries=0`, `npm run check`, OGraf validation, both QA gates, the state consistency check, and `git diff --check`.
- The `overrides` entry is a temporary bridge and should be removed once `concurrently` declares `shell-quote >= 1.11.0`. That task took no tag, release or npm action.

## Validation status — post-Astra focused remediation, 2026-10-07

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 135 files / 2,055 tests; `npm test` |
| OGraf fixture validation | PASS | `npm run validate:ograf` — offline against the vendored closure |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Chromium tests |
| Full Chromium | PASS | 268 tests; `npx playwright test --retries=0`; V6 QA also passes its 3 tests |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` — 35 checks |
| TypeScript | PASS | TypeScript 7.0.2; `npx tsc -b --pretty false` and the build/check paths pass |
| Lint | PASS | Oxlint 1.85.0 clean, including unused-disable reporting at error severity |
| Production build | PASS | Vite 8.3.0 production bundle |
| Dependency audit | PASS | `npm audit --audit-level=low`: 0 vulnerabilities after the bounded remediation in `reports/progress_153_dependency_advisory_maintenance.md` |
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
- Milestones A–G and H1–H6 are complete, and the H7 release decision has since been executed (the `v1.1.0-rc.2` candidate is a published prerelease awaiting the user QA pass). The maintenance follow-ups previously listed as deferred or open are closed through `37904fb`: dialog focus restoration, SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5. No further package, workflow, tag, release, or npm action is implicit; each requires explicit approval.
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
