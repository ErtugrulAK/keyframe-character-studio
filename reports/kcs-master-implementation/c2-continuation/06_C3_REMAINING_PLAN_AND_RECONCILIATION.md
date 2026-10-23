# C3 — remaining work plan, parent-delete bake review, scope reconciliation

2026-10-22, same worktree/branch, HEAD `39f6414`, nothing committed. **The C3 scope is NOT complete:**
items 6 (panel toggle, mode switch, stage width at real 200 %) and 7 (toolbar density, Inspector
mask/matte layout) are partial. USER ACCEPTED: PENDING for everything.

## 1. Parent-delete bake review

How it works: `releaseChildrenOfDeletedParents` → `dissolveContainer` (the existing ungroup core).
Per sequence scope that the deleted parent or the child animates: a static, unrotated parent is
FOLDED into the child's existing keys (times and easings kept); otherwise the child's local x, y,
rotation, scaleX, scaleY are BAKED into canonical channels — sparsest exact keys first, adaptive
subdivision, per-frame keys as the last resort (recorded in `bakeNotes`) — exact to 1e-10 at every
integer frame of the span. After the release, every released child's world affine is re-checked
at the key frames and gap midpoints of every scope; any mismatch refuses the delete.

| Aspect | Behaviour | Tested |
|---|---|---|
| Canonical channels | bake writes `Track.channels` (x, y, rotation, scaleX, scaleY) with `templateId = scope`; other channels (opacity, trim, masks) untouched — they are not inherited | YES — unit (animated parent, legacy parent), E2E (saved scene has channel keys) |
| Legacy composite keyframes on the PARENT | read through the evaluator, carried into the child as canonical channels | YES — unit (`legacy composite keyframes` case) |
| Legacy composite keyframes on the CHILD | fold path rewrites them with the same affine map; bake path writes channels, which take precedence; the legacy keys stay stored (compatibility) | NOT directly tested |
| Static, unrotated parent over an animated child | fold: key frames and easings unchanged, no new keys, no bake note | YES — unit |
| Moving/rotating parent | bake; dense (one key per frame) only where no sparse equivalent exists — e.g. 41 x/y keys for a 0–40 rotation | YES — unit (all frames 0–60, two sequences), E2E (5 frames) |
| All sequences | only scopes where the parent or the child animates get keys; every other scope gets the folded base pose | YES — unit (`Sequence` + `Intro`, frames 0–60) |
| Procedural IN/OUT presets | presets are per layer and never inherited (`evaluateFrame` adds each layer's own delta on its own world pose), so a delete neither moves nor changes them; preset ids/durations on children are untouched | YES — unit (edit + broadcast `animating_in`, frames 0/7/15/30/45, transform + opacity) |
| Fractional frames (broadcast `custom_timeline` overrides, sub-frame sampling) | exact at integer frames; between them a baked rotating composition can differ slightly | MEASURED (max position deviation, PROJECT UNITS, sampled every 0.25 frame over 0–40): translate-only 7e-15; rotate 0→90° linear 0.024; rotate+move easeInOut 0.097. How many screen pixels that is depends on the camera zoom and the output resolution |
| Undo / Redo | one history step restores parent, children, parentIds and tracks exactly | YES — E2E static (JSON equality) and animated (keys gone after Undo, back after Redo) |
| Serialization | baked keys are ordinary channel keys; save → reload keeps the result | YES — E2E reload, static and animated (screen pose at 5 frames) |
| Anchored child | refused (anchor replaces position) | unit only — `anchor` is not serialized and no UI sets it |
| Skew-requiring pose | refused | unit + E2E |
| Chain of deleted parents | released into the nearest surviving ancestor | unit |
| Delete of several unrelated parents at once | per-parent release, deepest first | NOT directly tested |
| Timeline readability | a dense bake adds one key per frame per channel (as ungroup already does) | superseded by `07_…` §1: announced BEFORE the delete with Cancel |

## 2. Reconciliation of historical gaps with current evidence

| Historical statement (source) | Current evidence | Reconciled status |
|---|---|---|
| WP-02: keyboard-only point editing not implemented (03_WP02) | arrow nudge (WP-06), `]`/`[` next/previous point (C2) | PARTIAL — keyboard path exists; roving focus over canvas points still not built |
| WP-02: V-T11 load-sensitive once (03_WP02) | passed in the logged full runs of 2026-10-22 (`c2_e2e_full.log` 503 tests, `c3_e2e_full.log` final 513 tests) | not reproduced; stays a historical note |
| WP-04: no pre-delete confirmation listing targets (05_WP04) | `DeleteDependentsDialog` (C2), `c2-layer-tree`, `m22`, `wp04` E2E | RESOLVED |
| WP-05: Bring Forward/Send Backward not added (06_WP05) | toolbar Arrange band + tree Alt+↑/↓ (C2) | RESOLVED |
| WP-06: Move Up/Down keyboard reorder missing (07_WP06) | Alt+↑/↓ in the layer tree (C2) | RESOLVED |
| WP-06: right-click pan/menu conflict untouched (07_WP06) | `c2-right-click-pan.spec.ts` | RESOLVED |
| WP-06 / C2: 200 % zoom only approximated | real browser zoom verified (`c3-real-browser-zoom`) — the emulation was NOT equivalent | VERIFIED; stage width at 200 % still open (§3.1) |
| 08: full Vitest/tsc/lint/build and full E2E not run; WP-07 TESTED: PARTIAL | full Vitest 3 074/3 074, full E2E 513/513, tsc/lint/build clean | the "not run" is closed; WP-07 TESTED: PASS on current code |
| C2 handoff: full E2E still running | finished: 501/503; both failures fixed; current 513/513 | CLOSED |
| C2 report: remaining heavy-scene cost is `PartRenderer` | attribution showed timeline rows first; fixed in C3 | CORRECTED |
| C2: deleting a non-group parent leaves a dangling `parentId` | C3 release + tests | RESOLVED |
| C2: Inspector disclosure not retained across Broadcast | C3 `retainKey` + E2E | RESOLVED |
| C2: header wraps at ≤ 720 px | one row at the real 200 % window | RESOLVED for ≥ ~700 px; narrower still wraps naturally |
| WP-01: locks not enforced | unchanged | OPEN (product decision) |
| WP-03: open/close toggle, vertex reorder, free-transform box | unchanged | OPEN (out of the first slice) |
| WP-04: pick-whip, D-04 default | unchanged | OPEN (not in scope) |
| WP-08 masked correction; Sprint 1 integration | unchanged | separate scope |

## 3. Remaining work — plan (not implemented; each needs approval)

### 3.1 Narrow windows: stage first

Current: both docks open on mount (`useDockedPanelEdge(true)` ×2 in `App.tsx`); the left dock opens
on Media (`LeftToolbar`, `'media'`); the timeline clamp keeps the stage ≥ 160 px tall. At the real
200 % window (712×402 CSS px) the stage is 210×139 px.
Proposal (layout default, NOT architectural): at mount, if the stage would be narrower than 400 CSS
px with both docks open, start the LEFT dock closed (its toggle stays visible; the user's later
choice is respected for the session through the existing retained-UI memory). No change at
≥ 1024 px windows. Optional second step: below the same threshold the right dock shows Layers with
Details collapsed until a layer is selected.
Acceptance: real 200 % window → stage ≥ 400 px wide, ≥ 139 px tall; 1440×900 and 1024×720 layouts
unchanged; opening the dock never moves the authored world (camera-invariance, panel-edge specs);
keyboard reaches the dock toggle; screenshots before/after.

### 3.2 Toolbar density and Inspector mask/matte layout

Toolbar — current: 13 bands, 40+ always-visible commands; the "stays visible" contracts are pinned
by `authoring-toolbar.spec.ts`. Proposal: keep every command visible at ≥ 1350 px (contract
unchanged); below 1350 px fold Align + Center + Distribute into one "Align" menu and Rotate/Flip +
Arrange into one "Arrange" menu using the existing `ToolbarMenu` (same authorities, same labels,
keyboard-operable menus). Product decision needed: whether the contract may change at narrow
widths. Acceptance: no horizontal toolbar scroll at 1280 and 1024 px; every command reachable by
mouse and keyboard; existing toolbar specs pass at 1440; new narrow spec.
Inspector — current: Details gets ~180 px at 1440×900 (Outliner ~220, timeline 320); card order is
LEGACY CLIP MATTE → LAYER MASKS → TRACK MATTE; masks are large pills. Proposal: order Layer Masks →
Track Matte → Legacy clip matte (last, labelled as legacy); compact mask rows (name, mode, enabled,
Edit on canvas) instead of pills; when a layer is selected, the Outliner/Details split gives Details
at least half of the right dock (the retained split height still wins once the user drags it).
Acceptance: at 1440×900, selecting a masked image shows the Layer Masks header and its first mask
row without scrolling; legacy controls all still reachable; matte/mask unit and E2E suites pass;
before/after screenshots.

### 3.3 Panel toggle and Edit ⇄ Broadcast hitches (ARCHITECTURAL — separate approval)

Panel toggle — current: the dock edge eases over ~15 frames; each frame commits the whole workspace
layout synchronously (`commitWorkspaceLayout` + `flushSync`) so the camera compensates on every
painted frame (the R2-02 contract: the authored world never moves on any painted frame). After C3,
part re-render is gone; what remains (heavy scene p95 33 ms, max 67 ms) is the synchronous layout
itself. Proposal: during the dock animation keep the stage box fixed and slide the dock as an
overlay (compositor transform), then commit the layout and the camera ONCE at the end — the world
still never moves because the stage box does not change until that single compensated commit.
Changes the dock animation mechanism → architectural. Acceptance: heavy scene panel toggle p95
≤ 16.8 ms and max ≤ 33.4 ms in two runs; `camera-invariance`, `panel-edge-handles`,
`timeline-workspace` specs pass unchanged.
Edit ⇄ Broadcast — current: the Inspector and timeline unmount in Broadcast and remount on return
(one 110 ms long task on the heavy scene; C2/C3 restore their UI memory). Proposal: keep them
mounted inside React 19.3's `<Activity mode="hidden">` while in Broadcast (state kept, effects and
updates suspended while hidden — no edit work during broadcast). Changes the mounting model of the
edit chrome → architectural. Acceptance: Broadcast → Edit with 0 long tasks and max frame ≤ 50 ms
on the heavy scene; no edit playback loop in Broadcast (`c2-mode-transition`); broadcast specs and
the edit-state round trip pass.
