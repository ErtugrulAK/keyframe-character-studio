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

## Post-Astra focused remediation — committed, 2026-10-07

- The Astra post-compaction review of the uncommitted authoring work found 16 defects (3 HIGH, 12 MEDIUM, 1 LOW; no BLOCKER). All 16 are closed and published as six commits on `main`: text Boolean geometry `a3f5b09`, bonded layer movement `78450f5`, timeline curve targeting `0a20dd6`, Playfair OGraf portability `aa392a9`, the pre-existing visual-only editor refresh `fb8ed96`, and this documentation reconciliation.
- The Playfair Display correction and the UI refresh are now committed unchanged in substance; the three owned Playfair files (normal TTF, italic TTF, OFL.txt) are tracked. No dependency, workflow, package, tag, release, or npm change is part of this publication.
- Focused regressions were added for every finding, and the real-browser proofs cover the family matrix, the whitespace parity, the font load -> settled retrace, the untraceable-operand refusal, the parented bonded drag, and the legacy single-file refusal. Retries, assertions and thresholds are unchanged.
- The dependency advisories recorded here were resolved on 2026-10-08 in a bounded maintenance run: `proxy-addr`, `source-map-js` and `fast-uri` by lock refreshes inside their parents' declared ranges, and `shell-quote` by a scoped `overrides` entry under `concurrently`. `npm audit --audit-level=low` now reports 0 vulnerabilities; see `reports/progress_153_dependency_advisory_maintenance.md`.
- H7 remains HOLD. Publishing, finalizing, or re-tagging the release requires a new explicit user instruction; release artefacts stay at `46d2a3e`.

## H7 GO — v1.1.0-rc.2 release candidate — 2026-10-08

- H7 GO was executed. A NEW release candidate was cut from the exact smoke-tested commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01` (Release Smoke Gate run `37752015020`). The annotated candidate `v1.1.0-rc.2` dereferences to that commit and its GitHub release entry is a draft prerelease with `targetCommitish` pinned to it.
- The earlier candidate is untouched at `46d2a3e59e065816d972dcd56951803951b577f6`; its draft prerelease is unmodified.
- Package metadata stays private at `1.1.0-rc.1` (PATH A): the candidate is the exact smoke-tested commit, and npm remains unpublished.
- The documentation tip is newer than the candidate and docs-only; it is NOT itself smoke-tested. Any commit that touches source, tests, workflows, packages or assets invalidates the result for the new commit, so re-run the gate before a further release decision.
- Next step: the user decides whether to publish the rc.2 draft prerelease and/or run the user QA pass. Publishing the draft does not create a tag (it already exists) and does not publish to npm. Record: `reports/progress_155_h7_rc2_release.md`.

## Exact-SHA release smoke gate — passed, 2026-10-08

- The manual `Release Smoke Gate` passed on the exact candidate: run `37752015020`, **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`**. Verdict: EXACT-SHA RELEASE SMOKE PASSED — READY FOR H7 RELEASE DECISION.
- The workflow is verification-only; it checked out the `candidate_sha` input, verified `git rev-parse HEAD`, and ran `npm ci` + Chromium + `npm run qa:release` (OGraf fixture validation plus two Chromium OGraf specs). It cannot tag, release or publish.
- **Candidate identity:** `6c27ef3` is the tested CODE sha. The documentation commit that records this run is not smoke-tested. Re-run the gate on any later SHA that changes code before making a release decision.
- The smoke gate is not the full suite: the Vitest suite (135 files / 2,055 tests), the full Chromium suite (268 tests), the API/SQLite checks and the CORS posture were validated locally on the same code line and are recorded in PROJECT_STATE.md.
- H7 remains HOLD. Creating or moving a tag, publishing or finalizing the draft release, and npm publication require a new explicit user instruction; the tag, draft, package version and npm state are unchanged.

## Dependency advisory maintenance — committed, 2026-10-08

- A fresh audit reported five advisories (3 critical, 1 high, 1 moderate). All are resolved by `chore: remediate dependency advisories` (`7f1e679`): three lock refreshes inside the parents' declared ranges and one scoped `overrides` entry under `concurrently` for `shell-quote`.
- No direct dependency, script, engine, workflow or application source change. Reachability was proven from code for `proxy-addr` (Express defaults `trust proxy` to `false`; KCS never sets it or reads `req.ip`/`req.ips`) and for `shell-quote` (concurrently's only `quote()` consumer requires additional CLI arguments the `dev` script never passes).
- `npm audit --audit-level=low` reports 0 vulnerabilities. The full gate is green: 135 Vitest files / 2,055 tests, 268 Chromium tests with `--retries=0`, `npm run check`, OGraf validation, both QA gates, the state consistency check, the API health endpoint on the loopback bind, and the `sqlite3` binding.
- The `overrides` entry is a temporary bridge; remove it once `concurrently` declares `shell-quote >= 1.11.0`. H7 remains HOLD.

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

1. **Milestone H: H7 GO executed.** H1–H6 are complete and the new release candidate `v1.1.0-rc.2` has been cut from the exact smoke-tested commit `6c27ef3`; its draft prerelease awaits the user's publish/QA decision. The earlier candidate remains at `46d2a3e` and npm publication is still out of scope. Re-run the exact-SHA smoke gate on any later commit that changes code before a further release decision.
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
