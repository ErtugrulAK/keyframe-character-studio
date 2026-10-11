# KCS — Canvas camera invariance (authoring UX)

## Latest action

`fix/authoring-ux-camera-invariance` at `df107b894d9e5490a767a169e5c43d2418550be4` fixes the reported defect where changing editor chrome panned and zoomed the authored world. It is stacked on `fix/authoring-ux-transform-toolbar` (`dea88ab`) and opened as stacked PR [#5](https://github.com/ErtugrulAK/keyframe-character-studio/pull/5) for review and CI only; nothing was merged, rebased or force-pushed.

| Field | Value |
|---|---|
| Fix commit | `df107b894d9e5490a767a169e5c43d2418550be4` |
| Branch | `fix/authoring-ux-camera-invariance` (base `fix/authoring-ux-transform-toolbar` @ `dea88ab`) |
| Stacked PR | #5 — base `fix/authoring-ux-transform-toolbar`, head `fix/authoring-ux-camera-invariance`, not merged |
| CI | `CI Pipeline` run `38138487966` (pull_request) — success, on the documentation tip `7ca126c`; the earlier run `38138294854` failed because the fix commit updated `CHANGELOG.md` without re-copying the bundle mirror, which the documentation commit repaired |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-camera-invariance` |

## Root cause

The edit SVG filled the stage and mapped its 600x480 viewBox with `preserveAspectRatio="xMidYMid meet"` (`StageCanvas.tsx`, base `dea88ab:757-760`), so the camera content was centred on the **stage box centre** and magnified by the layout fit `min(w/600, h/480)`; the pan/zoom CSS transform (`:767`) was applied about that moving centre, and `clientToSVGPoint` / `getCursorAnchoredViewport` (`viewportMath.ts:29`, `:151`) encoded the same assumption. Nothing owned the camera, so half of every panel-width change and every timeline-height change (which changes the fit) landed on the authored world.

## Measured drift before the fix

Real Chromium, isolated ports (UI 5188 / API 5003), stage `336,79 584x321`, 0.6687 px/unit:

| Transition | world point A dx, dy | world point B dx, dy | px/unit |
|---|---|---|---|
| right sidebar open → closed | +180.00, 0.00 | +180.00, 0.00 | 0.6687 |
| left sidebar open → closed | −168.00, 0.00 | −168.00, 0.00 | 0.6687 |
| timeline 320 → 150 | −36.55, +66.73 | +42.64, +112.41 | 0.9733 |
| timeline 490 → 560 | +60.00, −90.00 | −70.00, −165.00 | 0.1688 |

## Measured drift after the fix

**0.00 px** on both world points and on the rendered node box for every transition: right sidebar close/open, left sidebar close/open, timeline collapse/expand/resize up/resize down, ten repeated toggle cycles per surface, and a panned camera across chrome changes. Magnification (0.6687 px/unit) and the zoom label are unchanged; the serialized document is byte-identical and the undo depth is unchanged. Explicit pan, zoom and `Reset View Position` still move the camera on purpose.

## Fix

`src/utils/viewportMath.ts` now owns the camera: `StageCameraView` (a view centre in client pixels plus the px-per-unit scale it was anchored with), `getStageCameraTransform` (the rendered transform divides the layout fit back out, so magnification stays `zoom * baseScale`), `getCursorAnchoredCameraCenter` and `clientToCameraPoint`. `src/components/Canvas/StageCanvas.tsx` keeps the camera untouched for layout-only changes and folds a measured stage box in inside the same frame (`ResizeObserver` + `flushSync`); a change of the application window itself re-anchors the camera with its pan offset and a fresh scale, which is the fit behaviour a window resize always had. Initial centring, `Reset View Position`, the broadcast fit and its identity transform string are unchanged.

## Tests and validation

`e2e/camera-invariance.spec.ts` (new, 5 tests) proves the invariance, the unchanged document and the unchanged history in a real browser; `src/tests/viewportMath.test.ts` unit-tests the camera model and the stage-box invariance property; `e2e/left-toolbar-collapse.spec.ts` now measures its dock contract on the stage container.

Local validation on the fix commit: `tsc -b`, `oxlint`, `vitest` (138 files / 2095 tests), `vite build`, `validate:ograf`, the focused camera spec (5 passed), `qa:release` (2 passed), `qa:v6` (3 passed), `check-state-consistency` (38 checks), `npm audit --audit-level=low`, `git diff --check`, and the full Chromium suite with `--retries=0` (262 passed / 11 failed).

The 11 failures are inherited from the base commit `dea88ab`, which added `aria-label={\`Create ${operation} Boolean\`}` to the Boolean operation buttons while `e2e/boolean-text-operands.spec.ts` (9), `e2e/editor-interaction.spec.ts:164` and `e2e/v51-manual-qa.spec.ts:50` still query the accessible name `Union`/`Intersect` with `exact: true`. This branch touches no Boolean markup.

## Boundaries

The user's live QA preview (`keyframe-character-studio-omp-authoring-ux`, UI 5173 / API 5000) and the stable repository (`keyframe-character-studio`, `main` at `c46e698`) were never written to, restarted or killed, and were verified clean before and after the work. Every test used the isolated UI 5188 / API 5003 pair (release gate 5189, V6 QA 5187), and the vite/server process command lines were verified to come from this worktree. No merge, rebase, force push, tag, release, version bump or dependency change was performed.
