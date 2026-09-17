# KCS ChatGPT One-File Handoff

---

## 0. Upload Instructions

- This file is always the latest current handoff.
- It is overwritten/rebuilt for every task; the previous file is deleted before writing.
- It is not an archive, and old task sections are never appended or preserved.
- It is generated only from `chatgpt_handoff/latest/` plus `latest/OMP_FINAL_RESPONSE.md`.
- The repository root is `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`; the bundle folder is `chatgpt_handoff\latest` and this artifact is `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user project/asset workspace, not a handoff destination; nothing was copied there.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` is untouched by this workflow.

---

## 1. OMP Final Response

## KCS Milestone A — Final Response (blocker-closing pass)

This file is the OMP final response for the Milestone A blocker-closing task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

### 1) OVERALL RESULT

- **Status:** Milestone A implemented, all five review blockers closed, six review rounds run, **final verdict READY**. **NOT MERGED.**
- **Branch:** `feat/canvas-tangent-authoring` (local only, no remote counterpart)
- **Starting branch commit:** `c7ae7bc` (feature)
- **New commits:** `0114098`, `b3396ec`, `eb1f1a1`, `71e4290`, `469c070`, `e40b808`, `ffaf216`, `b0e1027`
- **Review blocker status:** 1 (verification matrix) CLOSED · 2 (legacy normalization) CLOSED · 3 (selection model) CLOSED · 4 (Escape/batch lifecycle) CLOSED · 5 (smooth-handle edge + extreme coordinates) CLOSED
- **Merge:** **not performed** — fast-forward is impossible in either direction (see §6)
- **Push:** none (the feature branch has no remote; `main` was not pushed)
- **`main == origin/main`:** yes, `312a0d771123b2b64f9b6f5779f873b439eedab5`, untouched
- **Working tree:** clean

### 2) BLOCKERS CLOSED

1. **Verification matrix (HIGH)** — CLOSED. Coordinate parity migrated to the real `EDITOR_CAMERA_CENTER` in five transform rows; the whole eligibility guard chain extracted to the pure `isFreeformTangentOverlayEligible` predicate with an 18-row guard matrix; canonical-path priority covered by unit and component tests; real `useHistory` entry counts; a genuine `exportProject()` → `importProject()` round-trip of a materialized path; OGraf/SVG parity argued structurally (render authorities untouched, canonical pass-through asserted by object identity and `d`); a permanent real-browser smoke spec.
2. **Legacy points normalization (MEDIUM)** — CLOSED. `resolveFreeformPath = part.path ?? legacyFreeformPointsToPath(normalizeClosedPoints(part.points ?? []), true)`, with tests for the repeated closing vertex, the `< 2` points case, canonical priority, and no mutation of `part.points`.
3. **Selection model (MEDIUM)** — CLOSED. Separate vertex and handle selection, vertex click clears the handle selection, handle click selects it (highlighted and exposed as `data-selected`), reset on layer change and on a vanished vertex index. The empty-canvas behaviour is documented as the existing stage authority rather than a second selection authority.
4. **Escape lifecycle (MEDIUM)** — CLOSED. The Escape listener exists only while a drag is in flight; the batch is closed by a state-driven post-commit effect, so `pointerdown` + Escape with no move closes the batch; `pointercancel` commits through the same path as `pointerup`; the unmount cleanup is bound to unmount only.
5. **Smooth-handle-at-anchor and extreme coordinates (MEDIUM)** — CLOSED. Dragging onto the anchor keeps the counterpart's own length; a non-finite pointer result is dropped; an overflowing dragged vector or mirror leaves the counterpart untouched; the smooth initializer walks mirror → direction-and-reach → degenerate-onto-vertex and computes nothing for a vertex whose own coordinates are not finite.

### 3) USER-FACING BEHAVIOUR

- **What it does:** selecting a single freeform layer in edit mode with the select tool shows its vertices on the stage; clicking a vertex shows its Bezier tangent handles; dragging a handle reshapes the rendered path live.
- **How to use it:** select the layer, click a vertex, drag the round handle; double-click a vertex to toggle corner ↔ smooth (creating symmetric handles from neighbour geometry).
- **Undo:** one history entry per completed drag (`Ctrl+Z` / `Ctrl+Shift+Z`).
- **Escape:** cancels an in-flight drag, restores the previous handles, and records no history entry.
- **Unsupported:** boolean owners/operands, trim-enabled layers, normalized-space paths, hidden layers, multi-selection, broadcast mode, and layers with zero scale show no overlay; vertex add/remove, multi-vertex transforms, keyboard nudging, and handle constraints are out of scope.

### 4) VALIDATION

| Check | Result |
|---|---|
| Focused suites (7 files) | 165 passed |
| Full Vitest | 108 files / 1641 tests passed |
| `validate:ograf` | PASS |
| `qa:release` (release gate) | PASS — 2 Chromium tests |
| `npm run build` | PASS |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (pre-existing `react-refresh` warning only) |
| `npx playwright test e2e/canvas-tangent-authoring.spec.ts` | PASS — permanent real-browser smoke |
| Existing interaction e2e (`canvas-interaction-v1`, `interactive-shape-creation-v1`, `editor-interaction-regressions`) | 9 passed |
| `git diff --check` | clean |

Coverage: coordinate matrix · guard matrix · canonical priority · real history · serialization/import · OGraf parity (structural) · manual/real-browser smoke.

### 5) REVIEW

- Round 1 (`c7ae7bc`) — BLOCKED, 5 findings.
- Round 2 (`0114098`) — BLOCKED: serializer round-trip evidence missing, an overflow path could still write `NaN`, six documentation over-claims.
- Round 3 (`eb1f1a1`) — BLOCKED: the initializer could store an overflowing mirror; an overflowing dragged length collapsed the counterpart; one of the new tests selected the wrong vertex.
- Round 4 (`469c070`) — BLOCKED: the initializer's *final* fallback was unvalidated (finite inputs could still produce `Infinity`); the bogus test confirmed.
- Round 5 (`e40b808`) — BLOCKED: both named defects CLOSED and verified against the exact pre-fix failing assertions; one new medium finding — the degenerate fallback copied a non-finite *anchor* into new handles.
- **Round 6 (`ffaf216`) — READY.** No new defect, no remaining over-claim; the only residual note is that existing non-finite handles arriving from an unsanitized legacy import are preserved by design.

Fixes after review: the finite-anchor precondition plus its two tests, and the documentation scoped to "the writers never compute a non-finite handle" with overflow-freedom and imported-value repair explicitly not claimed.

### 6) RELEASE SAFETY

- `v1.1.0-rc.1` tag target: `46d2a3e59e065816d972dcd56951803951b577f6` — unchanged
- Tag / release / npm: no tag create-move-delete, no release publish or edit, no npm publish (package stays private at `1.1.0-rc.1`)
- `without-mask`: untouched
- OMP config: model roles, providers, `memory.backend: mnemopi`, `task.maxConcurrency: 8` — unchanged
- `C:\Users\ertugrul.ak\Desktop\KCS` and `C:\Users\ertugrul.ak\Desktop\ograf-graphics`: untouched, nothing copied
- Secrets: none printed or copied
- `main` / `origin/main`: `312a0d771123b2b64f9b6f5779f873b439eedab5`, CI run `35114602866` success, unchanged by this work

**Merge blocking evidence:** `git merge-base --is-ancestor main feat/canvas-tangent-authoring` fails and the reverse also fails; `git rev-list --left-right --count main...feat/canvas-tangent-authoring` = `4  4` (main has four docs/handoff commits the branch lacks; the branch has eight commits main lacks). No rebase, no merge commit, and no force push were performed.

**Options that need your approval:** (1) replay the branch's changes as new commits on a fresh branch from current `main`, then fast-forward `main`; (2) explicitly approve a controlled `--no-ff` merge or a rebase.

### 7) HANDOFF

- `chatgpt_handoff/latest/`: 8 files (README, manifest, this final response, progress 108, the contract, the roadmap plan, next session, project state)
- One-file rebuilt from scratch, no append
- Source/test copies present: NO · Test-glob matching files present: NO · Desktop\KCS copied: NO
- Malformed Windows paths: zero collapsed-backslash paths in the one-file (the three patterns the handoff policy names were scanned and matched nothing outside this sentence)

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.

### NEXT ACTION

The milestone itself is finished and READY. The only open decision is the merge strategy for `main` (see §6): approve the replay option or a controlled merge/rebase exception. After that, the next roadmap milestone is **B (graph + keyboard accessibility, roadmap item 4)**, which is untouched and still plan-only.

---

## 2. Handoff Manifest

## KCS ChatGPT Upload Manifest — Milestone A (Canvas Tangent Authoring)

Clean refreshed: YES
Bundle purpose: Milestone A (direct canvas tangent handle authoring) — blocker-closing pass
Bundle scope: minimal and task-specific; this folder is not an archive

Current main / origin HEAD: 312a0d7 (one-file handoff audit; later docs commits may be newer)
Milestone A branch: feat/canvas-tangent-authoring (local only, no remote counterpart, NOT merged)
Milestone A commits: c7ae7bc (feat), 0114098, b3396ec, eb1f1a1, 71e4290, 469c070, e40b808, ffaf216 (review fixes), b0e1027 (final report)
Ancestry: main and the branch diverged (4 commits each way) — fast-forward merge impossible; no rebase, no merge commit, no force push performed
v1.1.0-rc.1 tag target: 46d2a3e59e065816d972dcd56951803951b577f6 (unchanged)
Tag/release/npm changed: NO
GitHub release: existing draft prerelease, not published/finalized
npm publish: NO

Copied files (8):
- README.md — bundle instructions
- manifest.txt — this inventory
- OMP_FINAL_RESPONSE.md — the final task response (blockers, validation, review rounds, merge evidence)
- progress_108_canvas_tangent_authoring.md — orchestration report plus the blocker-closing pass (verification matrix, validation, review rounds, deviations)
- KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md — design contract, updated where the implementation forced wording
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md — grouped roadmap plan with the current Milestone A row
- NEXT_SESSION.md — repository state and the pending merge decision
- PROJECT_STATE.md — project state, validation status, ChatGPT handoff policy

Omitted categories:
- Source and test files (they live under src/ and e2e/; flattened test copies break CI because Vitest's default include glob matches names ending in .test.*)
- package.json, ci.yml, release-smoke.yml, CHANGELOG.md (the milestone is not merged, so there is no released user-facing change to record)
- older progress reports, current-state/release documents, QA output, zip files, asset folders, screenshots, archives, dependencies, secrets, caches

Omitted files were not deleted from the repository. Not copied and never touched: .git, node_modules, .omp, backups, secrets/env/API keys, binary caches, `C:\Users\ertugrul.ak\Desktop\KCS`, `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

Validation at this revision:
- Focused Vitest: PASS — 7 files / 165 tests
- Full Vitest: PASS — 108 files / 1,641 tests
- validate:ograf, qa:release (2 Chromium tests), build, TypeScript, lint, git diff --check: PASS with the pre-existing Fast Refresh and Vite chunk-size warnings only
- Real-browser smoke: PASS — e2e/canvas-tangent-authoring.spec.ts (not part of CI or the release gate)
- Independent review: READY at round 6 (six rounds; round-6 verdict READY with no new defect and no remaining over-claim)

Upload the contents of chatgpt_handoff/latest/ to ChatGPT.

---

## 3. Bundle README

## KCS Minimal ChatGPT Upload Bundle — Milestone A (Canvas Tangent Authoring)

This is a minimal, task-specific ChatGPT upload bundle for the Milestone A blocker-closing pass. It was clean-refreshed for this task.

### What this bundle covers

Direct Bezier tangent-handle authoring on the stage canvas for the selected freeform layer, and the pass that closed all five findings of the independent review: the verification matrix (coordinate parity, eligibility guard matrix, canonical-path priority, real history, serialization round-trip, OGraf parity, real-browser smoke), legacy points normalization, the overlay selection model, the Escape/batch lifecycle, and the smooth-handle-at-anchor edge including a non-finite overflow guard.

### Files

- `progress_108_canvas_tangent_authoring.md` — the full report: orchestration record, implementation, blocker-closing pass, verification matrix, validation table, review rounds, deviations
- `KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md` — the design contract, updated where the implementation forced wording (normalization, non-finite policy, eligibility helper, selection model, Escape scope, test matrix)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the grouped roadmap plan with the current Milestone A status row
- `NEXT_SESSION.md` — repository state plus the Milestone A status and the merge decision that is pending
- `PROJECT_STATE.md` — project state, validation status, and the ChatGPT handoff policy

### Deliberately not included

Source and test files are intentionally omitted. Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI, and the real files live under `src/` and `e2e/` in the repository. Also omitted: `package.json`, CI/release workflows, older reports, release/current-state documents, `CHANGELOG.md` (the milestone is not merged, so there is no released user-facing change to record), QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

### Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload the contents of `chatgpt_handoff/latest/` to ChatGPT.

---

## 4. Progress Report

Milestone A report: orchestration record plus the blocker-closing pass.

## Progress 108 — Canvas Tangent Authoring (Milestone A) + Grouped Roadmap Orchestration

### 1. Scope

Grouped-roadmap orchestration with Milestone A (roadmap item 3, direct canvas tangent handles) as the first milestone. The goal review, milestone grouping, design contract, design review, implementation, and validation all ran; the milestone was **not merged** because the independent merge-gate review returned BLOCKED with a concrete remaining-work list.

### 2. Repo preflight state

- `main` = `origin/main` = `d3aa135bdf8d63b9cb01b21f2b2f4c14f7973c72`; working tree clean.
- Tag `v1.1.0-rc.1` present, target `46d2a3e59e065816d972dcd56951803951b577f6` (unchanged).
- CI on `main`: run `35103238439` (d3aa135) — success; no failing run on current `main`.

### 3. Goal review and milestone grouping

Complete before this run: Task 105 (export diagnostics remediation UX), Task 106B (minimal handoff policy + CI fix), Task 107 (track-matte source selection affordance). Roadmap items 1 and 2 are done.

Remaining roadmap items were grouped as instructed:

| Milestone | Roadmap items | Status this run |
|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | Implemented and validated on a branch; **not merged** (review BLOCKED) |
| B — Graph + keyboard accessibility | 4 | Not started |
| C — First export / onboarding flow | 5 | Not started |
| D — State / CI / warning hygiene | 6, 9 | Plan only (needs approval for dependency work) |
| E — OGraf QA / schema hardening study | 7, 8 | Plan only |
| F — Architecture exploration only | 10, 11, 12 | Plan only |

The grouping held up: A is genuinely separable, and B–F each keep their own gate. One correction to the grouping: item 9 (dependency/warning maintenance) must stay behind an explicit approval gate because it touches `package.json`/lockfile, so it is not a mechanical follow-up to item 6.

### 4. Milestone A — design contract

`docs/KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md` (three revisions).

- Revision 1 was reviewed by the ADVISOR/planner role and returned BLOCKED for factual and structural reasons (wrong editor camera centre, wrong rendering-authority file, `onPartPropChange` misdescribed as a canvas API, optional `BezierVertex.kind` ignored, a materialization hazard when both `path` and `points` exist, byte-parity over-claim, `worldToLocal` misused as a delta converter, an unimplementable smooth-handle rule, missing eligibility guards, pointer-ownership gaps).
- Revision 2 accepted every correction; a second review (SLOW role) confirmed most were CLOSED but returned BLOCKED on four remaining mechanics: the initializer's degenerate/open/partial policies, the cancel-rollback commit ordering versus `useHistory`'s ref sync, and a non-existent `part.closed` field.
- Revision 3 pinned all four: unit-normalized chord direction with an explicit fallback ladder, open-path endpoint rule, "zero chord never forces zero-length handles", the double-click action as the only handle creator (with mirror repair), materialization fixed to `legacyFreeformPointsToPath(normalizeClosedPoints(points), true)` (`closed: true`), and an Escape-cancel that writes the rollback first and closes the batch in a post-commit effect, with `pointercancel` committing like the existing transform drags.

Budget note: the prompt allows one review plus one re-review after BLOCKED; a third design round was not run, and the implementation review below covers the contract's promises.

### 5. Milestone A — implementation (branch `feat/canvas-tangent-authoring`, commit `c7ae7bc`)

- `src/utils/bezierPath.ts`: pure `initializeSmoothHandles(path, index)` — neighbour chord, unit direction, quarter-of-shortest-span reach, deterministic degenerate ladder, partial-smooth mirror repair, existing handles never overwritten.
- `src/utils/freeform.ts`: pure `resolveFreeformPath(part)` = `part.path ?? legacyFreeformPointsToPath(part.points, true)`.
- `src/components/Canvas/overlays/FreeformTangentOverlay.tsx`: vertex markers for the selected freeform layer (replacing the previous read-only marker block, same `data-testid`), the selected vertex's handles, handle drags through `setCharacterParts` inside `startBatchInteraction`/`endBatchInteraction`, Escape rollback, double-click corner/smooth toggle, pointer capture, all markers screen-sized through `zScale`.
- `src/components/Canvas/StageCanvas.tsx`: eligibility guards (edit mode, select tool, single selection, `custom_freeform`, no boolean ownership/operand, edit-visible, no other drag, `coordinateSpace === 'local'`, ≥2 points, trim disabled, non-zero scale) and wiring; the existing marker block was removed rather than duplicated.
- Tests: `src/tests/bezierTangentHandles.test.ts` (7) and `src/tests/freeformTangentOverlay.test.tsx` (6).

### 6. Validation at the stop point

| Check | Command | Result |
|---|---|---|
| Focused tests | `npx vitest run src/tests/bezierTangentHandles.test.ts src/tests/freeformTangentOverlay.test.tsx src/tests/bezierPath.test.ts` | PASS — 3 files / 18 tests |
| Full Vitest | `npm test` | PASS — 105 files / 1,588 tests |
| OGraf fixture | `npm run validate:ograf` | PASS |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| Production build | `npm run build` | PASS — existing Vite chunk-size warning only |
| TypeScript | `npx tsc --noEmit` | PASS |
| Lint | `npm run lint` | PASS — existing `AnimatorContext` Fast Refresh warning only |
| Whitespace | `git diff --check` | PASS |

`main` was not modified by this milestone: the branch is committed but unmerged, so `main`, the tag, the draft release, and CI are exactly as they were at preflight.

### 7. Independent review — BLOCKED

One independent merge-gate review ran on `d3aa135..c7ae7bc`. Verdict: **BLOCKED**, with these required items before merge. **Update (blocker-closing pass, §11): all five items were closed; see §11 for the evidence per item.**

1. **HIGH — verification matrix incomplete.** The contract requires coordinate parity at the real `EDITOR_CAMERA_CENTER` with rotation, non-uniform, and negative scale; behavior tests for every `StageCanvas` eligibility guard; canonical-path priority; real `useHistory` undo/redo/cancel entry counts; serialization/import and OGraf byte-parity; and a manual editor smoke. The branch has focused unit/component tests only, and one test name ("leaves other vertices identical") over-claims what it asserts.
2. **MEDIUM — legacy normalization missing.** `resolveFreeformPath` uses raw `part.points`; the contract pins `normalizeClosedPoints(points)`, so a legacy layer whose closing vertex repeats the first vertex would show an extra marker and materialize a duplicate vertex into the canonical path.
3. **MEDIUM — §7 selection model incomplete.** No separate handle-selection authority, no empty-canvas "clear overlay selection only" behavior, and the overlay does not reset its `selectedIndex` when the selected layer changes.
4. **MEDIUM — Escape lifecycle.** The listener is installed for the overlay's lifetime instead of only during a drag; a pointerdown-then-Escape with no move can leave the batch open until the global `mouseup`.
5. Also named: a plausible bug where dragging a smooth handle exactly onto its anchor collapses the counterpart's length (`Math.hypot(...) || 1`).

Reviewer conclusion: merge is blocked until those are closed; the reviewer explicitly confirmed the reused authorities, the coordinate/delta rule, the initializer, the pointer-ownership order, and that no parallel engine or protected-authority change was introduced.

### 8. Stop rationale

The orchestrator policy allows fixing in scope and running one more focused review, but also requires stopping when a milestone turns broad. Here the remaining work is a coherent batch (two small code fixes, selection/lifecycle behaviour, and a real verification matrix including history and export parity) that is larger than the increment itself. Stopping keeps `main` green and unchanged, leaves the design contract and the implementation available for the next session, and avoids merging an unverified increment. No package, workflow, dependency, or release change was made, and `chatgpt_handoff/latest/` was not given source or test copies.

### 9. Protected invariants

- Tag `v1.1.0-rc.1` target unchanged; draft release not published/finalized; no npm publish; no branch deleted.
- `main` untouched (`d3aa135…`); CI on `main` green.
- No new matte/rendering/evaluation/timing/package/state engine; `ShapePartRenderers`, `evaluateFrame`, `StagePartLayers`, matte authority, `bounds.ts`, and `src/ograf/**` untouched.
- `without-mask`, global OMP configuration (model roles, provider mappings, `memory.backend: mnemopi`, `task.maxConcurrency: 8`) untouched.
- `C:\Users\ertugrul.ak\Desktop\KCS` and `C:\Users\ertugrul.ak\Desktop\ograf-graphics` untouched; no secrets handled.

### 10. Next recommended action

Finish Milestone A on the existing branch by closing the review's five items, then run one focused re-review and merge by fast-forward. `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` records the milestone plan, the approval gates, and the recommended next prompt.

### 11. Blocker-closing pass (this session)

#### Branch

- Branch: `feat/canvas-tangent-authoring`
- Milestone A feature commit: `c7ae7bc` — `feat: add direct canvas tangent handle authoring`
- Blocker-fix commits: `0114098`, `b3396ec`, `eb1f1a1`, `71e4290`, `469c070`, `e40b808`, `ffaf216` (code fixes, test corrections, documentation scoping)
- Baseline `main` at branch point: `d3aa135`
- Current `main` / `origin/main`: `312a0d771123b2b64f9b6f5779f873b439eedab5`
- Ancestry: `main` and the branch **diverged** (main advanced with four docs/handoff commits after `d3aa135`), so a fast-forward merge is not possible in either direction. No rebase, no merge commit, no force push was performed.

#### Blocker status

| # | Review finding | Status | Evidence |
|---|---|---|---|
| 1 | HIGH — verification matrix incomplete (coordinate parity, guard matrix, canonical-path priority, real history, serialization/import, OGraf parity, manual smoke) | **CLOSED** | §Verification matrix below; new `freeformTangentEligibility.test.ts` (23), `freeformTangentPersistence.test.ts` (6), `freeformTangentHistory.test.tsx` (3), overlay suite grown to 19; guarded render condition extracted to `src/utils/freeformTangentEligibility.ts` |
| 2 | MEDIUM — legacy points normalization missing in `resolveFreeformPath` | **CLOSED** | `src/utils/freeform.ts`: `part.path ?? legacyFreeformPointsToPath(normalizeClosedPoints(part.points ?? []), true)`; tests cover repeated closing vertex, `<2` points → `undefined`, canonical-path priority, no mutation of `part.points` |
| 3 | MEDIUM — §7 selection model incomplete | **CLOSED** | overlay holds `selectedIndex` + `selectedHandle` + an in-flight drag flag; clicking a vertex clears the handle selection, clicking a handle selects it (rendered highlighted via `data-selected`); switching layer or losing the selected vertex resets the overlay selection; empty-canvas behaviour documented (see Deviations) |
| 4 | MEDIUM — Escape lifecycle / batch close | **CLOSED** | `Escape` listener is installed **only** while a drag is in flight and removed when it ends; the batch is closed by a state-driven post-commit effect (`pendingCancel`), so a `pointerdown` with no `pointermove` still closes the batch |
| 5 | MEDIUM — smooth-handle-at-anchor collapse (`Math.hypot(...) || 1`) | **CLOSED** | Drag: a vector `<= 1e-6` keeps the counterpart's own length/direction, a non-finite pointer result is dropped, a non-finite (overflowing) dragged length leaves the counterpart untouched, and a non-finite mirror leaves the counterpart untouched. Smooth toggle: the §8 initializer computes finite handles only — non-finite mirror → direction-and-reach handle; non-finite fallback → degenerate onto the vertex; overflowing span → zero reach; overflowing chord → `{x: 1, y: 0}`; a vertex whose own coordinates are not finite gains no computed handles. Exact scope: **no writer computes a non-finite handle** — the drag refuses non-finite output, and the smooth toggle computes handles only for a finite vertex; existing handles (including ones from an unsanitized legacy import) are passed through, and the arithmetic is not claimed to be overflow-free. Tests: `1.7e308` counterpart, `1.7e308` dragged vector, `1e308` mirror overflow (selected vertex = the huge one), overflowing chord with an unrepresentable reach, and a non-finite vertex gaining no handles. |

#### Verification matrix

#### A. Coordinate parity (real origin, real transform)

Overlay suite `FreeformTangentOverlay coordinate mapping`, `outputOrigin = EDITOR_CAMERA_CENTER` (the production constant), one row per transform: identity, rotation-only, non-uniform scale, negative `scaleX`, and rotation + non-uniform + negative scale + offset.

For each row the test drags the out-handle through the stage pointer mapper by a screen delta and requires the handle's world position to move by exactly that delta (± 1e-6 local / < 2 px in the browser run). The delta is produced by the implementation's separate inverse-mapping of the *start* and *current* pointer points (`worldToLocal` on each, difference of the two locals), so a raw world delta reaching `worldToLocal` would fail this row.

#### B. Eligibility guard matrix

`src/tests/freeformTangentEligibility.test.ts` — 23 tests. One positive case, one legacy-points-only positive case, two negative-control positives (unrelated hidden track, negative/non-uniform scale), and 18 guard rows, each asserting the predicate is `false`:

broadcast mode · non-select tool · active stage drag · empty selection · multi-selection · missing selected part · non-freeform type · boolean owner · boolean operands · boolean operand child · edit-hidden track · trim enabled · missing evaluated transform · `scaleX === 0` · `scaleY === 0` · normalized-space path · single-vertex path · fewer than two legacy points.

Plus canonical priority (path present while legacy points are unusable → eligible) and the inverse case.

The guard list is no longer inline JSX: `StageCanvas` calls `isFreeformTangentOverlayEligible({...})`, so the matrix and the runtime condition are the same code.

#### C. Canonical-path priority

- Unit: `resolveFreeformPath` returns the *same object* when `part.path` exists, and `buildBezierPathD(resolved) === buildBezierPathD(part.path)` even when legacy `points` disagree.
- Component: with `path` and differing legacy `points` the overlay renders exactly the path's 3 markers at the path's anchors (legacy points would produce 4 different anchors).
- Clone-on-write: the untouched-vertex test reads the neighbouring smooth vertex's handles after a drag and requires `26/0` and `14/0` — its own values — while the dragged vertex's handle holds the pointer value.

#### D. Real history

`src/tests/freeformTangentHistory.test.tsx` wires the overlay to the real `useHistory` (same `startBatchInteraction` / `endBatchInteraction` wiring `StageCanvas` uses):

| Action | Expected | Result |
|---|---|---|
| completed drag | exactly one undo entry; undo restores the previous handle; redo reapplies | PASS |
| drag then `Escape` | path restored, **no** entry added (one undo returns to the pre-drag state, then `canUndo === false`) | PASS |
| `pointerdown` then `Escape`, no move | batch closed, no entry (`canUndo === false`), path unchanged | PASS |
| `pointercancel` after a move | last value committed, one entry, undo restores | PASS |

#### E. Serialization / import

`src/tests/freeformTangentPersistence.test.ts`:

- A points-only layer materializes a `local`, closed path whose anchors are exactly the normalized legacy polygon and whose `d` equals the normalized `legacyFreeformPointsToPath` output.
- The materialized path (after `initializeSmoothHandles`) survives `JSON` round-trip **and** the import sanitizer `normalizeBezierPath(..., 'local')` unchanged (`toEqual` + identical `d`).
- `part.points` identity and the whole part object are unchanged by resolution (no hidden rebuild while a canonical path exists).
- **Real serializer round-trip (added after the first review round):** `src/tests/useSerialization.test.ts` → `Milestone A: a materialized freeform path survives export → import with its handles and legacy points` runs the real authority (`exportProject()` → `importProject()`), then asserts the restored part keeps the canonical path (`toEqual` of the whole path, `handleOut`, `kind: 'smooth'`, identical `d`) **and** the legacy `points` array next to it.

#### F. OGraf / SVG byte parity

- No file under `src/ograf/`, `ShapePartRenderers.tsx`, `StagePartLayers.tsx`, `bounds.ts`, `evaluateFrame`, or the matte authority is modified by this pass.
- For a **canonical** freeform path, `resolveFreeformPath` returns the identical object, so every render authority that reads `content.path` emits the identical `d` before and after this milestone. What the tests assert is exactly this: object identity plus `buildBezierPathD(resolveFreeformPath(part)) === buildBezierPathD(part.path)` in `freeformTangentPersistence.test.ts`. The renderers themselves are **not** called by that test — OGraf's canonical-path output is pinned by the existing, unchanged `src/tests/ografSvg.test.ts` (`d` for a canonical freeform layer), and Canvas/matte resolution is unchanged code, so the parity argument is structural rather than a new byte-diff assertion.
- `npm run validate:ograf` PASS and the OGraf suite in the full run PASS.
- Not claimed: byte parity for an *edited* handle (edits legitimately change geometry) and for a points-only layer **after** its first edit (documented deviation below).

#### G. Manual editor smoke (real Chromium, real app)

Throwaway Playwright spec (deleted after the run) seeded a scene with a canonical-path freeform layer plus a rect layer, then asserted against the live DOM:

| Step | Result |
|---|---|
| no selection → overlay absent; select layer → overlay present with 3 markers | PASS |
| click a vertex → its two handles appear | PASS |
| drag the out-handle 90/−60 px → rendered `d` changes and the handle follows the pointer within 2 px | PASS |
| `Ctrl+Z` → `d` restored byte-for-byte; `Ctrl+Shift+Z` → `d` reapplied | PASS |
| drag then `Escape` → `d` restored; the following `Ctrl+Z` steps over the *previous* action (no entry for the cancelled drag) | PASS |
| switching the selected layer away → overlay removed, back → re-rendered | PASS |

The smoke is now a **permanent, re-runnable spec** instead of a throwaway one: `e2e/canvas-tangent-authoring.spec.ts` (seeds the scene through the autosave key, asserts the same table above, writes `test-results/tangent-authoring-handles.png` and `test-results/tangent-authoring-eligibility.png`). `test-results/` is not tracked, so the screenshots are regenerated by running the spec; the spec itself is the auditable artefact. It is not part of CI or the release gate (neither runs this file).

Existing interaction e2e specs re-run on the branch for the "not obviously broken" part of the requirement: `canvas-interaction-v1.spec.ts` (gizmo corner resize, cursor-anchored zoom, marquee selection), `interactive-shape-creation-v1.spec.ts` (shape tools incl. Escape cancel), `editor-interaction-regressions.spec.ts` (mirror duplicate keeps the selection gizmo aligned) — **9 passed**.

Note recorded during the smoke: a `custom_freeform` layer intentionally renders no transform gizmo (`SelectionGizmo` skips `TransformGizmo` for freeform parts), so the gizmo check uses the rect layer. This is pre-existing behaviour, unchanged here.

#### Changed files

| File | Change |
|---|---|
| `src/utils/freeformTangentEligibility.ts` | **new** — pure eligibility predicate (single guard authority) |
| `src/utils/freeform.ts` | `resolveFreeformPath` normalizes legacy points |
| `src/components/Canvas/StageCanvas.tsx` | inline guard chain replaced by the helper call; unused import removed |
| `src/components/Canvas/overlays/FreeformTangentOverlay.tsx` | selection model (vertex + handle state, layer/topology reset), state-driven Escape/batch close, drag-scoped key listener, zero-length handle guard, `data-selected` marker on the handle hit target |
| `src/tests/freeformTangentEligibility.test.ts` | **new** — 23 guard/priority tests |
| `src/tests/freeformTangentPersistence.test.ts` | **new** — 6 normalization/materialization/parity tests |
| `src/tests/freeformTangentHistory.test.tsx` | **new** — 3 real-`useHistory` tests |
| `src/tests/freeformTangentOverlay.test.tsx` | rewritten — 19 tests (coordinate matrix, selection model, Escape/pointercancel, smooth-at-anchor, canonical priority) |
| `docs/KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md` | §4/§5/§7/§9/§10/§12 clarified where the implementation forced wording |
| `reports/progress_108_canvas_tangent_authoring.md` | this report |

Removed claim: the previous test name "leaves other vertices identical" asserted only the dragged vertex in one direction; the test was renamed and now reads the neighbouring smooth vertex's `handleOut`/`handleIn` after the drag.

#### Validation

| Command | Result |
|---|---|
| `npx vitest run` on the tangent/path suites + `useSerialization` | 165 passed (19 files) |
| Focused per-file counts | eligibility 23 · persistence 6 · overlay 21 · history 3 · initializer 12 · bezierPath 5 · useSerialization 95 |
| `npm test` (full suite) | 108 files / 1641 tests passed |
| `npm run validate:ograf` | PASS (`fixtures/ograf/minimal.ograf.json` valid) |
| `npm run qa:release` | PASS — release gate 2/2, candidate SHA resolved from HEAD |
| `npm run build` | PASS (`tsc -b && vite build`) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (one pre-existing `react-refresh` warning in `AnimatorContext.tsx`) |
| `git diff --check` | clean |
| `npx playwright test e2e/canvas-tangent-authoring.spec.ts` | PASS — permanent real-browser smoke (1 test) |

#### Deviations and limits (disclosed, not hidden)

1. **Empty-canvas click.** The contract §7 wording said an empty-canvas click must clear only the overlay-local selection. The stage already clears the *app* layer selection on an empty-canvas pointer-down — existing behaviour that this milestone must not change — and that necessarily unmounts the overlay. The contract was corrected to state the actual, pre-existing behaviour instead of adding a second selection authority.
2. **Legacy points-only layers and the degenerate closing vertex.** `normalizeClosedPoints` drops a repeated closing vertex, so for a points-only layer that carries one, the overlay shows/edits the normalized topology while the modern canvas and OGraf render branches (`part.path ?? legacyFreeformPointsToPath(part.points)`) still draw the duplicated, zero-length closing edge (the legacy/non-modern canvas branch already normalizes: `ShapePartRenderers.tsx:345-348`). A scene imported through `src/utils/v6Migration.ts` materializes a canonical path from the raw legacy points, so such a layer never reaches the overlay's normalization step at all — pre-existing migration behaviour, outside this milestone's scope. The shapes are visually identical (the extra edge has zero length), but after the first handle edit the materialized canonical path is the normalized one, so the `d` string of that layer changes (an edited layer, so F's parity claim does not apply). Canonical-path layers are unaffected. Recorded in the contract §4.
3. **`resolveFreeformPath` with two coincident legacy points** now returns `undefined` (normalization leaves one point) instead of a degenerate 2-point path, so the overlay stays hidden. Defence, not a behaviour loss: a 2-point "polygon" was never renderable as a closed shape.
4. **Extreme coordinates are refused, not repaired.** Individually finite coordinates near the double-precision limit can overflow the mirror/normalization arithmetic. The drag writer refuses non-finite output (the counterpart keeps its value); the §8 initializer refuses it too, falling back to the direction-and-reach handle and then to a zero-length handle at the vertex, and a vertex whose own coordinates are not finite gains no computed handles. Both are pinned by tests, and both tests fail on the pre-fix code (verified by replaying the old expressions). A non-finite value that a user scene already contains is preserved as-is: the versioned SceneData import sanitizes handles, the legacy `AnimationProject` import does not, and repairing that path is outside this milestone.
5. **Merge is not ff-possible on this branch base.** See §Branch. Awaiting an explicit decision.

##### Independent review rounds

| Round | Scope | Verdict | Outcome |
|---|---|---|---|
| 1 | `d3aa135..c7ae7bc` (the original implementation) | BLOCKED | the five findings closed in this pass |
| 2 | `c7ae7bc..0114098` (this pass) | BLOCKED | blockers 2/3/4 CLOSED; two gaps remained: (a) no real `exportProject()` → `importProject()` round-trip of a materialized path — the new test in `useSerialization.test.ts` closes it; (b) `Math.hypot` overflow on individually-finite imported coordinates could still write `Infinity`/`NaN` — closed by the non-finite policy in §5 plus the `1.7e308` counterpart test. Six documentation over-claims were also corrected (round-trip wording, renderer-parity wording, the NaN/Infinity claim, the initializer reach claim, screenshot paths now replaced by a permanent spec, and the points-only render generalization). |
| 3 | `0114098..eb1f1a1` (fix commits) | BLOCKED | blocker 1 CLOSED (real `exportProject()` → `importProject()` round-trip); blocker 5 still OPEN, with two extreme-coordinate paths named: the §8 initializer could store an overflowing mirror, and a dragged vector whose `hypot` overflows collapsed the counterpart onto the anchor (both finite-input arithmetic, not regressions of this milestone). Both are now guarded and covered by tests, and the five remaining documentation over-claims were rewritten to their exact scope. |
| 4 | `71e4290` / `469c070` (extreme-coordinate fixes) | BLOCKED | the drag side CLOSED; the initializer guard was incomplete — the *final* direction-and-reach fallback was still unvalidated, and one newly added test selected the wrong vertex so it passed on the pre-fix code. Both are fixed: the initializer now walks mirror → direction-and-reach → degenerate-onto-vertex, and the two regression tests were corrected/added and verified to fail pre-fix. |
| 5 | `e40b808` (initializer fallback + tests) | BLOCKED | both named defects CLOSED, verified with the exact pre-fix failing assertions; one new medium finding: the degenerate fallback copied a non-finite *vertex* into new handles. Fixed by a finite-anchor precondition (a non-finite vertex gains no computed handles) plus two tests, and the contract/report wording scoped to exactly that. |
| 6 | `ffaf216` (finite-anchor guard + wording scoping) | **READY** | the guard closes the round-5 reproduction, both earlier defects stay CLOSED, no new defect, documentation matches the code, residual note only: existing non-finite handles are pass-through by design. |

Self-found hardening during round 2: the unmount cleanup that closes an open batch was bound to `onBatchEnd`'s identity, so a re-created callback during a drag could have closed the batch early and split one drag into several history entries. It now reads the latest callback through a ref and is bound to unmount only.

### Merge status

**NOT MERGED — fast-forward impossible; awaiting an explicit decision.**

Evidence (`git merge-base --is-ancestor` in both directions, then `git rev-list --left-right --count main...feat/canvas-tangent-authoring`):

- `main` is **not** an ancestor of the branch and the branch is **not** an ancestor of `main`
- divergence: `4  4` — `main` has 4 commits the branch lacks (`449ed83`, `05418f1`, `9e52ca5`, `312a0d7`: docs/handoff only), the branch has 4 code+docs commits `main` lacks
- therefore `git merge --ff-only feat/canvas-tangent-authoring` on `main` fails, and `git merge --ff-only main` on the branch fails as well

Per the protected rules (no rebase, no normal merge commit, no force push) nothing was attempted. Safe options, both needing explicit approval:

1. **Replay onto current `main` (no history rewrite):** create a new branch from `main`, re-apply this branch's ten commits as new commits on it (for example `git checkout feat/canvas-tangent-authoring -- <paths>` per logical group, or `git cherry-pick c7ae7bc^..feat/canvas-tangent-authoring`), then `git merge --ff-only` that branch into `main`. `chatgpt_handoff/**` should be resolved in favour of the newest content (this branch's refresh).
2. **Approved exception:** a controlled `git merge --no-ff` on `main`, or an approved rebase of the branch onto `main`, which the standing rules currently forbid.

`main`, `origin/main`, the `v1.1.0-rc.1` tag target, the draft GitHub release, and npm were not touched: no push of any kind was performed (the feature branch has no remote counterpart).

---

## 5. Next Session

## Next Session Handoff

### Repository state

- Checkout: main at the Task 107 merge commit; `origin/main` synchronized
- Task 107 implementation is integrated by fast-forward; the track-matte source relation is now visible in the outliner and authorable from the existing Track Matte V2 card
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- `feat/export-diagnostics-ux` and `feat/track-matte-source-picker`: merged by fast-forward and retained
- Release tag: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged

### Current result

The four release blockers are resolved or explicitly accepted. Annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate. No npm publication occurred.

Task 105 delivered export diagnostics remediation UX: blocking diagnostics now report a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; and user-authored values no longer reach diagnostics, thrown errors, or toasts raw — a canonical formatter renders machine paths, URL credentials/query, and embedded payloads safely at every construction site.

### Validation

Post-merge full Vitest (103 files / 1557 tests), `validate:ograf`, `qa:release` (2 Chromium tests), TypeScript, lint, production build, and `git diff --check` passed, plus an independent review pass that returned `READY`. Existing Fast Refresh, Vite chunk-size, npm install-script, and schema-network warnings remain.

### Guardrails

- Do not reset, force-push, rebase, tag, or delete branches/reports.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml`, model roles, provider mappings, task concurrency, and global tooling unchanged.
- Keep `origin/without-mask` untouched and classified ARCHIVE.
- Production draft is not published; publish/finalize requires further explicit user instruction.

### ChatGPT handoff policy

- `chatgpt_handoff/latest/` is a per-response, task-specific upload bundle: clean it first, then place only the files that this specific ChatGPT conversation needs.
- Preferred upload artifact: `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. If a historical handoff archive is ever needed, create a separate explicitly named archive file under `chatgpt_handoff/archive/` only after user approval. The default ChatGPT upload is always this one file.
- Never store flattened source or test copies there. Those copies are separate files, and the ones named `src__*test*` are picked up by the Vitest default include glob, which breaks CI.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset folder, not a handoff dump. Never copy the bundle there unless the user explicitly asks.
- Omitted files are never deleted from the repository; they simply are not part of the bundle.

### Next scoped work

1. Read `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `reports/progress_108_canvas_tangent_authoring.md`.
2. Finish Milestone A on the existing branch `feat/canvas-tangent-authoring` (`c7ae7bc`): close the five review items listed in the report, then run one focused re-review and fast-forward merge if READY.
3. Milestones B (graph accessibility) and C (export onboarding) follow only after A is merged or explicitly deferred.
4. Preserve the tag/draft release and request independent review before every merge.
5. Publish/finalize the GitHub draft only after explicit user instruction.

### Milestone A status (canvas tangent authoring) — blocker-closing pass

- Branch: `feat/canvas-tangent-authoring` (local-only, not pushed), commits `c7ae7bc` (feature), `0114098` (review blockers), `b3396ec` (non-finite handle math + serializer round-trip proof), `eb1f1a1` (documentation corrections)
- All five review blockers are closed; validation is green (`npm test` 108 files / 1635 tests, build, TypeScript, lint, `validate:ograf`, `qa:release`, permanent Playwright smoke `e2e/canvas-tangent-authoring.spec.ts`)
- **Not merged:** `main` advanced with docs-only commits after the branch point, so the branch and `main` have diverged and a fast-forward merge is impossible in either direction. No rebase, no merge commit, and no force push was performed. An explicit decision is required (replay/cherry-pick onto current `main`, or an approved merge/rebase exception).
- `main` = `origin/main` = `312a0d771123b2b64f9b6f5779f873b439eedab5`, unchanged by this work.

---

## 6. Project State

## KCS Project State

### Current position

The accepted product and security follow-up line is integrated into main. Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

Task 105 (export diagnostics remediation UX) was integrated into main by fast-forward at `9fdbf0fe59c28d3d6f07c8ee37081fc93f2ff6db`. Current `main`/`origin/main` HEAD is `9f7114877e111527e8757668237e41fde8388a99`, which adds docs and handoff commits only and is therefore newer than the integration commit. Blocking OGraf export diagnostics now carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; and user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.

Task 107 (track-matte source selection affordance) is integrated into main by fast-forward. The matte source relation, whichever model holds it, is now resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps the existing self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers. No new matte, rendering, evaluator, validation, or state engine was introduced, and the canvas/export validators were left untouched.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

### Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, and the track-matte source selection affordance are present in the accepted main line. OMP tooling remains separate.

### Validation status

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 103 files / 1,575 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf`; committed minimal fixture |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Playwright tests |
| TypeScript | PASS | `npx tsc --noEmit` and build typecheck |
| Lint | PASS | Existing Fast Refresh warning only |
| Production build | PASS | Existing Vite chunk-size warning only |
| Independent review | PASS | `READY` at the Task 107 merge gate (three review rounds) |

### Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed.
- Milestone A (canvas tangent handles) is implemented and validated on `feat/canvas-tangent-authoring` (`c7ae7bc`) but **not merged**: the independent review returned BLOCKED with five concrete items, listed in `reports/progress_108_canvas_tangent_authoring.md`.
- Milestones B–F are planned only; dependency/workflow/release changes require explicit approval.
- Publish/finalize the GitHub draft only with further explicit user instruction.
- No npm publication occurred; package remains private at `1.1.0-rc.1`.

### ChatGPT handoff policy

- `chatgpt_handoff/latest/` holds a minimal, task-specific upload bundle, refreshed for each ChatGPT response instead of accumulating context files.
- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. A historical handoff archive, if ever needed, is a separate explicitly named file under `chatgpt_handoff/archive/` and only after user approval.
- Flattened source and test copies must not live there: the Vitest default include glob picks up files named `src__*test*`, which failed CI runs `35094144225` and `35095655446`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.

### Protected state

- The current main documentation commits are intentionally newer than the tag target; the tag remains on the workflow-tested code candidate.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- Candidate package version is `1.1.0-rc.1`; package remains private and unreleased.

### Milestone A status (canvas tangent authoring) — blocker-closing pass

- Branch: `feat/canvas-tangent-authoring` (local-only, not pushed), commits `c7ae7bc` (feature), `0114098` (review blockers), `b3396ec` (non-finite handle math + serializer round-trip proof), `eb1f1a1` (documentation corrections)
- All five review blockers are closed; validation is green (`npm test` 108 files / 1635 tests, build, TypeScript, lint, `validate:ograf`, `qa:release`, permanent Playwright smoke `e2e/canvas-tangent-authoring.spec.ts`)
- **Not merged:** `main` advanced with docs-only commits after the branch point, so the branch and `main` have diverged and a fast-forward merge is impossible in either direction. No rebase, no merge commit, and no force push was performed. An explicit decision is required (replay/cherry-pick onto current `main`, or an approved merge/rebase exception).
- `main` = `origin/main` = `312a0d771123b2b64f9b6f5779f873b439eedab5`, unchanged by this work.

---

## 7. Optional Current Design/Roadmap Docs

### KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md

## KCS Canvas Tangent Authoring — Design Contract

Milestone A of the grouped roadmap execution (roadmap item 3).

Revision 2 — incorporates the ADVISOR design review: corrected coordinate authority, added clone-on-write and eligibility invariants, removed keyboard nudging from the increment, and pinned the smooth-handle initializer policy.

### 1. Purpose

Let the user edit Bezier tangent handles **directly on the stage canvas** for the selected freeform layer, so path authoring no longer depends on an inspector path that does not exist for freeform layers.

This is an authoring affordance over the existing path data: not a new vector editor, not a new geometry engine, and not a change to evaluation, rendering, serialization, or export.

### 2. Existing authorities reused

| Concern | Authority | Reused for |
|---|---|---|
| Path model | `src/types/animator.ts` — `BezierPath`, `BezierVertex { id, x, y, handleIn?, handleOut?, kind? }`, `PathHandle`, `PathCoordinateSpace`, `PathVertexKind` | the only path representation. `kind` is optional, so imported data may carry no kind at all |
| Path helpers | `src/utils/bezierPath.ts` — `createBezierPath`, `legacyFreeformPointsToPath`, `normalizeBezierPath`, `buildBezierPathD`, `sampleBezierPath`, `areBezierPathsTopologyCompatible` | materializing a path, geometry strings, topology guards |
| Freeform helpers | `src/utils/freeform.ts` — `getFreeformVertexWorldPositions`, `normalizeClosedPoints`, `MIN_FREEFORM_POINTS` | local → world mapping of vertices |
| Inverse transform | `src/utils/matte.ts` — `worldToLocal(point, world, outputOrigin)` | world → part-local mapping during a drag |
| Stage transform | `getComputedTransform(partId, frame)` from the animator context (evaluated **world** transform, parent chain composed) | the transform the renderer uses at the current frame |
| Canvas write path | the animator context's `setCharacterParts` (the canvas has no `onPartPropChange`; that closure is private to `DetailsPanel`) | every path write |
| Undo batching | `startBatchInteraction` / `endBatchInteraction` from `useHistory` via the context | one history entry per drag |
| Freeform rendering | `src/components/Canvas/renderers/parts/ShapePartRenderers.tsx` freeform branch (`part.path ?? legacyFreeformPointsToPath(part.points)`) | unchanged |
| Existing canvas markers | `src/components/Canvas/StageCanvas.tsx` freeform vertex marker block (`getFreeformVertexWorldPositions` + `data-testid="freeform-vertex-marker"`) | replaced by this overlay, same test id and visual language |
| Mask path editor | `src/components/Inspector/BezierPathEditor.tsx` — used only for layer-mask paths via `StyleMatteSection` | unchanged; it is not a freeform `part.path` editor |

No new path model, no second selection authority, no package/runtime change.

### 3. Coordinate spaces

- **Part-local** (`path.points[i].x/y`, `handleIn`, `handleOut`): centre-relative, Y-down, exactly what `buildBezierPathD` consumes. Handles are **absolute local coordinates**, not offsets.
- **World / stage**: editor space whose origin is `EDITOR_CAMERA_CENTER` (`EDITOR_CAMERA_VIEWBOX` is 600×480, so the centre is (300, 240)). The constant is always used; no literal centre may appear in the implementation.
- **Client / container**: `clientToSVG` in `StageCanvas` converts pointer coordinates to world coordinates.

Rules:

- The overlay receives already-evaluated world data (transform at the current frame) and the same `outputOrigin` used by the stage.
- **Delta rule:** `worldToLocal` is a point converter, not a delta converter — it subtracts `outputOrigin + transform.x/y`. A drag therefore inverse-maps the *start* world point and the *current* world point separately and uses the difference of the two local results; a raw world delta is never passed to it.
- A zero `scaleX` or `scaleY` makes the layer degenerate and invisible; the overlay is inert in that case (no markers, no handles).

### 4. Path representation, materialization, and byte expectations

- The overlay edits the **effective path**: `part.path ?? legacyFreeformPointsToPath(normalizeClosedPoints(part.points ?? []), true)`.
- **Legacy normalization.** For a points-only layer the legacy array is normalized before conversion, so a repeated closing vertex (within `1e-6`) becomes a single vertex instead of a degenerate one. If normalization leaves fewer than two points the effective path is `undefined` and the overlay stays hidden. The render branches are **not** changed by this milestone: the modern canvas branch (`ShapePartRenderers.tsx`) and the OGraf branch still draw `part.path ?? legacyFreeformPointsToPath(part.points)` / `buildFreeformPath(part.points)` without normalization, while the non-modern canvas branch already normalizes. A points-only layer that carries a duplicate closing vertex is therefore drawn with a zero-length closing edge by the former while the overlay edits the normalized topology. The two shapes are visually identical; after the first handle edit the layer has a canonical (normalized) path, so its `d` string changes once. Canonical-path layers are unaffected and byte-identical.
- **Clone-on-write invariant:** if `part.path` exists, every write clones that path and changes only the dragged handle. Legacy `points` are never rebuilt into `path` while a canonical path exists — doing so with raw legacy points would discard curves and produce a visible geometry jump and export change.
- **Materialization** happens only when `part.path === undefined`: the first handle edit materializes the canonical path from `legacyFreeformPointsToPath(normalizeClosedPoints(part.points), true)` — that helper always yields `coordinateSpace: 'local'` and `closed: true`, which is exactly what the renderer already draws today. `CharacterPart` has no `closed` field of its own; an existing canonical path keeps its own `closed` and `coordinateSpace` values untouched. `part.points` is preserved unchanged.
- **Data expectations:** after the first write the scene JSON gains a `path` field and the rendered SVG/OGraf output legitimately changes when handles change. Byte-identical output is only claimed for layers whose canonical path is left untouched.
- Topology (point count and ids) is never changed by a handle drag.

### 5. Handle semantics

- A handle drag writes the dragged handle; on a `smooth` vertex it also writes the mirrored counterpart (next bullet). For a `corner` vertex only the dragged handle changes. The vertex position and the vertex `id` are never touched by a handle drag.
- `smooth` vertices keep mirrored handles: dragging one handle mirrors the other around the vertex with the opposite direction and the other handle's existing length.
- **Zero-length drag vector.** If the dragged handle sits on its anchor (vector length `<= 1e-6`) it carries no direction, so the counterpart is left **unchanged** rather than mirrored from a fabricated unit vector; the dragged handle is still written.
- **Extreme-coordinate policy.** Each writer refuses non-finite output instead of storing it: a non-finite pointer result is dropped; a dragged vector whose `Math.hypot` length is not finite leaves the counterpart untouched (its normalized direction would be unusable); a mirror result that is not finite (reachable from individually finite coordinates that overflow the arithmetic, e.g. a counterpart at `±1.7e308`) leaves the counterpart at its previous value. The §8 initializer applies the same rule, as a ladder: a non-finite mirror is replaced by the direction-and-reach handle, a non-finite fallback handle degenerates onto the vertex, an overflowing span falls back to the documented zero reach, and an overflowing chord falls back to the documented `{x: 1, y: 0}` direction. The guarantee carried here is **the writers never compute a non-finite handle**: the drag refuses non-finite output, and the smooth toggle computes handles only for a vertex whose own coordinates are finite (a non-finite vertex gains no handles and keeps the ones it has). It is not claimed that the arithmetic cannot overflow, nor that a value already present in imported data is repaired (the versioned SceneData import sanitizes handles, the legacy `AnimationProject` import does not, and existing handles are passed through untouched).
- `corner` vertices (and vertices whose `kind` is absent, treated as `corner`) move only the dragged handle.
- A handle is never created implicitly by a drag; creation is the explicit smooth action in §7.

### 6. Point topology

- Supported: `corner` (independent handles) and `smooth` (mirrored direction).
- Not supported in this milestone: asymmetric handles as a third kind, handle-length locking, per-handle angle constraints, vertex add/remove on the canvas, multi-vertex transforms, path boolean work. Vertex add/remove/reorder stays in the mask-path editor and the numeric vertex editor.

### 7. Eligibility and selection model

The overlay renders only when **all** of these hold:

- edit mode (`appMode !== 'broadcast'`);
- the select tool is active (`activeTool === 'select'`);
- exactly one part is selected (`selectedPartIds.length === 1`);
- that part is `custom_freeform`;
- it is not a boolean group owner (`booleanOperation` absent) and has no `booleanOperandIds`;
- it is not a boolean operand child (`booleanGroupId` absent) — editing the owner does not change the rendered boolean geometry, so the case is excluded rather than half-supported;
- the layer is edit-visible (`track.editVisible !== false`);
- no other canvas drag is in progress (`isDragging === false` in `StageCanvas`);
- the effective path exists, has at least two points, and `coordinateSpace === 'local'`;
- `trimPathEnabled !== true` (trim length is computed from legacy `points`, so a curve-edited path would render a mismatched trim);
- `scaleX` and `scaleY` are non-zero.

This list lives in one pure predicate, `isFreeformTangentOverlayEligible` (`src/utils/freeformTangentEligibility.ts`). `StageCanvas` forwards its existing state into that helper and renders the overlay on the result; the guard matrix is unit-tested row by row, so the runtime condition and the tests cannot drift apart.

Normal `parentId` children are supported, because `getComputedTransform` already composes the parent chain.

Selection state is overlay-local: `selectedIndex: number | null` and `selectedHandle: 'in' | 'out' | null`.

- Vertex markers are always drawn for an eligible layer; handles (and their lines to the vertex) are drawn only for the selected vertex, with the selected handle rendered in the highlight colour and exposed as `data-selected`.
- Clicking a vertex selects that vertex and clears the handle selection. Clicking a handle selects the handle (and the vertex it belongs to).
- **Empty canvas:** the stage's own pointer-down on empty canvas clears the app layer selection, exactly as before this milestone. That unmounts the overlay, so the overlay needs no separate empty-canvas handler and does **not** deselect the layer by itself. The overlay drops its own selection when the shown part changes (another layer selected) or when the selected vertex index no longer exists after a topology change.
- Double-clicking a vertex toggles `corner ↔ smooth`. Switching to `smooth` materializes missing handles through the deterministic initializer in §8; switching to `corner` keeps existing handle positions and only changes `kind`.
- Multi-vertex selection is out of scope.

### 8. Smooth-handle initializer

`createBezierPath` produces corner vertices without handles, so a neighbour-based initializer is required. It is a small **pure** helper added to the canonical `src/utils/bezierPath.ts` and unit-tested there. Exact algorithm for vertex `index` of `path`:

1. **Neighbours.** `previous` = `points[index - 1]`, or `points[n - 1]` when `index === 0 && path.closed`. `next` = `points[index + 1]`, or `points[0]` when `index === n - 1 && path.closed`. For an open path the endpoints therefore have only one neighbour.
2. **Direction.** With `ε = 1e-6`, and a unit vector whenever the chosen chord is finite and non-overflowing:
   - if both neighbours exist and `|next - previous| > ε` → `unit(next - previous)`;
   - else if `next` exists and `|next - v| > ε` → `unit(next - v)`;
   - else if `previous` exists and `|v - previous| > ε` → `unit(v - previous)`;
   - else → `{ x: 1, y: 0 }`.
   A zero chord never produces a zero-length handle on its own; it only selects the next rule in this list. The direction is normalized before it is scaled, so handle length is never multiplied by an unnormalized chord.
3. **Reach.** `reach = 0.25 × min` of the distances that exist (`|v - previous|` and/or `|v - next|`); the `ε` of step 2 only *selects* the direction rule, it does not clamp the reach. Exactly coincident neighbours therefore give `reach = 0` and coincident zero-length handles (the case `src/tests/bezierTangentHandles.test.ts` pins), while a very short span such as `5e-7` still yields its own small non-zero reach. An overflowing span is not representable, so `reach` falls back to `0`.
4. **Handles.** `handleIn = v − direction × reach`, `handleOut = v + direction × reach` — mirrored, opposite directions, equal length.
5. **Non-finite refusal.** Every handle the initializer *computes* is finite, for a vertex whose own coordinates are finite: a mirror that is not finite is dropped in favour of the step 1–4 handle, and when even that handle overflows the coordinate magnitude it degenerates onto the vertex (zero reach). A vertex that is itself not finite gains no computed handles at all and keeps whatever handles it already had — as does any existing handle, including one that arrived non-finite from an unsanitized legacy import (§5).
6. **Partial-smooth repair.** The **double-click smooth action** is the only writer that creates handles, and it is what repairs a `smooth` vertex that has only one handle: it keeps the existing handle exactly where it is and sets the missing counterpart to the exact mirror of the existing one around the vertex (same length, opposite direction). When both handles already exist, they are left untouched; when neither exists, both come from steps 1–4. A handle drag never creates handles (§5).

### 9. Hit testing, rendering order, and event ownership

- Markers are sized in screen units through the existing pattern: radius `7 * zScale` like today's markers, with a larger grab radius (`~9 * zScale`). `zScale` is the same value passed to `SelectionGizmo`.
- The overlay group renders **after** the artboard/border layers and **above** the transform gizmo so handles win the pointer over the gizmo's and the matte hit area's transparent regions. Pointer handlers stop propagation so a handle drag never starts a translate/rotate/scale/marquee interaction.
- Pointer capture is taken on `pointerdown` and released on `pointerup`/`pointercancel`, so a drag that leaves the marker keeps tracking and ends deterministically.
- The overlay owns no global keyboard shortcut. Its `keydown` listener for `Escape` is registered in an effect that runs **only while a drag is in flight** and is removed as soon as the drag ends (commit or cancel), so an idle overlay never consumes `Escape` and the stage's own `Escape` handling is untouched. `v1` has **no** arrow-key nudging.

### 10. Drag lifecycle and undo

- `pointerdown` on a handle: `startBatchInteraction()`, remember the initial path and the local start point in a ref, enter drag mode.
- `pointermove`: compute the local delta per §3 from the initial path, write the new path through `setCharacterParts` (each live move updates only the selected part's `path`).
- `pointerup`: `endBatchInteraction()`. `pointercancel` behaves the same way — the drag commits its last written value, exactly like `StageCanvas.handlePointerCancel` already does for the transform drags.
- **Escape during an active drag** is the only rollback path, and it is ordered so that history cannot capture a mid-drag snapshot: clear the drag ref, leave drag mode, set the `pendingCancel` **state**, and write the initial path back through `setCharacterParts`; the **post-commit effect** keyed on `pendingCancel` then calls `endBatchInteraction()` once and clears the flag. A state flag (not the path value) drives the effect, so a cancelling `pointerdown` that never moved — where the path never changes — still closes the batch. `useHistory.endBatchInteraction` reads `characterPartsRef.current`, which only syncs on render, so ending the batch inside the same handler could commit the mid-drag value — the effect runs after the rollback has been committed, which makes the batch's start and end snapshots identical and therefore records no entry.
- Because rollback is triggered by a keyboard event and not by a pointer event, no global `mouseup` can end the batch before the rollback commits. `endBatchInteraction` is idempotent, so a later stray end is a no-op.
- Result: one history entry per completed drag; a cancelled drag leaves no entry and restores the previous handles.

### 11. Constraints and documented limits

- Reuse `bezierPath.ts`, `freeform.ts`, `worldToLocal`, `getComputedTransform`, `setCharacterParts`, and the batch-history API. No duplicated transform or path math; only the §8 initializer is added.
- No change to `ShapePartRenderers`, `evaluateFrame`, `StagePartLayers`, the matte authority, `bounds.ts`, or anything under `src/ograf/`.
- **Accepted, pre-existing behaviour that this milestone does not change:** part bounds (marquee selection, matte hit areas) are derived from anchor points, so a curve may extend outside them; trim-path length is computed from legacy `points`. Both already hold today for any imported path with handles. This milestone excludes trim-enabled layers instead of silently editing around the mismatch.
- No new animation channel, state store, event bus, dependency, or CSS framework.

### 12. Tests

Implemented coverage (file → focus):

| File | Tests | Focus |
|---|---|---|
| `src/tests/freeformTangentEligibility.test.ts` | 23 | every guard of §7 row by row, canonical-path priority, negative/non-uniform scale, unrelated-track control |
| `src/tests/freeformTangentPersistence.test.ts` | 6 | legacy normalization (repeated closing vertex, `<2` points), canonical pass-through with identical `d`, no mutation of `part.points`, materialized path through the import sanitizer |
| `src/tests/freeformTangentOverlay.test.tsx` | 21 | §3 coordinate parity under identity/rotation/non-uniform/negative scale with the real `EDITOR_CAMERA_CENTER`; marker/handle visibility; untouched neighbouring vertex; smooth mirroring, the zero-length drag vector (§5), the overflowing counterpart and the overflowing dragged vector (§5); Escape with and without a move; `pointercancel`; selection model incl. layer switch and topology shrink; canonical priority; points-only materialization |
| `src/tests/freeformTangentHistory.test.tsx` | 3 | real `useHistory`: one entry per drag, undo/redo, no entry for Escape, `pointerdown`+Escape with no move, `pointercancel` commit |
| `src/tests/useSerialization.test.ts` | 95 (1 added) | the materialized canonical path survives the real `exportProject()` → `importProject()` round-trip together with the legacy `points` |
| `src/tests/bezierTangentHandles.test.ts` | 12 | §8 initializer (rings, open/closed, coincident neighbours, partial smooth, mirroring length) plus the non-finite refusal cases (overflowing mirror at the selected vertex, overflowing chord combined with an unrepresentable reach) |

Manual/runtime evidence: the permanent Playwright spec `e2e/canvas-tangent-authoring.spec.ts` (markers/handles, live drag with 1:1 pointer tracking, `Ctrl+Z`/`Ctrl+Shift+Z`, `Escape` cancel with no history entry, overlay follows the selection) plus the existing interaction e2e specs (`canvas-interaction-v1`, `interactive-shape-creation-v1`, `editor-interaction-regressions`).

Not covered by an automated test: byte-level OGraf output for a points-only layer that carries a degenerate closing vertex (§4) — the render authorities are unchanged, so their output is out of this milestone's scope. OGraf's canonical-path `d` stays pinned by the existing `src/tests/ografSvg.test.ts`.

### 13. Non-goals

- No full vector editor, pen tool, on-canvas vertex add/remove, multi-vertex transforms, or handle constraints.
- No boolean rewrite, no evaluator change, no runtime/package format change.
- No change to mask-path authoring, no new keyboard shortcut surface, no new shortcut registry.

### 14. Acceptance criteria

1. Selecting an eligible freeform layer in edit mode shows its vertices on the canvas, aligned with the rendered path under translate, rotate, scale, zoom, and pan, using the real `EDITOR_CAMERA_CENTER` origin.
2. Selecting a vertex reveals its tangent handles; dragging one updates the rendered shape live and produces exactly one undo entry, and Escape cancels cleanly.
3. Double-clicking a vertex creates symmetric handles for a curved path; a points-only layer gains a `local` canonical path on first edit without anchor movement, and the result survives export/import.
4. Existing interactions (transform gizmo, marquee, shape tools, matte overlay, freeform drawing, undo/redo, broadcast mode) are unaffected, and ineligible layers show no overlay.
5. Full validation passes with no new warnings and an independent review returns READY or READY WITH WARNINGS.

### KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md

## KCS Grouped Roadmap Execution Plan

Orchestrator close-out for the grouped post-RC roadmap run. Main stays at `d3aa135bdf8d63b9cb01b21f2b2f4c14f7973c72`; nothing from this run is merged.

### Milestone map and status

| Milestone | Roadmap items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | `feat/canvas-tangent-authoring` @ `eb1f1a1` | Implemented + validated; all five review blockers closed and re-reviewed; **not merged** (branch and `main` diverged: no fast-forward) |
| B — Graph + keyboard accessibility | 4 | — | Not started |
| C — First export / onboarding flow | 5 | — | Not started |
| D — State / CI / warning hygiene | 6, 9 | — | Plan only |
| E — OGraf QA / schema hardening study | 7, 8 | — | Plan only |
| F — Architecture exploration only | 10, 11, 12 | — | Plan only |

Completed earlier: item 1 (export diagnostics remediation UX, Task 105), item 2 (track-matte source selection affordance, Task 107).

### Milestone A — remaining work before merge

From `reports/progress_108_canvas_tangent_authoring.md` §7:

1. Normalize legacy points in `resolveFreeformPath` (`normalizeClosedPoints`) to match the contract.
2. Complete the §7 selection model: handle-selection state, empty-canvas "clear overlay selection only", and resetting the overlay selection when the selected layer changes.
3. Restrict the Escape listener to the drag lifetime and close the batch deterministically for a pointerdown-then-Escape with no move.
4. Build the contract's verification matrix: real-origin coordinate parity under rotation/non-uniform/negative scale; behaviour tests for every `StageCanvas` eligibility guard (extract the guard list into a pure predicate so it is testable); canonical-path priority; real `useHistory` undo/redo/cancel entry counts; serialization/import round-trip of a materialized path; OGraf byte-parity for an untouched canonical path; one manual editor smoke.
5. Decide the smooth-handle-at-anchor edge: dragging a handle exactly onto its anchor must not silently collapse the counterpart (`Math.hypot(...) || 1`).

Then: one focused re-review, fast-forward merge, push, CI check, report update, minimal handoff refresh.

### Milestone B — Graph + keyboard accessibility (roadmap item 4)

- Scope: keyboard reachability and screen-reader labelling for graph/path editing surfaces that already exist (`TemporalGraphPanel`, keyframe rows, selected-keyframe sections).
- Constraints: no graph engine rewrite, no broad style churn, reuse existing graph/value/channel authorities.
- Validation: focused keyboard/a11y tests, one Playwright smoke, full suite, independent review.
- Gate: stop if the work grows beyond narrow UI/accessibility.

### Milestone C — First export / onboarding flow (roadmap item 5)

- Scope: a short "first successful OGraf export" path for new users, reusing the Task 105 diagnostics, existing templates, and the existing export UI.
- Constraints: no host/vendor contract invention, no package format change, no `Desktop\KCS` interaction.
- Validation: onboarding/sample fixture tests, `qa:release`, full suite, independent review.

### Milestone D — State / CI / warning hygiene (roadmap items 6, 9)

- Item 6 (current-state consistency check) is a documentation/tooling task: a small script or CI check that fails when live docs contradict the tag/main SHA. No gate beyond normal review.
- Item 9 (dependency and warning maintenance) **requires explicit user approval**: it touches `package.json`/`package-lock.json`. Present the proposed dependency deltas and the warning inventory first, then wait.

### Milestone E — OGraf QA / schema hardening study (roadmap items 7, 8)

- Item 7 (offline schema closure) needs a licensing/size decision before any implementation; deliverable is a study with a hash closure proposal, not a change to fail-closed behaviour.
- Item 8 (downstream folder QA automation) must preserve the evidence-backed folder import model and must not invent host contracts.

### Milestone F — Architecture exploration only (roadmap items 10, 11, 12)

Research/design deliverables only: Lottie import mapping design, evaluator profiling plan, editable KCS import plan. No implementation without a separate explicit approval.

### Approval gates

- Package/lockfile/workflow/dependency changes: explicit user approval required before editing.
- Release/tag/draft-release/npm: explicit user approval required; unchanged by this run.
- Interchange work (Lottie, editable KCS import): design approval before code.
- Any milestone that grows into a broad refactor: stop and report.

### Handoff policy (unchanged)

`chatgpt_handoff/latest/` is a minimal, task-specific bundle: `README.md`, `manifest.txt`, the current report(s), `NEXT_SESSION.md`, `PROJECT_STATE.md`, and optionally the directly relevant contract/plan docs. Never source or test files — flattened copies named `src__*test*` matched Vitest's include glob and broke CI in runs `35094144225`/`35095655446`. Never copy the bundle into `C:\Users\ertugrul.ak\Desktop\KCS`.

### Recommended next prompt

"KCS MILESTONE A COMPLETION — close the five review items on `feat/canvas-tangent-authoring`, build the contract's verification matrix, run one focused re-review, fast-forward merge if READY, then refresh the minimal handoff." Milestones B and C follow only after A is merged or explicitly deferred.

---

## 8. File Inventory

Every file present in `chatgpt_handoff/latest/` at generation time:

- `KCS_CANVAS_TANGENT_AUTHORING_CONTRACT.md` — 21519 bytes
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — 5411 bytes
- `NEXT_SESSION.md` — 4776 bytes
- `OMP_FINAL_RESPONSE.md` — 8178 bytes
- `PROJECT_STATE.md` — 5804 bytes
- `README.md` — 2278 bytes
- `manifest.txt` — 2924 bytes
- `progress_108_canvas_tangent_authoring.md` — 29210 bytes

- Source/test copies present: NO
- Test-glob matching files present: NO
- Desktop\KCS copied: NO
