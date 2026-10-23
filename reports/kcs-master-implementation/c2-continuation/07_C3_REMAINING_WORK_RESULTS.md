# C3 — remaining work: results (approved items 1–3 + parent-delete follow-ups)

2026-10-22, worktree `kcs-master-implementation`, branch `feature/motion/kcs-master-implementation`,
HEAD `39f6414`, nothing committed/staged/merged/pushed. USER ACCEPTED: PENDING for every row.
Open list unchanged and NOT in scope: locks, mask open/close + vertex order, pick-whip, WP-08,
Sprint 1 integration.

Measurement conditions for every before/after below: production build (`vite build` + `vite
preview`), Playwright headless Chromium, 1440×900, synthetic simple/medium/heavy (3/40/150-layer)
scenes, `qa/evidence/c2-perf-probe.evidence.ts`, two runs each, same machine, same session.
Attribution: dev server, `c2-perf-attribution.evidence.ts`.

## 1. Parent delete follow-ups

| Request | Result | Evidence |
|---|---|---|
| Direct test: CHILD animated by legacy keyframes | exact world pose at frames 0–50 under a static and under a moving parent | `src/tests/c3ParentDeletion.test.ts` |
| Direct test: several UNRELATED parents deleted together | each family released to its own surviving ancestor; poses exact; static parents announce nothing | same file |
| Fractional-frame deviation in PROJECT UNITS | translate-only 7e-15; rotate 0→90° linear 0.024; rotate+move easeInOut 0.097 (max, every 0.25 frame over 0–40). Exact (0) at integer frames. The on-screen size depends on zoom/resolution, so no pixel claim is made | probe run (temporary, removed); numbers in `06_…` §1 |
| Opacity and other properties not inherited — verified in code | evaluator: `composeWorldTransform` (`utils/containerMath.ts:215-238`) composes x/y/rotation/scale and returns `opacity: child.opacity`; `evaluateFrame` applies each layer's own procedural delta and opacity; the renderer handles hierarchy only for Boolean operands (`StagePartLayers.tsx:758-767`) — masks, matte, trim, visibility are per layer | code references; preset/opacity test in `c3ParentDeletion.test.ts` |
| Announce heavy keyframe generation BEFORE the delete, with Cancel | `planPartDeletion` reports `bakedChildren` (keyframes before → after, per-frame flag); `requestDeletePart` opens the existing delete dialog when a child GAINS keyframes (also with matte dependents in the same dialog); Cancel changes nothing; a static parent (no new keys) deletes at once | unit (`bakedChildren` counts, per-frame flag), E2E `c3-parent-delete.spec.ts` (dialog text "Hand — 0 → N keyframes (one per frame …)", Cancel → tracks identical, then Delete) |

## 2. Narrow window: stage first (approved item 1)

Implementation: `shouldOpenWithLeftDockClosed` (`utils/workspaceLayout.ts`, threshold 400 CSS px)
decided ONCE at mount (`App.tsx`, before first paint), `useDockedPanelEdge.snap(false)`, then the
existing `REFIT_UNTOUCHED_CAMERA_COMMAND` (re-fits only an untouched opening camera). Never
re-applied: afterwards only the user opens/closes the dock.

| Window | Stage before | Stage after | Left dock at open |
|---|---|---|---|
| real 200 % browser zoom (1440×900 window, 712×402 CSS) | 210×139 | **462×139** | closed |
| 720×450 @2 emulation | 218×160 | 470×160 | closed |
| 1024×720 | unchanged | unchanged | open |
| 1440×900 | 692×366 | 692×366 | open |

Tests: `e2e/c3-narrow-start.spec.ts` — 1440 and 1024 open with both docks; 720×450 opens closed with
a ≥ 400 px stage and a centred untouched camera; opening the dock by mouse never moves the world
(< 0.5 px); selection and timeline seeks never re-close it; keyboard closes and reopens it; a camera
the user zoomed is never re-fitted. Real zoom: `evidence/c3-real-zoom/narrow-after/`.
Not done: the 200 % stage is still only 139 px TALL — the timeline keeps its 150 px minimum
(height policy unchanged by design).

## 3. Toolbar on narrow strips (approved item 2a)

Measured first: the strip scrolled at 1366 px (19 px hidden) and 1280 px (31 px) — caused by the
earlier C3 divider widening (6 px margins). Fixed (4 px). At ≤ 1200 px the Align/Center/Distribute
and Rotate-flip/Arrange bands fold into two `ToolbarMenu`s ("Align and distribute", "Arrange and
rotate") that call the same authorities with the same labels; each menu item keeps its own
availability and reason (`disabled` + title, new in `ToolbarMenuItem`), keyboard: Enter/Arrow/
Home/End/Escape, focus returns to the trigger. ≥ 1201 px: the bands are exactly as before (the
"stays visible" contracts at 1280/1440 unchanged).

| Width | Hidden strip content before | after |
|---|---|---|
| 1366 / 1280 | 19 / 31 px | 0 / 0 |
| 1200 / 1100 / 1024 / 900 | 111 / 211 / 287 / 411 px | 0 |
| 768 | 543 px | 55 px (still scrolls) |

Tests: `e2e/c3-toolbar-narrow.spec.ts` (visible bands per width, no scroll at 1440/1280/1024,
menus by mouse and keyboard, disabled reasons, align/rotate really applied), existing toolbar
specs (authoring-toolbar, ui-polish-v36, micro-polish-v37, layer-index-persistence,
real-user-verification, ae-layout-snapping, inspector-transform-details, stroke-alignment-v2,
keyboard-shortcuts) pass. Unit `authoringToolbar.test.tsx` lists both DOM variants (jsdom has no
media queries; the comment points to the browser spec). Evidence: `evidence/c3-toolbar/{before,after}/overflow.txt`,
`evidence/c3-visual/final/1024-toolbar.png`.

## 4. Inspector mask/matte layout (approved item 2b)

- Order: LAYER MASKS → TRACK MATTE → LEGACY CLIP MATTE (legacy text now says the Track Matte
  "above").
- Masks: compact rows (index, name, mode tag, "Off" tag; selected row = accent edge) replace the
  large pills; accessible names (`1. Window`) and `aria-pressed` unchanged.
- Layer list vs Details: the element count moved into the LAYERS header; the footer row now only
  appears for a drop hint/status (the live region stays in the DOM). Measured (`c3-dock-balance`):
  1440×900 — all 7 layer rows visible (before: 6), first mask row visible without scrolling;
  1024×720 — first mask row visible without scrolling, layer list still 3 full rows (the 22 px
  reclaimed is less than one 28 px row; the dock is height-limited by the 320 px timeline — not
  changed).
- Tests: matte/mask/outliner unit 147 + E2E 172 (22 files) pass. Screenshots before:
  `evidence/c3-visual/current/1440-inspector-*-window.png`; after: `evidence/c3-visual/final/…`.

## 5. Transition performance (approved item 3)

### 5.1 Dock show/hide — stage box fixed while the dock slides

`useDockedPanelEdge`: the dock is lifted out of the row and slides over the stage with a compositor
transform (`will-change: transform`) written to the element each frame — no React render, row
layout or camera work per frame. The stage box changes ONCE per toggle via `commitWorkspaceLayout`
(layout + camera compensation in the same task): at the start when hiding, at the end when
showing. A toggle mid-slide re-targets from where the dock is. Reduced motion snaps. At rest no
inline style remains.
Test changes (assertions unchanged): `camera-transition-stability` measures the inspector's
ON-SCREEN extent (row right edge − panel left edge; equal to its width at rest) instead of its
layout width; `camera-invariance` `settle()` also waits until no dock carries its travel style.
All 10 dock-toggling specs (66 tests) pass, including mid-edge reversals and world-drift checks.

| Heavy scene, panel toggle | p95 | max | long tasks |
|---|---|---|---|
| before (2 runs) | 33.4 / 33.4 ms | 100.1 / 100 ms | 0 / 0 |
| slide only | 33.4 / 33.3 ms | 83.4 / 83.4 ms | 0 / 0 |
| slide + own compositor layer (2 runs) | 16.8 / 16.8 ms | 100.1 / 99.9 ms | 0 / 0 |
| FINAL code (after the lint fix, 2 runs: `c3b-final1/2`) | 16.8 / **33.3** ms | 116.7 / 83.3 ms | 0 / 0 |

Medium scene 16.7–16.8 ms throughout. Dev attribution (panel toggle): `commitWorkspaceLayout`
410 → 102 ms, ease step 345 → 25 ms, main-thread busy 1 678 → 1 266 ms.
**Target 16.8 ms p95: reached in 3 of 4 runs, NOT stable (one final run 33.3 ms) — reported as not
met.** Also not met: one ~83–117 ms frame per toggle sequence remains — the single stage-box
change repaints the 150-layer SVG at the new size (no long JS task is involved).

### 5.2 Edit ⇄ Broadcast

- React `<Activity>` verified on the INSTALLED React 19.3.0 (temporary experiment, removed):
  hidden → `display: none`, effects cleaned up (a window `keydown` listener stopped handling),
  state kept — but the hidden subtree re-rendered on EVERY context change (30 of 30). The edit
  chrome reads `AnimatorContext`, which changes every Broadcast frame → background work while
  hidden. **Not used.**
- Alternative tried: mounting the edit chrome from `useDeferredValue(appMode)` (interruptible
  render, nothing kept mounted in Broadcast). Measured: heavy long task 146/155 ms → 0, max 133/150
  → 100 ms, BUT p95 16.8 → 50/33 ms and — decisive — `c2-mode-transition` failed: a user-zoomed
  camera changed after the round trip (the stage briefly filled the chrome's space). **Reverted.**
- Result: unchanged from before — heavy scene Broadcast → Edit p95 16.7–16.8 ms, **one long task
  146–155 ms (final runs: 148 / 153 ms) — target not met**; simple/medium scenes have none.
- Other heavy-scene numbers on the final code (2 runs): playback p95 16.8 / 16.7 ms, 0 long tasks;
  scrub p95 33.3 / 33.3 ms (earlier C3 runs 16.8 — run-to-run variance at this sample size, not
  attributed to this change; scrub is not touched by it).
- Next option (needs approval, not done): keep the dock/timeline SPACE reserved with empty
  placeholders while the deferred chrome renders, so the stage box never changes during the
  deferral.

## 6. Validation

| Command | Result | Log |
|---|---|---|
| `npx tsc -b` | exit 0 | `logs/c3b_tsc.log` |
| `npm run lint` | exit 0; 1 pre-existing warning (untouched `k5MatteVisibility.test.tsx`). A first final run also flagged a ref read during render in the new `useDockedPanelEdge`; fixed (the slide transform is now written only imperatively), dock specs 66/66 re-run, then this whole table re-run | `logs/c3b_lint.log` |
| `npm run build` | exit 0 | `logs/c3b_build.log` |
| `npx vitest run` | 214 files, 3 080 tests passed | `logs/c3b_vitest_full.log` |
| full E2E | **519 passed, 0 failed, 0 flaky** (22.0 min) on the final code | `logs/c3b_e2e_full.log` |

## 7. Status

| Item | IMPLEMENTED | TESTED | BROWSER VERIFIED | Gaps |
|---|---|---|---|---|
| Parent-delete follow-ups | YES | YES | YES | — |
| 1 Narrow start | YES | YES | YES (real 200 %) | stage height at 200 % |
| 2a Toolbar | YES | YES | YES | 768 px still scrolls 55 px |
| 2b Inspector | YES | YES | YES | 1024×720 list stays 3 rows |
| 3a Dock slide | YES | YES | measured | p95 16.8 not stable (16.8/16.8/16.8/33.3); ~83–117 ms frame per toggle |
| 3b Mode switch | NOT CHANGED (Activity rejected, deferred mount reverted) | — | measured | long task 146–155 ms |
