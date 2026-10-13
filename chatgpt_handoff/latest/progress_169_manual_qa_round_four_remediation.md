# Manual QA Round 4 — remediation, part 3 of 4

Branch: `fix/manual-qa-round1-remediation` (existing; PR #9 stays open, NOT merged — user-retest-gated).
Base: `origin/main` @ `8e2df61`. Worktree: `keyframe-character-studio-omp-manual-qa-r1`.

Part 1 (already on this branch, not redone): R4-03 + R4-04 (`c9357c3`), R4-07 (`babf9b3`), R4-14 (`bc49601`),
docs mirror (`6c3717f`).

Part 2 (already on this branch, not redone): R4-15 FPS/timebase (`bd73761`), R4-16 dev freshness (`6bf71c6`),
R4-13 OGraf ZIP hardening (`e5432a5`), R4-06 property tree (`af67021`), docs (`78743a8`).

Part 3 scope: **R4-09** (group selection UX), **R4-05** (keyframe arrow semantics + property-level controls),
**R4-01/R4-02** (editor handles + timeline divider) and **R4-08** (hollow keyframe diamonds).

## Result summary

| Finding | Status | Commit |
| --- | --- | --- |
| R4-09 group selection UX (vector-editor model) | **Fixed** | `c5ce029` |
| R4-05 previous/next arrow semantics + property-level controls | **Fixed + policy pinned** | `20307eb` |
| R4-01 side-panel handle redesign (no timeline overlap) | **Fixed** | `22cbdca` |
| R4-02 timeline divider visual | **Fixed** | `22cbdca` |
| R4-08 true hollow keyframe diamonds | **Fixed** | `22cbdca` (connector geometry in `20307eb`) |

---

## R4-09 — GROUP SELECTION UX (VECTOR-EDITOR MODEL)

### The model

One resolver, `resolveStageSelectionTarget(parts, partId, selectionIds)` in `src/utils/layerGrouping.ts`, is the
only answer to "which layer does this click target", and both canvas entry points — the click (`onSelect`) and
the pointerdown that may become a translate drag (`startTranslateDragForPart`) — go through it:

1. An UNGROUPED layer targets itself (unchanged).
2. A grouped layer targets its **OUTERMOST group ancestor**. The relationship chain (`parentId`) is walked to
   the top, never stopping at the first group, so a layer inside an inner group inside an outer group belongs
   to the outer group — nested groups read as one container.
3. The layer itself is the target only while the selection **already lives inside that group** (a set of
   selected layers, none of them the container, all of them descendants of it). That is the "entered group"
   state, and it is what makes the drilled-in child draggable, keeps a Shift-selected pair of children moving
   as a set, and keeps an Outliner-selected child editable on the canvas.

Consequences, all verified by tests/e2e:

- A plain Select-tool click on a child of an UNSELECTED group selects the GROUP. No child-level selection is
  drawn by that first click (the framed selection stays the container).
- A drag that starts on a child of an unselected group moves the WHOLE container and leaves the group selected
  (the same rule the round-1 "drag inside the selected group" path used, now resolved in one place instead of
  two).
- The round-1 group body drag is intact: a gesture that begins inside the selected group still moves the
  container as one unit, and the click the browser fires after the drag is still suppressed so it cannot steal
  the selection back (`groupBodyDragRef` replaced the old `pendingGroupClickRef`; the "a click that never moved
  selects the layer under the pointer" branch is gone, because a first click must not select the child).
- The empty gap between two children is still inert: parts are hit-tested per child geometry and no
  aggregate-AABB hit rect exists, so a point on no child's geometry never reaches the resolver and can never
  select the container through a hole. Clicking there clears the selection instead.

### The documented drill-in path

Child editing does NOT require ungrouping, through two EXPLICIT direct-selection paths that both leave the same
trace (the layer joins the selection):

- **Double-click a child on the canvas** — the vector-editor drill-in. `PartRenderer` gained `onDrillIn`, wired
  through `StagePartLayers` to `StageCanvas`, which selects the pressed layer itself (and keeps
  `selectedPartIds` in sync so the resolver reads it on the next press).
- **Click the child's row in the timeline Outliner** — the pre-existing path, unchanged.

The convention is stated in the resolver's own documentation and in `PartRenderer`'s pointer contract, so the
canvas surface, not a comment in an e2e file, is the authority a future reader finds.

### Files

`src/utils/layerGrouping.ts` (resolver + shared ancestor chain walk + docs), `src/components/Canvas/StageCanvas.tsx`
(resolver applied to click and drag, `canvasSelectionIds` memo, group-body-drag ref), 
`src/components/Canvas/renderers/PartRenderer.tsx` (`onDrillIn` + one named pointer-handler object),
`src/components/Canvas/StagePartLayers.tsx` (prop pass-through), `src/tests/layerGrouping.test.ts` (7 new tests),
`e2e/group-interaction.spec.ts`, and the three render tests that pass the new required prop.

`isDescendantOf` in `StageCanvas` is deleted: its chain walk is now the shared `ancestorChain` in
`layerGrouping`, used by both the resolver and the group-inside test.

### Tests

- Unit: outermost-group resolution for nested groups; ungrouped layers; "container selected stays the target";
  "selection inside the group targets the layer"; sibling-group isolation.
- e2e (`e2e/group-interaction.spec.ts`): the round-1 drag test unchanged and green; a click on a child of an
  unselected group selects the group with no child selection drawn; the same drag moves the whole container;
  plain click never selects a child while a double-click drills in (and the drilled-in child is then the drag
  target, with its sibling staying exactly still); the empty gap between children selects nothing. The old
  "a click inside the selected group still selects the layer under it" test was replaced by these — the product
  requirement was reversed, not weakened.

## R4-05 — KEYFRAME ARROW SEMANTICS + PROPERTY-LEVEL CONTROLS

### The pinned policy

The per-layer `[◀][+][▶]` (R3-07) already implemented it; the policy is now stated once on
`resolveAdjacentKeyframeFrame` and pinned by tests at both levels:

- **0 keys** → both directions disabled.
- **exactly 1 key** → both disabled while the playhead sits ON it; otherwise only the direction that REACHES it
  is enabled.
- **2+ keys** → `previous` enabled only when an earlier key exists, `next` only when a later one does.
- Navigation **NEVER wraps**.

"Previous"/"next" mean the key strictly before/after the playhead, so standing on a key still steps to its
neighbour instead of no-oping.

### The new property-level controls

Every expanded keyable row now carries the layer row's own `[◀][+][▶]`, scoped to THAT property:

- `resolveChannelKeyframeFrames(track, channel, activeTemplateId)` reads one channel's frames from the SAME
  canonical projection the lane diamonds are painted from (`resolveTrackChannels` → the shared
  `templateKeyframeFrames` rule), and `resolveAdjacentKeyframeFrame` resolves the endpoints. There is no second
  resolution path, so an arrow can neither skip a key the lane shows nor stop on a frame the property does not
  animate.
- `resolveLayerKeyframeFrames` is the union of those per-channel reads, so the layer pair and the property pairs
  can never disagree about what the document contains.
- Accessible names are stable and per-property (`Previous Location X keyframe of Alpha, frame 10` /
  `… (none)` when disabled), and the disabled state is the native `disabled` attribute — no custom styling
  contract.

### Files

`src/utils/timelineMetrics.ts`, `src/components/Timeline/TrackOutlinerRow.tsx`,
`src/components/Timeline/SequencerTimeline.css` (`.ue-channel-controls` strip), `src/tests/timelineMetrics.test.ts`,
`e2e/timeline-property-navigation.spec.ts` (new).

## R4-01 / R4-02 — EDITOR HANDLES + TIMELINE DIVIDER

- **R4-01.** The two dock handles were 26x48px rectangles anchored at the viewport's vertical centre, so a short
  window could push them down over the timeline. They are now the timeline's own compact edge-handle family: a
  20x46px elevated pill carrying a bare chevron, no label, symmetric left and right, keyboard accessible
  (unchanged `button` semantics and labels). They are children of the editor **workspace row** (`.main-layout`)
  and ride a single shared inset below its TOP edge (`--kcs-panel-handle-top: 32px`), the boundary a timeline
  resize never moves — so their vertical position is timeline-independent (the R3-02 contract still holds), they
  can never reach the timeline at any height, and they stay reachable while their panel is hidden. Horizontally
  they still straddle the panel edge they collapse (verified against the drawer's right edge).
- **R4-02.** The outliner divider now speaks the panel-height divider's language: a compact centred pill
  (3x42px, growing to 60px on hover/drag), NEUTRAL at rest (the same tone the height pill rests in),
  strengthened to the KCS accent only while hovered or dragged, inside a fully transparent 6px hit strip. No
  filled bar, no glow, and no colour outside the editor's teal accent.

## R4-08 — TRUE HOLLOW KEYFRAME DIAMONDS

The interpolation connector was ONE continuous line across the lane, drawn at the keyframe centre line, so an
unselected keyframe's hollow outline had the line running through its empty interior — the key read as filled.

`resolveConnectorSegments(frames, frameWidth, glyphGapPx)` (in the timeline metrics module next to the other
timeline math) splits the connector into ONE SEGMENT PER GAP, each cleared of the glyph at either end by
`KEYFRAME_GLYPH_GAP_PX = 9px` — 9px clears even the hovered 8px glyph (whose rotated bounds are ~11.3px, ~14.1px
hovered). The legacy composite span bar is cleared by the same rule. Masking is by geometry, so:

- the glyph stays exactly 8px inside its 18px hit target (nothing was enlarged to hide the line),
- an unselected keyframe is hollow, a selected one is filled with its channel colour, and deselection returns
  it to hollow,
- a gap narrower than two glyph clearances emits no segment at all instead of a sliver,
- several keys on one lane read cleanly.

### Files

`src/utils/timelineMetrics.ts` (`resolveConnectorSegments`), `src/components/Timeline/timelineConstants.ts`
(`KEYFRAME_GLYPH_GAP_PX`), `src/components/Timeline/TrackLane.tsx` (segments on the parent lane, every channel
lane, and the legacy span bar), `src/components/Timeline/SequencerTimeline.css` (R2-11 comment updated),
`e2e/timeline-keyframe-glyph.spec.ts` (new).

---

## Validation run in this part

| Command | Result |
| --- | --- |
| `npx tsc -b --pretty false` | clean |
| `npm run lint` | clean (0 warnings) |
| focused Vitest (`layerGrouping`, `timelineMetrics`, `trackLane`, `appInspectorToggle`, `leftToolbar`, `propertyInspector`) | all passed |
| `npm test` | 158 files / **2387** tests passed, 0 failed, 0 skipped |
| `npm run build` | built |
| `npm run validate:ograf` | valid |
| focused Playwright — `timeline-workspace` (incl. the R2-09 selector from `af67021`, never executed before), `group-interaction`, `timeline-keyframe-glyph`, `left-toolbar-collapse`, `timeline-property-navigation` | 27 passed |
| focused Playwright — `timeline-keyframe-gesture`, `timeline-marquee`, `keyframe-drag`, `graph-accessibility`, `editor-interaction`, `editor-interaction-regressions`, `canvas-interaction-v1` | 23 passed |
| `PORT=5012 CI=1` runs never touched 5173/5000; isolated ports 5187/5188/5189 + API 5012 | see below |
| `PORT=5012 npm run qa:release` | 2 passed (SHA `22cbdca`) |
| `PORT=5012 npm run qa:v6` | 3 passed |
| `npm run check` | green (lint + tsc + 2387 tests + build) |
| `node scripts/check-state-consistency.mjs` | PASS (44 checks) |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |

0 failed, 0 flaky, no new retries, no weakened assertions, no arbitrary sleeps, no skips. Two e2e assertions were
initially wrong for a real reason (CSS `transition` on the divider pill and on the glyph background made a
`getComputedStyle` read mid-transition), and one moved spec referenced a constant that does not exist in its new
file; all three were fixed in the specs themselves (transition settling is awaited with `expect.poll`, not with a
sleep), never by relaxing an assertion.

The user's live QA services were never touched: the dev server on 5173 (pid **50876**) and the API on 5000
(pid **18280**) were still listening on the same pids after every run. Every Playwright run started its own
server on an isolated port (5187 for v6, 5189 for the release gate, 5188 for `CI=1`) with the API on 5012, and
none of them was left listening.

## NOT done in this part (explicit)

- The **full Chromium suite** (every spec in `e2e/`) was NOT run — part 4 owns it. Only the focused spec list
  above was executed.
- Nothing was pushed, and PR #9 was not merged: the branch carries four local commits on top of `78743a8`.
- `track-matte` / `ograf` pixel-parity specs outside the release gate were not run in this part.
