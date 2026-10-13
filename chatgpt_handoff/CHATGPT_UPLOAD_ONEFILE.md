# KCS — ChatGPT upload one-file: MANUAL QA ROUND 4 REMEDIATION (parts 1–4, R4-01…R4-16)

Generated from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`.
Single current truth: **round 4 is implemented, self-reviewed and validated on the frozen head; PR #9 is
updated and NOT merged; the user retest on 5173 is the merge gate.** Nothing was released, tagged or
published.

---

## 1. Where this work lives

- Canonical stable checkout (untouched): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
- Branch: `fix/manual-qa-round1-remediation`, base `origin/main` at `8e2df61`
- Round-4 head: `d545cfca58978e82357c7f8ed8da8d1360710278` (`d545cfc`), pushed to `origin` by a fast-forward
  (the push moved the remote branch `14035e3..d545cfc`)
- Rounds covered: round 1 A–J, round 2 R2-01…R2-12, round 3 R3-01…R3-13, round 4 R4-01…R4-16

Round-4 commits, in order:

| Commit | Finding(s) |
| --- | --- |
| `c9357c3` | R4-03, R4-04 — pointer keyframe gesture, set delete |
| `babf9b3` | R4-07 — sparse ungroup bake |
| `bc49601` | R4-14 — one history entry per continuous gesture |
| `6c3717f` | docs — changelog mirror |
| `bd73761` | R4-15 — timebase authority |
| `6bf71c6` | R4-16 — dev preview cache freshness |
| `e5432a5` | R4-13 — cross-platform OGraf ZIP export |
| `af67021` | R4-06 — property tree without the wrapper row |
| `78743a8` | docs — round record, part two |
| `c5ce029` | R4-09 — grouped-object selection |
| `20307eb` | R4-05 — property-level keyframe navigation |
| `22cbdca` | R4-01, R4-02, R4-08 — edge controls, divider, hollow glyphs |
| `c206a4e` | docs — round record, part three |
| `1311557` | R4-10 — toolbar bands, Bind removed from the strip |
| `3d8d4b6` | R4-11 — one shortcut authority, Delete scope fix |
| `fec0c03` | R4-12 — animated GIF export |
| `9280335` | the two specs migrated to the contracts round 4 replaced |
| `d545cfc` | docs — the round-four record |

---

## 2. R4-01 … R4-16 — root cause → fix → where it is proven

**R4-01 — the side-panel show/hide handles could be pushed over the timeline.**
*Root cause:* 26×48 px rectangles anchored at the viewport's vertical centre, so a short window slid them
down over the timeline. *Fix:* they became the timeline's own compact edge-handle family — a 20×46 px
elevated pill with a bare chevron, no label, symmetric left and right — as children of the editor
**workspace row** riding one shared inset below its TOP edge (`--kcs-panel-handle-top`), a boundary a
timeline resize never moves; horizontally they still straddle the panel edge they collapse and stay
reachable while the panel is hidden. *Proven by:* the dock-handle geometry at the minimum, default and
maximum timeline heights and after a window resize (`e2e/timeline-workspace.spec.ts`), plus the retained
R3-02 vertical-stability contract.

**R4-02 — the outliner divider was off-language.** *Root cause:* a filled bar with a glow. *Fix:* the
panel-height divider's language — a compact centred pill (3×42 px, growing on hover/drag), neutral at rest,
strengthened to the KCS accent only while hovered or dragged, inside a fully transparent 6 px hit strip.
*Proven by:* rest/hover paint assertions in `e2e/timeline-workspace.spec.ts`.

**R4-03 — a keyframe drag could stay armed after the pointer was released.** *Root cause:* the gesture was
mouse-only; its listeners were registered inside a **passive effect gated on render state**, so a fast
press-drag-release (or a release delivered outside the window) was never received — there was no pointer
capture, no `pointercancel` and no loss-of-capture handling. *Fix:* the gesture is a POINTER gesture owned
in refs: the press arms it and resolves the moving set, the drag begins once the pointer crosses the shared
threshold, the pressed diamond holds the pointer captured for the whole sweep, and `pointerup`,
`pointercancel`, `lostpointercapture` **plus a move with no button held** end it at once. The window
listeners are registered once for the component's lifetime and read the live gesture record, so the ending
event can never be missed. *Proven by:* `e2e/timeline-keyframe-gesture.spec.ts` (the selected keys travel
together and stop at the release).

**R4-04 — delete was single-key and could reach the layer path.** *Root cause:* the delete mutator resolved
one keyframe id. *Fix:* `deleteSelectedKeyframeGroupsMutator` resolves the WHOLE selected id set against the
document in one pass and applies it in one write, so a multi-track/multi-channel deletion is one undo entry
and Undo restores the exact set; and while the timeline holds focus the command can only remove keyframes,
never a layer. *Proven by:* `src/tests/trackMutations.test.ts`, `src/tests/useTimeline.test.ts` and the
timeline-scope case in `e2e/keyboard-shortcuts.spec.ts`.

**R4-05 — no property-level keyframe navigation, and the arrow policy was implicit.** *Fix:* every expanded
keyable row carries the layer row's own `[◀][+][▶]` scoped to that property —
`resolveChannelKeyframeFrames` reads one channel's frames from the SAME canonical projection the lane
diamonds are painted from (`resolveTrackChannels`), so an arrow can neither skip a key the lane shows nor
stop on a frame the property does not animate; the layer pair reads the union of every channel through the
same helper. The policy is stated once and pinned at both levels. *Proven by:*
`src/tests/timelineMetrics.test.ts`, `e2e/timeline-property-navigation.spec.ts`.

**R4-06 — a redundant `Transform` wrapper row.** *Fix:* the tree reads Position > {X, Y}, Rotation, Scale >
{X, Y}, Opacity, Trim Path > {Start, End, Offset}, one level shallower, with the wrapper's outliner row AND
its lane spacer both gone so the row-for-row lane alignment contract is unchanged; `Transform` stays the
internal name of the model. *Proven by:* the tree-order and ownership tests plus the R2-09 selector in
`e2e/timeline-workspace.spec.ts`.

**R4-07 — ungrouping an animated container flooded the timeline.** *Root cause:* an unconditional dense
per-frame bake (one linear key per channel per integer frame of the union span). *Fix:* the bake keeps the
SPARSEST representation that still evaluates to the exact standalone pose at every displayed frame — a
channel the composition leaves constant takes one key, a channel the composition merely translates keeps the
container's own key times and easings, and only channels no single easing can carry are subdivided, down to
one key per frame as a last resort, which is now recorded as a `bakeNote` on the outcome instead of passing
silently. *Proven by:* `src/tests/layerGrouping.test.ts` and `src/tests/ungroupBake.test.tsx` — see §5.

**R4-08 — the connector ran through a hollow keyframe's interior.** *Root cause:* one continuous line drawn
at the keyframe centre line. *Fix:* `resolveConnectorSegments` splits it into ONE SEGMENT PER GAP, each
cleared of the glyph at either end by `KEYFRAME_GLYPH_GAP_PX = 9` px (which clears even the hovered 8 px
glyph); the legacy composite span bar is cleared the same way. Masking is by geometry, so nothing was
enlarged: the glyph stays 8 px inside its 18 px hit target. *Proven by:* `src/tests/timelineMetrics.test.ts`,
`e2e/timeline-keyframe-glyph.spec.ts`.

**R4-09 — a group could not be grabbed with one click.** *Root cause:* the canvas selected whichever CHILD
happened to be under the pointer. *Fix:* `resolveStageSelectionTarget(parts, partId, selectionIds)` answers
with the clicked layer's **outermost group ancestor** (the relationship chain walked to the top, so nested
groups read as one container) at BOTH canvas entry points — the click and the pointerdown that may become a
translate drag — and with the layer itself only while the selection already lives inside that group. The
"click that never moved selects the layer under the pointer" path is gone. Child editing stays available
through two EXPLICIT drill-in paths that leave the same trace: a canvas **double-click** (`onDrillIn`) or a
click on the child's row in the timeline Outliner. The empty gap between children stays inert: per-child
geometry hit-testing means no aggregate-AABB hit rectangle exists, so a point on no child's geometry never
reaches the resolver. *Proven by:* `src/tests/layerGrouping.test.ts`, `e2e/group-interaction.spec.ts` and
`e2e/authoring-layer-group.spec.ts` (§7).

**R4-10 — the toolbar's structure was unannounced and it carried a partition command.** *Fix:* the six
command bands (selection/navigation, creation, Boolean, grouping, arrange, view) are each one announced
`role="group"`; every command shares one hitbox token and one optical glyph size declared once in CSS; the
dividers use the standard border token. **Bind and Unbind left the strip** — the bond MODEL is untouched:
a document carrying `boundPartIds` still loads, still moves its bonded layers together and still round-trips
on export, `utils/partBinding` remains the one bond authority, and the binding spec now authors the bond
into the seeded document and still proves movement, the preserved bond and the parented world-delta case.
Bring to Front / Send to Back deliberately stay in the context menu, where they run the array-based
`reorderParts` authority, because exposing them in the strip would put two different order semantics side by
side. *Proven by:* `e2e/authoring-toolbar.spec.ts` (six named groups, no Bind/Unbind control, uniform hitbox
and glyph), `e2e/layer-binding.spec.ts`.

**R4-11 — a shortcut collision audit, and a real Delete scope bug.** *Finding:* no destructive gesture
collision existed, but `Delete` could reach the LAYER-delete path while the pointer was on the timeline.
*Fix:* `src/utils/shortcuts.ts` is the single keymap authority and the global handler resolves the keymap
instead of listing gestures, so a binding and the reference UI cannot disagree. Three guards decide whether a
command runs: a blocking dialog owns the keyboard, a text surface owns the keyboard, and the TIMELINE owns
its own keys while it has focus (`data-shortcut-scope="timeline"`), where `Delete`/`Backspace` can only
remove keyframes. Modifiers are matched EXACTLY, and the table never gives one gesture to two commands in
the same scope (pinned by a unit test). *Deliberately not adopted, with reasons recorded in the file:*
Space-hold pan, arrow-key nudging, `Shift+1`/`Shift+2`, `escape` clearing the layer selection, `mod+x` cut.
*Proven by:* `src/tests/shortcuts.test.ts`, `src/tests/useKeyboardShortcuts.test.ts`,
`e2e/keyboard-shortcuts.spec.ts`.

**R4-12 — no GIF export existed.** *Fix:* see §6 — implemented with **no new dependency**. *Proven by:*
`src/tests/gifEncoder.test.ts`, `src/tests/gifPlan.test.ts`, `e2e/gif-export.spec.ts`.

**R4-13 — the exported OGraf ZIP's portability was unverified, and an accented title mangled the graphic
id.** *Root cause:* an NFKD decomposition turns `é` into `e` + a combining mark, and the mark was treated as
a separator, so `Café Démo` produced `cafe-de-mo`. *Fix:* `foldDiacritics` removes the combining mark before
slugging (and `sanitizeFilenameComponent` deliberately keeps its Unicode-preserving behaviour for a
user-facing scene file name). Portability is now audited STRUCTURALLY: see §8. *Proven by:*
`src/tests/ografZipPortability.test.ts`.

**R4-14 — a continuous authoring gesture recorded one history entry per pointer sample.** *Root cause:* the
colour picker and the canvas already bracketed their gestures through the batch authority, but the
Inspector's sliders, the value graph, the cubic-bezier handles and the mask-path vertices did not. *Fix:*
each opens ONE transaction on the press and closes it on the release, the cancel or the loss of pointer
capture, through the same authority. See §4. *Proven by:* `src/tests/continuousGestureHistory.test.tsx`.

**R4-15 — playback was cadence-driven, so the monitor changed the animation's duration.** *Root cause:* the
loop advanced exactly one authored frame per `requestAnimationFrame` callback, so a 120 FPS authoring played
at half speed on a 60 Hz display, and a stalled/​throttled callback silently lost the time it should have
bought. *Fix:* the loop integrates ELAPSED WALL-CLOCK TIME and steps the playhead by however many whole
authored frames that interval buys, carrying the sub-frame remainder across callbacks; `src/utils/timebase.ts`
is the named frame↔second authority. See §3. *Proven by:* `src/tests/projectTimebase.test.ts` — 30/60/120
parity at t=1 s and t=2 s under 30/60/120/144 Hz cadences.

**R4-16 — "the LAN URL shows old content" was misattributed to stale app code.** *Finding:* the classification
is a PERSISTED USER DOCUMENT, not stale app code — the repository has **no service worker and no PWA
manifest**, the dev origin is plain HTTP (not a secure context, so `navigator.serviceWorker` and Cache
Storage do not even exist there), and Vite already revalidates every module. *Fix:* an explicitly narrow
dev-only Vite plugin pins `Cache-Control: no-store` on the entry DOCUMENT (the one hole left is an
intermediary allowed to STORE it, since `no-cache` permits storage with revalidation), plus a dev-only guard
that retires any service-worker registration found on a secure dev origin. See §9. *Proven by:*
`src/tests/devFreshness.test.ts`.

---

## 3. FPS/TIMEBASE CONTRACT (literal)

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

Supporting facts: `sanitizeProjectFps` refuses a hand-edited FPS that cannot carry the mapping (0, negative,
non-finite, fractional — a fractional value is rounded to the nearest whole rate and never silently kept);
`frameToSeconds`/`secondsToFrame` return 0 rather than `NaN`/`Infinity` when the rate cannot carry the
mapping; the playback loop resets `lastTimeRef` at the start of a run so idle time is never counted, and
clamps the end pose so a callback that elapsed several frames cannot overshoot it.

## 3b. Reality Hub timing note

A **Reality Hub Timeline FPS does not have to match the KCS FPS for timing to stay correct.** Only the
graphic's frame count and its own FPS define its duration: the OGraf package carries the same `fps` on
`SceneData` and requests it in `renderRequirements.frameRate.ideal`, and the generated runtime advances by
elapsed time (`|targetFrame - startFrame| / fps * 1000` ms → progress), so a host that runs a different
timeline rate still plays the graphic for the authored wall-clock duration.

---

## 4. UNDO TRANSACTION CONTRACT

- **One continuous gesture = ONE undo entry.** The transaction opens on the press
  (`startBatchInteraction`) and closes on the release, the cancel or the loss of pointer capture
  (`endBatchInteraction`), through the one existing batch authority in `useHistory`.
- **A discrete action stays its own entry.** A keyboard step on the same slider, or a separate press, is its
  own history item — batching never merges two actions into one.
- **Already batched before round 4:** canvas translate/rotate/scale drags, the colour picker, Boolean
  authoring, layer-group authoring, and the timeline keyframe drag.
- **Batched by R4-14:** the Inspector's range sliders (Appearance corner radius; Matte feather, strength and
  gradient angle), the value-graph points, the cubic-bezier handles, and the mask-path vertices.
- **A panel or timeline RESIZE is UI state and never enters document history at all.**
- **A set delete is one entry** (R4-04): the whole keyframe selection is resolved against the previous
  document in ONE reducer pass and applied in ONE write, so Undo restores the exact set.
- **Idempotent ends:** `endBatchInteraction` is a no-op when no transaction is open, which is what makes the
  unconditional global `pointerup`/`mouseup` ends (and the timeline's lifetime window listener) safe.

---

## 5. SPARSE UNGROUP — KEY-COUNT EVIDENCE (R4-07)

The bake keeps the sparsest representation that still evaluates to the exact standalone pose at every
displayed frame; parity is measured against the evaluator itself, not assumed.

| Case | Before (replaced rule) | After (shipped) | Pose parity |
| --- | --- | --- | --- |
| Container that merely travels (`src/tests/layerGrouping.test.ts`) | 21 keys per channel × 5 channels = **105** keys per child | `x = [0, 10, 20]` (the container's own key times) and `[0]` for `y`/`rotation`/`scaleX`/`scaleY` → **7** keys per child | exact at every sampled frame |
| Position-only container (`src/tests/ungroupBake.test.tsx`) | **105** keys per child | `x = [0, 12, 30]`, `y = [0, 12, 30]`, `[0]` elsewhere → **9** keys per child | max delta **< 1e-9** over 34 frames |
| Container whose rotation mixes the child's offset across x and y | **105** keys per child (every channel dense) | `x`/`y` stay dense (21 each — genuinely required) while `rotation`/`scaleX`/`scaleY` carry `[0, 8, 20]`; the whole per-child count is asserted `< 60` | max delta **< 1e-9** |
| `Boot` sequence scope | 21 keys per channel | `x = [0, 20]`, `[0]` elsewhere | exact |

A channel that still cannot be carried with fewer keys falls back to one key per frame **and records a
`bakeNotes` reason on the ungroup outcome**, so the dense result is never silent. The child's opacity is never
touched by the container's.

---

## 6. GIF EXPORT — IMPLEMENTATION AND DEPENDENCY NOTE (R4-12)

- **No new dependency.** `package.json` and `package-lock.json` are byte-identical to the state before the
  round: the encoder is written for KCS in `src/export/gifEncoder.ts` (GIF89a, one palette for the whole
  animation — exact colours when the scene has ≤ 255 of them, median cut otherwise — one transparent palette
  index at slot 0, and LZW compression per frame).
- **One render authority, not a second renderer.** Frames come from the editor's OWN stack: `evaluateSceneFrame`
  (the editor's frame evaluation, the same mapping the OGraf export uses) → `renderOGrafSvg` (the same SVG
  markup the OGraf package carries) → `src/export/svgRaster.ts` rasterises that markup through an ISOLATED
  SVG image context, which is exactly why the frame carries its fonts and images inline
  (`src/export/fontEmbedding.ts`). The background is not painted, so the GIF keeps its transparent area.
- **Timing is explicit and goes through the timebase** (`src/export/gifPlan.ts`): the exported frame count is
  `round(authoredDurationSeconds × exportFps)` capped at 900, each GIF frame's authored frame is
  `round(secondsToFrame(index / rate, projectFps))`, and each delay is
  `round((i+1)·100/rate) − round(i·100/rate)` whole centiseconds, never 0 — so `frame count × delay` is the
  authored wall-clock duration, independent of the encoding cadence. The panel offers 10…60 (GIF delay
  granularity is 1/100 s, so all its rates are ≤ 100) and states the format's real limitation: GIF has one
  transparent index and no partial alpha, so a semi-transparent pixel snaps to one side.
- **Proven against the produced bytes, not against the encoder's own claims:** `e2e/gif-export.spec.ts`
  downloads the real file and decodes it — `GIF89a`, 320×180, 12 frames for a 0.5 s document at 24 FPS,
  delays summing to exactly 50 centiseconds, transparent index 0, the authored colour present in the palette,
  the animation visibly progressing across frames, and the decoded pixels for a transparent-corner / red-centre
  case. `src/tests/gifEncoder.test.ts` and `src/tests/gifPlan.test.ts` cover the encoder and the plan directly.

---

## 7. THE ROUND'S OWN GATE AND THE TWO SPEC MIGRATIONS

Two specs still asserted behaviour round 4 replaced. Both were migrated to the shipped contracts — coverage
moved, never dropped; no assertion weakened, no spec skipped, no retry added, no arbitrary sleep kept.

1. **`e2e/authoring-layer-group.spec.ts`** asserted that a first canvas click on a child of a group selects
   the **child**. Round 4 replaced that rule (R4-09). The spec now pins the shipped rule (a plain click
   targets the **group**, with the container's frame still drawn and no child-level selection), adds the
   **double-click drill-in** as the way the child becomes primary (with the container's frame gone when it
   does), and keeps its original intent — "the decorative frame must never intercept the pointer" — as a
   direct assertion: `document.elementFromPoint` at the child's own centre must resolve inside
   `[data-part-id="b"]`. Result: **6/6 passed**.
2. **`e2e/workflow.spec.ts`** played the sequence, slept a fixed `1000 ms` and then clicked Pause. A default
   document is 60 authored frames at 60 FPS, and the R4-15 timebase makes that **exactly 1.000 s**, so the
   fixed wait landed on the finished state and no pause control was ever seen (**3/3 failures in isolation**
   — a real stale assumption, not a flake). The spec now asserts the transport into and out of its PLAYING
   state — a stronger assertion, with no duration-dependent sleep. Result: **12/12** across three repeats.

**The single caveat of the full gate.** The first full-suite run recorded one failure:
`e2e/camera-transition-stability.spec.ts › repeated chrome toggles never drift the world on any frame`
(`repeat Show Inspector: frame 13 t=264.9ms alpha x drifted -14.859px`, against a bound of `<= 1 px`). It is
the same load-sensitive sample a previous round recorded and could not reproduce: it appears only under the
load of the 379-test suite, during the tail of a 240 ms layout transition. In isolation it is **9/9 green**
with `worstDelta=0.000px`, and the immediately repeated full-suite run was **379 passed / 0 failed /
0 flaky**. Per instruction the spec was left untouched — no tolerance raised, no retry, no sleep, no weakened
assertion.

---

## 8. macOS ZIP STRUCTURAL PROOF (R4-13)

The exported OGraf package is audited structurally rather than assumed — the test decodes the archive
itself, so the claims do not rest on the library that wrote it:

- the end-of-central-directory record is located and the declared entry count matches the records actually
  found;
- every entry name is a RELATIVE forward-slash path: no backslash, no leading `/`, no drive letter
  (`^[A-Za-z]:`), no `..` component;
- every entry's compression method is stored (0) or deflate (8), each central-directory record's
  `localHeaderOffset` points at a real local header whose own method and name agree with it;
- CRCs are non-zero for non-empty entries, and no entry sets the UTF-8 name flag (the exporter cannot emit a
  non-ASCII name, so none may claim the flag falsely).

A real export with a space-containing asset path (`assets/images/my logo.png`) and an accented scene title
was then extracted by **four independent implementations** — fflate, Info-ZIP `unzip`, bsdtar/libarchive and
Python's `zipfile` — plus PowerShell's .NET `ZipFile`; all reported the same files with valid CRCs. A foreign
package with a non-ASCII, drive-letter, traversal or case-colliding entry (which macOS would collapse into
one file) is REFUSED with a diagnostic (`OGRAF_PACKAGE_UNSAFE_PATH` / `OGRAF_PACKAGE_DUPLICATE_PATH`) instead
of being mis-decoded; a backslash is normalized to the package separator rather than refused, so a
Windows-authored archive cannot resolve differently.

---

## 9. CACHE CLASSIFICATION — CODE CACHE vs PERSISTED DOCUMENT

Two different things, and round 4 separates them explicitly:

- **Stale APP CODE is not the cause of "the LAN URL shows old content".** There is **no service worker and
  no PWA manifest** in the repository, so no offline shell can be registered; the dev origin is plain HTTP
  (`http://172.16.0.172:5173`), which is not a secure context, so `navigator.serviceWorker` and the Cache
  Storage API do not even exist there; and Vite already answers `Cache-Control: no-cache` with an ETag on the
  entry document and every source module, so a fresh navigation gets current source.
- **The one hole closed (dev only):** the entry DOCUMENT alone answers `Cache-Control: no-store` in dev,
  pinned by the `kcs-dev-document-freshness` Vite plugin (`apply: 'serve'`, `/` and `*.html` only, header
  re-pinned at the write because Vite sets its own header afterwards), so an intermediary allowed to STORE
  the document cannot replay it. Pre-bundled dependencies and public assets keep their own dev caching, and
  **a production build is untouched — the hashed production bundle keeps its long-lived immutable caching.**
  A dev-only guard also retires any service-worker registration found on a secure dev origin.
- **What is NOT stale code is the DOCUMENT the editor restores.** The editor restores the last autosaved
  project from `localStorage` on boot, so a returning LAN user sees their previous project — the scene, the
  layers, the title — served by current source. That is PERSISTENCE, a separate axis from code freshness, and
  it is stated that way in `src/utils/devFreshness.ts`.

---

## 10. TESTS — the full validation on the frozen head `d545cfc`

Isolated ports only (`PORT=5012` → API 5012; UI 5188/5189/5187 per gate); `npm run dev` was never used;
5173/5000 were never bound, stopped or restarted.

| Command | Result |
| --- | --- |
| `npx tsc -b --pretty false` | clean |
| `npm run lint` | clean |
| `npm test` | **163 files / 2438 tests** passed, 0 failed, 0 skipped |
| `npm run build` | built |
| `npm run validate:ograf` | valid OGraf v1 manifest |
| `PORT=5012 npm run qa:release` | 2 passed (candidate SHA `fec0c03`) |
| `PORT=5012 npm run qa:v6` | 3 passed |
| `npm run check` | green (lint + tsc + 2438 tests + build) |
| `node scripts/check-state-consistency.mjs` | PASS (46 checks) |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |
| `CI=1 PORT=5012 npx playwright test e2e/authoring-layer-group.spec.ts --retries=0` | 6 passed (the migrated case included) |
| `CI=1 PORT=5012 npx playwright test e2e/workflow.spec.ts --retries=0 --repeat-each=3` | 12 passed |
| **FULL Chromium** `CI=1 PORT=5012 npx playwright test --retries=0` (run 1) | 378 passed / 1 failed — the documented load-sensitive `camera-transition-stability` sample |
| **FULL Chromium** `CI=1 PORT=5012 npx playwright test --retries=0` (run 2) | **379 passed, 0 failed, 0 flaky** |
| `CI=1 PORT=5012 npx playwright test e2e/camera-transition-stability.spec.ts --retries=0 --repeat-each=3` | **9 passed**, `worstDelta=0.000px` (not reproducible) |

**Formal self-review of the whole round-four diff (`14035e3`..`d545cfc`): no product defect was found.** Each
audited item — `pointerup` always terminating a key move; the timeline `Delete` scope; sparse ungroup holding
pose while avoiding key explosion; the group hit target being the child-geometry union with drill-in still
possible; the Bind-strip removal leaving legacy bond documents intact; shortcut collisions and input-focus
safety; history batching keeping discrete actions separate; GIF timing matching the timebase; ZIP portable
paths and central directory; OGraf duration independent of monitor refresh; the dev cache fix not degrading
production caching and not conflating persistence with code freshness; and the toolbar duplicating no command
implementation — is recorded with its evidence in `reports/progress_170_manual_qa_round_four_remediation.md`.
One observation is recorded rather than changed: after the Bind strip removal `usePartBindingAuthoring` has
no production consumer (the bond MODEL and `utils/partBinding` are untouched and the hook stays exercised by
`src/tests/authoringAuthorities.test.tsx`).

---

## 11. PR #9, CI, live surfaces, and what was NOT done

- **PR #9 — OPEN, not merged:** `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`, base `main`.
- Head `d545cfca58978e82357c7f8ed8da8d1360710278` (`d545cfc`) on `origin`; mergeable **MERGEABLE**;
  merge state **CLEAN**.
- CI **CI Pipeline** run **`38420352883`** (`pull_request`) on that head — conclusion **success**
  (`https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/38420352883`).
- **Live preview 5173:** HTTP 200, served from THIS worktree — the listener is
  `node … keyframe-character-studio-omp-manual-qa-r1\node_modules\.bin\..\vite\bin\vite.js --host --port 5173`
  (pid **50876**); `/src/utils/timebase.ts` (a module that does not exist on `main`) answers 200, the
  round-four modules are served, and the dev document answers `Cache-Control: no-store`.
- **API 5000:** pid **18280** (`server/index.js`), never stopped or restarted; `/api/health` 200.
- **No merge, no release:** PR #9 was not merged; no tag was created, moved or deleted; no GitHub release was
  published or finalized; nothing was published to npm; no dependency, package, lockfile, workflow or OMP
  global config changed; no force push, no rebase, no history rewrite, no branch deletion.
- **The handoff refresh that carries this file is a docs-only commit on top of `d545cfc`** (documentation
  only — no product source, test, package or workflow byte), so the **validated code+record head is
  `d545cfc` and its green CI run is `38420352883`**.

## 12. USER RETEST LIST (the merge gate)

Please retest on `http://localhost:5173/` (this worktree):

- **Round 1 — A, B, C, D, E, F, G, H, I, J**
- **Round 2 — R2-01 … R2-12**
- **Round 3 — R3-01 … R3-13**
- **Round 4 — R4-01 … R4-16**, in particular: the side-panel handles at a very short window height (R4-01);
  the outliner divider at rest and on hover (R4-02); a keyframe drag released outside the window, which must
  stop the keys at once (R4-03); `Delete` on a multi-key selection, then one Undo (R4-04); the per-property
  `[◀][+][▶]` on a single-key property (R4-05); the tree with no `Transform` row (R4-06); ungrouping an
  animated container and checking the key count in the timeline (R4-07); a hollow keyframe with the
  connector no longer crossing it (R4-08); a first click on a grouped child selecting the group and a
  double-click selecting the child (R4-09); the toolbar bands and the absence of Bind (R4-10); `Delete`
  while a keyframe diamond is focused (R4-11); a GIF export with the frame-rate and size controls (R4-12);
  a `.zip`/`.ograf` export opened on macOS (R4-13); one Undo after dragging a colour or a slider (R4-14);
  a 1-second animation finishing in 1 second on a 144 Hz display (R4-15); a fresh page load showing current
  code with the previously autosaved project restored (R4-16).

## 13. Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
