# Progress 159 — Authoring UX: canvas camera invariance

Date: 2026-10-11. Worktree: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-camera-invariance` (branch `fix/authoring-ux-camera-invariance`).

Opening or closing a sidebar, or resizing the timeline, panned **and** zoomed the authored world. Root-caused to the stage camera having no authority of its own, fixed at the camera, and covered by a deterministic Chromium spec.

## Candidate identity

| Field | Value |
|---|---|
| Fix commit | `df107b894d9e5490a767a169e5c43d2418550be4` |
| Branch | `fix/authoring-ux-camera-invariance`, stacked on `fix/authoring-ux-transform-toolbar` (`dea88ab`) |
| Stacked PR | [#5](https://github.com/ErtugrulAK/keyframe-character-studio/pull/5) — base `fix/authoring-ux-transform-toolbar`, head `fix/authoring-ux-camera-invariance`, review/CI only, not merged |
| CI | `CI Pipeline` run `38138294854` on the pull request (see the PR checks for the final conclusion) |

## Reproduction and measured drift before the fix

Playwright, real Chromium, isolated ports (`CI=1 PORT=5003` → UI 5188 / API 5003), Desktop Chrome 1280x720. Stage box `336,79 584x321`, magnification 0.6687 px/unit. Probes: the SVG screen CTM of two authored world points (the selected layer's centre and a second layer) plus the rendered node box.

| Transition | point A dx, dy | point B dx, dy | px/unit |
|---|---|---|---|
| right sidebar open → closed | +180.00, 0.00 | +180.00, 0.00 | 0.6687 |
| right sidebar closed → open | 0.00, 0.00 | 0.00, 0.00 | 0.6687 |
| left sidebar open → closed | −168.00, 0.00 | −168.00, 0.00 | 0.6687 |
| left sidebar closed → open | 0.00, 0.00 | 0.00, 0.00 | 0.6687 |
| timeline 320 → 150 (collapse to the minimum) | −36.55, +66.73 | +42.64, +112.41 | 0.9733 |
| timeline 150 → 490 | +42.50, −63.75 | −49.58, −116.88 | 0.3146 |
| timeline 490 → 560 (resize up) | +60.00, −90.00 | −70.00, −165.00 | 0.1688 |
| timeline 560 → 380 (resize down) | +15.00, −22.50 | −17.50, −41.25 | 0.5437 |

## Root cause

`src/components/Canvas/StageCanvas.tsx` (`dea88ab:757-760` and `:767`) and `src/utils/viewportMath.ts` (`dea88ab:29`, `:151`):

- The edit SVG filled the stage (`width/height: 100%`) and mapped its 600x480 viewBox with `preserveAspectRatio="xMidYMid meet"`, so the camera content was centred on the **stage box centre** and magnified by the layout fit `min(w/600, h/480)`.
- The pan/zoom CSS transform was applied about that moving centre, and the pure helpers (`clientToSVGPoint`, `getCursorAnchoredViewport`) encoded the same assumption.
- Nothing owned the camera, so half of every panel-width change and every timeline-height change (which changes the fit) landed on the authored world.

## Fix

| Concern | Authority |
|---|---|
| Camera state | `StageCameraView` (`viewportMath.ts`): a view centre in client pixels plus the px-per-unit scale it was anchored with |
| Rendering | `getStageCameraTransform` — the CSS translate is screen pixels and the scale divides the layout fit back out, so the rendered magnification stays `zoom * baseScale` |
| Pointer mapping | `clientToCameraPoint` (fallback) and the SVG screen CTM (production path, unchanged) |
| Wheel zoom | `getCursorAnchoredCameraCenter`, anchored from the camera state instead of the CSS matrix |
| Layout folding | `StageCanvas` `ResizeObserver` + `flushSync`: a layout-only change leaves the camera untouched; a change of the application window itself re-anchors the camera with its pan offset and a fresh scale |

Preserved: initial-mount centring, `Reset View Position`, explicit pan/zoom, the broadcast fit and its identity transform string, and the edit-viewport memory across mode switches.

## Result

After the fix, every transition in the table above measures **0.00 px** on both world points and on the rendered node box, with the magnification and the zoom label unchanged — including ten repeated toggle cycles per surface. The serialized document stays byte-identical and the undo depth (history) is unchanged across every transition.

## Regression coverage

- `e2e/camera-invariance.spec.ts` (new, 5 tests, real Chromium): right/left sidebar close and open, timeline collapse/expand/resize up/down, ten repeated cycles, explicit pan/zoom/reset, and a panned camera across chrome changes — each asserting ≤1 px drift, unchanged magnification/zoom, an unchanged document and an unchanged undo depth.
- `src/tests/viewportMath.test.ts`: the camera model and the stage-box invariance property.
- `e2e/left-toolbar-collapse.spec.ts`: the dock contract is measured on the stage container, because the stage SVG carries the camera transform by design.

## Validation

`npx tsc -b --pretty false`, `npm run lint`, `npm test` (138 files / 2095 tests), `npm run build`, `npm run validate:ograf`, the focused camera Chromium spec (5 passed), `npm run qa:release` (2 passed), `npm run qa:v6` (3 passed), `npm run check`, `node scripts/check-state-consistency.mjs` (38 checks), `npm audit --audit-level=low`, `git diff --check`, and the full Chromium suite with `--retries=0` on isolated ports (262 passed / 11 failed, see below).

The 11 full-suite failures are inherited from the base branch commit `dea88ab`, which added `aria-label={\`Create ${operation} Boolean\`}` to the Boolean operation buttons: `e2e/boolean-text-operands.spec.ts` (9 tests), `e2e/editor-interaction.spec.ts:164` and `e2e/v51-manual-qa.spec.ts:50` still query the accessible name `Union`/`Intersect` with `exact: true`, so those locators cannot match any more. This branch touches no Boolean markup; the regression belongs to the base branch.

## Boundaries

- The user's live QA preview (`keyframe-character-studio-omp-authoring-ux`, UI 5173 / API 5000) and the stable repository (`keyframe-character-studio`, `main` at `c46e698`) were never written to, restarted or killed; both were clean before and after the work. Every test ran on the isolated UI 5188 / API 5003 pair (release gate 5189, V6 QA 5187), and the vite/server process command lines were verified to come from this worktree.
- No merge, rebase, force push, tag, release, version bump or dependency change.
