# KCS — ChatGPT upload one-file: MANUAL QA ROUND 5 REMEDIATION (R5-01…R5-15)

Generated from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`.
Single current truth: **round 5 is implemented and validated on the frozen revision; PR #9 is updated and
NOT merged; the user retest on 5173 is the merge gate.** Nothing was released, tagged or published.

---

## 1. Where this work lives

- Canonical stable checkout (untouched, still on `main` @ `8e2df61`, clean): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
- Branch: `fix/manual-qa-round1-remediation`, base `origin/main` at `8e2df61`
- Branch head: `1168ceea0fe409f153221749b3e0b890316835cf` (`1168cee`), pushed to `origin` by a
  **fast-forward** (`42acf1e..1168cee`), explicit refspec, no force, no rebase
- **Validated code + tests head: `0e81ff3`** (`0e81ff36…`). `1168cee` adds the round record and the
  changelog only — no product source, test, package, workflow or config byte
- Rounds covered: round 1 A–J, round 2 R2-01…R2-12, round 3 R3-01…R3-13, round 4 R4-01…R4-16,
  round 5 R5-01…R5-15

Round-5 commits, in order:

| Commit | Finding(s) |
| --- | --- |
| `ff17cad` | R5-05 — a timeline keyframe drag no longer moves the playhead |
| `8b2abb3` | R5-08 — a marquee over grouped children normalizes to the group |
| `0e310dd` | R5-03 (first attempt — CSS `height` transition) |
| `556fdc8` | docs — round-five part-one changelog record |
| `56fef66` | R5-03 (shipped fix — frame-committed JS ease, replacing the CSS version) |
| `43e02e2` | R5-01, R5-02, R5-04, R5-06, R5-07 — panel-boundary handles, the declared editor stack, keyframe control visuals |
| `5d58f04` | R5-14, R5-15 — compact Transform Details, paint order off the panel |
| `50404a8` | R5-09, R5-10, R5-11 — align, distribute, rotate, flip |
| `0e81ff3` | R5-12, R5-13 — nine toolbar bands, shortcut-reference redesign |
| `1168cee` | docs — the round-five record (this file's companion) |

---

## 2. R5-01 … R5-15 — root cause → fix → where it is proven

**R5-01 — a panel show/hide handle sat over the panel's own content.** *Root cause:* the handle was
anchored to the inner content of the panel it collapses, so a label, a card or a row could end up
underneath it. *Fix:* each handle is anchored outside the panel it collapses — the drawer's RIGHT edge,
the inspector's LEFT edge — while its vertical anchor stays the workspace row's top edge, so a timeline
resize still cannot move it (R3-02 / R4-01 unchanged). *Proven by:* `e2e/panel-edge-handles.spec.ts`
(327 lines) — placement and pointer reachability of every docked surface; `e2e/left-toolbar-collapse.spec.ts`
migrated to the moved handle.

**R5-02 — the header painted over its own dropdowns.** *Root cause:* the header was a flex item carrying the
same `z-index: 100` the handle layer used. Its z-index counted even while unpositioned, so it became a
stacking context at the handle layer and **trapped the Export dropdown and the GIF panel inside itself**;
the handle then won the tie on DOM order and painted over them. *Fix:* the editor states its stack once, as
tokens in `src/kcsEditorTheme.css` — `--kcs-layer-panel: 90`, `--kcs-layer-handle: 100`,
`--kcs-layer-chrome: 200`, `--kcs-layer-chrome-overlay: 300` (dialogs/menus/toasts stay at 1000+). The
docked panels keep the value they already had (90); the header moves 100 → 300. *Proven by:*
`e2e/panel-edge-handles.spec.ts`.

**R5-03 — collapsing the timeline teleported its edge (and drifted the world while it did).** *Root cause:*
a browser-side `transition: height` moves the edge during the frame's own style/layout step, which leaves
the stage's corrected camera to a `ResizeObserver` notification that can arrive a frame late under load —
measured at **5.883px** of transient world drift. *Fix:* the ease lives in the timeline (`animateTimelineEdge`,
`TIMELINE_EDGE_TRANSITION_MS = 180ms`, monotone ease-out cubic) and **every frame commits through the same
`commitWorkspaceLayout` authority** the height drag uses. *Proven by:* the R5-03 assertions in
`e2e/camera-transition-stability.spec.ts` — the edge visits intermediate heights, moves in ONE direction the
whole way, and the edge handle stays within 2px of the moving edge on every frame.

**R5-04 — a selected keyframe showed a second square.** *Root cause:* a `.selected` box-shadow ring drawn
around the key's **18px hit target**. *Fix:* the ring is deleted; keyboard focus keeps its ring through
`:focus-visible`. The hit target is unchanged — only the redundant paint is gone. *Proven by:*
`e2e/timeline-keyframe-controls.spec.ts`.

**R5-05 — a keyframe drag moved the playhead.** *Root cause:* every keyframe diamond's `onClick` carried an
unconditional `onSetFrame(...)` beside `handleKeyframeClick`, and a real drag ends with a browser `click` on
the pointer-captured element — so the closure read the key's **post-drag** frame. The property diamond's
`onPointerDown` also wrote the cursor at press time. *Fix:* the cursor write moved inside the single
drag-aware click authority `handleKeyframeClick` (which already suppressed a post-drag click's selection);
a travelled press suppresses the cursor write with it, a press that never moved is still the click that
reveals its frame, and the prop diamond's `pointerdown` no longer writes the cursor at all. *Proven by:*
§4 below and `src/tests/trackLane.test.tsx`.

**R5-06 — a disabled endpoint arrow looked interactive.** *Root cause:* it kept a not-allowed cursor.
*Fix:* the normal disabled language — greyed, `disabled`, named `"(none)"`, no forbidden cursor. *Proven by:*
`e2e/timeline-keyframe-controls.spec.ts`.

**R5-07 — a property row's strip borrowed the channel colour.** *Fix:* the strip is the neutral `[◀][+][▶]`
trio — a plain `+` where a coloured keyframe glyph sat, no coloured tick, no tinted label. The channel colour
stays on the lane diamonds and their connector; hierarchy, indentation and row/lane alignment are unchanged.
*Proven by:* `e2e/timeline-keyframe-controls.spec.ts`.

**R5-08 — a marquee over grouped children selected the children (and an empty gap could select the group).**
*Root cause:* the canvas committed the RAW `getPartsInMarquee` hit list, so `selectedPartIds` became the
children and the overlays drew child frames; and `getPartsInMarquee` measured the geometryless container
through the synthetic ±32 `fallbackBounds()`, which is why an empty gap selected the group. *Fix:*
`resolveMarqueeSelection` (`src/utils/layerGrouping.ts`) folds every hit through the existing
`resolveStageSelectionTarget` — the same authority the canvas click uses — with the selection that was live
when the box began, and drops `isGroup` containers from the raw hits. *Proven by:* §5 below.

**R5-09 / R5-10 / R5-11 — align, distribute, rotate and flip did not exist.** *Fix:* one pure planner plus
one writer, so a command is exactly one undo step — see §3 for the full semantics. *Proven by:*
`src/tests/vectorArrange.test.ts`, `src/tests/vectorArrangeCommands.test.tsx`, `src/tests/shortcuts.test.ts`,
`e2e/authoring-toolbar.spec.ts`.

**R5-12 — the toolbar's structure was unannounced and its bands were uneven.** *Fix:* the strip is organised
into the **nine** command bands a motion editor reads left to right — canvas tools, create, Boolean, layer
group, align, distribute, rotate and flip, arrange, view — and every band is one `role="group"` with its own
accessible name. A band whose commands are variants along one axis (six align edges, two distribute axes) is
ONE trigger that opens a menu; a band of distinct one-shot commands (rotate CCW/CW, flip H/V) keeps one
button per command. The toolbar owns no document state and holds no second copy of any command. *Proven by:*
`e2e/authoring-toolbar.spec.ts`, `src/tests/authoringToolbar.test.tsx`.

**R5-13 — the shortcut reference was a second copy of the keymap.** *Fix:* it is now a FILTER over the one
shortcut table (`utils/shortcuts`): typing narrows rows by label, detail, category or the formatted keys;
each category is a labelled section with its row count; each gesture is a platform-formatted chip (Windows/Linux
reads `Ctrl+Shift+←`, macOS reads `⇧⌘←`); a command owned by a focused control is listed under Timeline with
its scope named; an empty result says so. It uses the shared focus trap and opener restoration.
*Proven by:* `src/tests/shortcutReferenceDialog.test.tsx`.

**R5-14 — the Transform section was repetitive.** *Fix:* `Position [X][Y]` followed by ONE row of
`[Rotation][Scale][Opacity]`, three cells on one fractional grid that keep their own column at every
inspector width (a quarter narrower than the stacked rows, still one line at the 250px dock floor).
Removed: `Reset 0°` (a second control writing the field's own value), `Add Keyframe` (keyframing is the
timeline property row's authority), and the labelled `Locked`/`Free` button — the aspect lock stays
reachable as one compact glyph in the Scale cell's header, because removing it outright would make a free,
non-uniform canvas corner drag unreachable. The model is untouched: `scaleX` and `scaleY` remain independent
channels with their own lanes and keyframes. *Proven by:* `e2e/inspector-transform-details.spec.ts`,
`src/tests/transformPresentation.test.tsx`.

**R5-15 — the layer's paint order was repeated in Details.** *Fix:* the raw `Index 1` readout and the second
Bring Forward / Send Backward strip are gone; arrange lives on the authoring toolbar's own group, which
writes the same `handleZIndexChange` path, and the now-dead `TransformZIndexCard` plus the prop it fed are
deleted. *Proven by:* `e2e/layer-index-persistence.spec.ts` now observes the STAGE'S PAINT ORDER and drives
the toolbar's Arrange group — the same write path, a stronger observable.

---

## 3. VECTOR COMMAND SEMANTICS (R5-09, R5-10, R5-11)

Two modules, one authority each:

- `src/utils/vectorArrange.ts` — **pure planning only**. It decides the world-space patch every target
  receives and writes nothing.
- `src/hooks/useVectorArrangeAuthoring.ts` — writes that plan through the ONE transform write path
  (`updateCurrentTransform`: world space in, container-local out) inside ONE batch interaction, so a command
  is exactly one undo step and one history entry, on animated and static layers alike.

**What a target is.** A **layer** of the canonical selection, measured in world space by
`getLayerWorldBounds` — the group-aware measurement the grouping authority already uses, so a container is
arranged by the box its children define and the two can never disagree. A layer whose ancestor is ALSO
selected is dropped from the plan: the ancestor already carries it and writing both would move it twice.
The ancestor relationship is read from `utils/partBinding`, the one place `parentId`/`booleanGroupId`
precedence is defined.

| Command | Reference / pivot | Rule |
| --- | --- | --- |
| ALIGN (6 edges) | the COLLECTIVE selection bounds | only the aligned axis is written, so the other axis cannot drift; a target already on the edge receives NO write, so a property that did not move creates no keyframe. There is no reference-object ("key object") authority in this editor; inventing one here would be a second selection rule. |
| DISTRIBUTE (2 axes) | needs **≥ 3** measurable targets | ordered by box CENTRE, ties broken by layer id; the two extreme targets keep their positions (the span never changes); every interior centre sits at an even step, `first + (last − first) · i / (n − 1)`. Distribution by centres, not by gaps — defined for overlapping layers too. |
| ROTATE ±90° | the COLLECTIVE selection centre | one pivot for the whole selection turns it as one rigid body; each new place comes from `rotateAboutWorldPivot` — the same pivot-rotation authority the canvas gizmo uses — evaluated against the transform captured BEFORE the command, so the pivot cannot drift. |
| FLIP H/V | the COLLECTIVE selection centre | world placement preserved: a single target flips in place about its own visual centre, a multi-selection mirrors as one picture. The sign law is `utils/mirror`'s (`scaleX`/`scaleY`/`rotation` negate), applied about the origin line then translated onto the flip axis, so a rotated, non-uniformly scaled layer mirrors exactly instead of approximately. |

**Keys** (four of the commands carry a binding; chosen so no plain tool letter is claimed and no binding is
a prefix of another):

| Gesture | Command |
| --- | --- |
| `mod+shift+arrowleft` | Rotate 90° counter-clockwise |
| `mod+shift+arrowright` | Rotate 90° clockwise |
| `shift+h` | Flip horizontal |
| `shift+v` | Flip vertical |

Align and distribute are deliberately **toolbar-only**: their target depends on the measurable selection (an
align of two layers and a distribute of three are different commands with the same intent), so a single
letter would have to guess. They are absent from the shortcut reference rather than documented with a fake
key.

---

## 4. KEY-DRAG / PLAYHEAD PROOF (R5-05)

`e2e/timeline-keyframe-gesture.spec.ts` drives the real editor with the authoring cursor scrubbed to
**frame 18** between two keyframes, and asserts `.playhead-line[data-frame]`:

1. a **single-key** drag released **before** the playhead keeps the cursor at `18` during the drag, at the
   release AND after further pointer movement (which changes nothing);
2. a **two-key** drag **crossing** the playhead and released **after** it does the same;
3. one `Ctrl+Z` returns both keys to their pre-drag frames.

Unit level: `src/tests/trackLane.test.tsx` (42 lines added) pins the click authority — a travelled press
suppresses the cursor write, a press that never moved still reveals its frame.

The defect's shape, stated once: the browser fires a `click` on the pointer-captured element after a real
drag, so an unconditional `onSetFrame` in that handler reads the key's **post-drag** frame; and a
`pointerdown` that writes the cursor moves it at press time. Both writes now live in the one drag-aware
click authority, and the prop diamond's `pointerdown` writes nothing.

---

## 5. GROUP-SELECTION NORMALIZATION PROOF (R5-08)

`e2e/group-interaction.spec.ts` (142 lines added) asserts against the real DOM:

1. a marquee across the grouped children selects the **group**: ONE container frame, drawn from the
   click-selected frame's exact geometry (children aggregate), and **no child-level frame**;
2. the same box dragged across the **empty gap between the children** selects **nothing** — the
   `fallbackBounds()` placeholder is no longer a candidate rectangle;
3. a marquee across a **nested** child normalizes to the **outermost** container;
4. the two explicit drill-in paths still select the layer itself and draw its OWN frame — a canvas
   **double-click** and a click on the child's row in the timeline Outliner.

All four fail on the unfixed commit. Unit level: `src/tests/layerGrouping.test.ts` (51 lines added) pins
`resolveMarqueeSelection` — the fold through `resolveStageSelectionTarget`, the `isGroup` drop, and the
selection captured before the press clears it.

---

## 6. CAMERA-INVARIANT TRANSITION PROOF (R5-03) — and the round's one open item

**What R5-03 proves (green).** `e2e/camera-transition-stability.spec.ts` samples the client position of
authored world points on EVERY animation frame across a chrome transition and requires every frame to hold
the world within **1px** of the first sample and the magnification within `0.002`. The R5-03 section added by
this round asserts the timeline edge specifically: it visits intermediate heights, travels in ONE direction
with no counter-motion, and the edge handle stays within 2px of the moving edge on every frame. The measured
traces of the timeline collapse and expand — and of every other toggle — report `worstDelta=0.000px`.

**The open item, reported exactly as measured.** The FULL Chromium suite contains 396 tests and runs on **8
workers**. Three runs of it on the frozen revision `0e81ff3`:

| Run | Command | Result |
| --- | --- | --- |
| 1 (already on record) | `CI=1 PORT=5013 npx playwright test --retries=0` | **393 passed / 3 failed** — `e2e/camera-invariance.spec.ts:300`, `e2e/camera-transition-stability.spec.ts:231`, `e2e/camera-transition-stability.spec.ts:259` |
| 2 (this record) | same | **394 passed / 2 failed** — `:231`, `:259` |
| 3 (this record) | same | **394 passed / 2 failed** — `:231`, `:259` |
| Isolation A | `… playwright test e2e/camera-transition-stability.spec.ts e2e/camera-invariance.spec.ts --retries=0` (2 workers, 9 tests) | **9 passed / 0 failed**; all 12/12 traces `worstDelta=0.000px` |
| Isolation B | `… playwright test e2e/camera-transition-stability.spec.ts --workers=8 --retries=0` (8 workers, 4 tests) | **4 passed / 0 failed**; all 12/12 traces `worstDelta=0.000px` |

The two failing samples, exactly as the reporter printed them:

```
inspector show: frame 6 t=150.9ms alpha x drifted -28.859px (stage 885.3px)      [run 2, spec line 231]
repeat Show Inspector: frame 5 t=137.8ms alpha x drifted -28.859px (stage 1221.3px)  [run 2, spec line 259]
inspector show: frame 6 t=154.2ms alpha x drifted -28.859px (stage 885.3px)      [run 3, spec line 231]
repeat Show Inspector: frame 6 t=160.3ms alpha x drifted -28.859px (stage 1221.3px)  [run 3, spec line 259]
```

with `worstDelta=28.859px` and `magnificationSpread=0.00000` on both samples in both runs, against the
spec's `<= 1px` bound. Every other trace in every run — `inspector hide`, `repeat Hide Inspector`, the left
toolbar, the timeline collapse and expand — reported `worstDelta=0.000px`, and the magnification never moved
on any frame of any run.

**What the number is.** `28.859px` is exactly half of `57.71875px`, the stage box's own width delta for the
frame one step earlier (`944 → 886.28125` and `1280 → 1222.28125`; the sample reads the box later in the same
frame, at `885.3` / `1221.3`). The panel is on the right, so the stage's right edge gives up the width and the
stage's centre moves left by half of it — the arithmetic of a world point painted at the box's centre while
the box has already narrowed. It is the same class of transient R5-03 measured on the timeline's CSS
`height` transition (5.883px there, because the timeline's per-frame delta is smaller): one painted frame of
the authored world against a box it no longer had, because the correction rides a `ResizeObserver`
notification that can land after the paint when the main thread is busy.

**What this record does and does not claim.**

- The failing assertion (`expectStable`, `DRIFT_TOLERANCE_PX = 1`) and the two failing tests are the
  **pre-round-5 text**; this round only ADDED a timeline section to that spec and extended `movingFrames` to
  also treat a height change as an animation. The inspector samples' stage height is constant (`281.0`).
- The measured transition — `.property-inspector`'s `transition: width 240ms ease, …` — is **unchanged** by
  this round: `43e02e2` changed only that rule's `z-index` from the literal `90` to `--kcs-layer-panel`,
  whose value is also `90`.
- It is **invisible in isolation** at 2 and at 8 workers with `worstDelta=0.000px`, and it reproduces in
  **every** full-suite run at this revision (3/3) at the same offset — a higher reproducibility than the
  round-4 record, where the same command's repeated full run was clean and the single sample appeared once
  (`camera-transition-stability.spec.ts:238`) and did not return.
- **No tolerance was widened, no retry added, no sleep inserted and no test skipped**; the spec bytes are
  untouched, as directed. The reviewer sees it as an open item, not as a passing gate: a clean full-suite run
  at this revision has not been observed.
- The one diagnostic this record does **not** contain: a full-suite run on the pre-round-5 revision under the
  same 8-worker load, which would need another checkout (out of this part's scope). So the record shows the
  reproducibility change without attributing it.

---

## 7. FPS/TIMEBASE CONTRACT (literal, unchanged)

```
FPS/TIMEBASE CONTRACT (KCS) — the ONE mapping between frames and time.

  seconds = frame / fps        frame = seconds * fps

- The project FPS is an authored TIME MAPPING, not a redraw budget. Changing
  the FPS of a document re-maps frames to seconds; it never changes what the
  viewer sees, and it never changes the animation's wall-clock duration unless
  the frame count changes with it.
- The monitor / browser refresh rate has no effect on the authored duration:
  playback integrates elapsed wall-clock time and steps the playhead by whole
  authored frames (see `usePlayback`).
- The FPS is a positive whole number of frames per second. Fractional rates
  such as 59.94 are NOT supported and are never faked: the Lottie importer
  rounds `fr` and reports LOTTIE_FRACTIONAL_FPS, and the editor offers
  24/30/60/120 FPS with 60 as the new-document default.
- The OGraf package carries the same `fps` on SceneData and asks for it in
  `renderRequirements.frameRate.ideal`; the generated runtime advances by
  elapsed time (`|targetFrame - startFrame| / fps * 1000` ms → progress), so an
  exported graphic keeps its wall-clock duration in a host whose own timeline
  FPS differs.
- The timeline's duration control writes `round(seconds * fps)` frames, so the
  seconds the user types are the seconds the animation lasts, at every rate.
- Any GIF/video export must map `frameDelayMs = 1000 / fps` per authored frame
  for the same reason: frame count × delay = wall-clock duration, independent of
  the encoding cadence.
```

**Reality Hub timing note.** A Reality Hub Timeline FPS does not have to match the KCS FPS for timing to stay
correct — only the graphic's frame count and its own FPS define its duration, and the generated runtime
advances by elapsed time, so a host running a different timeline rate still plays the graphic for the
authored wall-clock duration.

---

## 8. UNDO TRANSACTION CONTRACT (unchanged by round 5)

- **One continuous gesture = ONE undo entry.** The transaction opens on the press (`startBatchInteraction`)
  and closes on the release, the cancel or the loss of pointer capture (`endBatchInteraction`).
- **A discrete action stays its own entry.** Batching never merges two actions into one.
- **A vector arrange command is one entry**: the whole plan is written inside ONE batch interaction through
  `updateCurrentTransform`, on animated and static layers alike (R5-09…R5-11).
- **A panel or timeline RESIZE is UI state and never enters document history at all** — including the R5-03
  frame-committed ease, which commits layout, not the document.
- **A set delete is one entry** (R4-04), and `endBatchInteraction` is idempotent when no transaction is open.

---

## 9. TESTS — the full validation on the frozen revision `0e81ff3`

Isolated ports only (`PORT=5013` → API 5013, UI 5188); `npm run dev` was never used; 5173/5000 were never
bound, stopped or restarted.

| Command | Result |
| --- | --- |
| `npm run check` (single command: lint + `tsc -b` + `vitest run` + build) | **green** — oxlint clean, typecheck clean, **165 files / 2,478 tests** passed, 0 failed, 0 skipped, production build succeeded (2,072 modules) |
| `node scripts/check-state-consistency.mjs` | **PASS** (48 checks on `0e81ff3`; 50 once this round's record joins the bundle) |
| `npm audit --audit-level=low` | **0 vulnerabilities** |
| `git diff --check` | **clean** |
| **FULL Chromium** `CI=1 PORT=5013 npx playwright test --retries=0` (run 2, 396 tests, 8 workers) | 394 passed / **2 failed** — see §6 |
| **FULL Chromium** `CI=1 PORT=5013 npx playwright test --retries=0` (run 3, 396 tests, 8 workers) | 394 passed / **2 failed** — see §6 |
| `CI=1 PORT=5013 npx playwright test e2e/camera-transition-stability.spec.ts e2e/camera-invariance.spec.ts --retries=0` | **9 passed / 0 failed**, `worstDelta=0.000px` on 12/12 traces |
| `CI=1 PORT=5013 npx playwright test e2e/camera-transition-stability.spec.ts --workers=8 --retries=0` | **4 passed / 0 failed**, `worstDelta=0.000px` on 12/12 traces |
| (already green on this revision) `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`, `npm run validate:ograf`, `PORT=5013 npm run qa:release` (2) , `PORT=5013 npm run qa:v6` (3) | all pass |

Round-4's own numbers are unchanged and still stand for that round: **163 files / 2,438 tests**, and the
FULL Chromium **379 passed / 0 failed / 0 flaky** on its repeated run. The delta to today's 165 files /
2,478 tests is round 5's new specs and cases.

---

## 10. PR #9, CI, live surfaces, and what was NOT done

- **PR #9 — OPEN, not merged:** `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`, base `main`.
- Head `1168ceea0fe409f153221749b3e0b890316835cf` (`1168cee`) on `origin`; mergeable **MERGEABLE**;
  merge state **CLEAN**. The push was a fast-forward (`42acf1e..1168cee`) with an explicit refspec — **no
  force push, no `--force-with-lease`, no rebase, no history rewrite, no branch deletion**.
- CI **CI Pipeline** run **`38550570067`** (`pull_request`) on that head — conclusion **success**,
  job `Build, Lint & Test Verification` green in 1m20s
  (`https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/38550570067`).
- **Live preview 5173:** HTTP 200, served from THIS worktree at the pushed head. The listener is
  `node … keyframe-character-studio-omp-manual-qa-r1\node_modules\.bin\..\vite\bin\vite.js --host --port 5173`
  (pid **50876**), and branch-only modules answer 200 there — `/src/utils/vectorArrange.ts` (the round-5
  arrange authority, which does not exist on `main`) and `/src/tests/vectorArrange.test.ts`.
- **API 5000:** pid **18280** (`server/index.js`), never stopped or restarted; `/api/health` 200.
- **No merge, no release:** PR #9 was not merged; no tag was created, moved or deleted; no GitHub release was
  published or finalized; nothing was published to npm; no dependency, package, lockfile, workflow or OMP
  global config changed.
- **The canonical checkout was never written to** — it is still on `main` @ `8e2df61` and clean.
- **Scope guard held:** the GIF export keeps its 60 FPS cap, no video export exists, the Mac ZIP and Reality
  Hub timing items remain final manual QA pending with no product change, and the FPS/timebase is untouched.
- **The handoff refresh that carries this file is a docs-only commit on top of `1168cee`** (documentation
  only — no product source, test, package or workflow byte), so the **validated code+record head is
  `1168cee` and its green CI run is `38550570067`**.

---

## 11. USER RETEST LIST (the merge gate)

Please retest on `http://localhost:5173/` (this worktree):

- **Round 1 — A, B, C, D, E, F, G, H, I, J**
- **Round 2 — R2-01 … R2-12**
- **Round 3 — R3-01 … R3-13**
- **Round 4 — R4-01 … R4-16**
- **Round 5 — R5-01 … R5-15**, in particular: both panel handles at a very short window height and a very
  narrow window width (R5-01); the Export dropdown and the GIF panel opened while both handles are on screen
  (R5-02); the timeline edge easing on collapse/expand with its handle glued to the moving edge (R5-03);
  a selected keyframe showing the filled diamond only, with `Tab`-focus still ringing it (R5-04); a keyframe
  drag released before, across and after the playhead — the playhead must not move (R5-05); a disabled
  `[◀]`/`[▶]` endpoint arrow (R5-06); a property row's neutral `[◀][+][▶]` (R5-07); a marquee across grouped
  children and then across the empty gap between them (R5-08); Align and Distribute on two and three layers,
  `Ctrl+Shift+←`/`→` rotate, `Shift+H`/`Shift+V` flip, each undone by one `Ctrl+Z` (R5-09…R5-11); the nine
  toolbar bands left to right (R5-12); `?` opening the filterable shortcut reference (R5-13); the compact
  Position/Rotation/Scale/Opacity rows at the narrow inspector width (R5-14); no paint-order readout or Bring
  Forward strip in Details, arrange on the toolbar instead (R5-15).

---

## 12. Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in the `latest` bundle needs to be
uploaded.
