# KCS — Corner resize anchors the opposite corner (stacked on the authoring-UX line)

## Latest action

Corner-handle resize in the transform gizmo was fixed so the dragged corner follows
the pointer while the diagonally **opposite** corner stays fixed in world space. The
fix is one pure geometry authority plus its wiring into the existing canvas → inspector
write path. It is committed on `fix/authoring-ux-corner-anchor`, a branch stacked on
`fix/authoring-ux-camera-invariance`, pushed normally, and opened as a stacked pull
request for review and CI only. Nothing was merged, nothing was rebased or
force-pushed, no tag/release/npm action was taken, and the live 5173 preview was not
touched.

| Field | Value |
|---|---|
| Branch | `fix/authoring-ux-corner-anchor` (stacked) |
| Base branch | `fix/authoring-ux-camera-invariance` (branch base `55a4ab2`, application head `aef21de`) |
| Application commit | `04dc182` (`fix: anchor opposite corner during resize`) |
| Docs commit | the handoff refresh on top of `04dc182` (documents only) |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-corner-anchor` |
| Stacked PR | [#6](https://github.com/ErtugrulAK/keyframe-character-studio/pull/6) — base `fix/authoring-ux-camera-invariance`, head `fix/authoring-ux-corner-anchor`, `MERGEABLE`, review and CI only, **NOT merged** |
| PR CI (code head `04dc182`) | `CI Pipeline` run `38149765766` — **success** (job "Build, Lint & Test Verification", 1m56s) |
| Live preview | `http://localhost:5173/` — unchanged, still the camera worktree's preview (PID 16844) |
| API | `127.0.0.1:5000` — unchanged, same process as before this task (PID 24896) |

## Root cause (recorded before the patch, with file:line evidence)

The corner drag scaled about the layer's **own centre** and never wrote a position:

- `src/components/Canvas/StageCanvas.tsx:518-547` (aspect-ratio-lock path) and `:547-560`
  (free path) called `updateCurrentTransform({ scaleX, scaleY })` only. `useInspector`'s
  `updateCurrentTransform` (`src/hooks/useInspector.ts:272-275`) writes exactly the keys
  it is given, so the origin stayed put and both corners moved by half the size change.
- The "anchor" the free path computed was the world-axis offset
  `centerX − grabSignX · initHalfW` (`StageCanvas.tsx:547-556`), which is not a corner at
  all once the layer is rotated.
- `dragInitialLocalX/Y` were the **pointer's** distance from the origin, not the local
  geometry (`StageCanvas.tsx:377-383`), so a non-uniformly scaled layer solved against the
  wrong span.
- The aspect-ratio lock is ON by default (`src/context/AnimatorContext.tsx:197`) and took a
  radial branch (`StageCanvas.tsx:521-533`) that ignored the corner identity: the dragged
  corner moved along the centre ray and never reached the pointer.

Measured pre-fix in real Chromium (fixed ±36/±24 px drags at 0.6687 px per world unit):
opposite-corner drift 0.27-28.61 px (unrotated rectangles ≈ 0.4-1.6 px, rotated
5.9-9.7 px, −45° TR 18.7 px, non-uniformly scaled parent 28.6 px) and a dragged corner
that missed the pointer by 31-45 px; the keyframed case did not move the layer at all.

## Geometry contract (preserved, not invented)

Corner handles are **aspect-ratio locked by default**: `isScaleLocked` starts `true` and the
Inspector's Scale card toggles "Aspect Ratio Locked (Uniform Scale)" / "Aspect Ratio
Unlocked (Free Scale)" (`src/components/Inspector/sections/transform/TransformScaleCard.tsx`).
Unlocked, the corner writes independent `scaleX`/`scaleY`. `Shift` was only a
decimal-precision switch (2 vs 3 decimals) and is **not** an aspect constraint — no new
`Shift` behaviour was added. Cursors are unchanged: TL/BR `nwse-resize`, TR/BL `nesw-resize`.

## Implementation authority

`src/utils/cornerResize.ts` — `resolveCornerResize({ transform, bounds, corner,
startPointer, pointer, uniform, minScale }) → { x, y, scaleX, scaleY }` in **world space**:

- uses the renderer's model `cornerWorld = origin + R(rotation)·(local ⊙ scale)`;
- fixes the diagonally opposite local corner as the gesture invariant;
- rotates the pointer travel into the layer's local basis and solves it against the fixed
  local span, giving the next scale with its sign (a crossover mirrors, which the gizmo
  already renders);
- rebuilds the next origin from the fixed corner, so the anchor is exact and there is no
  jump at pointer-down;
- `uniform: true` projects the travel onto the layer diagonal (exact aspect preservation,
  same anchor, no jump);
- clamps the minimum magnitude with the crossed sign kept and rebuilds the origin again, so
  the clamp cannot move the anchor; zero-extent axes keep their scale.

Wiring: `TransformGizmo` reports the handle identity (`scale_corner_tl|tr|bl|br`) and the
local bounds it drew; `StageCanvas` stores them at pointer-down and writes the helper's
world patch through the existing `updateCurrentTransform` authority (world → container-local
conversion, bonded partners, current-frame channel/keyframe writes). The dead `'scale'` mode
and the pointer-derived half-extents on the corner path are removed; edge and single-axis
handles are unchanged. The gesture stays inside `startBatchInteraction`/`endBatchInteraction`.

## Results

| Area | Result |
|---|---|
| Opposite corner, 19 Chromium cases | 0.00 px drift in every case (rotated, non-uniform, parented, keyframed, panned, zoomed, layout-changed, free-scale) |
| Dragged corner vs pointer | ≤ 0.87 px in every case |
| Rotation | preserved (the solver never returns a rotation; asserted by the unit file) |
| Parents | translated, rotated and non-uniformly scaled parents hold the world anchor; the container-local inverse round-trips the authored world transform |
| Animation | a frame-30 drag rewrites only frame 30 of the active template's `x`/`scaleX`/`scaleY`; the frame-0 keyframe, the keyframe counts and the other template's frame-30 keyframe are identical |
| History | one drag = one entry; one undo restores the pre-drag document byte-for-byte (undo then disabled), redo restores the post-drag document byte-for-byte |
| Escape | not a drag cancel in this gizmo (unchanged contract): neither cancels nor corrupts, and the gesture still commits as one entry |
| Negative scale / minimum size | crossover mirrors; the clamp keeps the fixed corner |

## Validation (isolated ports, `CI=1 PORT=5004` → UI 5188 / API 5004)

`npx tsc -b --pretty false` clean · `npm run lint` clean · `npm test` 140 files / 2122
tests · `npm run build` OK · `npm run validate:ograf` valid · `npm run check` green ·
`npm audit --audit-level=low` 0 vulnerabilities · `git diff --check` clean ·
`node scripts/check-state-consistency.mjs` PASS (40 checks) · `npm run qa:release` 2 passed ·
`npm run qa:v6` 3 passed · focused Chromium (`corner-anchor-resize`, `camera-invariance`,
`boolean-text-operands`, `editor-interaction`, `v51-manual-qa`) 44 passed · **full Chromium
suite 292 passed / 0 failed / 0 flaky / 0 skipped with `--retries=0`**. New unit coverage:
`cornerResize.test.ts` (22 cases) and `cornerResizeAuthoring.test.tsx` (5 cases). No
assertion, tolerance, retry or threshold was weakened.

## Isolation

Port 5173 was never bound, restarted or re-pointed: it is still the camera worktree's
preview (`...omp-camera-invariance\node_modules\...\vite --host --port 5173`, PID 16844)
serving the camera line's validated application source. The API on `127.0.0.1:5000` is the
same PID (24896) as before this task. All tests used Playwright's own isolated pair
(UI 5188 / API 5004; release gate 5189, V6 QA 5187). The stable repository, the
authoring-UX worktree, the runtime-parity worktree and `.hermes/desktop-attachments/` were
not written to.

## Boundaries

- Not merged, not rebased, not force-pushed; no history rewrite, no branch deletion, no tag,
  release, npm publish, version bump, dependency, package or workflow change.
- No runtime, export, OGraf, camera-model, snapping, toolbar, colour-picker, context-menu,
  Group/Ungroup or aggregate-border work is included; no object geometry is mutated.
- Known limitation: a legacy layer whose `anchor` is not `none` pins its evaluated world
  position (`src/utils/evaluateTransform.ts:61-66`), so no position write can hold a corner
  for it. It keeps the previous scale-only behaviour instead of gaining dead keyframes on a
  pinned axis; a fix needs the anchor model, which is outside this task.
- The corner path no longer rounds the authored values to 2/3 decimals (the rounding `Shift`
  used to change). Exactness is what makes the ≤ 1 px contract hold, and the Inspector shows
  scale as an integer percentage, so nothing user-visible changed.

## ChatGPT upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. Its sources are this
response, `chatgpt_handoff/latest/README.md`, `chatgpt_handoff/latest/manifest.txt`,
`chatgpt_handoff/latest/progress_160_corner_anchor_resize.md` and the mirrored live documents
(`NEXT_SESSION.md`, `PROJECT_STATE.md`, `CHANGELOG.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`,
`KCS_RELEASE_CANDIDATE_SUMMARY.md`) plus the stacked base's two progress records.
