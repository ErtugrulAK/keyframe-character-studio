# KCS ChatGPT One-File Handoff

---

## 0. Upload Instructions

- This file is always the latest current handoff.
- It is overwritten/rebuilt for every task; the previous file is deleted before writing.
- It is not an archive, and old task sections are never appended or preserved.
- It is generated only from `chatgpt_handoff/latest/` plus `latest/OMP_FINAL_RESPONSE.md`.
- Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT; the files in `chatgpt_handoff\latest` are its sources.
- The repository root is `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user project/asset workspace, not a handoff destination; nothing was copied there.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` is untouched by this workflow.

---

## 1. OMP Final Response

# KCS Milestone F Item 10 First Slice — Final Response (Lottie Import Core)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** the approved first slice of the Lottie mapping design (the import core) is implemented on branch `feat/lottie-import-core` (base `main` = `06a5dfcf…`); awaiting the review and the user merge decision.
- **Report:** `reports/progress_123_lottie_import_core.md`. **Design:** `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`.
- No UI entry point is wired yet: the core returns a scene plus a loss report, and a later slice adds the import entry point with the report-before-replace UX.

## 2) WHAT CHANGED

| File | Content |
|---|---|
| `src/interop/lottie/temporal.ts` | Frame mapping (`max(0, round(t − ip − st))`, frame rate preserved) and the **segment split**: Lottie's `o` on keyframe k becomes `mapped[k].bezierOut` and its `i` becomes `mapped[k+1].bezierIn`; `h: 1` → `hold`; no handles → `linear`; roving and expression-driven segments are reported and fall back to linear; the 512-keyframe-per-channel limit is reported |
| `src/interop/lottie/diagnostics.ts` | The loss-report contract (stable code, severity, feature, source path, message, mandatory action) and the first-cut limits |
| `src/interop/lottie/mapDocument.ts` | `importLottieDocument(text)`: size limit → JSON → depth-bounded prototype-key walk → mapping. Document: `fr`→fps (fractional reported), `ip`/`op`→totalFrames (in-point shift reported), `w`/`h`, `nm`. Layers: `ty` 1/3/4 converted; precomps, text and images reported and skipped (approved first-cut decision), as are effects, expressions, masks and track mattes; broken parents reported and dropped. Transforms → base values or canonical channels; shapes `sh`/`rc`/`el`/`fl`/`st`/`tm` mapped, `gr` flattened and reported, anything else reported |
| `src/tests/lottieImport.test.ts` | 17 cases in four groups: document timing, transforms (including the segment split, hold, roving fallback, keyframe limit), shapes and unsupported constructs, and untrusted input |

Two real mis-mappings were caught by the tests while writing them and fixed: the incoming handle was attached to the keyframe that holds it instead of the keyframe it arrives at, and rectangle size / fill colour were read through a helper that rejects arrays (so `{ k: [x, y] }` produced nothing).

## 3) VALIDATION

| Check | Result |
|---|---|
| Type gate (CI's) | `npm run build` (`tsc -b && vite build`) — PASS |
| Lottie core suite | PASS — 17 cases |
| Full suite | PASS — 120 files / 1,753 tests |
| Lint / release gate / state check | clean / PASS (2 Chromium tests) / PASS |

## 4) REVIEW

The change goes through the independent read-only review gate before any merge; the verdict is recorded here before the merge request.

## 5) SAFETY

- No UI, export, dependency, `package.json`, lockfile or workflow change; the importer only reads text and returns a scene.
- The output uses the existing `SceneData`/`AnimationTrackData` shapes, so the existing serializer validates it again before anything is applied.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6) NEXT

One decision: merge `feat/lottie-import-core` after the review passes. The following slices — masks and track mattes, text/image/precomp, and the import entry point with the report-before-replace UX — each need their own approval.

---

## 2. Handoff Manifest

# KCS ChatGPT Upload Manifest — Milestone F Item 10 First Slice (Lottie Import Core)

Clean refreshed: YES
Bundle purpose: Milestone F item 10 first slice — the Lottie import core and its loss report (no UI entry point yet)
Bundle scope: minimal and task-specific; this folder is not an archive

Branch: feat/lottie-import-core on top of main 06a5dfcf (after the CI hotfix)
Task record: reports/progress_123_lottie_import_core.md; design: docs/design/KCS_LOTTIE_IMPORT_MAPPING.md (in the repository)
What changed: src/interop/lottie/temporal.ts (frame mapping and the segment-to-keyframe handle split, hold, linear fallback with reports for roving/expression, keyframe limit), src/interop/lottie/diagnostics.ts (loss-report contract and first-cut limits), src/interop/lottie/mapDocument.ts (importLottieDocument: untrusted input handling, document timing, layer/transform/shape mapping, everything else reported), src/tests/lottieImport.test.ts (17 cases)
Approved first-cut decisions honoured: precomps reported and skipped; layer in/out reported, not converted; the design's limits (512 keyframes per channel, 8 masks, 32 levels, 4096 vertices, 32 MB); the report carries codes, paths and actions
Not changed: no UI, export, dependency, package.json, lockfile or workflow change
Validation: npm run build (tsc -b && vite build) PASS; lottie core suite PASS (17); full suite PASS (120 files / 1,753 tests); lint clean; qa:release PASS (2 Chromium tests); state check PASS
Next slices (each needs its own approval): masks and track mattes; text/image/precomp; the import entry point with the report-before-replace UX
v1.1.0-rc.1 tag target: 46d2a3e59e065816d972dcd56951803951b577f6 (unchanged)
Tag/release/npm changed: NO
GitHub release: existing draft prerelease, not published/finalized
npm publish: NO

Copied files (8):
- README.md — bundle instructions
- manifest.txt — this inventory
- OMP_FINAL_RESPONSE.md — the item-10 first-slice final response
- progress_123_lottie_import_core.md — the task record
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md — roadmap plan (copy of the root document)
- CHANGELOG.md — changelog (copy of the root document)
- NEXT_SESSION.md — current state and next action (copy of the root document)
- PROJECT_STATE.md — project state (copy of the root document)

Omitted categories:
- Source, test and design files (they live in the repository, including docs/design/KCS_LOTTIE_IMPORT_MAPPING.md)
- package.json, package-lock.json, ci.yml, release-smoke.yml files
- Older reports, current-state/release documents
- QA output, zip files, asset folders, screenshots, archives, dependencies, secrets, caches

Omitted files were not deleted from the repository. Not copied and never touched: .git, secrets/env/API keys, backups, binary caches, `C:\Users\ertugrul.ak\Desktop\KCS`, `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

Validation at this revision (each command run separately):
- npm run build (tsc -b && vite build): PASS — the type gate CI runs
- npx vitest run src/tests/lottieImport.test.ts: PASS — 17 cases
- npm test: PASS — 120 files / 1,753 tests; npm run lint: clean
- npm run qa:release: PASS (2 Chromium tests); node scripts/check-state-consistency.mjs: PASS

Next: the independent review of this branch, then the user merge decision, followed by the remaining item-10 slices.

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md to ChatGPT. The files listed above are the sources of that one-file artifact.

---

## 3. Bundle README

# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 10 First Slice (Lottie Import Core)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The first implementation slice of the approved Lottie mapping design (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`): the **import core**. It maps a Lottie document to a normal KCS `SceneData` plus a loss report — document timing, shape/solid/null layers, transforms, paths, primitives, fill/stroke/trim, and the segment-to-keyframe easing rules. Everything it does not convert is **reported**, never guessed:

- Lottie's `o` on keyframe k becomes `bezierOut` on that keyframe and its `i` becomes `bezierIn` on the **next** one; `h: 1` maps to `hold`; a segment without handles is `linear`; roving and expression-driven segments are reported and fall back to linear.
- Precomps, text, images, effects, expressions, masks and track mattes are reported and skipped (the approved first-cut decisions), with the design's limits (512 keyframes per channel, 4096 vertices, 32 MB) enforced as reports rather than silent truncation.
- Untrusted input is handled like the project import boundary: size limit, JSON syntax, and a depth-bounded prototype-key walk.

No UI entry point is wired yet; the following slices (masks/mattes, text/image/precomp, the import entry point with the report-before-replace UX) each need their own approval.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_123_lottie_import_core.md` — the task record (scope, changes, validation, residual risks)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone F status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and design files are intentionally omitted (they live in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.

---

## 4. Task Record

# Progress 123 — Lottie Import Core, First Slice (Milestone F, item 10)

## 1. Scope

The approved first slice of `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`: the import **core**. It maps a Lottie document into a normal KCS `SceneData` plus a loss report, covering document timing, shape/solid/null layers, transforms, paths, primitives, fill/stroke/trim and the temporal/easing rules. Everything the slice does not convert is **reported**, never guessed. There is deliberately **no UI entry point** yet: the caller receives a scene it can hand to the existing import path.

## 2. Branch

- `feat/lottie-import-core`, based on `main` at `06a5dfcf98cf7d5a0dd61f09ca06acab35dcd26e` (after the CI hotfix).

## 3. What changed

- **`src/interop/lottie/temporal.ts`** — the conversion that must not be guessed:
  - `frame = max(0, round(t − documentInPoint − layerStartTime))`; the importer preserves the document frame rate, so Lottie frame units and scene frames are the same unit (documented in the module).
  - **The segment split:** Lottie's `o` on keyframe *k* is the outgoing control point of the segment *k → k+1* and its `i` is the incoming control point of that same segment, so `mapped[k].bezierOut ← o` and `mapped[k+1].bezierIn ← i`. A converted channel therefore keeps both sides of every curve.
  - `h: 1` → the `hold` easing with no invented handles; a segment without handles → `linear`; a **roving** keyframe or an **expression** keyframe is reported (`LOTTIE_ROVING_KEYFRAME`, `LOTTIE_UNSUPPORTED_EXPRESSION`) and falls back to linear.
  - The per-channel keyframe limit (512) reports `LOTTIE_KEYFRAME_LIMIT` and keeps the first keyframes.
- **`src/interop/lottie/diagnostics.ts`** — the loss-report contract: a stable code, severity, feature, source document path, message and a mandatory action, plus the first-cut limits that this slice enforces (512 keyframes per channel, 32 hierarchy levels, 4096 vertices, 32 MB document). The mask limit from the design arrives with the mask slice, because nothing converts masks yet.
- **`src/interop/lottie/mapDocument.ts`** — `importLottieDocument(text)` → `{ ok, scene?, diagnostics }`:
  - Untrusted-input handling like the project import boundary: size limit before parsing, JSON syntax, and a depth-bounded prototype-key walk reusing `isPrototypeSensitiveKey`.
  - Document level: `fr` → `fps` (fractional rates rounded and reported), `ip`/`op` → `totalFrames` with an in-point shift warning, `w`/`h` → scene size, `nm` → name, and the scene is emitted as `coordinateSystem: 'project-unit-center-v1'`.
  - Layers: `ty` 1/3/4 (solid/null/shape) are converted; **precomps, text and images are reported and skipped** per the approved first-cut decision, as are effects, expressions, masks and track mattes; a parent index that is not an already-imported layer reports `LOTTIE_BROKEN_PARENT` and is dropped.
  - Transforms: `ks.p` (x/y), `ks.r`, `ks.s` (percent → factor), `ks.o` (percent → 0..1), static values as the base transform and keyframed ones as canonical channels.
  - Shapes: `sh` → `BezierPath` (v1) with a vertex limit, `rc`/`el` → width/height, `fl` → fill colour + opacity, `st` → stroke width, `tm` → trim start/end/offset, `gr` → flattened and reported, anything else reported.
- **`src/tests/lottieImport.test.ts`** — **31 cases** across five groups: document timing (mapping, fractional fps, in-point shift, missing timing), transforms (static values, the segment split, hold, roving fallback, keyframe limit), dimensions and fallbacks (per-dimension vector mapping, non-uniform keyframed scale, roving *with* handles, a two-segment curve pinning both handles on the middle keyframe, layer start-time subtraction with the frame-0 clamp, hierarchy limit, layer in/out + skew + auto-orient reports, unreadable shape payloads, stroke colour), shapes and unsupported constructs, and untrusted input (malformed JSON, prototype key, size limit, broken parent).

**Bugs the tests caught while writing them** (each fixed before commit):

1. The incoming handle was attached to the keyframe that *holds* it instead of the keyframe it *arrives at*.
2. Rectangle size and fill colour were read through a record helper that rejects arrays, so `{ k: [x, y] }` produced nothing.
3. **Review round 1 (independent, read-only) found three more, all fixed here:**
   - A vector property aliased its first component into every channel: `p: [15, 25]` imported `y = 15` and non-uniform `s: [100, 200]` imported `scaleY = 100`. Numeric properties now keep every dimension and each channel maps its own.
   - A roving or expression-driven keyframe **with** handles kept its Bezier easing; the design requires the linear fallback plus a report, so both handle passes now skip such a segment.
   - The `y` channel's diagnostics were dropped from the report (they are distinct paths), and keyframed scale/opacity carried Lottie percentages while the static base values were divided by 100 — the channels now go through the same conversion.

**Review round 1 also asked for fuller reporting, now added:** layer in/out ranges, skew, auto-orient, the document 3D flag, unreadable shape payloads, stroke colour mapping, and the hierarchy limit measured as a chain depth instead of an index gap (the unused mask limit was removed).

**Review round 2** went further on the design's "lossless" rows and the silent drops behind them, and this revision adds:

- Solid layers now map their own paint and size (`sc` → fill colour, `sw`/`sh` → width/height) instead of importing a white layer.
- A rect corner radius maps to `borderRadius`, and stroke opacity maps to `strokeOpacity` (percent → factor).
- The constructs KCS genuinely does not model are **reported** rather than ignored: the layer anchor (`LOTTIE_UNSUPPORTED_ANCHOR`), a shape's own position (`LOTTIE_UNSUPPORTED_SHAPE_POSITION`), stroke cap/join (`LOTTIE_UNSUPPORTED_STROKE_STYLE`), and an animated fill, stroke width or trim (`LOTTIE_UNSUPPORTED_ANIMATED_SHAPE`, one entry per animated item). layer in/out ranges (`LOTTIE_LAYER_TIMING`), skew (`LOTTIE_UNSUPPORTED_SKEW`), auto-orient (`LOTTIE_UNSUPPORTED_AUTO_ORIENT`), the document 3D flag (`LOTTIE_UNSUPPORTED_3D`), unreadable shape payloads (`LOTTIE_UNREADABLE_SHAPE`, `LOTTIE_UNREADABLE_SIZE`, `LOTTIE_UNREADABLE_COLOUR`, `LOTTIE_UNREADABLE_STROKE_WIDTH`, `LOTTIE_UNREADABLE_PATH`), stroke colour mapping, the hierarchy limit now measured as a chain depth instead of an index gap, and the unused mask limit removed (it returns with the mask slice).

## 4. Validation (branch `feat/lottie-import-core`)

| Check | Command | Result |
|---|---|---|
| Type gate (CI's) | `npm run build` (`tsc -b && vite build`) | PASS |
| Lottie core suite | `npx vitest run src/tests/lottieImport.test.ts` | PASS — 31 cases |
| Full suite | `npm test` | PASS — 120 files / 1,767 tests |
| Lint | `npm run lint` | clean |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| State consistency | `node scripts/check-state-consistency.mjs` | PASS |

## 5. Protected invariants

- No UI, export, dependency, `package.json`, lockfile or workflow change; the importer only *reads* text and returns a scene, so no existing surface can be affected until a later slice wires an entry point.
- The canonical model, the OGraf package format and the export paths are untouched; the produced scene uses the existing `SceneData`/`AnimationTrackData` shapes, so the existing serializer validates it again.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6. Residual risks

- **Not wired to a UI yet.** The importer is a library call; the design's "show the report before replacing work" step lands when an entry point is added, and importing today would require calling the module directly.
- **Colour/model limits of the first slice:** shapes are flattened (group transforms reported), masks and track mattes are reported rather than converted, and gradient/merge/repeater items are reported. Each is a documented follow-up slice.
- **Coordinate assumption:** Lottie units map 1:1 into `project-unit-center-v1`; a scene authored at a different scale needs the existing coordinate migration after import, which is not automatic.

## 7. Next slices (each needs its own approval)

1. Masks and track mattes (`§5` of the design).
2. Text and image layers, precomp flattening.
3. The import entry point with the report-before-replace UX.

---

## 5. Next Session

# Next Session Handoff

## Repository state

- Checkout: branch `feat/lottie-import-core` (Milestone F item 10 first slice) on top of `main` at `06a5dfcf…`, which matches `origin/main`; milestones A–E, the Milestone F study, the item-11 harness, the item-12 first step and product half, and the CI hotfix are merged. The merged warning-maintenance work and the Milestone E study are in `main`; the feature branches `feat/export-onboarding`, `chore/state-hygiene-gate`, `chore/dependency-warning-audit`, `chore/warning-maintenance` and `docs/milestone-e-ograf-qa-study` are retained as review artefacts.
- Milestone A (canvas tangent handles) is integrated into `main` by approved replay + fast-forward; `main` is a strict superset of its previous state
- Task 105 (export diagnostics UX) and Task 107 (track-matte source selection) are integrated by fast-forward; both are retained
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- Release tags: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged
- Branches kept: `feat/canvas-tangent-authoring` (Milestone A review artefact) and `feat/canvas-tangent-authoring-replay` (identical to `main`; deleting it needs approval)

## Current result

Milestones A–E are complete, and Milestone F is the active milestone:

- Milestone A — canvas tangent authoring (`077911b`): vertex selection shows Bezier handles on the stage, dragging reshapes the path live, one history entry per completed drag, `Escape` cancels.
- Milestone B — graph + keyboard accessibility (`96e8f9d`): named keyframe diamonds with a lane-local arrow walk, a labelled value graph with keyboard-editable points, decorative SVG hidden from assistive tech, focus rings.
- Milestone C — first export / onboarding (`c2dcb22`): opt-in "First export help" panel, readiness check reading the same OGraf diagnostics authority as the export, one shared compile path for readiness and both export actions.
- Milestone D item 6 — state consistency check (`b91e8b9`, CI follow-up `be76df9`): `node scripts/check-state-consistency.mjs`.
- Milestone D item 9 — dependency and warning maintenance: **the audit is complete** (`reports/progress_112_dependency_warning_audit.md`, review closed READY WITH WARNINGS in round 6 of six) and **the approved Option A is implemented on `chore/warning-maintenance`** (`reports/progress_113_warning_maintenance.md`): W1 Fast Refresh split, W2 chunk splitting, W3 jsdom stubs, W4 honest dependency arrays, W5 `.gitattributes`, the D9-2 checker rule, plus the local SQLite binding repair — the API starts again and `GET /api/health` returns 200 in this working copy. `package.json`, `package-lock.json`, `.github/workflows/**` and every dependency version are unchanged. Audit findings that remain open by decision: 20 outdated rows over 21 package names (7 patch / 12 minor / 1 no-wanted-update; across two toolchain groups / three package names a newer major is available — `typescript` 6→7 and the Vitest pair `vitest` + `@vitest/coverage-v8` 4→5), `npm audit` 7 findings (6 moderate, 1 high; only `qs` and `undici` moderate in the production tree), the `engines` declaration and the npm-12 `allowScripts` pin. The branch is not merged: it is subject to the user merge decision.

The release stance is unchanged: annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate; nothing was published, finalized, or pushed to npm.

## Validation

Full Vitest (120 files / 1,767 tests), `npm run validate:ograf`, `npm run qa:release` (2 Chromium tests, candidate SHA `d19bab6` (the branch's source revision; later commits are documentation only)), `npm run build`, `npx tsc --noEmit`, `npm run lint` (clean), `git diff --check`, `node scripts/check-state-consistency.mjs` and a live browser smoke (built app from `vite preview`: layer authoring, transform gizmo, inspector, timeline lane) all pass on this Milestone F stack (`fix/kcs-import-boundary-hardening`), whose source commits are `f17215b` (item 11), `9c257ed` (item 12 first step) and `a17be8b` (item 10 design). The seven catalogued warnings from the item-9 audit are resolved except the two that are not repository defects (W6 `e2e/**` outside the Vitest glob by design; W7 the environment `NO_COLOR`/`FORCE_COLOR` notice) — see `reports/progress_113_warning_maintenance.md`.

## Next scoped work

1. **Milestone F — item 10 first slice awaiting the merge decision**: the Lottie import core (document timing, shape/solid/null layers, transforms, shapes, the segment-to-keyframe easing rules and the loss report) is implemented on `feat/lottie-import-core` (`reports/progress_123_lottie_import_core.md`). Its next slices — masks and track mattes, text/image/precomp, and the import entry point with the report-before-replace UX — stay plan-only, as do item 12’s unified import entry and OGraf package import. Still open afterwards: Option B (7 patch + 12 minor updates + a bounded `npm audit fix`, needs `package.json`/lockfile approval), Option C (TypeScript 7 / Vitest 5 majors on their own branch), the `engines` declaration, and an npm-12 `allowScripts` decision (without it a fresh install blocks `sqlite3`'s install script again).
2. Milestone F items 10 (design), 11 and 12 (first step + product half) are implemented on their branches, with the merges awaiting the decision above; anything beyond them — item 10’s importer, item 12’s unified import entry, OGraf package import, Milestone E beyond items 7 and 8 — stays plan-only, and **D's dependency/package part (item 9) requires explicit user approval** before any `package.json`/lockfile work; all release/tag/draft-release changes need explicit approval.
3. Preserve the tag and draft release, and run an independent review before every merge.
4. Publish/finalize the GitHub draft only with further explicit user instruction.

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
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; the selected-keyframe panel is a group scoped to its frame; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- Roadmap status when this milestone landed: D was next (items 6 and 9) and C was merged. Current status: A–E are complete and Milestone F is the active milestone (see "Current result" above).

---

## 6. Project State

# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into main, and the grouped post-RC roadmap has completed milestones A, B, C and Milestone D item 6.

Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

Current `main` / `origin/main` is at `44218a62ff48…` (the Milestone F stack is merged): milestones A–E are complete — A/B/C, Milestone D item 6, the item-9 audit and its approved Option A warning maintenance, the Milestone E study, and Milestone E items 7 (7-A offline schema closure) and 8 (folder QA automation), with green CI on the merge. The Milestone F study is merged (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`); **item 11 (evaluator profiling) is implemented** on `chore/evaluator-profiling-harness` as measurement only (`reports/progress_118_evaluator_profiling.md`), **item 12’s first step (validated import boundary)** is merged at `44218a6` (`reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix executed as fixtures, the legacy migration report, and the autosave restore routed through the same boundary) is implemented on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design** is delivered in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`; item 10’s **first implementation slice (the import core)** is implemented on `feat/lottie-import-core` (`reports/progress_123_lottie_import_core.md`). The merge of that branch is the open decision.

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
| Full Vitest | PASS | 120 files / 1,767 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf` — offline against the vendored closure, every document pin-verified (`reports/progress_115_ograf_offline_schema_closure.md`) |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Playwright tests — latest run at `d19bab6` on this branch (its source revision; later commits are documentation only) |
| Real-browser milestone smoke | PASS | `e2e/graph-accessibility.spec.ts` and the live editor smoke with port 5000 closed (layer authoring, readiness check, real export) |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` — 33 checks on this branch with its bundle, 34 on the earlier `main` run (the total scales with the number of bundle documents scanned) |
| TypeScript | PASS | `npm run build` (`tsc -b && vite build`) — the gate CI runs; `npx tsc --noEmit` alone does not cover the same project program (see `reports/progress_122_ci_hotfix_import_boundary_types.md`) |
| Lint | PASS | clean — the Fast Refresh warning was removed in `reports/progress_113_warning_maintenance.md` |
| Production build | PASS | no chunk-size advisory — split into 382.19 kB app + react-vendor/icons/geometry chunks (see `reports/progress_113_warning_maintenance.md`) |
| Independent review | PASS | Milestone A `READY` in round 6 of six; the item-9 audit closed `READY WITH WARNINGS` in round 6 of six (`reports/progress_112_dependency_warning_audit.md` §12); the Option A change closed with `READY WITH WARNINGS` from the read-only `scout` round (the reviewer model hit a provider usage limit) after `reviewer-agent` rounds 1–3 closed every finding (`reports/progress_113_warning_maintenance.md` §2) |
| CI on `main` | PASS | runs `35206117254` (Milestone A merge) and `35207913453` (state reconciliation) |

## Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed, and **Milestone A is merged**.
- **Milestone B (graph + keyboard accessibility, item 4) — MERGED** at `96e8f9d`: the timeline keyframe diamonds are named keyboard buttons with a lane-local arrow walk, the value graph exposes a labelled group with keyboard-editable points, decorative SVG geometry is hidden from assistive tech, and focus rings were added. One review round returned BLOCKED (3 findings, 6 over-claims), all closed; the re-review returned READY WITH WARNINGS.
- **Milestone C (first export / onboarding flow, item 5) — MERGED** at `c2dcb22` (final gate verdict READY WITH WARNINGS): an opt-in "First export help" panel, a readiness check that reads the same OGraf diagnostics authority the export reads, and one shared compile path used by the readiness check and both export actions. **Milestone D is complete** — item 6 and item 9 (audit, the approved Option A and the local SQLite repair) are merged at `3923141` (`reports/progress_112_dependency_warning_audit.md`, `reports/progress_113_warning_maintenance.md`). Milestone E (study plus items 7 and 8) is complete, and Milestone F is the active milestone with its study delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`); implementation stays plan-only. Follow-ups stay approval-gated before any `package.json`, lockfile, or workflow change: Option B, Option C, the `engines` declaration and the npm-12 `allowScripts` pin.
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

---

## 7. Current Roadmap Plan and Changelog

# KCS Grouped Roadmap Execution Plan

Orchestrator close-out for the grouped post-RC roadmap run. Milestone A was later completed, re-reviewed, and fast-forward merged into `main` (see `reports/progress_108_canvas_tangent_authoring.md`); milestone B was completed, re-reviewed, and fast-forward merged into `main` (see `reports/progress_109_graph_accessibility.md`); milestone C was completed, re-reviewed (final gate verdict READY WITH WARNINGS), and fast-forward merged into `main` (see `reports/progress_110_export_onboarding.md`); milestone D item 6 (state consistency check) was completed, re-reviewed, and fast-forward merged into `main` while item 9 stays behind an explicit approval gate (see `reports/progress_111_state_hygiene_gate.md`); milestone E items 7 and 8 are implemented and merged at `22335a5`, and Milestone F is study-only until its items are approved separately.

## Milestone map and status

| Milestone | Roadmap items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | `feat/canvas-tangent-authoring` (replayed as `feat/canvas-tangent-authoring-replay`) | **MERGED** — five review findings closed across six rounds (final verdict READY), fast-forward merged into `main` |
| B — Graph + keyboard accessibility | 4 | `feat/graph-accessibility` | **MERGED** — one review round returned BLOCKED (3 findings, 6 over-claims), all closed; re-review returned READY WITH WARNINGS; fast-forward merged at `96e8f9d` |
| C — First export / onboarding flow | 5 | `feat/export-onboarding` | **MERGED** — six review rounds; final gate verdict READY WITH WARNINGS; fast-forward merged into `main` at `c2dcb22` |
| D — State / CI / warning hygiene | 6, 9 | `chore/state-hygiene-gate`, `chore/dependency-warning-audit`, `chore/warning-maintenance` | **COMPLETE** — **item 6 MERGED** (`node scripts/check-state-consistency.mjs`); **item 9 MERGED** at `3923141` (`reports/progress_112_dependency_warning_audit.md`, `reports/progress_113_warning_maintenance.md`): the audit, then the approved Option A (W1, W2, W3, W4, W5, D9-2) and the local SQLite repair, fast-forward merged with green CI run `35322372675`. Follow-ups stay approval-gated: Option B (patch/minor updates + `npm audit fix`), Option C (TypeScript 7 / Vitest 5), the `engines` declaration and the npm-12 `allowScripts` pin |
| E — OGraf QA / schema hardening study | 7, 8 | `docs/milestone-e-ograf-qa-study`, `chore/ograf-offline-schema-closure`, `test/ograf-folder-qa-automation` | **COMPLETE** — study and plan delivered (`docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`, `reports/progress_114_ograf_qa_study.md`); **item 7 (7-A) implemented and merged** on `chore/ograf-offline-schema-closure` (`reports/progress_115_ograf_offline_schema_closure.md`) and **item 8 implemented and merged** on `test/ograf-folder-qa-automation` (`reports/progress_116_ograf_folder_qa.md`), integrated at `22335a5` with green CI. **Plan only** for anything beyond those two approved scopes |
| F — Architecture exploration only | 10, 11, 12 | `docs/milestone-f-interop-study` | **NEXT** — the study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`, `reports/progress_117_interop_study.md`): item 10 Lottie mapping contract, item 11 evaluator profiling plan, item 12 editable-KCS-import product/security plan. **Plan only** for implementation until each item is approved separately. **Item 11 approved and implemented** on `chore/evaluator-profiling-harness` (`reports/progress_118_evaluator_profiling.md`): deterministic scenes, an on-demand harness and a first baseline; measurement only, no caching. **Item 12 first step implemented** on `fix/kcs-import-boundary-hardening` (`reports/progress_119_kcs_import_boundary.md`): a validated import boundary with stable refusal codes and limits; item 10 is designed in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` |

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
- Item 9 (dependency and warning maintenance) **requires explicit user approval for anything that touches `package.json`/`package-lock.json`**. The audit is complete (`reports/progress_112_dependency_warning_audit.md`), the approved **Option A** (warning fixes only, no package change) is implemented and **merged** at `3923141` (`reports/progress_113_warning_maintenance.md`); Option B, Option C, the `engines` declaration and the npm-12 `allowScripts` pin stay approval-gated.

## Milestone E — OGraf QA / schema hardening study (roadmap items 7, 8)

- Item 7 (offline schema closure): **7-A approved and implemented** — the eight pinned documents (33,567 B) are vendored under `fixtures/ograf/schema/` with both upstream notices in `NOTICE.md`; `npm run validate:ograf` is offline and deterministic by default and verifies every pin, `--online` is the refresh path, and the existing CI step needed no change. Evidence: `reports/progress_115_ograf_offline_schema_closure.md`.
- Item 8 (downstream folder QA automation): **approved and implemented** — the generator, the ZIP/folder comparison and the host-limited report live on `test/ograf-folder-qa-automation` and reuse the canonical compiler and path-safety authorities, with the QA root as an explicit required argument. Evidence: `reports/progress_116_ograf_folder_qa.md`.

## Milestone F — Architecture exploration only (roadmap items 10, 11, 12)

Research/design deliverables only: Lottie import mapping design, evaluator profiling plan, editable KCS import plan. The study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`) and fixes each deliverable contract; **item 11 is implemented** (`perf/sceneBuilder.ts`, `perf/evaluator-profile.perf.ts`, `src/tests/evaluatorProfileScenes.test.ts`, `reports/progress_118_evaluator_profiling.md`) as measurement only — no caching, no threshold; **item 12’s first step (validated import boundary) is implemented** (`src/utils/importValidation.ts`, `reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix, migration report, autosave through the boundary) on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design is delivered** (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, `reports/progress_120_lottie_mapping_design.md`) with its four open questions settled by the user, and its **first implementation slice (the import core)** is implemented on `feat/lottie-import-core` (`reports/progress_123_lottie_import_core.md`): document timing, shape/solid/null layers, transforms, shapes and the segment-to-keyframe easing rules, with every unconverted construct reported; the UI entry point and the mask/matte and text/image/precomp slices remain plan-only; **no implementation without a separate explicit approval**, and the design gate in §Approval gates applies before any code.

## Approval gates

- Package/lockfile/workflow/dependency changes: explicit user approval required before editing.
- Release/tag/draft-release/npm: explicit user approval required; unchanged by this run.
- Interchange work (Lottie, editable KCS import): design approval before code.
- Any milestone that grows into a broad refactor: stop and report.

## Handoff policy (unchanged)

`chatgpt_handoff/latest/` is a minimal, task-specific bundle: `README.md`, `manifest.txt`, the current report(s), `NEXT_SESSION.md`, `PROJECT_STATE.md`, and optionally the directly relevant contract/plan docs. Never source or test files — flattened copies named `src__*test*` matched Vitest's include glob and broke CI in runs `35094144225`/`35095655446`. Never copy the bundle into `C:\Users\ertugrul.ak\Desktop\KCS`.

## Recommended next prompt

"KCS MILESTONE E — OGRAF QA (approval-gated). The study and plan are delivered (`docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`): item 7 measured the schema closure (8 pinned documents, 33,567 B, 8/8 pins verified, MIT + BSD-style notices) and proposes 7-A vendor + offline mode / 7-B verified cache / 7-C status quo; item 8 proposes a folder-QA generator, artifact comparison and host-limited report on `test/ograf-folder-qa-automation`. Decide item 7 (and separately the CI wiring), item 8 implementation, and the QA root path policy. Milestone D item 9 Option A is already merged at `3923141`; Option B (patch/minor updates plus a bounded `npm audit fix`; edits `package.json` + lockfile), Option C (TypeScript 7 / Vitest 5 majors on their own branch) — OGraf QA / schema hardening study, items 7 and 8; Option D also requires explicit user approval, and Milestone E stays plan-only until then). The local SQLite repair (D9-1) is already applied on that branch, so the remaining decision is the merge itself."

Historical notes: "KCS MILESTONE A COMPLETION …" was carried out (five items closed, READY, replayed and fast-forward merged at `077911b`); "KCS MILESTONE B — GRAPH + KEYBOARD ACCESSIBILITY …" was carried out (merged at `96e8f9d`); "KCS MILESTONE C — FIRST EXPORT / ONBOARDING FLOW …" was carried out: implemented on `feat/export-onboarding`, gate-reviewed (READY WITH WARNINGS) and fast-forward merged at `c2dcb22` (see `reports/progress_110_export_onboarding.md`).

---

# Changelog

All notable changes to **Keyframe Character Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- A state consistency check for the repository: `node scripts/check-state-consistency.mjs` fails when the live documents contradict the tag/`main` SHA, when the roadmap and the next action disagree, or when the handoff bundle carries a stale status, a superseded upload instruction, source/test copies, collapsed Windows paths or secret markers.
- A first-export path for new users: a labelled "First export help" panel next to Export lists the three steps, offers a readiness check that reports what would block an OGraf export (reusing the existing export diagnostics), and states that nothing is written until you export. The readiness answer is a pre-flight summary; a scene changed afterwards is recompiled when the export runs.
- The timeline keyframe diamonds are keyboard operable: each one is a named button in the tab order, `Enter`/`Space` selects the keyframe and moves the playhead (and selects the part on the parent lane), and `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order.
- The value graph's keyframe points are announced with their frame and value, and its decorative axes and curve stay out of the accessibility tree; the selected-keyframe panel is exposed as a group scoped to its frame.
- Bezier tangent handles can be authored directly on the stage: select a single freeform layer, click a vertex to reveal its handles, drag a handle to reshape the path live, and double-click a vertex to toggle corner ↔ smooth. Each drag is a single undo step and `Escape` cancels one without recording history.
- Track-matte source relationships are now visible in the outliner for both relationship models (`Mask → <source name>`), and unnamed layers fall back to their ids in the matte source pickers.
- The Track Matte V2 card's source select carries an accessible label.
- Actionable OGraf export diagnostics: every blocking diagnostic now reports a stable title, the failing layer or feature, the reason, and a concrete next step, and it never reports success while export is blocked.
- Non-blocking OGraf warnings are surfaced as a compact grouped notification instead of being silently dropped.
- Package materialization failures now carry stable failure codes; filesystem guidance states the trusted-directory requirement, the unsupported hostile-concurrency case, and avoids claiming perfect OS-level protection. Machine paths are reduced to a display-safe form.

### Changed
- The value and speed graphs are exposed as labelled groups instead of images, and focus rings were added for the timeline diamonds and the graph keyframe points.
- Freeform paths that only carry legacy `points` normalize a repeated closing vertex before the editing overlay materializes a canonical `path` on first edit; the legacy array itself is preserved.
- Matte relationship resolution went through one shared helper that mirrors the rendered result, so the outliner indicator and the stage agree for enabled, disabled, missing, and unusable sources.

### Release candidate `1.1.0-rc.1` (unreleased package metadata)
- Consolidates the accepted Public Controls, OGraf packaging, filesystem hardening, schema-validation, and release-smoke work.
- The Git tag and GitHub draft prerelease exist; this changelog entry remains under `[Unreleased]` because the package is private and was not published.

### Security
- Hardened prototype-sensitive imported OGraf keys, package paths, MIME lookups, and generated runtime maps.
- Hardened SVG input boundaries, source-path handling, output filesystem checks, hierarchy, broadcast state, and mask/matte parity.
- The `1.1.0-rc.1` candidate records accepted operational warnings for hostile-concurrency filesystem mutation and network-dependent schema validation.

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

## 8. File Inventory

Every file present in `chatgpt_handoff/latest/` at generation time:

- `CHANGELOG.md` — 6149 bytes
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — 11822 bytes
- `NEXT_SESSION.md` — 9242 bytes
- `OMP_FINAL_RESPONSE.md` — 3602 bytes
- `PROJECT_STATE.md` — 12455 bytes
- `README.md` — 2984 bytes
- `manifest.txt` — 3479 bytes
- `progress_121_kcs_import_product_half.md` — 5293 bytes
- `progress_123_lottie_import_core.md` — 8540 bytes

- Source/test copies present: NO
- Test-glob matching files present: NO
- Desktop\KCS copied: NO

