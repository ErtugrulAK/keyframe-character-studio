# Next Session Handoff

## Repository state

- Checkout: `main` at or after `7abee17`, matching `origin/main` after the Authoring UX stacked PR integration (2026-10-11; PRs #4–#7) and the OGraf runtime-parity integration (2026-10-11; PR #8), all **fast-forward-only** merges that created no merge commit. The earlier Astra remediation run closed the audit's findings F-01…F-10, one branch and one focused regression each (mixed legacy/channel round trips, legacy import validation, Lottie numeric property forms, the OGraf procedural-animation mismatch, archive size accounting, dropped-media persistence, preset storage boundaries, the naming dialog's focus lifecycle, the React `act` warnings, and the stale live-document claims) — see `reports/progress_151_astra_remediation.md`. Before it, the five-task maintenance run closed dialog focus restoration (`5cb8a45`), runtime SQLite repository hygiene (`b3f3c6c`), the exact API CORS allowlist (`2a313d7`), Oxlint 1.85 adoption (`feca773`), and the aligned TypeScript 7 / Vitest 5 upgrade (`37904fb`). Milestones A–G remain complete, Milestone H remains complete through H6, and its release decision remains held (H7). The historical checkpoint `docs/checkpoints/2026-09-18-after-lottie-core/` remains unchanged.
- Milestone A (canvas tangent handles) is integrated into `main` by approved replay + fast-forward; `main` is a strict superset of its previous state
- Task 105 (export diagnostics UX) and Task 107 (track-matte source selection) are integrated by fast-forward; both are retained
- Checkout after the item 12 merge: `main` at or after `a4f8642` (the OGraf package import and its handoff refresh), matching `origin/main`
- Milestone D item 9 **Option B is merged into `main` at `73426e5`** (`reports/progress_130_dependency_maintenance_option_b.md`) and `main` matches `origin/main`
- The **`engines` declaration and the npm-12 `allowScripts` question are answered on `chore/engines-allow-scripts`** (`reports/progress_131_engines_allow_scripts.md`): `engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"` (the locked toolchain's supported intersection) plus a version-pinned `allowScripts` approval for `sqlite3@6.0.1`; `package-lock.json` mirrors only the root engine metadata and its dependency graph is unchanged (**merged into `main` at `1a12d79`**)
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- Release tags: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged
- Branches kept: `feat/canvas-tangent-authoring` (Milestone A review artefact) and `feat/canvas-tangent-authoring-replay` (its replayed integration branch, now behind `main`); both are retained and deleting them needs approval. The six proven-obsolete branches (`fix/authoring-ux-transform-toolbar`, `fix/authoring-ux-camera-invariance`, `fix/authoring-ux-corner-anchor`, `fix/authoring-ux-final-slices`, `fix/ograf-runtime-parity-phase-a-replay`, `fix/ograf-runtime-parity-phase-a`) were deleted locally and on `origin` in the final pre-QA cleanup.

## Manual QA Round 1 remediation — 2026-10-12

- Checkout: the isolated worktree `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1` on branch `fix/manual-qa-round1-remediation` (base `origin/main` at `8e2df61`); the canonical checkout stays on `main` for the stable QA history.
- The ten manual-QA findings are fixed: A–F in PART 1 (`9f916f6` keyframe capture preserves the pose, `69bbad5` camera is its own state, `1e21fa5` group body drag / no ghost pivot / identity-keyed transform cache / edge resize anchored on the fixed opposite edge) and G–J in PART 2 (`9774729` timeline property rows declare their owning layer, `05f3130` sequence tabs suppress the native context menu, `aba0b05` paired light/dark selection outline, `18b4aca` floating toolbar removed and the docked strip promoted to the authoring toolbar).
- PR #9 is OPEN and not merged; the code head `18b4acac0538c7a3ef9732e190ccb7e2f7b9b566` passed CI run `38246227512` (CI Pipeline, pull_request, success) and the full local gate, including the FULL Chromium suite with `--retries=0` (**344 passed, 0 failed, 0 flaky**).
- Live surfaces: 5173 now serves the remediation worktree (vite listener pid 33512; the previous canonical listener pid 34860 was stopped) and answers 200 on branch `fix/manual-qa-round1-remediation`; API 5000 (pid 8872) was never stopped and `/api/health` answers 200.
- The next input is the user retest of A–J on 5173; PR #9 is merged only after that retest.

## Final pre-QA repository housekeeping — 2026-10-11

- **PR #3 (`fix/ograf-runtime-parity-phase-a`) was CLOSED as superseded — not merged** (closed 2026-10-11T20:58:45Z), and **PR #8 is MERGED**; OGraf Runtime Parity Phase A is in `main`. The closed PR #3's application delta is represented in `main` (the three `src/ograf` files are byte-identical and `main`'s parity test file is a strict superset), so no unique required application behaviour existed only there.
- The six proven-obsolete branches were deleted locally and on `origin` (five were already ancestors of `main` with zero unique commits; the sixth, `fix/ograf-runtime-parity-phase-a` at `f53398f`, carried only the already-integrated application fix plus two docs commits). `feat/canvas-tangent-authoring`, `feat/canvas-tangent-authoring-replay` and `origin/without-mask` were retained.
- TESTED CODE SHA remains `7abee1783039c606b6fbe6f2263bc09b09640885`; exact-SHA Release Smoke Gate run `38172157643` remains the relevant tested-code smoke. This cleanup changed docs/handoff only — no source, test, workflow, package or asset byte — so no new smoke is required.
- Live surfaces at that time: UI 5173 served the canonical `main` application code (HTTP 200) and API 5000 (pid recorded then) was never stopped or restarted (`/api/health` 200). No tag was created, moved or deleted, no release was published or finalized, and nothing was published to npm.
- **NEXT = MANUAL QA ONLY.** Record: `reports/progress_165_pre_qa_repository_cleanup.md`.

## Authoring UX stacked PR integration — 2026-10-11

- The completed Authoring UX stacked PR chain was integrated into `main` in order by four **fast-forward-only** merges, creating no merge commit and rewriting no history: PR #4 `fix/authoring-ux-transform-toolbar` (`c46e698` → `7d7ebe2`), PR #5 `fix/authoring-ux-camera-invariance` (`7d7ebe2` → `55a4ab2`), PR #6 `fix/authoring-ux-corner-anchor` (`55a4ab2` → `b453ba1`), PR #7 `fix/authoring-ux-final-slices` (`b453ba1` → `a56ed01`). Each step proved `git merge-base --is-ancestor main origin/<head>` first; PRs #4–#7 are MERGED and no branch was deleted.
- The integrated code tip is `a56ed017e1df804e255842ca81ef1108b9b48ebc` and `main` at or after `a56ed01`, matching `origin/main`.
- Full post-merge validation on that exact checkout: TypeScript, lint, `npm test` (145 files / 2,219 tests), build, `validate:ograf`, `qa:release` (2) and `qa:v6` (3), `npm run check`, the state-consistency check (43 checks), `npm audit --audit-level=low` (0 vulnerabilities), `git diff --check`, and the FULL Chromium suite with `--retries=0` — **334 passed, 0 failed, 0 flaky**.
- Exact-SHA Release Smoke Gate on the integrated tip: run `38166764216`, candidate SHA `a56ed017e1df804e255842ca81ef1108b9b48ebc`, **success** (2026-10-11T19:08:41Z → 19:09:24Z). No tag was created or moved, no release was published, and npm was not published.
- The live QA preview was switched to the canonical stable repo on 2026-10-11 (see the integration section below), superseded on 2026-10-12 by the manual-QA-round-1 worktree switch: UI 5173 there served `keyframe-character-studio` on `main`, and API 5000 (pid recorded then) was never stopped. The four authoring-UX branches were deleted in the final pre-QA cleanup (see above).
- `fix/ograf-runtime-parity-phase-a` (PR #3) is now **CLOSED as superseded — not merged**; its application delta is in `main` through the merged PR #8. Only the docs/handoff bookkeeping files differed. The audit recommendation (B) — a controlled sync/replay — was carried out and integrated; see the section below and the final pre-QA cleanup section.
- The release decision is unchanged: `v1.1.0-rc.2` remains the published prerelease at its historical smoke-tested candidate, and any future stable or RC decision requires a new explicit user instruction plus a new exact-SHA smoke on any later code change.

## OGraf runtime parity integrated into `main` (PR #8) + QA worktree cleanup — 2026-10-11

- Replacement **PR #8 was integrated into `main` by fast-forward only**: `git merge --ff-only origin/fix/ograf-runtime-parity-phase-a-replay` moved `main` from `b7a0141501a8057214065734b59915b10cec2e43` to `7712deeb12221a4262f4de9c4ce4d820d1231777`, adding three commits (`023d4d0`, `4e0eebb`, `7712dee`) and creating **no merge commit** (`git log --merges b7a0141..HEAD` is empty). PR #8 is MERGED; GitHub records the fast-forward tip as its merge commit. No branch was deleted and PR #3 was not rewritten or closed.
- The integrated diff is exactly the four Phase A files (`src/ograf/runtimeSnippets.ts`, `src/ograf/runtimeTemplate.ts`, `src/ograf/svgRenderer.ts`, `src/tests/ografRuntimeParity.test.ts`) plus docs/handoff.
- Self-review confirmed the generated runtime embeds the canonical `compareByStackingOrder` and `resolveMatteSource` from `src/utils/stackingOrder.ts` and `src/utils/matte.ts`; the static renderer and the runtime agree; the ascending-`zIndex` order is stable for equal `zIndex`; input arrays are not mutated; a disabled Track Matte V2 still falls back to the legacy matte; inverse-matte behaviour is unchanged; group containers render no element while their children keep the composed parent transform and the shared stacking order.
- One vacuous assertion in `src/tests/ografExport.test.ts` (`not.toContain('data-layer="g"')`, an attribute no renderer emits — the wrapper is `data-layer-id="<id>"`) was corrected to `not.toContain('data-layer-id="g"')` as a test-only fix, commit `7abee1783039c606b6fbe6f2263bc09b09640885`. A throwaway probe proved the old form is unsatisfiable and the real attribute appears as soon as a container paints.
- Full post-merge validation on the integrated `main` was green: `npx tsc -b --pretty false`, `npm run lint`, `npm test` (146 files / 2,234 tests), `npm run build`, `npm run validate:ograf`, the focused runtime-parity/stacking/matte/export/grouping set (10 files / 508 tests), `qa:release` (2) and `qa:v6` (3), `npm run check`, `node scripts/check-state-consistency.mjs` (47 checks), `npm audit --audit-level=low` (0 vulnerabilities), `git diff --check`, and the FULL Chromium suite with `--retries=0`: **334 passed, 0 failed, 0 flaky**. All E2E ran isolated (`CI=1 PORT=5008` → UI 5188 / API 5008); `npm run dev` was never used. The affected gates were re-run at the final code SHA `7abee17` (check, focused set, both QA gates, full Chromium, state consistency) and were green again.
- **Exact-SHA Release Smoke Gate** on the final code SHA: run `38172157643`, candidate SHA `7abee1783039c606b6fbe6f2263bc09b09640885`, conclusion **success** — the run checked out the exact requested SHA, passed the expected-SHA assertion, `npm ci`, the Chromium setup, the OGraf fixture validation and `qa:release`. `7abee17` is the TESTED CODE SHA; the docs tip above it is docs-only and was deliberately not smoke-tested.
- The live 5173 QA surface was switched to the canonical stable repo: the old final-UX worktree vite process (pid 34956) was stopped and `npx vite --host --port 5173` was started from `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (vite listener pid 4412, spawned by the `npx vite` service wrapper pid 34504). 5173 answered 200 and served the integrated `main` application code (the tested code SHA `7abee17`) including the runtime-parity changes, verified by reading the process working directory and fetching the served modules. API 5000 (pid recorded then) was never stopped and `/api/health` still answers 200.
- All six redundant Desktop worktrees were removed **with `git worktree remove` only** after passing every safety check (clean tree, zero untracked files, branch reachable from `main` or fully pushed, no user data, no dependent process): `keyframe-character-studio-omp-authoring-ux`, `-omp-authoring-ux-final`, `-omp-camera-invariance`, `-omp-corner-anchor`, `-omp-runtime-parity-replay` and `-omp-runtime-parity`. `git worktree prune` then listed only the canonical checkout. Only denied content was build/test artifacts and the seeded SQLite file; the live API uses the canonical database.
- The six proven-obsolete branches were deleted locally and on `origin` in the final pre-QA cleanup; `feat/canvas-tangent-authoring(-replay)` remain kept as before. PR #3 was CLOSED as superseded (not merged); PR #8 is MERGED.
- No tag was created or moved, no release was published or finalized, nothing was published to npm, and no dependency/package/workflow/OMP change was made. Record: `reports/progress_164_ograf_runtime_parity_integration.md`.

## Post-Astra focused remediation — committed, 2026-10-07

- The Astra post-compaction review of the uncommitted authoring work found 16 defects (3 HIGH, 12 MEDIUM, 1 LOW; no BLOCKER). All 16 are closed and published as six commits on `main`: text Boolean geometry `a3f5b09`, bonded layer movement `78450f5`, timeline curve targeting `0a20dd6`, Playfair OGraf portability `aa392a9`, the pre-existing visual-only editor refresh `fb8ed96`, and this documentation reconciliation.
- The Playfair Display correction and the UI refresh are now committed unchanged in substance; the three owned Playfair files (normal TTF, italic TTF, OFL.txt) are tracked. No dependency, workflow, package, tag, release, or npm change is part of this publication.
- Focused regressions were added for every finding, and the real-browser proofs cover the family matrix, the whitespace parity, the font load -> settled retrace, the untraceable-operand refusal, the parented bonded drag, and the legacy single-file refusal. Retries, assertions and thresholds are unchanged.
- The dependency advisories recorded here were resolved on 2026-10-08 in a bounded maintenance run: `proxy-addr`, `source-map-js` and `fast-uri` by lock refreshes inside their parents' declared ranges, and `shell-quote` by a scoped `overrides` entry under `concurrently`. `npm audit --audit-level=low` now reports 0 vulnerabilities; see `reports/progress_153_dependency_advisory_maintenance.md`.
- At that point the release artefacts were still at `46d2a3e`; publishing, finalizing or re-tagging required — and still requires — a new explicit user instruction.

## v1.1.0-rc.2 PUBLIC PRERELEASE published — 2026-10-08

- The `v1.1.0-rc.2` release is now a **PUBLISHED PRERELEASE** (`isDraft: false`, `isPrerelease: true`, release id `RE_kwDOTexJrc4YPnCt`, `publishedAt` 2026-10-08T13:11:16Z). It is RC.2 READY FOR USER QA — not a stable release.
- No tag was created or moved, no release was recreated or retargeted, rc.1 is unchanged, and npm remains unpublished (404; package private at `1.1.0-rc.1`).
- The candidate is the exact smoke-tested code commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01`; the documentation tip is newer and docs-only, and is not itself smoke-tested.
- Next input: the user QA checklist in `reports/progress_156_rc2_prerelease_publish.md`. A BLOCKER or MAJOR code defect, or any code change, requires a new commit and a new exact-SHA smoke run before any further RC or stable decision.

## H7 GO — v1.1.0-rc.2 release candidate — 2026-10-08

- H7 GO was executed. A NEW release candidate was cut from the exact smoke-tested commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01` (Release Smoke Gate run `37752015020`). The annotated candidate `v1.1.0-rc.2` dereferences to that commit, and its GitHub release entry was then published as a PUBLIC PRERELEASE on 2026-10-08 (id `RE_kwDOTexJrc4YPnCt`, still `prerelease: true`, never stable).
- The earlier candidate is untouched at `46d2a3e59e065816d972dcd56951803951b577f6`; its draft prerelease is unmodified.
- Package metadata stays private at `1.1.0-rc.1` (PATH A): the candidate is the exact smoke-tested commit, and npm remains unpublished.
- The documentation tip is newer than the candidate and docs-only; it is NOT itself smoke-tested. Any commit that touches source, tests, workflows, packages or assets invalidates the result for the new commit, so re-run the gate before a further release decision.
- The rc.2 prerelease was published on 2026-10-08; publishing it created no new tag and published nothing to npm. Record: `reports/progress_155_h7_rc2_release.md` and `reports/progress_156_rc2_prerelease_publish.md`.

## Exact-SHA release smoke gate — passed, 2026-10-08

- The manual `Release Smoke Gate` passed on the exact candidate: run `37752015020`, **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`**. Verdict: EXACT-SHA RELEASE SMOKE PASSED — READY FOR H7 RELEASE DECISION.
- The workflow is verification-only; it checked out the `candidate_sha` input, verified `git rev-parse HEAD`, and ran `npm ci` + Chromium + `npm run qa:release` (OGraf fixture validation plus two Chromium OGraf specs). It cannot tag, release or publish.
- **Candidate identity:** `6c27ef3` is the tested CODE sha. The documentation commit that records this run is not smoke-tested. Re-run the gate on any later SHA that changes code before making a release decision.
- The smoke gate is not the full suite: the Vitest suite (135 files / 2,055 tests), the full Chromium suite (268 tests), the API/SQLite checks and the CORS posture were validated locally on the same code line and are recorded in PROJECT_STATE.md.
- Creating or moving a tag, publishing a stable release, and npm publication each require a new explicit user instruction; the earlier candidate and the package metadata were unchanged by that task.

## Dependency advisory maintenance — committed, 2026-10-08

- A fresh audit reported five advisories (3 critical, 1 high, 1 moderate). All are resolved by `chore: remediate dependency advisories` (`7f1e679`): three lock refreshes inside the parents' declared ranges and one scoped `overrides` entry under `concurrently` for `shell-quote`.
- No direct dependency, script, engine, workflow or application source change. Reachability was proven from code for `proxy-addr` (Express defaults `trust proxy` to `false`; KCS never sets it or reads `req.ip`/`req.ips`) and for `shell-quote` (concurrently's only `quote()` consumer requires additional CLI arguments the `dev` script never passes).
- `npm audit --audit-level=low` reports 0 vulnerabilities. The full gate is green: 135 Vitest files / 2,055 tests, 268 Chromium tests with `--retries=0`, `npm run check`, OGraf validation, both QA gates, the state consistency check, the API health endpoint on the loopback bind, and the `sqlite3` binding.
- The `overrides` entry is a temporary bridge; remove it once `concurrently` declares `shell-quote >= 1.11.0`.

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

Post-Astra remediation local gate on October 7, 2026: `npx tsc -b --pretty false`, `npm run lint`, `npm test` (135 files / 2,055 tests), `npm run build`, `npm run validate:ograf`, `npm run qa:release` (2 Chromium tests), `npm run qa:v6` (3 Chromium tests), and the full Chromium suite (268 tests with `--retries=0`) all passed. State consistency passed 35 checks; `npm audit --audit-level=low` reported the dependency warnings recorded in PROJECT_STATE.md. One incidental sidebar visual-dimension test was deleted; actual collapse/reopen geometry, hidden controls, and compact-viewport reachability remain covered. The dependency audit at that time reported one moderate `fast-uri` advisory (GHSA-hrr3-gc8f-f4qj), resolved later with the other advisories. Remote CI is checked after the normal push; earlier remediation CI is historical evidence, not proof for this publication.

## Next scoped work

1. **Milestone H — final pre-QA repository housekeeping complete; NEXT = MANUAL QA ONLY.** PR #3 was CLOSED as superseded (not merged), PR #8 is MERGED and the OGraf Runtime Parity Phase A delta is in `main`; the six proven-obsolete branches were deleted locally and on `origin`, while `feat/canvas-tangent-authoring`, `feat/canvas-tangent-authoring-replay` and `origin/without-mask` were retained. The `v1.1.0-rc.2` public prerelease is unchanged and npm was never published. The tested code SHA remains `7abee17` (smoke run `38172157643`) and this cleanup touched docs only. The next input is the user MANUAL QA pass against 5173; a stable release, a further candidate, or any code-affecting commit (which requires a new exact-SHA smoke run) remains a separate explicit decision.
2. The Astra remediation findings F-01…F-10 are closed and merged with green CI, one branch per finding; `reports/progress_151_astra_remediation.md` records the reproduction evidence and the remaining limitations.
3. The post-compaction Astra findings A-01…A-05, B-01…B-04, C-01…C-03, D-01…D-03 and DOC-01 are closed and published on `main` in six commits; `reports/progress_152_post_astra_focused_remediation.md` records the per-finding reproduction, fix, test and result.
4. The five maintenance tasks that preceded the remediation are complete: focus restoration, SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5.
5. Preserve the tag and draft prerelease. Publishing, finalizing, or re-tagging requires a new explicit user instruction.
6. The GitHub Actions Node 20 deprecation annotation and the announced `ubuntu-latest` migration to Ubuntu 26 are non-blocking workflow-maintenance warnings; they do not change the held release decision.

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
