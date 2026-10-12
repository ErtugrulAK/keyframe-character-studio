# KCS — Manual QA Round 1 remediation (PART 1 A–F + PART 2 G–J)

**Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.** No other file needs uploading.

Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
Worktree used for this work (isolated): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
Branch: `fix/manual-qa-round1-remediation` — base `origin/main` at `8e2df61`
Pull request: **#9** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9` (base `main`, **OPEN**, MERGEABLE, mergeStateStatus CLEAN)
Code head validated: `18b4acac0538c7a3ef9732e190ccb7e2f7b9b566` (`18b4aca`)
CI: **CI Pipeline** run `38246227512` (event `pull_request`) — **success** (2026-10-12T11:59:51Z → 12:01:17Z) on head `18b4aca`

**No merge. No release. No tag. Nothing published to npm.** The user's retest on the remediation preview is the merge gate.

## 1. Why this round happened

The user ran MANUAL QA ROUND 1 against the live editor on 5173. Ten findings were recorded (A–J). PART 1 (A–F) was already committed on this branch; PART 2 (G–J) is this task. Every fix keeps the current data model and the existing authorities — no new command bus, no second state authority, no new animation/evaluation engine.

## 2. Findings, reproduction, root cause, fix, tests

### PART 1 (already committed — context, not re-done in this task)

| # | Finding | Root cause | Fix (commit) |
|---|---|---|---|
| A | Camera/layout transition jitter: toggling a sidebar visibly slid the authored world | The camera was derived from the stage box, so any layout animation re-projected the world every frame | The camera is its own state — view centre in client pixels + the px-per-unit scale it was anchored with (`StageCameraView`, `getStageCameraTransform`); the rendered transform divides the layout fit back out (`69bbad5`) |
| B | Dragging inside a group dragged a single child | The pointer target (a child) owned the gesture | A gesture starting inside the SELECTED group box moves the container as one unit; a click that never moved still selects the layer under the pointer; the post-drag click cannot steal the selection back (`1e21fa5`) |
| C | Ghost centre square inside a geometryless group frame | The gizmo always drew a pivot marker | `suppressPivotMarker` for a container: frame + handles only (`1e21fa5`) |
| D | Rotation-drag border jitter on a group | The transform cache was cleared in an effect, so a render could mix the *previous* revision's container transform with the current children | The cache is keyed to the document identity (`characterParts`/`tracks`/`activeTemplateId`) and validated on every read (`useMath.ts`) (`1e21fa5`) |
| E | Edge resize grew on both sides | Edge drags were solved from the box centre | `resolveEdgeResize`: the OPPOSITE edge is the fixed point, only the dragged axis' scale changes, anchored on the box the gizmo actually drew (the group's aggregate box) (`1e21fa5`) |
| F | The timeline `+` moved a parented/grouped layer, drift accumulated per click | Keyframe capture read the evaluated WORLD transform, but a channel value is the layer's *container-local* pose | `resolveAuthoredLocalTransform` converts with the same inverse the Inspector/grouping use (`9f916f6`) |

### PART 2 (this task)

**G — orphan / unclear `Transform` row (timeline, MAJOR UX).**
*Repro:* expand a layer in the timeline; a lone `Transform` row appears with no readable owner (nothing says which layer or group it belongs to).
*Root cause:* the property block carried no layer identity. The row was inside the layer's group in the DOM, but in the UI it carried no owner: the header said only "Transform", the block had no indentation/boundary against the layer row, and there was no machine-readable ownership for a test to pin.
*Fix:* every property row now declares the layer it belongs to — the block is `data-owner-part-id`/`data-owner-name` with `role="group"` and an accessible name (`Properties of <layer>`); the Transform and each sub-group header carry `data-owner-part-id`, an owner-naming `aria-label`/`title` and `role="button"` + `aria-expanded` with Enter/Space activation; the Transform header shows the owning layer's name; the whole block hangs off its layer row on a nesting rail (`.ue-channel-group`); the lane side carries the same owner id (`data-owner-part-id` on `.ue-lane-group`). A group child's properties stay owned by the child.
*Files:* `src/components/Timeline/TrackOutlinerRow.tsx`, `src/components/Timeline/TrackLane.tsx`, `src/components/Timeline/SequencerTimeline.css`, `src/tests/timelineLaneOwnership.test.tsx` (3 tests: block+rows bound to the right layer; a group child's rows owned by the child, never the container; owner names survive collapse + Enter toggle).
*Commit:* `9774729 fix: bind timeline property rows to their owning layer`.

**H — sequence tab right-click opened the browser menu (MINOR).**
*Repro:* right-click a sequence tab in the timeline.
*Root cause:* no `contextmenu` handling on the tab, so Chromium's native menu opened.
*Fix:* the tab calls `preventDefault()` on `contextmenu` and does nothing else — no custom sequence menu was invented, and the prevention is scoped to the tab element, so click-to-activate, double-click rename and the close control are untouched. An unrelated right-click on a sibling element still reports the native menu.
*Files:* `src/components/Timeline/SequencerTimeline.tsx`, `src/tests/sequenceTabContextMenu.test.tsx`.
*Commit:* `05f3130 fix: suppress native sequence context menu`.

**I — selection border too heavy (UX).**
*Repro:* select a layer on light artwork: the selection frame reads as a thick black halo.
*Root cause:* the frame was a single wide dark backing (3.5 × z-scale, `var(--bg-darkest)`) under the accent dash — max contrast, but heavy.
*Fix:* a paired light/dark outline of reduced thickness — an outer light keyline from the new `--kcs-selection-keyline` token (3 × z-scale), a thin dark core (1 × z-scale) and the accent dash (1.5 × z-scale) on top. Total band 3 × z-scale against 3.5 × z-scale all black, so it reads over light AND dark artwork without a black halo, with no pixel sampling and no blend-mode risk. Both decorative halves stay `pointer-events: none`.
*Files:* `src/components/Canvas/overlays/TransformGizmo.tsx`, `src/index.css` (token), `src/tests/selectionGizmo.test.tsx` (paired-outline contract), `e2e/authoring-ux-slice1.spec.ts` (measured stroke luminance: one solid stroke > 0.7, one < 0.2, widest half < 7), `e2e/group-interaction.spec.ts` (frame selector now picks the accent geometry).
*Commit:* `aba0b05 fix: lighten the canvas selection frame to a paired outline`.

**J — top toolbar too weak / duplicated the floating canvas toolbar (UX/feature).**
*Repro:* two toolbars competed: the docked strip repeated a few actions and the floating coordinate-plane pill over the stage repeated tool/grid/zoom/reset.
*Root cause:* the floating `CanvasViewportToolbar` still owned the tool pair, grid, zoom and reset, so the top strip could never be the authoring toolbar.
*Fix:* the floating toolbar is **removed** (component, its CSS in `StageCanvas.css`, its theme override, its two unit specs) and the docked strip is the one authoring toolbar, exposing only authorities that already exist:
1. Selection/navigation — Select/Pan with one roving Tab stop and Arrow/Home/End navigation;
2. Creation — rectangle, circle, text and freeform pen through `armShapeCreation`/`addCustomPart`/`setActiveTool('freeform_draw')`;
3. Paint — Fill/Stroke on the shared paint write path (only for a selected non-group layer);
4. Boolean — Union/Subtract/Intersect/Exclude **always visible**, enabled only for a compatible selection (two Boolean-eligible layers, or an existing group), disabled otherwise, through the shared Boolean authority; Dissolve alongside;
5. Grouping — Group/Ungroup always visible, state-aware disabled, through the shared layer-group authority;
6. Arrange — Bring forward / Send backward on the shared z-index path (`handleZIndexChange`);
7. View — grid toggle, zoom in/out and reset view on the shared `canvas-viewport-command` channel (the same channel the `+`/`-` shortcuts use).
State-dependent actions never disappear, so the strip cannot reflow around the selection and an unavailable action stays discoverable; a disabled action cannot fire (guarded + tested). The removed pill's zoom readout is replaced by `data-camera-zoom` on the stage container — a read of the existing camera state, not a new authority. No shortcut, accessible label or tool-state authority was lost, and no command was implemented twice.
*Spec migration (coverage preserved, nothing deleted to make it pass):* `authoring-toolbar` (single-toolbar assertion + always-visible/enabled Boolean, arrange, keyboard, drift), `authoring-ux-interactions` (Boolean operand rule and the empty-document surface now assert visible-but-disabled), `camera-invariance`, `camera-transition-stability` (probe reads `data-camera-zoom`), `canvas-interaction-v1`, `corner-anchor-resize`, `broadcast-viewport`, `real-user-verification` (zoom scale asserted against the shared channel's ×1.1 steps), `v51-manual-qa` (reset keeps zoom, asserted through `data-camera-zoom`), `workflow`.
*Files:* `src/components/Toolbar/AuthoringToolbar.tsx` + `.css`, `src/components/Canvas/StageCanvas.tsx` (render/import/`setPanOffset` removed, `data-camera-zoom` added), `src/components/Canvas/StageCanvas.css`, `src/kcsEditorTheme.css`, deleted `src/components/Canvas/overlays/CanvasViewportToolbar.tsx` + `src/tests/CanvasViewportToolbar.test.tsx` + `src/tests/viewportToolbar.test.tsx`, `src/tests/authoringToolbar.test.tsx`, the ten migrated e2e specs.
*Commit:* `18b4aca feat: promote the top authoring toolbar`.

## 3. Validation on head `18b4aca` (isolated ports only; 5173/5000 never touched during it)

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | PASS (no output) |
| `npm run lint` | PASS (oxlint clean) |
| `npm test` | PASS — **147 files / 2,262 tests** |
| `npm run build` | PASS (`✓ built in 381ms`; existing large-chunk notice only) |
| `npm run validate:ograf` | PASS (`fixtures/ograf/minimal.ograf.json`: valid OGraf v1 manifest) |
| `PORT=5009 npm run qa:release` | PASS — 2 passed, "Release gate passed for candidate SHA: 18b4acac0538c7a3ef9732e190ccb7e2f7b9b566" |
| `PORT=5009 npm run qa:v6` | PASS — 3 passed |
| `npm run check` | PASS (lint + tsc + test + build, exit 0) |
| `node scripts/check-state-consistency.mjs` | PASS — 38 checks (after this documents refresh) |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |
| Focused Playwright (migrated specs) | PASS — authoring-toolbar 8, camera-invariance 17, camera-transition-stability + group-interaction + authoring-ux-slice1 17, canvas-interaction-v1/corner-anchor-resize/broadcast-viewport/workflow/editor-context-menu/left-toolbar-collapse 39+, authoring-ux-interactions 14, v51-manual-qa/real-user-verification/workflow/broadcast-viewport 15 |
| **FULL Chromium** `CI=1 PORT=5009 npx playwright test --retries=0` | **344 passed, 0 failed, 0 flaky** |

No assertion was weakened, no spec was skipped to make it pass, no retry was added, and no arbitrary sleep or tolerance hack was introduced (the one tolerance-bearing assertion that existed before — the camera test's centre movement — was replaced with deterministic pan/reset assertions).

## 4. Self-review of the whole diff from `8e2df61`

- **Camera transition (A)** — the camera is its own state and the rendered transform is a pure projection of it (`getStageCameraTransform`); there is no CSS transition on it, and the new `e2e/camera-transition-stability.spec.ts` measures `worstDelta=0.000px` across the transition frames, not only the final frame. No local/world mismatch in the projection: `translate` is a client-pixel delta and `scale` divides the layout fit back out.
- **Resize (E)** — corner and edge solves share one model (`cornerWorld(local) = origin + R(rotation)·(local ⊙ scale)`); both take the box the gizmo actually DREW (`overrideBounds` = the group aggregate box, `dragStart.localBounds`), so a geometryless container is never solved against fallback geometry; the fixed point is the opposite corner/edge, and the origin is rebuilt from it (no subtraction of large numbers, no jump at pointer-down).
- **Aggregate bounds (B/C)** — `getGroupAggregateBounds` recurses with a depth guard, uses the evaluated transforms of the frame (`worldOf = getComputedTransform`) and converts each child with `worldToContainerLocal`; nested groups measure as the art inside them. No ghost fallback geometry is left: a fallback box exists only for a container with no children at all.
- **Keyframe capture (F)** — capture converts the WORLD pose into the container-local space the evaluator expects (`resolveAuthoredLocalTransform`), used by both the timeline `+` and the Inspector's add-keyframe path; the sequence identity (`templateId`, defaulting to `Sequence`) is unchanged and still part of the key.
- **Toolbar (J)** — no duplicated tool state (the strip reads the animator context and the command channel; `StageCanvas` remains the only camera consumer), a disabled action cannot fire (`disabled` attribute plus a guard), and no command is implemented twice.
- **Context menu (H)** — the prevention is scoped to the tab element; an unrelated right-click still reports the native menu (asserted), and rename/close still work.
- **Selection contrast (I)** — a paired light/dark outline, asserted by measured stroke luminance in the browser, so the frame reads over light AND dark content; no per-frame pixel sampling was added.
- **Group model** — untouched: a real container with `CharacterPart.isGroup: true`, geometryless, `parentId`, children keeping their own content, group transform composing to children; Bind/Bond stays position-only. OGraf export/runtime parity did not regress (`npm run validate:ograf` plus `ograf-editor-export`, `ograf-phase2d-interoperability` and the group-export tests in the full suite).
- No broad refactor was introduced; the only removals are code made obsolete by the J cutover (the floating toolbar, its CSS and its specs) and the dead `setPanOffset`/`setShowGrid` wiring it left behind.

## 5. Live surfaces after this task

| Surface | State |
|---|---|
| Repository | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical stable checkout, `main`) — untouched by this task |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1` (branch `fix/manual-qa-round1-remediation`) |
| UI 5173 before | pid **34860** — `node ...\keyframe-character-studio\node_modules\...\vite\bin\vite.js --host --port 5173` (canonical repo, HTTP 200) |
| UI 5173 after | pid **33512** (vite listener; `npx vite` service wrapper pid 40896) — `npx vite --host --port 5173` started from this worktree; HTTP 200; the served modules contain this branch's code (`Add rectangle` in `AuthoringToolbar.tsx`, `data-camera-zoom` in `StageCanvas.tsx`); branch `fix/manual-qa-round1-remediation`, HEAD = the PR head |
| API 5000 | pid **8872** (`node server/index.js`) — **never stopped or restarted**; `/api/health` 200 before and after |
| PR | **#9 OPEN, not merged** |
| Release | No tag created/moved, no GitHub release published, npm never published |

## 6. User retest list (the merge gate)

On `http://localhost:5173` (the remediation preview, branch `fix/manual-qa-round1-remediation`):

1. **A** — toggle the left toolbar and the right inspector while watching the canvas: the authored world must not slide or rescale.
2. **B** — select a group, drag from inside its box: the whole group moves; a plain click inside still selects the child under the pointer.
3. **C** — select a group: the frame is drawn with no centre/pivot square.
4. **D** — rotate a group by its rotation handle: the frame must not jitter.
5. **E** — drag an edge handle of a group: the opposite edge stays fixed, the frame does not grow on both sides.
6. **F** — press the timeline `+` twice on a grouped/parented layer: the layer must not move.
7. **G** — expand a layer in the timeline: the `Transform` row names its owning layer and is visibly nested under it; the same for a group's children.
8. **H** — right-click a sequence tab: no browser menu.
9. **I** — select a layer over light and over dark artwork: the frame is readable and no longer a thick black halo.
10. **J** — the floating pill over the stage is gone; the top strip is the authoring toolbar (Select/Pan, creation, Fill/Stroke, Boolean, Group/Ungroup, arrange, grid/zoom/reset). Boolean and Group/Ungroup stay visible and grey out when the selection cannot use them; the `V`/`H`/`+`/`-` shortcuts still work.

## 7. Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in the latest bundle needs to be uploaded.
