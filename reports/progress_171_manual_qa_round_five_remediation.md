# Manual QA Round 5 — remediation, part 2 of 2 (final record, gate, PR and handoff)

Branch: `fix/manual-qa-round1-remediation` (existing; PR #9 stays open, not merged).
Base: `origin/main` @ `8e2df61`. Worktree: `keyframe-character-studio-omp-manual-qa-r1`.

Already on this branch, not redone here:

- Part 1 (recorded by `556fdc8`, docs only): R5-05 (`ff17cad`), R5-08 (`8b2abb3`),
  R5-03 (`0e310dd` + `56fef66`).
- Part 2 fixes: R5-04/R5-06/R5-07/R5-01/R5-02 (`43e02e2`), R5-14/R5-15 (`5d58f04`),
  R5-09/R5-10/R5-11 (`50404a8`), R5-12/R5-13 (`0e81ff3`).

Part 2 scope: record the round, run the remaining gates and the FULL Chromium suite on the frozen
revision, commit the round record, push to PR #9 and refresh the handoff. No merge, no release, no
tag, no npm publication, no force push, no rebase, no package/dependency/workflow change, and no
spec left weakened, skipped or retried.

## Result summary

| Item | Result |
| --- | --- |
| Gates on the frozen revision | `npm run check` green (165 files / 2,478 tests); state consistency **PASS** (48 checks on `0e81ff3`, before this record joined the bundle); `npm audit` 0 vulnerabilities; `git diff --check` clean |
| FULL Chromium, `--retries=0` (396 tests, 8 workers) | run 1 (on record): **393 / 3 failed**; run 2: **394 / 2 failed**; run 3: **394 / 2 failed** — every failure in the load-sensitive camera-drift family |
| The same specs in isolation | **9 / 0 failed** at 2 workers and **4 / 0 failed** at 8 workers, `worstDelta=0.000px` on 12/12 traces |
| The two `Show Inspector` samples | **28.859px** of single-frame client-x excursion, identical across all three full runs; left untouched, reported (sections 7 and 13) |
| Round-5 findings fixed | R5-01 … R5-15 (`ff17cad`, `8b2abb3`, `0e310dd`, `56fef66`, `43e02e2`, `5d58f04`, `50404a8`, `0e81ff3`) |
| Docs commit | `docs: record manual qa round five remediation` (this record, the changelog and its bundle mirror) |
| PR #9 | pushed with the explicit refspec, **not merged**; head and CI recorded in the one-file handoff |
| Live surfaces | 5173 HTTP 200 serving THIS worktree at the pushed head; API 5000 healthy, process unchanged |

---

## 1. R5-01 / R5-02 — the handles ride the panel boundary and the stack is declared once

**The finding.** A panel show/hide handle sat over the panel's own content, so a label, card or row
inside a panel could end up underneath one; and the header painted *over* the Export dropdown and the
GIF panel instead of under them.

**Root cause.** The handle was anchored to the panel's inner content rather than its outer boundary.
The header was (and is) a flex item carrying `z-index: 100` — the value the handle layer also used —
so its z-index counted even while unpositioned: it became a stacking context at the same layer as the
handle, and the handle then won the tie on DOM order, painting over the header's own overlays. A
chrome element that shares a layer with the handles cannot win that tie.

**Fix.** Each handle is anchored outside the panel it collapses — the drawer's right edge, the
inspector's left edge — while its vertical anchor stays the workspace row's top edge, so a timeline
resize still cannot move it (R3-02 / R4-01 behaviour preserved). The editor's stack is declared once,
as tokens in `src/kcsEditorTheme.css`:

| Token | Value | Owner |
| --- | --- | --- |
| `--kcs-layer-panel` | 90 | docked panels (left toolbar, inspector, timeline) and the popovers they own |
| `--kcs-layer-handle` | 100 | the panel edge handles |
| `--kcs-layer-chrome` | 200 | authoring toolbar band and its menu |
| `--kcs-layer-chrome-overlay` | 300 | header chrome, which owns the surfaces hanging below the bar |
| (literals) | 1000+ | dialogs, context menus, toasts |

**Evidence.** `e2e/panel-edge-handles.spec.ts` (327 lines) pins the placement and the pointer
reachability of every docked surface; `e2e/left-toolbar-collapse.spec.ts` was migrated to the moved
handle. The z-index the docked panels already had (90) is unchanged; only the header moved (100 →
300) and the handle's own anchor moved.

## 2. R5-04 / R5-06 / R5-07 — the keyframe controls read as controls

**The finding.** A selected keyframe showed an extra square; a disabled endpoint arrow carried a
not-allowed cursor; a property row's strip showed a coloured keyframe glyph and a tinted label.

**Root cause.** The extra square was a `.selected` box-shadow ring drawn around the key's **18px hit
target**, i.e. decoration over a target that must not change. The disabled arrow was styled with a
forbidden cursor. The property row borrowed the lane's channel colour for its `+` control and its
label.

**Fix.** The ring is deleted; keyboard focus keeps its ring through `:focus-visible`, so the hit
target is untouched and only the redundant paint is gone. A disabled endpoint arrow uses the normal
disabled language (greyed, `disabled`, named `"(none)"`, no not-allowed cursor). A property row's
strip is the neutral `[◀][+][▶]` trio with a plain `+`; the channel colour stays on the lane diamonds
and their connector. Hierarchy, indentation and row/lane alignment are unchanged, and the two-click
frame moves are `Undo`-able through `handleAddChannelKeyframe`'s existing batched path.

**Evidence.** `e2e/timeline-keyframe-controls.spec.ts` (231 lines) pins all three, including the
filled-diamond contract and the disabled arrow's accessible name.

## 3. R5-14 / R5-15 — the compact Transform Details

**The finding.** The Transform section stacked Position/Rotation/Scale/Opacity cards with a `Reset 0°`
control, a labelled `Locked`/`Free` button and an `Add Keyframe` button; the layer's paint order was
also repeated there as a raw `Index 1` readout plus a Bring Forward / Send Backward strip.

**Why it was wrong.** `Reset 0°` was a second control writing the field's own value, and `Add
Keyframe` duplicated the timeline property row's authority. The paint order is arrange, which already
has a home on the authoring toolbar writing the same `handleZIndexChange` path — two copies of one
command.

**Fix.** `Position [X][Y]` followed by ONE compact row of `[Rotation][Scale][Opacity]`, three cells on
one fractional grid that each keep their own column at every inspector width (a quarter narrower than
the stacked rows, still one line at the 250px dock floor). Removed: `Reset 0°`, `Add Keyframe`, and
the labelled lock button — the aspect lock stays reachable as one compact glyph in the Scale cell's
header, because removing it outright would make a free (non-uniform) canvas corner drag unreachable.
`TransformZIndexCard` and the now-dead `handleZIndexChange` prop it fed are deleted.

**The model is untouched.** `scaleX` and `scaleY` remain independent channels, each with its own lane
and keyframes, and Position, Scale and Opacity still write through the canonical transform path.

**Evidence.** `e2e/inspector-transform-details.spec.ts` (199 lines) covers the layout, the removals,
the scale semantics and the narrow-width case; `src/tests/transformPresentation.test.tsx` covers the
presentation; `e2e/layer-index-persistence.spec.ts` now observes the STAGE'S PAINT ORDER and drives
the toolbar's Arrange group (the same write path, a stronger observable); `e2e/corner-anchor-resize.spec.ts`
and `e2e/real-user-verification.spec.ts` were migrated to the new contracts (lock glyph, toolbar arrange).

## 4. R5-09 / R5-10 / R5-11 — align, distribute, rotate and flip: the vector command semantics

**The finding.** The editor had no align / distribute / rotate-90 / flip commands for the current
selection.

**Design.** One authority plans, one writes:

- `src/utils/vectorArrange.ts` — **pure planning**. It decides the world-space patch every target
  receives and writes nothing.
- `src/hooks/useVectorArrangeAuthoring.ts` — writes that plan through the ONE transform write path
  (`updateCurrentTransform`: world space in, container-local out) inside ONE batch interaction, so a
  command is exactly one undo step and one history entry, on animated and static layers alike. The
  toolbar and the keyboard run the SAME actions, so no second geometry rule exists.

**What a target is.** A **layer** of the canonical selection, measured in world space by
`getLayerWorldBounds` — the group-aware measurement the grouping authority already uses, so a
container is arranged by the box its children define and the two can never disagree. A layer whose
ancestor is ALSO selected is dropped from the plan: the ancestor already carries it and writing both
would move it twice. The ancestor relationship is read from `utils/partBinding`, the one place
`parentId`/`booleanGroupId` precedence is defined.

**The four documented policies** (stated in the `vectorArrange.ts` header):

| Command | Reference / pivot | Rule |
| --- | --- | --- |
| ALIGN (6 edges) | the COLLECTIVE selection bounds | only the aligned axis is written, so the other axis cannot drift; a target already on the edge receives NO write (no zero-delta keyframe). There is no reference-object ("key object") authority in this editor; inventing one here would be a second selection rule. |
| DISTRIBUTE (2 axes) | needs ≥ 3 measurable targets | ordered by box CENTRE, ties broken by layer id; the two extremes keep their positions (the span never changes); interior centres are placed at an even step `first + (last - first) * i / (n - 1)`. Distribution by centres, not by gaps — defined for overlapping layers too. |
| ROTATE ±90° | the COLLECTIVE selection centre | one pivot for the whole selection turns it as one rigid body; each new place comes from `rotateAboutWorldPivot` — the same pivot-rotation authority the canvas gizmo uses — evaluated against the transform captured before the command, so the pivot cannot drift. |
| FLIP H/V | the COLLECTIVE selection centre | world placement preserved: a single target flips in place about its own visual centre, a multi-selection mirrors as one picture. The sign law is `utils/mirror`'s (`scaleX`/`scaleY`/`rotation` negate) applied about the origin line and then translated onto the flip axis, so a rotated, non-uniformly scaled layer mirrors exactly instead of approximately. |

**Keys.** Four of the commands carry a binding, chosen so no plain tool letter is claimed and no
binding is a prefix of another:

| Gesture | Command |
| --- | --- |
| `mod+shift+arrowleft` | Rotate 90° counter-clockwise |
| `mod+shift+arrowright` | Rotate 90° clockwise |
| `shift+h` | Flip horizontal |
| `shift+v` | Flip vertical |

Align and distribute are deliberately **toolbar-only**: their target depends on the measurable
selection (an align of two layers and a distribute of three are different commands with the same
intent), so a single letter would have to guess. They are absent from the shortcut reference rather
than documented with a fake key.

**Evidence.** `src/tests/vectorArrange.test.ts` (302 lines) pins the four policies and the target
folding; `src/tests/vectorArrangeCommands.test.tsx` (213 lines) pins the single-history-entry
contract and the toolbar wiring; `src/tests/shortcuts.test.ts` and `e2e/keyboard-shortcuts.spec.ts`
pin the bindings; `e2e/authoring-toolbar.spec.ts` pins the bands and the commands end to end.

## 5. R5-12 / R5-13 — the nine toolbar bands and the shortcut reference

**R5-12.** The authoring toolbar is organised into the nine command bands a motion editor reads left
to right — **canvas tools, create, Boolean, layer group, align, distribute, rotate and flip, arrange,
view** — and every band is one `role="group"` with its own accessible name, so the structure is
announced, not just painted. A band whose commands are variants along one axis (six align edges, two
distribute axes) is ONE trigger that opens a menu, so the strip stays compact and no band is a long
row of near-identical glyphs; a band of distinct one-shot commands (rotate CCW/CW, flip H/V) keeps
one button per command. The band's own accessible name is its menu label. The toolbar owns no
document state of its own and holds no second copy of any command; paint is deliberately NOT there
(fill and stroke are authored in the Inspector's Appearance section, their one home).

**R5-13.** The shortcut reference is a filter over the ONE shortcut table (`utils/shortcuts`) rather
than a second copy of it: typing narrows the rows by label, detail, category or the formatted keys
themselves; each category is a labelled `section` with its row count; every gesture is drawn as a
platform-formatted chip (a Windows/Linux user reads `Ctrl+Shift+←`, a macOS user `⇧⌘←`); a command
owned by a focused control is listed under Timeline with its scope named, and an empty result says so
instead of showing an empty list. The dialog uses the shared focus trap and opener restoration
(`useDialogFocusTrap` / `useDialogFocusRestoration`), and its close control and filter input carry
accessible names.

**Evidence.** `e2e/authoring-toolbar.spec.ts` pins the bands and their commands; `src/tests/
authoringToolbar.test.tsx` pins the band structure and the enablement policy;
`src/tests/shortcutReferenceDialog.test.tsx` pins the filter, the counts and the empty state.

## 6. The three part-1 findings (recorded in `556fdc8`, summarised here for completeness)

- **R5-05 — a keyframe drag no longer moves the playhead.** Every keyframe diamond's `onClick`
  carried an unconditional `onSetFrame(...)` beside `handleKeyframeClick`, and a real drag ends with a
  browser `click` on the pointer-captured element, so the closure read the key's POST-drag frame; the
  property diamond's `onPointerDown` also wrote the cursor at press time. The cursor write now lives
  inside the one drag-aware click authority `handleKeyframeClick`, which already suppressed a
  post-drag click's selection; the prop diamond's `pointerdown` no longer writes the cursor at all.
  Proof: `e2e/timeline-keyframe-gesture.spec.ts` — with the authoring cursor at frame 18, a single-key
  drag released before the playhead and a two-key drag crossing it and released after both leave
  `.playhead-line[data-frame]` at `18` during the drag, at the release and after further pointer
  movement, while one `Ctrl+Z` returns both keys to their pre-drag frames. Also
  `src/tests/trackLane.test.tsx`.
- **R5-08 — a marquee over grouped children normalizes to the GROUP.** The canvas committed the RAW
  `getPartsInMarquee` hit list, so grouped children became the selection and overlays drew child
  frames; and `getPartsInMarquee` measured the geometryless container through the synthetic ±32
  `fallbackBounds()`, which is why an empty gap could select the group. `resolveMarqueeSelection`
  (`src/utils/layerGrouping.ts`) folds hits through the existing `resolveStageSelectionTarget` and
  drops `isGroup` containers from raw hits. Proof: `e2e/group-interaction.spec.ts` (all four outcomes
  fail on the unfixed commit) and `src/tests/layerGrouping.test.ts`.
- **R5-03 — the timeline collapse eases from the frame commit.** A CSS `height` transition measured
  **5.883px** of transient world drift (the edge moves during the frame's own style/layout step, which
  leaves the stage's corrected camera to a ResizeObserver notification that can arrive a frame late).
  Replaced with `animateTimelineEdge` (`TIMELINE_EDGE_TRANSITION_MS = 180ms`, monotone ease-out cubic)
  committing every frame through `commitWorkspaceLayout`. Proof: the R5-03 assertions in
  `e2e/camera-transition-stability.spec.ts` (intermediate heights, one-direction travel, handle pinned
  to the moving edge).

## 7. The gate: the FULL Chromium suite on the frozen revision

Isolated ports only (`PORT=5013` → API 5013, UI 5188); `npm run dev` was never used; 5173/5000 were
never bound, stopped or restarted. Every run below is `CI=1 PORT=5013 npx playwright test … --retries=0`
with the stock reporter, **no `--repeat-each`, no retry, no serialisation**.

| Run | Scope | Result |
| --- | --- | --- |
| Run 1 (already on record for this head) | FULL suite, 396 tests, **8 workers** | **393 passed / 3 failed** — `camera-invariance.spec.ts:300`, `camera-transition-stability.spec.ts:231`, `camera-transition-stability.spec.ts:259` |
| Run 2 (this part) | FULL suite, 396 tests, 8 workers | **394 passed / 2 failed** — `:231`, `:259` |
| Run 3 (this part) | FULL suite, 396 tests, 8 workers | **394 passed / 2 failed** — `:231`, `:259` |
| Isolation A | both camera specs, 9 tests, **2 workers** | **9 passed / 0 failed**; all **12/12** traces `worstDelta=0.000px` |
| Isolation B | `camera-transition-stability.spec.ts`, 4 tests, **8 workers** | **4 passed / 0 failed**; all **12/12** traces `worstDelta=0.000px` |

**The exact failures.** Both are the same measured quantity — the ALPHA layer's client x against the
first sampled frame of the same transition — and both are the maximum of the whole sample, reached at
one frame of the panel's 240ms width transition:

| Run | Test | Reported failure | Sample line |
| --- | --- | --- | --- |
| 2 | `:231 the right inspector never counter-moves the world while it animates` | `inspector show: frame 6 t=150.9ms alpha x drifted -28.859px (stage 885.3px)` | `inspector show \| frames=36 \| animating=30 \| stage 944.0x281.0->584.0x281.0 \| worstDelta=28.859px \| magnificationSpread=0.00000` |
| 2 | `:259 repeated chrome toggles never drift the world on any frame` | `repeat Show Inspector: frame 5 t=137.8ms alpha x drifted -28.859px (stage 1221.3px)` | `repeat Show Inspector \| frames=35 \| animating=30 \| stage 1280.0x281.0->920.0x281.0 \| worstDelta=28.859px \| magnificationSpread=0.00000` |
| 3 | `:231` | `inspector show: frame 6 t=154.2ms alpha x drifted -28.859px (stage 885.3px)` | same `worstDelta=28.859px`, `magnificationSpread=0.00000` |
| 3 | `:259` | `repeat Show Inspector: frame 6 t=160.3ms alpha x drifted -28.859px (stage 1221.3px)` | same `worstDelta=28.859px`, `magnificationSpread=0.00000` |

Everything else in both runs was clean: the HIDE direction of the same panel
(`inspector hide`, `repeat Hide Inspector`) reported `worstDelta=0.000px`, the left toolbar and the
timeline edge traces reported `0.000px`, and `magnificationSpread` was `0.00000` on **every** trace in
every run — so the camera's zoom and the world's magnification never changed; only one chromatic
position sample moved.

**What the number is.** `28.859px` is exactly half of `57.71875px`, which is the stage box's own width
delta between the baseline frame and the frame before the failing sample (`944 → 886.28125` and
`1280 → 1222.28125`; the sample reads the box at `885.3` and `1221.3` because it is read later in the
same frame). That is the arithmetic of a world point painted at the stage box's centre while the box
has already narrowed by that delta: the panel is on the right, so the stage's right edge gives up the
width and its centre moves left by half of it. It is the same class of transient R5-03 measured on the
timeline's CSS `height` transition (**5.883px** there, because the timeline's per-frame delta is
smaller) — one painted frame of the authored world against a box it no longer had, because the
correction rides a `ResizeObserver` notification that can land after the paint when the main thread is
busy.

**Why it is reported and not fixed.** The record states the facts rather than a conclusion, because
this part was scoped to the gate and the round's record:

- The failing assertions are **unchanged** by this round. Round 5 only *added* a timeline section to
  `e2e/camera-transition-stability.spec.ts` (`0e310dd`, `56fef66`) and extended `movingFrames` to also
  treat a height change as an animation; `expectStable`, `DRIFT_TOLERANCE_PX = 1` and the two failing
  tests are the pre-round-5 text, and the inspector samples' height is constant (`281.0`).
- The transition being measured — `.property-inspector`'s
  `transition: width 240ms ease, …` — is **unchanged** by this round: `43e02e2` changed only that rule's
  `z-index` from the literal `90` to `--kcs-layer-panel`, whose value is also `90`.
- It is **invisible in isolation** at both 2 and 8 workers, with `worstDelta=0.000px` on all traces, and
  it reproduces in **every** full-suite run at this head (3/3) at the same offset — a higher
  reproducibility than the round-4 record, where the same command's repeated full run was clean and the
  single sample appeared once (`camera-transition-stability.spec.ts:238`) and did not return.
- No tolerance was widened, no retry added, no sleep inserted and no test skipped, and the spec bytes
  are untouched, as directed.

The consequence for the reviewer is explicit: at this head the two `Show Inspector` samples are
**reproducible whenever the full 396-test suite runs at 8 workers** and vanish in isolation, so a
reviewer who wants a clean full-suite run should treat this as an open item, not a flake to be ignored
— and the one diagnostic this record does **not** contain is a full-suite run on the pre-round-5
revision under the same 8-worker load, which would need another checkout and was out of this part's
scope (see section 13).

## 8. The remaining gate commands on the frozen revision

| Command | Result |
| --- | --- |
| `npm run check` (single command: `lint` + `tsc -b` + `vitest run` + `build`) | **green** — oxlint clean, typecheck clean, **165 files / 2,478 tests passed, 0 failed, 0 skipped**, production build succeeded (2,072 modules) |
| `node scripts/check-state-consistency.mjs` | **PASS (48 checks)** on `0e81ff3` before the docs commit |
| `npm audit --audit-level=low` | **0 vulnerabilities** |
| `git diff --check` | **clean** (exit 0) |

`npm run check` was run as the single command, not as four separate ones, so the four sub-gates are
proven to pass in the order the repository declares.

## 9. Push and PR #9

- Pushed normally with an explicit refspec: `git push origin HEAD:refs/heads/fix/manual-qa-round1-remediation`.
  **No force push, no `--force-with-lease`, no rebase, no history rewrite.**
- PR **#9** — OPEN, **not merged** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`,
  base `main`.
- The pushed head, the CI run id and its conclusion are recorded in
  `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` and `chatgpt_handoff/latest/manifest.txt`, which are
  regenerated after the push (a document cannot carry the SHA of the commit that contains it).

## 10. Live surfaces (never touched)

| Surface | State |
| --- | --- |
| `http://localhost:5173/` | HTTP 200 |
| | served by the vite listener whose process is the one started from THIS worktree |
| `/src/utils/vectorArrange.ts` on 5173 | HTTP 200 — a module that exists only on this branch, so the served tree is proven to be this worktree at the pushed head |
| `http://127.0.0.1:5000/api/health` | HTTP 200, process unchanged |
| Isolated test surfaces | UI 5188 / API 5013 only; `npm run dev` never used |

The user's live QA session was never bound, stopped or restarted, and the canonical checkout was never
written to.

## 11. User retest list (the merge gate)

Please retest on `http://localhost:5173/` (this worktree):

- **Round 1 — A, B, C, D, E, F, G, H, I, J**
- **Round 2 — R2-01 … R2-12**
- **Round 3 — R3-01 … R3-13**
- **Round 4 — R4-01 … R4-16**
- **Round 5 — R5-01 … R5-15**, in particular: both panel handles at a very short window height and at a
  very narrow window width (R5-01); the Export dropdown and the GIF panel opening while both handles are
  on screen (R5-02); the timeline edge easing on collapse/expand with the handle glued to it (R5-03);
  a selected keyframe showing the filled diamond only, and `Tab`-focus still ringing it (R5-04); a
  keyframe drag released before, across and after the playhead — the playhead must not move (R5-05);
  a disabled `[◀]`/`[▶]` endpoint arrow (R5-06); a property row's neutral `[◀][+][▶]` (R5-07); a marquee
  dragged across grouped children, then across an empty gap between them (R5-08); Align/Distribute on
  two and three layers, `Ctrl+Shift+←`/`→`, `Shift+H`/`Shift+V`, each in one `Ctrl+Z` (R5-09…R5-11);
  the nine toolbar bands left to right (R5-12); `?` opening the filterable shortcut reference (R5-13);
  the compact Position/Rotation/Scale/Opacity rows at the narrow inspector width (R5-14); no paint-order
  readout or Bring Forward strip in Details, arrange on the toolbar (R5-15).

## 12. Guardrails respected

No `rebase`, no `--force`/`--force-with-lease`, no `reset --hard`, no `git clean`, no branch delete,
no merge of PR #9, no tag/release/npm publish/deploy, no package/dependency/lockfile change, no OMP
global config change, no broad refactor, no arbitrary sleep, and **no tolerance widened, no retry
added, no spec skipped** for any failure of the camera-drift family (see the gate section). The
canonical checkout was never written to; the user's live surfaces were never bound, stopped or
restarted; isolated tests ran on UI 5188 / API 5013 only.

## 13. Not done (explicit)

- PR #9 is **not merged** — the user retest on 5173 is the merge gate.
- No tag, no GitHub release, no npm publication.
- The camera-family question is **reported, not resolved**: this part did not run the FULL suite on the
  pre-round-5 revision under the same 8-worker load, so the record shows the reproducibility change
  (3/3 full runs at this head versus a clean repeat at the round-4 head) without attributing it. Doing
  that comparison needs another checkout, which this part's scope and its Git-state guardrail exclude.
- Mac ZIP verification and Reality Hub timing remain final manual QA pending, with no product change.
- GIF keeps its 60 FPS cap; no video export; FPS/timebase unchanged.
