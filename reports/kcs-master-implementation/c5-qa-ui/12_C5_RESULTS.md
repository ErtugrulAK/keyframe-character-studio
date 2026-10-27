# C5 — usability / UI fixes before manual QA

Worktree `kcs-master-implementation`, branch `feature/motion/kcs-master-implementation`, HEAD `39f6414`.
Nothing committed, staged, merged or pushed. Main and Sprint 1 sources untouched. Baseline status of
this round: `00_baseline_status.txt` (176 entries, accepted as the starting point); after:
`01_status_after.txt`. USER ACCEPTED: **PENDING** (yours). WP-08: still waiting for your schema decision.

## 1. Request | Implemented | Test | Browser evidence | Gap

| # | Request | Implemented | Test | Browser evidence | Gap / limitation |
|---|---|---|---|---|---|
| 1 | Marquee beyond mounted rows; auto-scroll; selection/focus/names kept; keyboard reveal; layer search | Marquee hit-tests the lane LAYOUT (`timelineLaneLayout.ts`, which `TrackLane` now also renders from) for every track, mounted or not; edge auto-scroll (gesture-scoped timer); unmounted track heights estimated from the same layout. Layer search in the Layers header over the scene data (case/accent-insensitive, ancestors kept, ↓/Enter → first match, Esc clears). Tree rows: concise accessible name (name + states) | unit `c5QaUiHelpers` (lane layout, search); E2E `c5-long-list-selection` (4) + `timeline-marquee` (6) + `c4-long-lists` | E2E only | Browser Ctrl+F still finds only mounted rows — the layer search is the supported way. The timeline lanes are not filtered by the search (only the Layers panel) |
| 2 | Group / parent / matte distinct; delete scope said before; drag line vs "Parent to …"; pick-whip field | Delete: a GROUP lists the layers it takes (one existing dialog, button "Delete N layers"); a plain PARENT keeps its children — the context menu says "Delete (Keeps 1 Child)" / "Delete Group and 2 Layers" before anything happens. Drag: line at the row edge = reorder (hint names a parent change), dashed row + in-row label "Parent to “X”" / "Move into group “G”", refused target shows the reason in the row. Pick-whip stays on `trackMatte.sourceLayerId` — verified as the field renderer, validator, serialization, navigation and badge use; reports 08/11 corrected | unit `c5QaUiHelpers` (delete scope, Track Matte authority); E2E `c5-relations-edit-target` (drag, delete), updated `c2-layer-tree`, `authoring-layer-group`, `c3-parent-delete` | E2E only | AGENTS.md §11 / kcs-track-matte skill still call `matte.sourcePartId` canonical — doc update proposed for the merge, not edited |
| 3 | "What am I editing?" | One description (`utils/editTarget.ts`) feeds a compact top-left stage strip ("MASK EDITING · Photo / Mask 1" + Finish; "MATTE SOURCE · Circle · matte of Photo" + Back to Photo; "DRAWING MASK", "DRAWING SHAPE · Pen · 3 points" + Finish/Cancel; "NEW SHAPE · Rectangle"; "LAYER · name") and the Inspector session row. The strip text is pointer-transparent (only its buttons take presses). Esc = Finish (one level). An uncommitted mask-pen draft is never dropped silently (toast with the point count); freeform already reported | unit `c5QaUiHelpers` (edit target); E2E `c5-relations-edit-target` (strip ⇄ Inspector, pass-through, matte source), updated `wp06` | `evidence/c5-ui/after/mask-editing.png` | — |
| 4 | UI consistency in the existing theme | Inspector buttons: ONE geometry (24 px, 6 px radius, same type) — "primary" is now the selected state (accent fill + border + text), not a bigger glowing pill. Toolbar: an option switched ON (grid, snap, overlay) = quiet fill + accent glyph, no outline; the current tool keeps outline + fill + lower bar. Mask rows: aligned Enabled / Lock path / Edit-on-canvas icon buttons. Matte summary moved next to the Track Matte card (Legacy stays last, labelled). Layers list: eye is a real switch (name, pressed, reason), long names in the tooltip, name keeps the room (badges shrink first), collapse buttons titled, Hide/Show + Lock/Unlock in the context menu (keyboard via Shift+F10). Contrast: timeline "LAYERS" label 2.26 → token, playhead number 2.49 → dark on teal. Focus: vertex handles ring in the focus colour, duration field and search field ring their box | `c5-ui-audit` (measurement) | `evidence/c5-ui/before|after/*` (window, inspector-full, layers, toolbar, timeline, mask editing) + `audit.json` | Audit is automated (WCAG ratio, names, focus marks); it does not replace your visual judgement |
| 5 | Narrow screens, panel space, perf | Layers/Details splitter is now a real splitter: Tab stop, name + value, ↑/↓ (Shift faster), Home, End = all the room for the list, Enter / double-click = maximise and back; a user-sized split is honoured over the short-window caps (Details shrinks to its header). Stage crop availability no longer evaluates every layer's world bounds on each provider render (lazy rect, first-hit check) | E2E `c5-relations` (splitter End), `c4-narrow-layout`, `c3-narrow-start`; perf series | `evidence/c5-layout/after/*` incl. `*-list-enlarged.png` + `metrics.json`; `evidence/c4-mode/c5-series-1..5` | Real 200 %: 3 rows by default, **5 full rows** after End (sidebar is 276 px tall). Mode switch: **1 of 25** Broadcast→Edit switches still a 54 ms long task (C4: 2 of 25) — not met |
| 6 | Overlay ON tests | Pointer transparency of every overlay node; a press on the axes/origin reaches the layer; drawing a shape across the origin; dragging a mask point lying on the origin marker; Broadcast shows no overlay/readout/strip/stage chrome; the exported OGraf package contains no editor-chrome markers | E2E `c5-overlay-interaction` (3) + existing `coordinate-overlay` (zoom/pan/resize/hierarchy/toggle) | E2E only | GIF export is raster; covered by the shared renderer path, not separately asserted here |
| 7 | WP-08 wording | `09_WP08_DESIGN_PROPOSAL.md`: copy/duplicate copy effects with id + `maskId` remapping; animation transfer must NOT change effects, masks, matte, geometry; tests planned for both | — | — | WP-08 not implemented (schema decision pending) |

## 2. Test results (after the last source change)

| Gate | Result | Log |
|---|---|---|
| `npx tsc -b` | exit 0 | `logs/c5_tsc.log` |
| `npm run lint` | exit 0; 1 pre-existing warning (`k5MatteVisibility.test.tsx`) | `logs/c5_lint.log` |
| `npm run build` | exit 0 | `logs/c5_build.log` |
| `npx vitest run` | 222 files, 3 148 tests passed | `logs/c5_vitest_full.log` |
| full E2E (worktree root, isolated port 5196) | **563 passed, 0 failed, 0 flaky** (26.3 min) | `logs/c5_e2e_full.log` |

Intentional test updates (contract changes, no assertion weakened): `authoring-layer-group`,
`c3-parent-delete` (group delete now confirms with the listed layers), `c2-layer-tree` ("Parent to"
replaces "Nest into", plus the in-row label), `wp06-narrow-layout-keyboard` (strip button "Finish"),
`wp04-matte-navigation`, `wp06` (two "Back to Landscape" buttons now — the test names the Inspector's).

The first full run had 4 failures (559 passed), all from this round's changes, fixed and re-run in full:
- `editor-interaction` Boolean delete: a Boolean group now lists its operands before the delete (intended) → the test confirms the dialog.
- `real-user-verification` BUG 3: `getByText('The Cow').first()` now hit the stage strip's name (pointer-transparent) → the test clicks the Layers row, as its own comment says.
- `c4-track-matte-pick-whip`: the matte summary now sits above the Track Matte card, pushing the handle to the edge of the Details scroll area → the helper scrolls the handle into view first.
- `m22` E2E-9: the new eye button was disabled for a layer without a track, where the old icon was a clickable no-op → PRODUCT fix: the button stays enabled (no-op, reason in the tooltip).

A React key warning from `TrackLaneView` appears once in the log; it was also present in the C4 full run (not introduced here; not investigated further).

## 3. Performance (production build, 150-layer scene, 5 runs × 5 rounds, no tracing)

| Interaction | C4 | C5 | Target | Met? |
|---|---|---|---|---|
| Broadcast → Edit: long tasks | 2/25 (53, 51 ms) | 1/25 (54 ms) | none | **NO** |
| Broadcast → Edit: max frame | 16.8–50 | 16.8–50.1 | — | — |
| Broadcast → Edit: p95 | 16.8 | 16.8 | ≈ 16.8 | yes |
| Edit → Broadcast: long tasks / max | 0 / 16.8 | 0 / 16.8 | none | yes |

What remains (traced, unminified run `evidence/c4-mode/c5-traced`): React mounting the Edit chrome
(~3 000 elements) and the first layout it forces. Removing it needs a different architecture
(keeping the Edit chrome mounted while hidden, or splitting the mount over frames) — not done, as
instructed. The stage-crop bounds fix removed ~24 ms of CPU per provider render (it ran on every
playback frame too), but that work was not inside the remaining long task. Measurement cost was kept
out: the series runs without tracing/profiling; the traced run is used only for attribution.

## 4. Layout (`evidence/c5-layout/after/metrics.json`)

| Surface | Stage | Layer rows (default → after End on the splitter) | Toolbar hidden | Page h-overflow | Camera after splitter |
|---|---|---|---|---|---|
| 1440×900 | 708×461 | 6 → 12 | 0 | 0 | unchanged |
| 1024×768 | 424×419 | 6 → 11 | 0 | 0 | unchanged |
| 768×900 | 507×492 | 6 → 12 | 0 | 0 | unchanged |
| real 200 % | 462×276 | 3 → 5 | 0 | 0 | unchanged |

Enter on the splitter restores the previous split in every case. Panel choices are session-retained.

## 5. User acceptance

Not given — manual QA follows (first round below in the chat).
