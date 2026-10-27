# C8 — manual QA round: fixes, UI requests, findings

Worktree `kcs-master-implementation`, branch `feature/motion/kcs-master-implementation` (no upstream).
Start `858685c`, end `2caabfa` (last source change `a4dab88`). Commits only on this branch; main is untouched (`39f6414`, 22 status
entries). Nothing merged or pushed. USER ACCEPTED: **PENDING** (yours).

Input: the user's run of the 77-item manual QA list on `qa-20261024-1227-514fd13`, plus free-form notes.

## 1. What changed

| # | Report | Root cause (evidence) | Change | Commit |
|---|---|---|---|---|
| 28 | Bring forward/back moves the canvas, not the layer list | SOURCE: the toolbar wrote `zIndex ± 1`; the list shows the array order. MEASURED: equal z-indices made list and paint disagree from the start | Toolbar runs `reorderParts` like the list and the context menu; disabled with a reason at the top/bottom | `fb9af31` |
| 42 | Stroke Align "does not work" | SOURCE: OUTSIDE stored `center` (drew a centred stroke); the real outside renderer drew half the width (OGraf masks twice the width) | INSIDE / CENTER / OUTSIDE, each drawn as named; legacy centred strokes show as CENTER (no visual change). E2E measures the painted band on each side of the edge | `0e5630e`, `1f39445` |
| 26 | Arrow keys do not move the selection | SOURCE: never implemented (only mask points nudged) | Arrows 1 unit, Shift 10, via the arrange authority; a held key is one undo; keyed at the playhead when animated; layer list / timeline / mask editor / text fields / arrow widgets keep their arrows | `f65c8a2` |
| 63 | Paste Animation changes the target's shape | MEASURED: a circle pasted from a 2.5×1 rect jumped to x −500 and took `scale(2.5, 1)` | Relative transfer: position/rotation offset, scale ratio (zero base = 1), opacity/Trim as-is. AGENTS.md §14 updated. Keyframe copy/paste stays exact. (A suspected mask-channel loss was checked and does not exist: per-mask animation lives in `maskChannels`, which the transfer already kept.) | `4f2d713` |
| 3 | 200 % zoom: right sidebar cannot be scrolled | MEASURED: Details pane 134 CSS px, scrolling body 29 px | Container query: below 180 px the pane scrolls as one column. 1440×900 (215 px) unchanged | `e55d431` |
| — | Motion Curves needs scrolling; labels overlap | MEASURED at 1440×900: 946 px content in 858; "−300" on the first point, "value units" on the last, P2 label on the curve, MAX/MIN labels outside the graph | Handle cards beside the graph, value graph full width (760); labels moved off points/curves. Drag maps unchanged. Still scrolls at 1280×720 (by choice: the curve graph would become too small) | `9c80cbb` |
| 70 | 120 fps template gives a 25-frame GIF | SOURCE: by design — GIF shows ≤ 50 fps (2 cs floor); 0.5 s × 50 = 25. Pinned by `gifPlan` tests | Panel states the reason; 60/120 options read "(plays at 50)". Plan unchanged | `db0e0ce` |
| 4 | Dock open/close could be softer | SOURCE: 240 ms (timeline 180 ms) ease-out | 320 ms ease-in-out for both. Found on the way: the timeline eased under reduced motion; it now snaps like the docks | `0967802` |
| — | No top-right notifications for rename, copy/paste… | — | Confirmation toasts removed (see commit for the list); errors, refusals, import/export reports and invisible side effects kept | `b63d5ec` |
| — | Remove mirror/duplicate/delete beside the layer name | — | Header actions removed; Delete / Ctrl+D / context menu remain; Duplicate & mirror moved to a Layer-tab card whose titles say "across the stage's centre line" (#45) | `739d355` |
| 41 | Move opacity to Appearance? | Decision: keep in Transform (layer opacity, animated in the transform group) | Renamed "Layer opacity" | `1adb078` |
| — | Side handles lower; better timeline handle spot | — | Side handles 112 px (fixed, never move with the timeline, stay inside the 160 px stage minimum); timeline handle at its top edge's centre; grip pill no longer painted | `a4dab88` |

## 2. Answers and findings (no code change)

- **#14 FPS change shortens the timeline.** KCS keeps the frame count when the FPS changes; After Effects keeps the duration and re-times keys. Changing it touches every keyframe, preset duration and the scene format → research item.
- **#45 Mirror.** Mirrors across the stage centre lines by design (symmetric copies); in-place flipping is the toolbar's Flip. Titles now say so.
- **"Borders get very thick".** MEASURED: strokes are `vector-effect: non-scaling-stroke`: a 10-unit stroke is 10 screen px on a 2× layer (230 px wide) and on a 0.5× layer (58 px wide). Scaling a layer down or zooming out makes the stroke relatively thick; After Effects scales strokes with the layer. Proposal for a later round (render contract, OGraf parity): strokes scale with the layer, or a per-layer "scale stroke" option.
- **#44, #64, #65, #66 cannot be tested.** SOURCE: the IN/OUT preset card (preset pick, save, export/import, delete) was unmounted from Details in `fe543aa` (V5.1 checkpoint, 2026-08-28); only tests mount it. Not a C8 regression; main has the same state. Restoring it (e.g. in the Layer tab) needs approval.
- **Research items (not this round):** FPS change semantics; proportional keyframe time-stretch (AE Alt-drag); copy/paste-able animation code formats (cubic-bezier, CSS/JS).

## 3. Validation (HEAD `2caabfa`)

| Gate | Result | Log |
|---|---|---|
| `npx tsc -b` | exit 0 | `logs/c8_tsc.log` |
| `npm run lint` | exit 0; 3 warnings: 1 pre-existing (`k5MatteVisibility.test.tsx`), 2 in the untracked C7c evidence script | `logs/c8_lint.log` |
| `npm run build` | exit 0 | `logs/c8_build.log` |
| `npx vitest run` | 228 files, 3 202 tests passed | `logs/c8_vitest_full.log` |
| full E2E (isolated port 5196), run 1 | 606 passed, 5 failed | `logs/c8_e2e_full_1.log` |
| full E2E, run 2 (after `2caabfa`) | **611 passed, 0 failed** | `logs/c8_e2e_full_2.log` |

Run 1 failures:
- Four specs still encoded the pre-C8 behaviour; they were updated in `2caabfa`:
  - a timeline-edge drag at the centre;
  - the removed header actions;
  - 47 shortcut rows;
  - Bring forward on the top layer.
- `c2-mask-pen-close` (hover close target at 100 %) is a **pre-existing flake**. On an exported copy of the pre-C8 tree `858685c` it failed 4 of 30 repeats; on C8 it failed 2 of 18. It passed in run 2. Root cause not investigated in this round; no retry, skip or wait was added.
- The React "unique key" warning from `TrackLaneView` in the log is also in the C7 log.

Changed test expectations (all for an intended behaviour change, none loosened): toolbar arrange
(list-driven, boundary-disabled), stroke alignment (three options, measured bands), animation transfer
(relative values), confirmation toasts (now asserted absent), Details header (no buttons; flows moved to
keyboard / Layer card), handle positions (centred timeline handle, 112 px inset), dock slide windows
(320 ms), C7c probe (the timeline's resize bar counts as covering chrome). Each new behaviour has its own
test; the stroke-alignment and Motion Curves tests were also run against the old code to confirm they
fail there.

## 4. QA candidate

`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.qa-artifacts\qa-20261025-2158-2caabfa\`:
- Production build of the committed tree of `2caabfa` (git archive; the last source change is `a4dab88`, `2caabfa` is test-only).
- Smoke-tested on a temporary local port 5320, since stopped:
  - no page errors, no HMR;
  - `X-KCS-QA-Build` header present;
  - source and parent paths return 404; `/assets/` serves the app shell, not a listing.

The running QA build `qa-20261024-1227-514fd13` on 5310 (local and LAN) is unchanged. Switching needs the user's approval.

## 5. Test guide for the user

`.research/qa/KCS_C8_Test_Rehberi.txt` (Turkish): step-by-step for the items marked "did not
understand" (2, 11, 27, 40, 43, 55, 56; 44/64/65/66 marked blocked), a separate step-by-step mask /
matte / colour-correction section (46–53), and the C8 re-test list.
