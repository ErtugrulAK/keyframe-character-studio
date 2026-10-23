# C4 — results (items 1–11)

Worktree `kcs-master-implementation`, branch `feature/motion/kcs-master-implementation`, HEAD
`39f6414`; nothing committed, staged, merged or pushed. Main and Sprint 1 sources unchanged.
USER ACCEPTED: **PENDING for every row** (yours to give).
Details per item: `08_C4_PROGRESS_AND_HANDOFF.md`; WP-08 proposal `09_…`; integration plan `10_…`.

## 1. Request | Implemented | Test | Browser evidence | Gap / limitation

| # | Request | Implemented | Test | Browser evidence | Gap / limitation |
|---|---|---|---|---|---|
| 1 | Edit ⇄ Broadcast without the long task; nothing jumps; state kept; hidden editor takes no keys | YES — measured cause (11 400 DOM elements of two 150-row lists); row windowing ≥ 60 rows; list scroll positions retained; Broadcast no longer passes editor shortcuts (Delete deleted the selected layer there) | `c4RowWindow` (6), `useKeyboardShortcuts` (+1), E2E `c4-long-lists` (6) + `c2-mode-transition`, `micro-polish-v37`, camera specs | perf series (5 runs) `evidence/c4-mode/series-*` | 2 of 25 switches still 53 ms (target "0 long tasks" not fully met). Windowed lists: Ctrl+F of an off-screen row name and a timeline marquee reaching far off-screen rows find only mounted rows (≥ 60-row scenes only) |
| 2 | Panel show/hide without the 83–117 ms frame | measured: the C3 frame was a HARNESS ARTEFACT (Playwright role/name locator scanning 12 000 elements in the page); clean harness: base and current p95 16.7–16.8, max 16.8, 0 frames > 50 ms; resize-while-sliding contract tested | E2E `c4-dock-slide` (2) + dock/camera specs | series `evidence/c4-panel/series-*` | the C3 report's explanation was wrong (corrected here) |
| 3 | Narrow/short windows share space; no forced toolbar scroll; user choice not overridden | YES — one-row header, compact header ≤ 820 px tall, opening timeline policy (session-retained), Outliner split cap no longer written back, Details min 140, ≤ 860 px Boolean/Crop/View menus, ≤ 1279 px arrange menus | E2E `c4-narrow-layout` (5, incl. 1440→720 width sweep), updated timeline/camera/narrow specs | `evidence/c4-layout/before` vs `after` (PNG + metrics.json) | real 200 %: 3 full layer rows (sidebar 276 px is the physical limit); timeline header still wraps to 2 rows ≤ 1024 px wide |
| 4 | Locks: no accidental change from any path; inspect + unlock; mixed selection policy; mask lock; undo | YES — write-path guard + pre-flight refusals; canvas pass-through; list inspection with read-only Details and Unlock; Ctrl+L / Ctrl+Shift+L; mask "Lock path" | `c4LayerLocks` (13), E2E `c4-locks` (6) | E2E screenshots on failure only; manual list below | policy: a mixed selection is refused WHOLE with the locked names; composition-level ops (stage crop, sequence/template switch) are not layer edits and are not blocked |
| 5 | Mask open/close + point order | YES — Closed switch, Reverse direction, Make first point, Move earlier/later (named, distinct from layer order), applied to static path + every keyframe (one undo); open mask keeps the SVG fill contract, implied edge drawn dotted | `c4MaskPathOrder` (8), `BezierPathEditor` (+3), E2E `c4-mask-path-order` (3), `c2-mask-point-type` | — | adding/removing points on an animated path stays refused (explained) |
| 6 | Keyboard focus on canvas mask points | YES — listbox/options, one Tab stop, Home/End, ]/[, arrows move, C type, Delete → neighbour focus, Esc → entry control, visible ring | E2E `c4-mask-keyboard` (3) | — | entering via keyboard focuses the points; via mouse focus stays (by design) |
| 7 | Track Matte pick-whip | YES — drag to layer list / timeline row / canvas layer; valid/invalid + reason; Esc/empty/refused writes nothing; validator-based; Enter → source list | `c4TrackMattePick` (5), E2E `c4-track-matte-pick-whip` (3) | — | writes `target.trackMatte.sourceLayerId`, the V6 Track Matte that renderer, validator, serialization and navigation all read (verified in C5); `matte.sourcePartId` is the legacy clip matte — see `08_…` |
| 8 | Re-parent animated layers keeping the world pose | YES — re-base/bake via the ungroup ladder, verified per sequence, confirmation with key counts before adding keys, refusal on skew; shared bake bug fixed | `c4ReparentAnimated` (10), updated `c2LayerParenting`; E2E `c4-reparent-animated` (1), updated `c2-layer-tree` | — | between frames up to 0.51 (rotating parent) / 0.19 project units; exact (≤ 1e-13) at integer frames |
| 9 | WP-08 masked colour correction | NO — stopped for schema approval (option B proposed); SVG feasibility proven | spike `c4-wp08-spike` | `evidence/c4-wp08-spike/*.png` | needs your schema decision |
| 10 | Sprint 1 coordinate overlay integration | YES — 6 files copied, 8 merged (2 conflicts, both sides kept), View-menu item, toolbar re-fit | sprint unit + `coordinate-overlay` (4) + toolbar sweep | `evidence/c4-layout/after/real-zoom-200.png` (readout visible) | sprint handoff documents not copied |
| 11 | Validation, results, manual list, integration plan | YES | see §2 | — | merge waits for your approval (`10_…`) |

## 2. Test results (after the last source change)

| Gate | Result | Log |
|---|---|---|
| `npx tsc -b` | exit 0 | `logs/c4_tsc.log` |
| `npm run lint` | exit 0; 1 pre-existing warning (`k5MatteVisibility.test.tsx`) | `logs/c4_lint.log` |
| `npm run build` | exit 0 | `logs/c4_build.log` |
| `npx vitest run` | 221 files, 3 136 tests passed | `logs/c4_vitest_full.log` |
| full E2E | **552 passed, 0 failed, 0 flaky** (22.6 min), run from the worktree root | `logs/c4_e2e_full.log` |

Note: the first full E2E attempt was started from the QA folder and stopped at collection
(`v6-motion-core.spec.ts` reads its fixture relative to `process.cwd()`); it was re-run from the
worktree root as in C3. That run found 54 failures, all from two COMBINATION effects, fixed in the tests (no assertion, threshold or retry changed):
- 48 pixel tests: the Sprint 1 X/Y overlay is on by default and draws its axes/origin over the stage pixels they sample → each pixel spec switches the overlay off with its own toggle after the seed and after every reload (`hideCoordinateOverlay`).
- 5 tests (crop, snapping ×3, binding) place layers at ±400–500 units, outside the editor camera's 600×480 framing; at 1280×720 the stage now opens taller, the framing is larger and those layers sat under the left dock → these five tests zoom out two steps first (`keepWideLayoutOnStage`); their assertions read the live scale.

## 3. Performance (production build, same machine/scene/build, 5 runs × 5 rounds)

| Interaction (heavy 150-layer scene) | Base (C3 code) | C4 | Target | Met? |
|---|---|---|---|---|
| Broadcast → Edit: long tasks | 25/25 switches, 166–177 ms | 2/25 switches, 53 ms | none | **NO (close)** |
| Broadcast → Edit: max frame | 167–183 ms | 33–50 ms | — | — |
| Broadcast → Edit: p95 | 16.8 | 16.8 | ≈ 16.8 | yes |
| Edit → Broadcast: p95 / max / long | 16.8 / 16.8 / 0 | 16.8 / 16.8 / 0 | ≈ 16.8 | yes |
| Inspector toggle: p95 / max / > 50 ms frames | 16.8 / 16.8 (one run 50) / 0 | 16.8 / 16.8 / 0 | ≈ 16.8 | yes |
| Left dock toggle: p95 / max / > 50 ms frames | 16.8 / 16.8 / 0 | 16.8 / 16.8 / 0 | ≈ 16.8 | yes |

DOM of the edit chrome on that scene: 11 437 → 3 362 elements.

## 4. User acceptance

Not given. Short manual checklist (≈ 10 min, any scene of yours or `fixtures/`):

1. Lock a layer with its lock button in the layer list → click it on the canvas: the layer
   beneath gets selected. Select it in the list: Details says "locked", fields are greyed, cards
   still open; Delete / F2 / Alt+↑ / Ctrl+G with it in the selection show "is locked". Unlock from
   the banner. Ctrl+Z undoes the lock.
2. Select an image with a mask → LAYER MASKS → tick "Lock path": Edit on Canvas and path buttons
   are disabled, Mode still changes.
3. Mask path: turn "Closed path" off — the canvas shows a dotted closing edge and the mask still
   fills; Reverse direction / Make first point keep the outline; "◀ Earlier / Later ▶" change it.
4. Keyboard: focus "Edit on Canvas", Enter → focus on point 1; ] [ Home End move, arrows nudge,
   C toggles smooth, Delete removes and focus stays on a point, Esc returns to the button.
5. Track Matte: on a layer, TRACK MATTE → drag the spiral handle onto another layer's row (or the
   canvas): green = OK, red = reason; Esc cancels.
6. Parent an animated layer into a rotating one (Parent field): a dialog lists the key counts;
   Cancel changes nothing; Re-parent keeps it moving on the same screen path.
7. Window 1024×768 and a 200 % browser zoom: one-row header, timeline shorter / collapsed at
   200 %, no toolbar scroll; expand the timeline — it stays expanded after Broadcast.
8. A 100+ layer scene: Broadcast → Edit feels immediate; scroll both lists quickly — no blank gaps.
9. The X/Y coordinate overlay and its toggle (View controls, or the View menu on a narrow window).
