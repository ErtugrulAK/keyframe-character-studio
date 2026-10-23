# C2 — Interaction reliability continuation: baseline and slices A–D

Session: 2026-10-22. New report directory; reports 00–08 and earlier evidence are untouched.

## Baseline (verified at start)

- Worktree `C:\Users\ertugrul.ak\Desktop\kcs-master-implementation`, branch
  `feature/motion/kcs-master-implementation`, HEAD `39f6414` (no commits), 34 tracked files modified
  (WP-01–WP-07) plus untracked WP files.
- New since the last handoff, not created by this session: `reports/kcs-master-implementation.zip`
  (10:15). Treated as user data: not read, moved or modified.
- Main and Sprint 1: status + tracked diff + untracked SHA-256 identical to the original baseline.

## A/B — The active tool owns the stage pointer; an open drawing owns Undo/Redo

| User problem | Reproduction | Verified root cause |
|---|---|---|
| Rectangle over a full-canvas image selects the image, nothing is drawn | `e2e/c2-tool-ownership-draft-undo.spec.ts` on the base copy: 0 shapes created | `PartRenderer` swallows every primary `mousedown` (`stopPropagation`) and selects on `click`; `shape_create` also only started on an empty-canvas target. Pen/Hand/crop had the same blind spot over layers and gizmos. |
| After drawing, the previously selected image stays selected | same spec (selection assertion) | `addCustomPart` set the primary `selectedPartId` but not the canonical `selectedPartIds`, so Timeline and canvas kept the old layer selected beside the new one. |
| 17 points, a wrong 17th, Ctrl+Z undoes the previous finished shape | same spec (draft test) | The Pen draft had no history; Undo always went to scene history. The first click also stored the first point twice. |
| Switching tools silently loses a drawing; finishing needs Enter/double-click | same spec | `useFreeformDraw` cancelled silently on tool change; no visible Finish/Cancel; no close-on-first-point. |

Fixes (canonical authorities reused):
- `StageCanvas`: capture-phase ownership (`onMouseDownCapture/onClickCapture/onDoubleClickCapture`)
  for armed creation, Pen, Hand and crop; stage chrome (`data-stage-chrome`) is excluded; mask
  edit/draw keep their own overlays. One press → one scene operation.
- `useToolbar.addCustomPart`: the new part becomes THE selection (both stores).
- `AuthoringToolbar`: Rectangle/Circle show the real armed state (`aria-pressed`, active) and a
  second press disarms.
- `AnimatorContext`: `registerDraftHistory` — a narrow interaction-ownership seam on the EXISTING
  Undo/Redo command (keyboard, buttons, `canUndo/canRedo`). While a draft is registered the
  commands act on the draft only, even when it is empty; scene history stays the only authority
  for committed edits. Text fields keep their Undo (existing editable-element guard).
- `useFreeformDraw`: transient draft history (one step per click; a freehand stroke is one step),
  close on the first point (10 CSS px, measured on screen through the current camera), duplicate
  click guard (3 px), visible Finish/Cancel banner, Escape one level.
- `MaskDrawOverlay` (Mask Pen): same draft history and ownership; the close test now uses the
  first point's CURRENT screen position (before: client coordinates stored at click time, stale
  after pan/zoom/resize); hover close target (12 px ring); visible "Finish mask (n points)".

Interaction table (implemented):

| Situation | Freeform Pen (shape layer) | Mask Pen (owner mask) |
|---|---|---|
| Click | adds a corner (duplicate within 3 px ignored) | adds a point (same guard) |
| Drag | freehand stroke = one draft step | — |
| Click on first point (≥ 3 points) | closes and creates the shape | closes and creates the mask |
| Double-click / Enter / Finish button | finish | finish |
| Ctrl+Z / Ctrl+Shift+Z / Undo button | draft undo/redo only | draft undo/redo only (Backspace = undo point) |
| Escape | draft → discarded, Pen stays; no draft → Select | ends the mask drawing session (no write) |
| Switch tool | ≥ 3 points: shape created, toast says so; fewer: discarded with a toast | session ends, nothing written |
| After commit | Select tool | the new mask is edited on the canvas |
| Open vs closed | freeform shapes are closed fills (existing model; no open-path type invented) | masks are closed |

## C — Mask path editing ergonomics

- `BezierPathEditor`: full Inspector width with the owner's proportions, Expand/Collapse, a margin
  so out-of-box geometry is visible (no 0..1 clamp of unrelated values), "Point n of m" status,
  a Corner/Smooth radio group showing the selected point's real type (Corner→Smooth uses the
  canvas rule `initializeSmoothHandles`; Smooth→Corner keeps the handles), canvas and Inspector
  share the selected point.
- Found while testing: Add/Delete/Move/Open-Close were enabled on an ANIMATED path in the Inspector,
  bypassing the WP-03 topology guard. They are now disabled with the reason; moving points stays.
- Closed paths keep ≥ 3 points (same rule as the canvas `deleteMaskVertex`); one old unit test
  that deleted from a 3-point closed path now uses a 4-point fixture (same intent: unique ids).

## D — "Canvas jumps on show/hide"

- Probe (`qa/evidence/c2-toggle-jump-probe.evidence.ts`): 7 controls × 10 toggles at 1440/1280/1024,
  ~360 rendered frames each, user zoom applied: the content and a second layer never moved
  (0 px). Same in the in-app (headed) browser with real clicks: 1 057 + 350 frames, 0 px.
- The observation was still real: the dotted stage backdrop was anchored to the container corner.
  When a panel opened/closed, the container edge moved while the world stayed, so the pattern slid
  under the content for the whole dock transition (phase vs. artboard 20 px → 12 px on a left-drawer
  toggle). Fix: the backdrop is anchored to the camera centre (`StageCanvas` inline
  `background-position`). After the fix every frame has phase 0 (≡ 24) on all dock/timeline toggles.

## Evidence (this slice)

| Command (cwd: worktree) | Result |
|---|---|
| base copy (git archive 39f6414, port 5197): `npx playwright test -c playwright.base.config.ts c2-stage-backdrop c2-tool-ownership` | 8/8 FAIL (the bugs reproduce) |
| `npx playwright test -c reports/kcs-master-implementation/qa/playwright.isolated.config.ts --project=e2e c2-tool-ownership` | 7/7 PASS |
| `... --project=e2e c2-mask-pen wp03` | 7/7 PASS (close at zoomed out / 100 % / zoomed in, after a layout move) |
| `... --project=e2e c2-mask-point-type wp02` | 5/5 PASS |
| `... --project=e2e c2-stage-backdrop` | 1/1 PASS (18 toggles, every frame) |
| `... --project=e2e c2-tool-ownership authoring-toolbar interactive-shape-creation-v1 named-sequence-v2` | 22 PASS after one test-flow update (the tool now stays armed and a second press disarms) |
| `npx vitest run src/tests/c2DraftHistoryOwnership.test.tsx src/tests/BezierPathEditor.test.tsx src/tests/authoringToolbar.test.tsx` | PASS (2 + 7 + 22) |
| `npx tsc -b`, `npm run lint` | clean (pre-existing warning in untouched `k5MatteVisibility.test.tsx`) |

QA process note: an orphaned Vite child of a background command kept port 5196 after `TaskStop`;
its process chain (Git Bash → npx → cmd → node, started 11:08:21 by this session) was verified and
only that tree was terminated. The QA HTML reporter was removed (it wrote trace-viewer JS into the
worktree, which the repo lint then scanned).
