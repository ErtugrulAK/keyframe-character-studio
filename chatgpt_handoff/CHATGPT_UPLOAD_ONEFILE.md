# KCS — Manual QA Rounds 1, 2 and 3 remediation (A–J, R2-01…R2-12 and R3-01…R3-13)

**Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.** No other file needs uploading.

Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
Worktree used for this work (isolated): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
Branch: `fix/manual-qa-round1-remediation` — base `origin/main` at `8e2df61`
Pull request: **#9** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9` (base `main`, **OPEN**, not merged)

**No merge. No release. No tag. Nothing published to npm.** The user's retest on the 5173 preview is the merge gate.

## 1. Why these rounds happened

The user ran MANUAL QA against the live editor. **Round 1** produced ten findings (A–J), **round 2**
produced twelve further findings (R2-01…R2-12) and **round 3** produced thirteen further findings
(R3-01…R3-13). All three rounds are implemented on this branch. Every fix keeps the current data model
and reuses the existing authorities — no second state authority, no second animation/evaluation engine,
no new command bus.

## 2. Rounds 1 and 2 result (context, do not redo)

**Round 1** findings A–J all passed their authored checks: A–F in PART 1 (`9f916f6`, `69bbad5`,
`1e21fa5`) and G–J in PART 2 (`9774729`, `05f3130`, `aba0b05`, `18b4aca`). The round-1 head `18b4aca`
passed CI run `38246227512` (`pull_request`, success) and the full local gate (full Chromium 344 passed
/ 0 failed / 0 flaky).

**Round 2** findings R2-01…R2-12 were fixed in eight commits (`a941dc8`, `016f0b5`, `47ae65c`,
`80afc17`, `9b845c1`, `39e34a5`, `03f4e26`, `9207b22`). Measured outcomes: R2-05 rotation holds ONE
world pivot captured at pointer-down (worst frame-centre drift **40.559px → 0.000px**); R2-04
`src/utils/selectionFrame.ts` is the single frame-geometry authority and the stray cyan square is gone;
R2-02 a real 151–155-frame timeline drag with height 320→441 holds **0.000px** worst drift and 0.00000
magnification spread; R2-01/R2-03 collapse/expand, height resize and column resize go through ONE
sizing authority; R2-10/R2-12 a canonical `selectedKeyframeIds` plus the marquee; R2-11 an 18px hit
target with an 8px diamond; R2-09 the compact channel tree (and the missing opacity lane, `03f4e26`);
R2-06 Group/Ungroup out of Details; R2-07 editor-wide capture-phase contextmenu suppression; R2-08
Fill/Stroke out of the toolbar. The round-2 code head `0078dcd` passed CI run `38267691521`
(`pull_request`, success) and the full local gate (full Chromium **359 passed, 0 failed, 0 flaky**).

## 3. Round 3 — findings, root cause, fix, evidence

| # | Finding | Root cause | Fix (commit) |
|---|---|---|---|
| R3-01 | The timeline collapse control read as a labelled button floating in the header band | the control was not attached to the boundary the panel geometry owns | a compact EDGE HANDLE (`.sidebar-handle.timeline-edge-toggle`) straddling the panel's own top edge — no text, reachable while collapsed, and the authored height is restored exactly on expand (`53f1941`) |
| R3-02 | Dragging the timeline height also dragged the side-panel show/hide handles vertically | the handles were children of `.main-layout`, so their `top: 50%` anchor resolved against the box the timeline resize shrinks | the handles are children of the editor SHELL `.app-container` (viewport height, never changed by the timeline), with `position: relative` made explicit on the shell; a timeline drag from the minimum height to the maximum and back leaves them exactly where they were (`53f1941`) |
| R3-03 | The timeline divider carried an indigo/neon glow | decorative accent on a structural divider | a restrained neutral line that yields to the accent only on hover/focus — the painted line is the padding box, the borders stay hit area (`06abc93`) |
| R3-04 | Dragging a keyframe moved only the grabbed diamond | the drag had no set-level mutation authority | the gesture moves the WHOLE selected set captured at press time through `moveKeyframesMutator`, by one frame delta. Collision policy: the move stops at the first frame it would overwrite, and a set may move onto frames its own members vacate; it clamps to the project range. Regressions: `src/tests/keyframeSetMove.test.ts` (`7931867`) |
| R3-05 / R3-06 | The property tree was a flat, badge-numbered list and the lane stack did not line up row-for-row | the tree and the lanes had no shared hierarchy or shared row constants at the group level | the tree reads Layer > Transform > { Position > {X, Y}, Rotation, Scale > {X, Y}, Opacity } and Layer > Trim Path > {Start, End, Offset}; numeric count badges are gone; every disclosure row shares one `DisclosureChevron`; one lane per property row in tree order, with Trim Path a peer group of Transform on both sides, so the outliner tree and the lane column stay pixel-aligned (`53f1941`, `06abc93`) |
| R3-07 | No way to step between a layer's keyframes | navigation was only available globally | previous/next arrows in the layer row resolved by `resolveLayerKeyframeFrames` / `resolveAdjacentKeyframeFrame` over the canonical `resolveTrackChannels` projection. Navigation only: the playhead moves, the document never does (`53f1941`) |
| R3-08 | The loop toggle gave no accessible state | the state was eye-only | the toggle reports its state twice (`aria-pressed` for assistive technology and the existing `.active` treatment for the eye); the wrap stays the playback authority's job and the flag is **view state, deliberately NOT serialized** with the project (`53f1941`) |
| R3-09 | No one-click way back to frame 0 | missing transport control | a go-to-frame-0 button in the transport band (navigation only) (`53f1941`) |
| R3-10 / R3-11 | A layer-level keyframe action wrote the legacy composite list while the expanded Location X/Y rows read the canonical channels — so aggregate diamonds vanished while the evaluator still played the legacy animation. Two animation stores, two answers | the legacy composite list and the canonical channel list were both writable, and no single authority reconciled them | ONE canonical authored truth: `addTransformKeyframeGroupMutator` authors the aggregate/canonical transform keyframe group from the layer's evaluated authored pose (the timeline `+`, the Outliner `+` and the Inspector keyframe panel all write through it); `migrateLegacyKeyframesToCanonical` re-expresses a legacy composite list as canonical channel keyframes using the evaluator's own resolution and drops the redundant list; the Inspector transform write path is the channel path only; and **`resolveTrackChannels` is the one READ truth** that `TrackLane` (layer row and channel lanes) and `KeyframesTab` both project, so no store can show on one row and hide on another (`947dd48`) |
| R3-12 | GROUP, BIND and BOOLEAN appeared in the Details surface as well as in the toolbar / context menu | structural commands were duplicated in the Inspector | the three sections left Details; their commands live in the top authoring toolbar and the editor context menu, and Bind is surfaced in the toolbar through ONE domain hook, `usePartBindingAuthoring`, instead of an Inspector-local copy of the binding logic. Details becomes a pure property/tab surface (`90b602e`) |
| R3-13 | Ungroup refused every animated container ("Ungroup cannot redistribute an animated group"), so an animated group could never be dissolved without deleting its keys and losing the motion | the container's motion had nowhere to go | Ungroup now BAKES the container's motion into every child, so the child's standalone animation `containerLocal(t) ∘ childLocal(t)` evaluates to exactly the world pose it had inside the container at every frame: an exact affine fold per sequence scope while the container's own local transform is constant and unrotated (every authored key keeps its time and easing), otherwise a documented per-integer-frame bake over the union span of the container's and the child's own local key times; each child's base transform takes the container's authored local transform; `composeWorldTransform` is now the single parent-child composition authority (`evaluateTransform` uses it instead of its own inline copy); opacity, masks and Trim Path are never inherited and stay untouched; the container and its track are removed last. The blanket refusal is gone; ONE narrow and actionable refusal remains: a child pinned by a stage anchor (whose x/y the evaluator overwrites after keyframe resolution) cannot receive a baked position (`a123a5a`) |

## 4. Proofs behind the round-3 contract

- **Channel authority (R3-10 / R3-11)** — `src/tests/channelKeyframeAuthority.test.tsx`: the layer row
  and the channel lanes project the same canonical store; an aggregate keyframe action and an expanded
  X/Y write land in the same channels; a channel write can never hide animation that is still playing;
  import materialises the legacy fallback into the channels it still drives.
- **Animated-ungroup parity (R3-13)** — `src/tests/ungroupBake.test.tsx` drives the PRODUCT's ungroup
  action and samples the animated span: the child's standalone world pose equals its in-container world
  pose — **world-pose parity 0.000e+0 over 26 frames** — plus undo/redo, save/reload, OGraf runtime and
  static export parity. `src/tests/layerGrouping.test.ts` covers the static and animated fold cases,
  multiple children, per-sequence scopes, folded-easing preservation, and the surviving stage-anchor
  refusal.
- **Multi-key collision policy (R3-04)** — `src/tests/keyframeSetMove.test.ts`: frame-group location and
  provenance, representative vs per-channel grab, cross-track selections, spacing preservation,
  backwards moves, clamping to frame 0 and the project end, and the collision rule (a move stops at the
  first frame it would overwrite; a set may move onto frames its own members vacate).

## 5. Two stale specs the browser suite caught, and their migration

The first FULL Chromium run on the pre-migration revision was **359 passed / 2 failed** — two specs
still asserted behaviour round 3 deliberately replaced. Neither assertion was weakened, skipped,
retried or tolerance-hacked; both were migrated to the new authorities (`91f9fde`):

- `e2e/authoring-ux-interactions.spec.ts` asserted the removed blanket ungroup refusal. It now proves
  the new contract in a real browser: the animated container and its track dissolve, the children stay
  in the world pose they had while parented, and ONE undo restores the container, its keys and the
  parenting with a byte-identical document.
- `e2e/v51-recovery.spec.ts` asserted `inspector-hidden` on `.main-layout`. R3-02 moved the panel
  visibility flags (and the handles whose anchor they define) to the editor shell `.app-container`, so
  the spec asserts them there — the same hidden/visible lifecycle, on the element that now owns it.

The full suite was then re-run on the migrated revision: **361 passed, 0 failed, 0 flaky**.

## 6. The previously reported load-sensitive flake

`e2e/camera-transition-stability.spec.ts` — "repeated chrome toggles never drift the world on any frame"
— failed once under full-suite load on a much earlier head (`03f4e26`) and could not be reproduced since.
**On the round-3 head it passed in both full runs** (`--retries=0`), and its assertion, its
`DRIFT_TOLERANCE_PX` (1px) and `MAGNIFICATION_TOLERANCE` (0.002), its sampling density and its
`animating >= 4` observation check were **not** weakened, skipped, retried or tolerance-hacked. The spec
is unchanged from the round-2 head.

## 7. Validation on the round-3 head (isolated ports only; 5173/5000 never touched)

| Command | Result |
|---|---|
| `npm run validate:ograf` | PASS — `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| `PORT=5011 npm run qa:release` | PASS — release gate passed (2 tests) |
| `PORT=5011 npm run qa:v6` | PASS (3 tests) |
| `npm run check` (oxlint + `tsc -b` + vitest + build) | PASS — 153 test files / 2,325 tests, build built |
| `node scripts/check-state-consistency.mjs` | PASS — 40 checks |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |
| **FULL Chromium** `CI=1 PORT=5011 npx playwright test --retries=0` | **361 passed, 0 failed, 0 flaky** (2.7m) |

No assertion was weakened, no spec was skipped to make it pass, no retry was added, and no arbitrary
sleep or tolerance hack was introduced.

## 8. PR #9 and CI

- **PR #9 — OPEN, not merged**: `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`,
  base `main`, head branch `fix/manual-qa-round1-remediation`.
- Round-3 code head `91f9fde9fb67a24881747aaba3c50f7249590fcb` (`91f9fde`), mergeable MERGEABLE, merge
  state CLEAN. CI **CI Pipeline** run `38384921198` (`pull_request`) — **success**.
- The branch tip adds the docs refresh that carries this bundle; the code head above is the revision the
  full gate was run on.
- CI runs lint, `tsc -b`, the Vitest suite and the production build; the browser e2e suite is not part of
  `ci.yml`, so the FULL Chromium run in §7 is the browser gate for this head.

## 9. Live surfaces (this task never bound, stopped or restarted them)

| Surface | State |
|---|---|
| Repository | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical checkout, `main`, clean at `8e2df61`) — untouched |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1` |
| UI 5173 | vite listener pid **33512** serving THIS worktree; HTTP 200; **never stopped or restarted** |
| API 5000 | pid **8872** — **never stopped or restarted**; `/api/health` 200 |
| Isolated test ports | UI 5188 / API 5011 (`CI=1 PORT=5011`) — the only ports the tests used |
| Release | No tag created/moved, no GitHub release published/finalized, npm never published, PR #9 not merged |

## 10. User retest list (the merge gate)

On `http://localhost:5173` (branch `fix/manual-qa-round1-remediation`):

**Round 3**

1. **R3-01** — collapse and restore the timeline from the small edge handle on its top edge; it carries no label and the authored height returns.
2. **R3-02** — open both side panels, then drag the timeline from its minimum height to its maximum and back: the left/right show-hide handles must not move up or down.
3. **R3-03** — look at the timeline divider: a restrained neutral line, no neon glow (accent only on hover/focus).
4. **R3-04** — box-select several keyframes, then drag one: the whole set moves together; dragging onto an occupied frame stops at the collision.
5. **R3-05 / R3-06** — expand a layer: the tree reads Layer > Transform > { Position > {X, Y}, Rotation, Scale > {X, Y}, Opacity } and Layer > Trim Path > {Start, End, Offset}, with no numeric badges, and each row lines up with its lane.
6. **R3-07** — use the layer row's `[◀][+][▶]` arrows: the playhead jumps between that layer's keyframes; the document is not modified.
7. **R3-08** — toggle loop: the button shows its pressed state to assistive technology, and reloading the project does not persist the toggle.
8. **R3-09** — click the go-to-frame-0 transport button: the playhead returns to frame 0.
9. **R3-10 / R3-11** — press the timeline `+` on a layer, then expand its X/Y rows: the keyframes must appear on the channels that are actually playing, and editing a value must not make the layer-level keys vanish.
10. **R3-12** — Details no longer shows GROUP, BIND or BOOLEAN; Group, Bind/Unbind and the Boolean operations remain in the top toolbar and the right-click menu.
11. **R3-13** — animate a group (keyframe the container), then Ungroup: the group dissolves, each child keeps the exact position it was drawn at, and one Ctrl+Z restores the group.

**Round 2 (re-check)**

12. **R2-05** — rotate a group by its rotation handle: the frame turns in place, the visible centre does not orbit.
13. **R2-04** — select a group / multi-selection with a geometryless container: no stray square appears.
14. **R2-02** — drag the timeline's top edge and use the height presets while watching the canvas: the authored world must not jolt.
15. **R2-01** — collapse and restore the timeline; the authored height returns.
16. **R2-03** — drag the divider between the layer list and the time region; the frame a pointer x maps to stays correct.
17. **R2-10 / R2-12** — drag a box over several keyframe diamonds: they select together; Shift/Ctrl adds; Escape restores the previous selection; a plain click on empty space clears it. (Moving the selected keys together is now available — see R3-04.)
18. **R2-11** — click keyframe diamonds: the click target is comfortable while the diamond stays small; selected keys are filled, unselected hollow.
19. **R2-09** — expand a layer: the property stack is compact and each row lines up with its lane; the opacity lane is present.
20. **R2-06 / R2-08** — Group/Ungroup are not in Details (toolbar + context menu only), and the toolbar has no Fill/Stroke (paint is in the Inspector); Boolean and Group/Ungroup stay visible and grey out when the selection cannot use them.
21. **R2-07** — right-click anywhere in the editor (canvas, layer list, sequence tab, toolbar, timeline, Details, text field): no browser menu; KCS custom menus still open.

**Round 1 (re-check)**

22. **A** — toggle the left toolbar and the right inspector: the authored world must not slide or rescale.
23. **B / C / E** — drag inside a selected group (whole group moves, a plain click still picks the child); no pivot square; an edge drag keeps the opposite edge fixed.
24. **D** — rotate a group: no border jitter.
25. **F** — press the timeline `+` twice on a grouped/parented layer: the layer must not move.
26. **G** — expand a layer: the `Transform` row names its owning layer and is nested under it.
27. **H** — right-click a sequence tab: no browser menu.
28. **I** — select a layer over light and dark artwork: the frame is readable, no black halo.
29. **J** — the floating pill is gone; the top strip is the authoring toolbar; `V`/`H`/`+`/`-` shortcuts still work.

## 11. Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in the latest bundle needs to be uploaded.
