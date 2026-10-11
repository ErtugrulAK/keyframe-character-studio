# Progress 160 — corner resize anchors the opposite corner

Task: fix the transform gizmo's corner-handle resize so the dragged corner follows the
pointer while the diagonally **opposite** corner stays fixed in world space.
Branch: `fix/authoring-ux-corner-anchor`, stacked on `fix/authoring-ux-camera-invariance`
(application head `aef21de`, branch base `55a4ab2`).
Scope: editor-only transform authoring. No runtime, export, OGraf, camera-model, dependency,
package, workflow, tag or release change. Nothing merged.

## 1. Reproduction before the patch

`e2e/corner-anchor-resize.spec.ts` seeds a layer through the real document format, locates the
four corner hit targets of `[data-testid="transform-gizmo"]` by matching the **authored** world
corners (projected through the SVG screen CTM) to the rendered handles, drags one handle with a
real Chromium pointer, and re-measures. It records, for every case, the dragged and opposite
corner in world units, the authored centre, `scaleX`/`scaleY` and the rotation.

Recorded pre-fix behaviour (fixed ±36/±24 px drags at zoom 1, 0.6687 px per world unit; the
implementation scales about the object centre and never writes a position):

| case | opposite-corner drift | dragged corner vs pointer |
|---|---|---|
| unrotated TL keeps BR | −0.80, −0.40 px | missed by 36.2 px |
| unrotated TR keeps BL | +0.40, −0.20 px | missed by 36.2 px |
| unrotated BL keeps TR | −1.60, +0.80 px | missed by 35.0 px |
| unrotated BR keeps TL | +0.80, +0.40 px | missed by 36.2 px |
| rotated 30° TL keeps BR | +5.93, +8.98 px | missed by 39.9 px |
| rotated 30° BR keeps TL | −6.43, −9.73 px | missed by 40.4 px |
| rotated −45° TR keeps BL | −6.24, +18.73 px | missed by 36.2 px |
| rotated 120° BL keeps TR | +0.27, −4.48 px | missed by 34.4 px |
| non-uniform (rot 20°, 2.4 / 0.6) BR keeps TL | +11.52, +5.90 px | missed by 32.9 px |
| translated parent, child TL keeps BR | −6.42, −3.21 px | missed by 33.1 px |
| rotated parent, child BR keeps TL | −8.76, −16.17 px | missed by 45.0 px |
| non-uniformly scaled parent, child TR keeps BL | +28.61, +17.72 px | missed by 31.2 px |
| keyframed layer at frame 30, BR keeps TL | 0.00, 0.00 px | missed by 36.0 px (no write at all) |
| drag then one undo | −5.22, −2.61 px | missed by 31.7 px |
| Escape mid-drag | +3.21, +1.60 px | missed by 34.5 px |
| after explicit pan / after layout change | −4.41/−2.21 px, −4.01/+2.01 px | missed by 32.9 px, 34.9 px |

18 of the 19 cases failed with `--retries=0`; the cursor case failed only because the ticket's
assumed `nesw` mapping for TR/BL is the real mapping and the assertion had been written the
other way round.

## 2. Root cause (file:line evidence, application head `aef21de`)

1. **The corner drag scaled around the object centre and never wrote a position.**
   `src/components/Canvas/StageCanvas.tsx:518-547` (aspect-ratio lock path) and `:547-560`
   (free path) both call `updateCurrentTransform({ scaleX, scaleY })` only. `useInspector`'s
   `updateCurrentTransform` (`src/hooks/useInspector.ts:272-275`) writes exactly the keys it is
   given, so the origin — the corner rotation happens about — stayed where it was and *both*
   corners moved by half the size change. This is the measured drift: 0.8 px on an unrotated
   rectangle whose drag changed the width by 2.4 px, and 11-28 px wherever the size change was
   large.
2. **The "anchor" it did compute was not the opposite corner.**
   `StageCanvas.tsx:547-556` derived `anchorX = centerX − grabSignX · initHalfW` from the
   pointer's own distance-to-centre axis-aligned in **world** space, ignoring the layer
   rotation, so rotated layers anchored at a point that is not a corner at all (−45° TR:
   +18.73 px of drift where an unrotated case shows −0.4 px).
3. **The "initial half extents" were the pointer's distance, not the geometry.**
   `StageCanvas.tsx:377-383` sets `dragInitialLocalX/Y` from the pointer offset, so a handle
   grabbed anywhere but exactly on the corner — and every non-uniformly scaled layer — solved
   against the wrong span (2.4/0.6 scale: 11.52 px of drift on the first move).
4. **The aspect-ratio lock (default ON, `src/context/AnimatorContext.tsx:197`) took a radial
   branch** (`StageCanvas.tsx:521-533`) that ignored the corner identity entirely: it scaled by
   `|pointer − centre| / |grab offset|`, so the dragged corner moved along the centre ray and
   never reached the pointer (the keyframed case moved 0.00 px because the radial factor stayed
   1 while the pointer moved off the ray).
5. **Product contract (preserved, not invented):** corner handles are **aspect-ratio locked by
   default** — `isScaleLocked` starts `true` and the Inspector's Scale card toggles
   "Aspect Ratio Locked (Uniform Scale)" / "Aspect Ratio Unlocked (Free Scale)"
   (`src/components/Inspector/sections/transform/TransformScaleCard.tsx:18-47`). Unlocked, the
   corner writes independent `scaleX`/`scaleY`. `Shift` was used **only** to pick 2 vs 3
   decimals of rounding — it is not an aspect constraint, and no new `Shift` behaviour was
   introduced. Corner cursors: TL/BR `nwse-resize`, TR/BL `nesw-resize`
   (`src/components/Canvas/overlays/TransformGizmo.tsx:91-94`), unchanged.

## 3. Fix — one geometry authority

`src/utils/cornerResize.ts` (new, pure, no React, no dependency) exports
`resolveCornerResize({ transform, bounds, corner, startPointer, pointer, uniform, minScale })`
and returns `{ x, y, scaleX, scaleY }` **in world space**.

- The renderer's own model is used: `cornerWorld = origin + R(rotation)·(local ⊙ scale)`
  (`src/utils/bounds.ts` `getPartWorldBounds`, and the gizmo group transform).
- The diagonally opposite corner is computed from the local bounds and is the invariant of the
  gesture; the pointer's travel is rotated into the layer's local basis and solved against the
  fixed local span, giving the next scale with its sign (crossing a corner mirrors, which the
  gizmo already renders).
- The next origin is **rebuilt from the fixed corner**, so the anchor is exact instead of a
  subtraction of two large numbers, and there is no jump when the pointer-down point is a
  fraction of a pixel off the handle centre.
- `uniform: true` (the aspect-ratio lock) projects the travel onto the layer diagonal, which
  preserves the authored aspect ratio exactly, keeps the same exact anchor, and still starts
  without a jump.
- The minimum-size clamp is applied to the magnitude with the crossed sign kept, then the origin
  is rebuilt from the fixed corner again, so the clamp cannot move the anchor. Zero-extent axes
  keep their scale, and there are no per-angle branches and no magic offsets.

Wiring:

- `TransformGizmo` reports the handle identity (`scale_corner_tl|tr|bl|br`) and the local bounds
  it drew (`baseBounds`) through `onScaleMouseDown` — so the solve uses exactly the rectangle the
  user sees, stroke expansion and Boolean-derived contours included.
- `StageCanvas` maps the mode to a `CornerId`, stores the corner + bounds at pointer-down, and on
  every move writes the helper's result through the existing `updateCurrentTransform` authority
  (world → container-local conversion, bonded partners, current-frame channel/keyframe writes).
  The dead `'scale'` mode and the pointer-derived local half-extents on the corner path are gone;
  edge and single-axis handles are untouched.
- The gesture stays inside `startBatchInteraction`/`endBatchInteraction`, so one drag is one
  history entry.

## 4. Results

- **Opposite corner:** 0.00 px in all 19 measured cases (world-unit drift 0.000/0.000), including
  rotated, non-uniformly scaled, parented, keyframed, panned, zoomed and layout-changed runs.
- **Dragged corner vs pointer:** every case ≤ 0.87 px (largest world-unit residual 1.295).
- **Rotation:** preserved (the solver never returns a rotation; the helper's unit tests assert the
  authored rotation survives the write).
- **Parents:** translated, rotated and non-uniformly scaled parents hold the anchor in world space;
  the container-local inverse round-trips the authored world transform (`cornerResize.test.ts`).
- **Animation:** a frame-30 drag rewrites only frame 30 of the active template's `x`, `scaleX` and
  `scaleY` channels — the frame-0 keyframe, the keyframe counts and the other template's frame-30
  keyframe are byte-identical (browser snapshot + `cornerResizeAuthoring.test.tsx`).
- **History:** one drag is exactly one entry; one undo restores the pre-drag document byte-for-byte
  and disables undo, redo restores the post-drag document byte-for-byte.
- **Escape:** not a drag cancel in this gizmo (unchanged contract) — Escape mid-drag neither
  corrupts nor cancels the gesture, which still commits as one entry.
- **Camera:** resize works after an explicit pan, after a toolbar zoom and after inspector /
  left-toolbar / timeline-resizer layout changes, with the screen CTM magnification unchanged by
  the resize; the camera-invariance spec is green (0.00 px drift on its own transitions).
- **Negative scale / minimum size:** crossovers mirror instead of collapsing, and the clamp holds
  the fixed corner.

## 5. Validation matrix (isolated ports; `CI=1 PORT=5004` → UI 5188, API 5004)

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | clean |
| `npm run lint` (Oxlint) | clean |
| `npm test` (Vitest) | 140 files / 2122 tests passed |
| `npm run build` | Vite production build OK |
| `npm run validate:ograf` | minimal fixture valid |
| `npm run check` | lint + tsc + test + build green |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |
| `node scripts/check-state-consistency.mjs` | PASS (40 checks) |
| `PORT=5004 npm run qa:release` | 2 passed |
| `PORT=5004 npm run qa:v6` | 3 passed |
| focused Chromium (`corner-anchor-resize`, `camera-invariance`, `boolean-text-operands`, `editor-interaction`, `v51-manual-qa`) | 44 passed / 0 failed |
| full Chromium `CI=1 PORT=5004 npx playwright test --retries=0` | 292 passed / 0 failed / 0 flaky / 0 skipped |
| new unit tests | `cornerResize.test.ts` 22 cases, `cornerResizeAuthoring.test.tsx` 5 cases |

No assertion, tolerance, retry or threshold was weakened; `--retries=0` throughout.

## 6. Isolation

Port 5173 was never bound, restarted or re-pointed: it is still the camera worktree's preview
(`...omp-camera-invariance\node_modules\...\vite --host --port 5173`, PID 16844) serving the
camera line. The API on `127.0.0.1:5000` is the same process as before this task
(PID 24896, `node server/index.js`). Every test used the isolated pair UI 5188 / API 5004
(release gate 5189, V6 QA 5187) started by Playwright's own `webServer`. The stable repository,
the authoring-UX worktree, the runtime-parity worktree and `.hermes/desktop-attachments/` were
not written to.

## 7. Known limitations

- **Legacy anchored layers** (`CharacterPart.anchor !== 'none'`) pin their evaluated world
  position to a preset offset (`src/utils/evaluateTransform.ts:61-66`), so no position write can
  hold a corner for them. They keep the previous behaviour (scale only, no position write) rather
  than gaining dead keyframes on a pinned axis. Fixing that needs the anchor model, which is
  outside this task's scope.
- The corner path no longer rounds the authored values to 2/3 decimals (the rounding that
  `Shift` used to change). Exactness is what makes the ≤ 1 px contract hold; the Inspector shows
  scale as an integer percentage, so nothing user-visible changed.
