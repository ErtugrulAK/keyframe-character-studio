# C7 — canvas stability, timeline property tree, Inspector tabs: results

Worktree `kcs-master-implementation`, branch `feature/motion/kcs-master-implementation` (no upstream).
Commits only on this branch; main is untouched (`39f6414`, 22 status entries). Nothing merged or
pushed. USER ACCEPTED: **PENDING** (yours).

## 1. What changed

| # | Request | Result | Commit |
|---|---|---|---|
| 1 | Canvas "teleports" on sidebar/timeline toggle | Frame-by-frame (paused clock + real CDP screencast at DPR 1/1.25/1.5): world objects never moved; the coordinate readout and the edit-target strip jumped ~360 px when the stage box changed. They now ride the sliding dock edge (`--kcs-dock-*-overlap`). | `8a99055` |
| 2 | Canvas shimmer while resizing the timeline | The fixed 600×480 viewBox plus a CSS scale re-rasterised the SVG at a new scale every frame. The edit camera now lives in the viewBox (CSS transform = translate only) and the camera centre is snapped to device pixels: raster scale constant during a height drag. | `8a99055` |
| 3 | "Restored from this browser's autosave" in the header | Chip removed; the provenance is in the save badge's tooltip. | `e395a8a` |
| 4 | Parent too prominent; right sidebar layout | Details split into Radix Tabs: **Properties** (transform, paint, text, Trim Path, geometry, effects), **Masks** (layer masks, Track Matte, legacy clip matte, with an in-use count) and **Layer** (Hierarchy/Parent, Animation Data). Closed cards are one header row (whole row toggles); dropdowns 28 px/11 px like the fields. A mask/matte session opens Masks; an effect-only mask stays on Properties. | `4080745` |
| 5 | Sidebar handle overlaps a dropdown button | Two overlaps fixed: the right dock handle covered the layer list's "Template Elements" chevron (12 px gutter); the timeline collapse handle covered the Inspector's last row (now sits left of the Inspector and rides its edge). | `a24faf9`, `1abfd3d` |
| 6 | Timeline layer dropdown property rows | Position (X, Y), Scale (X, Y), Rotation, Opacity; Trim Paths only when the layer uses it or holds Trim keys; one group per mask, named after it (Path, Feather, Opacity, Expansion). Closed groups show summary ticks. Tree, lanes, marquee and row heights share one row model. | `6286fe2` |
| 7 | Stopwatch shows a big square on hover/click | 20×20 button, hover tint, focus ring only for the keyboard. | `6286fe2` |
| 8 | Use a UI library | `@radix-ui/react-tabs` 1.1.22 (pinned; 1.2.x was under two weeks old). Other Radix primitives not added this round. | `4080745` |

## 2. Limits / still open

- Ctrl+Z while focus is inside an Inspector field stays with the field.
- No Pencil (freehand) tool.
- Colour correction: images only, not animatable, OGraf export refused.
- Only Tabs moved to Radix; selects, tooltips and popovers are still native/in-house.

## 3. Validation (HEAD `bf21812`)

| Gate | Result | Log |
|---|---|---|
| `npx tsc -b` | exit 0 | `logs/c7_tsc.log` |
| `npm run lint` | exit 0; 1 pre-existing warning | `logs/c7_lint.log` |
| `npm run build` | exit 0 | `logs/c7_build.log` |
| `npx vitest run` | 228 files, 3 192 tests passed | `logs/c7_vitest_full.log` |
| full E2E (isolated port 5196) | **584 passed, 0 failed, 0 flaky** | `logs/c7_e2e_full_2.log` |

The first full E2E run after the tabs (`logs/c7_e2e_full_1.log`) had 50 failures: 47 specs reached a
card that moved to another tab, one (colour correction) found a real bug — editing a freshly drawn
effect-only mask switched to the Masks tab — fixed in `4080745`, and BUG 5 read the zoom from a CSS
`scale()` that the C7 camera no longer writes (now reads the camera zoom and the rendered world
scale). No assertion was removed or loosened.

New tests: `c7DetailsTabs` (unit); C7 cases in `c6-dock-visual-continuity` (edge chrome, raster
scale, timeline handle gap per frame); `panel-edge-handles` now treats controls as content.

## 4. QA candidate (not switched)

`C:\Users\ertugrul.ak\Desktop\kcs-qa-artifacts\qa-20261024-0104-bf21812\` — production build of the
committed tree of `bf21812`, read-only, smoke-tested on a temporary local port (no page errors, no
HMR, source and parent paths 404). The running QA build `qa-20261023-2059-6c5d02e` on 5310 (local
and LAN) is unchanged.
