# C3 follow-up — results of this session (2026-10-22, Claude Code terminal)

Worktree `C:\Users\ertugrul.ak\Desktop\kcs-master-implementation`, branch
`feature/motion/kcs-master-implementation`, HEAD `39f6414` (nothing committed, staged, merged or
pushed). Scope: the eight items the user approved in this session. WP-08 and the Sprint 1
integration are NOT part of it. USER ACCEPTED is PENDING for every row.

## 0. Session events the user must know about

- **Concurrent session.** At the start, a second Claude Code session was writing to this worktree
  (15:16–15:20): it fixed the two full-E2E failures (`OutlinerRow` ordinal `aria-hidden`, wp04 test
  confirms the dependents dialog), converted 29 CRLF files to LF and updated reports 03/handoff. It
  was verified idle (no process, no writes) before this session wrote anything; its fixes were kept.
- **Protected-tree incident (found and reverted by this session).** A PowerShell
  `[IO.File]::ReadAllText/WriteAllText` call with a RELATIVE path resolved against the process
  directory (the main checkout), not the worktree. It inserted one line (`showToast,`) into
  `main:src/hooks/useTimeline.ts` and created an empty `main:src/tests/c3ParentDeletion.test.ts`.
  Both were detected by the baseline snapshot, reverted (the line removed with an exact edit, the
  0-byte file this session created deleted), and main was re-verified IDENTICAL to the snapshot:
  HEAD, `git status`, tracked-diff SHA-256 and every untracked file's SHA-256 (0 differences).
  Sprint 1 was never touched (0 differences). File edits after that used absolute paths only.

## 1. Full E2E result of the C2 code (item 1)

`logs/c2_e2e_full.log`: **503 tests — 501 passed, 2 failed** (21.8 min). Both failures were real,
deterministic, caused by WP-05/C2, not load:
- `track-matte.spec.ts:1295` V-G13 — the WP-05 ordinal was part of the layer row's accessible name
  ("2 Target …"). Fixed (by the concurrent session): the ordinal is `aria-hidden`.
  This session added a guard: `e2e/wp05-layer-ordinal.spec.ts` asserts every row is announced by
  its layer name.
- `wp04-matte-navigation.spec.ts:59` — the C2 dependents dialog was not confirmed in this spec.
  Fixed (concurrent session): the spec confirms the dialog and checks the named dependent. Cancel /
  Escape is covered by `c2-layer-tree.spec.ts` ("Cancel keeps everything").
- Rerun after the fixes: `wp05 wp04 c2-layer-tree track-matte:1295` 7/7 PASS.

## 2. Hierarchy and delete (item 2)

| Behaviour | Implementation | Evidence |
|---|---|---|
| Square → Triangle → Star: parent transform reaches children; a child never moves its parent; Circle independent | existing evaluator + C2 reparent | `c3ParentDeletion.test.ts` (hierarchy case), `c2-layer-tree.spec.ts` |
| Deleting a NON-group parent: children move up to its parent and keep their world pose at EVERY frame of EVERY sequence | `releaseChildrenOfDeletedParents` (`utils/layerGrouping.ts`) reuses the ungroup core (`dissolveContainer`: affine fold, or per-frame bake when the parent moves/rotates); `planPartDeletion` (`utils/partDeletion.ts`); `useTimeline.deletePart` | unit: static, rotated/scaled, ANIMATED parent in two sequences (frames 0–60 compared), chain of two deleted parents; E2E `c3-parent-delete.spec.ts` (screen pose at 5 frames) |
| Cannot keep the pose → refused with the reason, nothing deleted | skew (rotated parent × non-uniform scale), stage-anchored child, Boolean operand as parent; every release is VERIFIED by comparing world affines before/after | unit + E2E refusal test (skew) |
| One undo step; Redo; save/reload; no dangling `parentId` | same state transaction as before | E2E: Undo restores layers+tracks JSON exactly; Redo; reload |
| Group delete contract unchanged (group takes its children); Boolean group takes operands | untouched `collectOwnedDeletionIds` | unit + E2E |

Toast after a release: "1 child layer kept its place" (+ "the parent's motion was baked into their
keyframes" when a bake happened). Found on the way: `anchor` is not serialized in scene JSON and no
UI sets it, so an anchored child cannot be produced in the editor today (refusal kept as a guard,
unit-tested only).

## 3. Active tool priority (item 3)

- While Rectangle/Circle is armed, Pen is active, the Hand or crop is on, the tool owns EVERY stage
  press — including a press on the current selection's transform handle (the C2-H exception was
  removed). The gizmo stays visible but passive (40 % opacity, no resize cursors, not grabbable):
  class `tool-owns-pointer`, `StageCanvas.css`.
- Select (V / Esc / button) resizes as before. `canvas-interaction-v1.spec.ts:95` now presses Select
  before the handle drag (its assertion is unchanged); the "tool stays armed for consecutive shapes"
  contract is kept.
- Two real bugs found by the new tests and fixed in `useFreeformDraw`: during an open Pen draft
  (a) a right-button temporary pan added a vertex on release, (b) ANY left click outside the stage
  (toolbar, header, panel) added a vertex. Now only the release of a stage press adds one.
- Evidence: `e2e/c3-tool-priority.spec.ts` (drag ON the selected image's corner handle draws; image
  and another shape untouched; Select resizes; Pen on a handle; right-drag pan keeps the draft;
  header click adds nothing; mouse finish), `src/tests/c3FreeformDrawInput.test.ts`.

## 4. Drawing and mask use (item 4)

Verified, not rewritten (C2 implementation): draft Undo/Redo touches only the draft
(`c2-tool-ownership-draft-undo`), mouse finish (first point / Finish button), Esc/tool switch,
Mask Pen close at zoomed out/100 %/zoomed in (`c2-mask-pen-close`), Corner/Smooth + shared selected
point (`c2-mask-point-type`, `BezierPathEditor.test`). Added: freeform Pen closes with the mouse on
its first point after Zoom out ×2 and Zoom in ×2 (`c3-tool-priority.spec.ts`). Mask Path editor
width/legibility: see the visual set (§7); no further change was needed for this session's tests.

## 5. Canvas and mode transitions (item 5)

- Inspector card open/closed state survives Edit → Broadcast → Edit: `StyleCard.retainKey` on all
  15 cards (unique keys; titles repeat) backed by the existing `useRetainedUiState` (session UI
  memory — not scene, not history). Side effect by design: the card state also carries over when
  another layer showing the same card is selected.
- The "nine per-mount tests" the previous session reported were reproduced: all in
  `styleMatteSection.test.tsx`; a second render in the same test found the card already open. The
  helper now opens the card only if it is closed and asserts it is open (assertions unchanged).
- `c2-mode-transition.spec.ts` now also asserts the opened TRANSFORM card and the camera transform
  after the round trip (selection, playhead, tree state, stage element already asserted). Reduced
  motion and show/hide stability: existing C2 tests, passing.

## 6. Performance and real 200 % zoom (item 6)

Measured (synthetic 3/40/150-layer scenes; production build for cadence, dev server for
attribution; headless Chromium, 1440×900; `evidence/c2-perf/{c3-pre,c3-post,c3-post2,attr-c3-pre,attr-c3-post}`).

Bottlenecks proven by attribution and fixed (render-only; evaluation, playback, broadcast and SVG
output unchanged):
- Timeline rows/lanes re-rendered on every playhead frame → `TrackLane` and `TrackOutlinerRow`
  memoized; a collapsed row re-renders only when its previous/next keyframe navigation changes; one
  stable action bag (latest handlers read at call time; add-keyframe resolves the CURRENT frame).
  Guard: `e2e/c3-timeline-rows.spec.ts`.
- Every camera/dock-layout frame re-rendered every part → `StagePartLayers` memoized (pure props),
  `sortedParts` memoized, stable part actions.

| Heavy scene (dev attribution) | before | after |
|---|---|---|
| Main-thread busy, 40-frame scrub | 2 766 ms | 1 794 ms (−35 %) |
| Main-thread busy, 2 s playback | 2 579 ms | 2 283 ms (−11 %) |
| `TrackOutlinerRow` + `TrackLane` during playback | 274 ms | not in the top list |
| Panel toggle: `handleViewportCommand` (incl. part re-render) | 710 ms | 267 ms |

| Heavy scene, production UI cadence (p95 / max ms) | before | after (2 runs) |
|---|---|---|
| Playback | 16.7 / 33.3 | 16.7 / 16.8 · 16.8 / 16.8 |
| Scrub | 16.8 / 33.3 | 16.8 / 33.3 · 16.8 / 33.4 |
| Panel toggle | 33.4 / 66.6 | 33.3 / 66.6 · 33.3 / 66.7 |
| Mode switch | 16.8 / 100, 1 long task 110 ms | unchanged |

Improvement vs. solved, separately: CPU headroom improved; on THIS machine playback/scrub/drag/draw
already ran at 60 Hz cadence and still do. NOT solved: panel toggle p95 33 ms (remaining cost is the
dock animation's per-frame `commitWorkspaceLayout`/`flushSync` layout writes — fixing it means
changing the dock animation mechanism, an architectural proposal, not done); Edit←Broadcast mode
switch has one 110 ms long task (Inspector/timeline remount). Measured but NOT changed: the stage
crop authority computes all visible-layer bounds on every provider render (~3–4 % of busy time);
an exact cheaper form needs a contract decision (a single non-finite box disables the command
today). Not measurable here: GPU/paint cost on real hardware (headless, software paint).

Real 200 % browser zoom (`qa/evidence/c3-real-browser-zoom.evidence.ts`): a disposable Chromium
profile with zoom 200 % (`partition.default_zoom_level`), full Chromium new-headless, a real
1440×900 window, NO viewport/DPR emulation; the test fails unless the page itself reports DPR 2 and
CSS width = window/2 (proof: DPR 2, 712 CSS px of a 1440 px window). The old headless shell ignores
the preference (first attempt: DPR 1 — the test refused to fall back). Screenshots use the DevTools
capture (Playwright's `page.screenshot` saved a quarter of the zoomed page).

| | real 200 % before | real 200 % after | C2 emulation 720×450@2 |
|---|---|---|---|
| CSS viewport | 712×402 | 712×402 | 720×450 |
| Header height | 102 px (2 rows) | 74 px (1 row) | 74 px |
| Stage | 210×111 | 210×139 | 218×186 → 218×160 (*) |

(*) Not a regression of the stage policy: the timeline's opening clamp (C2-H) is
`window − stage top − MIN_STAGE_HEIGHT (160)`. Before, the header was still wrapping when the clamp
ran, so the ceiling came out lower and the timeline stayed at its 150 px minimum; with the one-row
header the timeline takes the full ceiling (176 px) and the stage gets exactly the guaranteed
160 px. At the real 200 % window the ceiling (128) is below the timeline minimum (150), so the
stage gets 139 px. Whether small windows should favour the stage over the timeline is a layout
decision (open).
| Shortcut dialog fits, Esc closes | yes | yes | yes |

The emulation was NOT a fair stand-in (more height, different stage). Still open at real 200 %: the
stage is only ~210 px wide because the Media drawer opens by default and the right panel keeps its
width — proposal: below a 400 px stage width, start with the drawer collapsed (Master Review spec
11, responsive targets); not implemented (layout/default-state decision).

## 7. Visual quality (item 7) — before/after in `evidence/c3-visual/{before,after}/`

| Area | Before | After |
|---|---|---|
| Shortcut reference | every category band was a shrinking flex item clipped mid-row ("Pen / freeform draw", "Flip vertical" cut; rows hidden) | bands keep full height, the body scrolls; every row readable |
| Toolbar active tool | the current tool and a switched-on toggle (grid/snap) looked identical | tools (Select, Hand, create, Pen) get a filled accent state with an accent underline; toggles keep the quieter outline |
| Toolbar icons | Boolean icons were solid blocks (another icon family), disabled glyphs at 40 % nearly invisible | Boolean icons redrawn in the strip's 24-grid 2-px line language (outlines + filled result; still original KCS drawings); disabled 55 %; wider band dividers |
| Layer tree header | "TEMPLATE ELEMENTS" header above a "Template Elements" root row | header "LAYERS", root row names the template |
| Track Matte in the tree | scissors + "Mask → Logo" (read as a layer mask) | pill "Matte · Logo" (Blend icon); legacy "Clip · …"; missing source in warning colour |
| Layer masks in the tree | no indicator | separate mask pill with the count ("2 layer masks") |
| Row clutter | up/down stack arrows on every row | arrows on the hovered/selected/focused row only |
| Narrow header (≤ 860 px) | wrapped to 2 rows | icon-only actions (text kept as accessible name), one row |

Not done in this pass (visual, needs a product decision rather than CSS): toolbar density (40+
always-visible commands; folding Align/Distribute/Arrange into menus conflicts with the existing
"stays visible" toolbar contracts), the short Outliner pane vs. a large empty Details pane, Media
drawer default at narrow widths, Inspector mask/matte card layout redesign. No new dependency.

## 8. Validation (final code)

| Command (cwd: worktree) | Result | Log |
|---|---|---|
| `npx tsc -b` | exit 0 | `logs/c3_tsc.log` |
| `npm run lint` | exit 0; 1 pre-existing warning (untouched `k5MatteVisibility.test.tsx`) | `logs/c3_lint.log` |
| `npm run build` | exit 0 (pre-existing INEFFECTIVE_DYNAMIC_IMPORT notice) | `logs/c3_build.log` |
| `npx vitest run` | 214 files, 3 074 tests passed | `logs/c3_vitest_full.log` |
| full E2E `--project=e2e` | **513 passed, 0 failed, 0 flaky** (22.5 min). An earlier full run on the code before the last fix: 512 passed, 1 failed (`authoring-ux-slice1.spec.ts:60` — the redrawn Boolean icon has two paths; the spec now reads the marked RESULT path, its "four distinct icons" assertion unchanged) | `logs/c3_e2e_full.log` |

## 9. One table: every request → implementation → evidence → remaining gap

Sources: Master Review WP list (`KCS_MASTER_REVIEW/14`), WP checkpoints 00–08, C2 reports 00–03,
handoff, this session's items 1–8. The original C2 request text (§10/§14/§16/§17) is not on disk;
rows from it are taken from the C2 reports' paraphrase (UNVERIFIED wording).

| Request | Implementation | Test / visual evidence | Remaining gap |
|---|---|---|---|
| WP-01 mask authoring scope | `trackMutations`, `layerMasks`, `usePartPropertyAuthoring`, `useTimeline.authorMaskPath` | `src/tests/wp01*`, evidence wp01, report 02 | `track.locked`/`LayerMask.locked` not enforced (product decision) |
| WP-02 edit mask on canvas | `maskPathEditing`, `useMaskEditing`, `MaskPathOverlay` | `e2e/wp02*`, report 03 | roving tabindex over canvas points (keyboard path exists: `]`/`[`, arrows, numeric editor) |
| WP-03 create mask, path rotate/scale | `maskPathCreation`, `MaskDrawOverlay` | `e2e/wp03*`, `c2-mask-pen-close`, report 04 | open/close toggle, vertex reorder, free-transform box |
| WP-04 Track Matte navigation | `matteRelationship`, `useMatteNavigation`, `TrackMatteSummary` | `e2e/wp04*` (fixed this session), `m22`, report 05 | pick-whip; D-04 default not applied |
| WP-05 display ordinals | `layerOrdinal` (+ `aria-hidden` ordinal) | `e2e/wp05*` (+ accessible-name guard), V-G13 | — |
| WP-06 tool/focus, narrow layout | CSS/layout, nudge; C3 header one row ≤ 860 px | wp06 evidence; `c3-real-browser-zoom` | stage width at real 200 % (Media drawer default), panel balance |
| WP-07 OGraf capability | `capabilityReport`, `OGrafCapabilityDialog` | `e2e/wp07*`, `ografBrowserZip.test` | report 08 TESTED: PARTIAL (pre-existing racy E2E) |
| WP-08 masked color correction | NOT implemented (separate scope) | — | all |
| C2 A/B tool ownership + draft undo | `StageCanvas` capture ownership, `registerDraftHistory`, `useFreeformDraw` | `c2-tool-ownership-draft-undo`, `c2DraftHistoryOwnership.test` | — |
| C2 C mask path ergonomics | `BezierPathEditor` | `c2-mask-point-type`, `BezierPathEditor.test` | — |
| C2 D show/hide stability | camera-anchored backdrop | `c2-stage-backdrop-anchor`, toggle probe | — |
| C2 E layer tree / parenting / rename | `layerParenting`, `useLayerParenting`, `OutlinerRow`, `LayerParentField` | `c2-layer-tree`, `c2LayerParenting.test` | animated reparent refused, not re-based |
| C2 F keyboard / shortcuts / right-click | `shortcuts.ts` scopes, right-press pan vs menu | `keyboard-shortcuts`, `c2-right-click-pan` | toolbar density (see §7) |
| C2 G Edit ⇄ Broadcast | `useRetainedUiState` | `c2-mode-transition` | — (cards added in C3) |
| C2 §14 UI library evaluation | report 02, nothing installed | — | UNVERIFIED wording |
| C2 §17 acceptance scenario | `c2-acceptance.evidence.ts` | 3/3 variants | its "200 %" was an emulation (see item 6) |
| 1 Full E2E result, two failures | fixes (concurrent session) + guard | `logs/c2_e2e_full.log`, reruns | — |
| 2 Hierarchy + non-group parent delete | `releaseChildrenOfDeletedParents`, `planPartDeletion` | `c3ParentDeletion.test`, `c3-parent-delete.spec` | anchored children cannot be created in the editor today (guard only) |
| 3 Active tool priority | tool owns every stage press; passive gizmo; 2 draft bugs fixed | `c3-tool-priority.spec`, `c3FreeformDrawInput.test` | — |
| 4 Drawing / mask use | verified C2 + zoomed close test | specs listed in §4 | — |
| 5 Mode transitions incl. cards/camera | `StyleCard.retainKey` | `c2-mode-transition`, `styleCard.test` | — |
| 6 Performance | memoized timeline rows/lanes and stage layers | `evidence/c2-perf/*c3*`, `c3-timeline-rows.spec` | panel toggle p95 33 ms, mode-switch 110 ms long task, crop-bounds scan, GPU paint unmeasured |
| 6 Real 200 % zoom | real-zoom harness; header fix | `evidence/c3-real-zoom/*` | stage ~210 px wide at real 200 % |
| 7 Visual quality | §7 table | `evidence/c3-visual/{before,after}` | toolbar density/menus, pane balance, Inspector card layout |
| 8 Final validation | §8 | logs | see §8 |

## 10. Status

**The C3 scope is not complete** (items 6 and 7 partial). The bake review, the reconciliation of
historical gaps and the plan for the remaining work are in `06_C3_REMAINING_PLAN_AND_RECONCILIATION.md`.


| Item | IMPLEMENTED | TESTED | BROWSER VERIFIED | USER ACCEPTED | MERGED |
|---|---|---|---|---|---|
| 1 E2E failures | YES (concurrent session) + guard | YES | YES | PENDING | NO |
| 2 Parent delete keeps children | YES | YES | YES (Chromium) | PENDING | NO |
| 3 Tool priority + 2 draft bugs | YES | YES | YES | PENDING | NO |
| 4 Drawing / mask use | VERIFIED (+1 test) | YES | YES | PENDING | NO |
| 5 Mode round trip incl. cards/camera | YES | YES | YES | PENDING | NO |
| 6 Perf: timeline/stage re-render | YES (partial: panel toggle, mode switch open) | YES | measured | PENDING | NO |
| 6 Real 200 % zoom | VERIFIED (real zoom), header fixed; stage width open | YES | YES (real zoom) | PENDING | NO |
| 7 Visual pass | PARTIAL (see §7 not-done) | YES | screenshots | PENDING | NO |
