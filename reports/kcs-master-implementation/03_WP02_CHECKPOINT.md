# WP-02 checkpoint — Existing mask editing on the canvas

- Worktree / branch / base = current HEAD: as in `00_SESSION_PLAN_AND_BASELINE.md` (no commits).
- Product decisions applied: D-02 (path vertices + absolute handles, no mask transform field),
  D-03 (frozen frame/sequence; playback, IN/OUT preset motion and live stunts refuse editing
  visibly), D-10 (Space playback unchanged; Escape one level per press).

## Plan (as executed)

Pure helper (`utils/maskPathEditing.ts`) → domain hook (`hooks/useMaskEditing.ts`) → thin context
wiring (`AnimatorContext`, Escape chain in `useKeyboardShortcuts`) → minimal UI (Inspector
"Edit on Canvas", stage overlay + status banner).

## Changed / added files

| File | Reason |
|---|---|
| `src/utils/layerMasks.ts` | `maskPathNormalizationSize` extracted from `buildLayerMaskPathD` (identical expression) so the editor and the renderer share ONE normalization authority. |
| `src/utils/bezierPath.ts` | `moveVertexHandle` (the smooth-vertex mirror rule) moved here unchanged from `FreeformTangentOverlay`, shared by both tangent editors. |
| `src/components/Canvas/overlays/FreeformTangentOverlay.tsx` | Uses the shared `moveVertexHandle`; behaviour unchanged (its existing tests pass). |
| `src/utils/maskPathEditing.ts` (new) | Path↔world frame from the renderer's normalization + owner world affine (`worldAffineOf`, handles shear/negative scale); singular-map refusal (smallest-singular-value bound); absolute-delta translate / vertex / tangent edits; `resolveMaskEditBlock` (locked, playback, procedural pose, collapsed map). |
| `src/hooks/useMaskEditing.ts` (new) | Transient target (owner + mask), validity by owner/mask existence + selection + Edit mode, Escape chain, gesture snapshot and the narrow cancellation seam (`cancelMaskGesture`: restore owner masks + path channels inside the open batch, close the batch after the restore renders → no history entry, redo kept). |
| `src/context/AnimatorContext.tsx` | Thin wiring of the hook; Escape chain slot; `isMaskEditing`. |
| `src/hooks/useKeyboardShortcuts.ts`, `src/utils/shortcuts.ts` | Escape: cancel gesture → leave mode (one level). Delete / Select All never fall through to the owner layer while a mask is edited. Reference text updated. |
| `src/components/Canvas/overlays/MaskPathOverlay.tsx` (new) | Outline = `buildLayerMaskPathD` (the renderer's contour); path area + centre move handle, vertices, tangent handles; 3 px drag threshold; pointer capture; one batch per drag; cancel on Escape / pointercancel / frame or sequence change / unmount. |
| `src/components/Canvas/StageCanvas.tsx` | Gizmo + freeform overlay hidden, layer drag / marquee / stage click-select suppressed while editing; overlay + status banner (owner › mask, reason when refused, Exit). |
| `src/components/Canvas/StageCanvas.css` | Banner styles (wraps on narrow stages). |
| `src/components/Inspector/...` (`DetailsPanel`, `StyleTab`, `StyleMatteSection`) | "Edit on Canvas" / "Exit Mask Editing" (aria-pressed); Inspector's active mask follows the canvas target. |
| Tests | `src/tests/wp02MaskPathEditing.test.ts`, `src/tests/wp02MaskCanvasEditing.test.tsx`, `e2e/wp02-mask-canvas-editing.spec.ts` |

## Evidence

| Command (cwd) | Exit | Result |
|---|---|---|
| `npx vitest run src/tests/wp02MaskPathEditing.test.ts src/tests/freeformTangentOverlay.test.tsx src/tests/freeformTangentHistory.test.tsx src/tests/layerMasks.test.ts src/tests/bezierPath.test.ts` (worktree) | 0 | 5 files, 44 tests |
| `npx vitest run src/tests/wp02MaskCanvasEditing.test.tsx src/tests/wp02MaskPathEditing.test.ts` (after Delete/Select-All/playback guards) | 0 | 2 files, 16 tests |
| `npx vitest run src/tests/shortcuts.test.ts src/tests/shortcutReferenceDialog.test.tsx src/tests/useKeyboardShortcuts.test.ts` | 0 | 3 files, 32 tests |
| `npx playwright test -c playwright.isolated.config.ts --project=e2e wp02` (qa dir) | 0 | 3 passed (rotated+scaled image; animated path at frame 10 + IN preset refusal; sheared parent at zoom 1 and zoomed) |
| `npx playwright test -c playwright.isolated.config.ts --project=evidence wp02` | 0 | 2 passed (1440×900, 1024×720) |
| `npx vitest run` (full, after renaming evidence files so Vitest never collects them) | 0 | 202 files, 3011 tests |
| `npx tsc -b`, `npm run lint`, `npm run build` | 0 | clean (1 pre-existing lint warning in untouched `k5MatteVisibility.test.tsx`) |
| Canvas/matte E2E subset (11 specs, log `logs/wp02_e2e_subset.log`) | 1 | 165 passed, 1 failed: `track-matte.spec.ts` V-T11 timed out waiting for the `Pause` button. Re-run in isolation 3/3 PASS. The test clicks Play, waits a fixed 1800 ms, then needs `Pause` on a 2 s sequence: under load playback can end first. Not concealed; recorded as load-sensitive. |

Oracles used in E2E (not screenshots): every vertex marker moves by exactly the CSS drag delta
(forward(inverse(p)) = p through rotation, non-uniform scale, sheared parent, zoomed camera);
the overlay outline `d` equals the renderer's clip `<mask>` path `d`; saved JSON proves the image
pose/tracks unchanged, path changed, key inserted at the playhead, neighbours untouched; Undo
restores; Escape mid-drag leaves the path identical and Redo enabled.

Screenshots: `evidence/wp02/{1440,1024}_01_layer_mode … 06_exit_layer_mode.png`.

## Known limits / open points

- Keyboard-only point editing (arrow nudge, roving focus on vertices) is not implemented; the
  Inspector's numeric path editor remains the keyboard alternative. Recorded for WP-06.
- Escape while focus is inside an Inspector text field is owned by that field (existing rule).
- Mask snapping is off (as specified); nothing claims it.
- Lock: `LayerMask.locked` now refuses canvas editing (button disabled, hook refuses with a reason);
  `track.locked` remains unenforced as before (see WP-01 decision).

IMPLEMENTED: YES
TESTED: PASS (focused unit/integration, real-pointer E2E, evidence; full Vitest/tsc/lint/build) — PARTIAL for the broad E2E subset (1 load-sensitive pre-existing timing test failed once, 3/3 in isolation)
USER ACCEPTED: PENDING
MERGED: NO
