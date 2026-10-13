# Progress 167 — Manual QA round 3 remediation

Date: 2026-10-13
Repository (canonical, untouched): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
Worktree (this work): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
Branch: `fix/manual-qa-round1-remediation` (base `origin/main` at `8e2df61`)

## Scope

Round 3 of the manual QA pass produced thirteen findings (R3-01…R3-13) on top of the round-1
set (A–J) and the round-2 set (R2-01…R2-12). This record carries every round-3 finding to a green
full-suite gate on the frozen head, updates PR #9 and refreshes the handoff bundle. No merge, no
release, no tag, no npm publication, no force push, no rebase, no history rewrite, no
package/dependency/workflow change.

## Commits (round 3)

| Commit | Finding(s) | Change |
|---|---|---|
| `947dd48` | R3-10, R3-11 | One canonical authored truth for transform keyframes; `resolveTrackChannels` is the one READ truth. |
| `7931867` | R3-04 | Dragging a keyframe moves the whole selected set by one frame delta; its collision/clamp regressions. |
| `a123a5a` | R3-13 | Ungroup bakes an animated container's motion into every child instead of refusing. |
| `53f1941` | R3-01, R3-02, R3-05, R3-06, R3-07, R3-08, R3-09 | Timeline navigation and workspace-control refinement (handles on the shell, edge-handle collapse, layer keyframe navigation, loop toggle, frame-0 button, property-tree hierarchy). |
| `06abc93` | R3-03, R3-05, R3-06 | Timeline hierarchy and resize affordances styling; tree/lane row alignment. |
| `90b602e` | R3-12 | GROUP, BIND and BOOLEAN sections removed from Details; their commands live in the toolbar and the context menu through one binding hook. |

## Findings, root cause, fix, evidence

- **R3-01 timeline collapse.** The collapse control was a labelled button floating inside the header
  band. It is now a compact edge handle (`.sidebar-handle.timeline-edge-toggle`) that straddles the
  panel's own top edge — the boundary the height drag owns — carries no text, and stays reachable
  while collapsed. The authored height is never touched, so expanding restores it exactly.
- **R3-02 side-panel handles dragged by the timeline.** Root cause: the show/hide handles were children
  of `.main-layout`, and their `top: 50%` anchor resolved against that box — which the timeline resize
  shrinks. They are now children of the editor shell `.app-container` (viewport-height, never changed
  by the timeline), with `position: relative` made explicit on the shell, so a timeline drag from the
  minimum height to the maximum and back leaves them exactly where they were.
- **R3-03 timeline divider.** The indigo/neon glow was replaced with a restrained neutral line that
  yields to the accent only on hover/focus; the painted line is the padding box, the borders stay hit
  area.
- **R3-04 multi-key move.** Dragging any selected keyframe now moves the WHOLE selected set by the same
  frame delta instead of only the grabbed diamond. Collision policy: a move stops at the first frame it
  would overwrite, and a set may move onto frames its own members vacate; the move clamps to the
  project range. Regressions: `src/tests/keyframeSetMove.test.ts`.
- **R3-05 / R3-06 property tree.** The tree reads Layer > Transform > { Position > {X, Y}, Rotation,
  Scale > {X, Y}, Opacity } and Layer > Trim Path > {Start, End, Offset}; numeric count badges are
  gone; every disclosure row shares one `DisclosureChevron`; the outliner tree and the lane column stay
  pixel-aligned, row-for-row, with Trim Path a peer group of Transform on both sides.
- **R3-07 per-layer keyframe navigation.** Previous/next keyframe arrows in the layer row, resolved by
  `resolveLayerKeyframeFrames` / `resolveAdjacentKeyframeFrame` over the canonical
  `resolveTrackChannels` projection. Navigation only: the playhead moves, the document never does.
- **R3-08 loop toggle.** The transport loop toggle reports its state twice (`aria-pressed` for
  assistive technology and the existing `.active` treatment for the eye); the wrap itself stays the
  playback authority's job and the flag is view state — it is deliberately NOT serialized.
- **R3-09 go-to-frame-0.** A transport button moves the playhead to frame 0 (navigation only).
- **R3-10 / R3-11 two animation stores, two answers.** A layer-level (aggregate) keyframe action wrote
  the legacy composite list while the expanded X/Y rows read the canonical channels, and the first
  canonical channel write switched the layer row to the channel projection — so aggregate diamonds
  vanished while the evaluator still played the legacy animation. There is now one canonical authored
  truth: `addTransformKeyframeGroupMutator` authors the aggregate/canonical transform keyframe group
  from the layer's evaluated authored pose (the timeline `+`, the Outliner `+` and the Inspector
  keyframe panel all write through it); `migrateLegacyKeyframesToCanonical` re-expresses a legacy
  composite list as canonical channel keyframes using the evaluator's own resolution and drops the
  redundant list; the Inspector transform write path is the channel path only; and
  `resolveTrackChannels` is the one READ truth that `TrackLane` and `KeyframesTab` both project, so no
  store can show on one row and hide on another.
- **R3-12 structural actions out of Details.** The GROUP, BIND and BOOLEAN sections leave the Details
  surface. Group/Bind/Boolean are authoring commands and live on the top authoring toolbar and the
  editor context menu; Bind is surfaced in the toolbar through one domain hook,
  `usePartBindingAuthoring`, instead of an Inspector-local copy of the binding logic. Details becomes a
  pure property/tab surface (BOOLEAN, GROUP, BIND gone; their commands remain in the toolbar/context
  menu).
- **R3-13 animated-group ungroup refused.** Ungroup refused every animated container ("Ungroup cannot
  redistribute an animated group"), so a group the user had animated could never be dissolved without
  deleting its keys and losing the motion. Ungroup now bakes the container's motion into every child so
  the child's standalone animation `containerLocal(t) ∘ childLocal(t)` evaluates to exactly the world
  pose it had inside the container at every frame: an exact affine fold per sequence scope while the
  container's own local transform is constant and unrotated (every authored key keeps its time and
  easing), otherwise a documented per-integer-frame bake over the union span of the container's and the
  child's own local key times; `composeWorldTransform` is now the single parent-child composition
  authority; opacity, masks and Trim Path are never inherited and stay untouched; the container and its
  track are removed last. One narrow refusal remains: a child pinned by a stage anchor (whose x/y the
  evaluator overwrites after keyframe resolution) cannot receive a baked position.

## Proofs

- **channel-authority (R3-10/R3-11):** `src/tests/channelKeyframeAuthority.test.tsx` — the pixel/animation
  read of a track is the canonical channel projection; an aggregate keyframe action and an expanded X/Y
  write land in the same store, and a channel write never hides animation that is still playing.
- **animated-ungroup parity (R3-13):** the product's ungroup action is sampled across the animated span
  and the child's standalone world pose equals the in-container world pose — **world-pose parity
  0.000e+0 over 26 frames**, plus undo/redo, save/reload, OGraf runtime and static export parity.
- **multi-key collision policy (R3-04):** `src/tests/keyframeSetMove.test.ts` proves spacing
  preservation, backwards moves, clamping to frame 0 and the project end, and the collision policy
  (stop at the first frame that would be overwritten; a set may move onto frames its own members
  vacate).

## Validation on the frozen round-3 head

Gates run in the isolated worktree (`CI=1 PORT=5011` for the browser gates; the user's live 5173/5000
were never bound, stopped or restarted):

| Gate | Result |
|---|---|
| `npm run validate:ograf` | PASS — `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| `PORT=5011 npm run qa:release` | PASS — release gate passed at candidate SHA `90b602e` (2 tests) |
| `PORT=5011 npm run qa:v6` | PASS (3 tests) |
| `npm run check` (oxlint + `tsc -b` + vitest + build) | PASS — 153 test files / 2,325 tests, build built |
| `node scripts/check-state-consistency.mjs` | PASS — 40 checks |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |
| FULL Chromium `CI=1 PORT=5011 npx playwright test --retries=0` | **361 passed, 0 failed, 0 flaky** (2.7m) |

The first full-suite run on the pre-migration revision was 359 passed / 2 failed: two specs still
asserted behaviour round 3 deliberately replaced (`authoring-ux-interactions.spec.ts` asserted the
removed blanket ungroup refusal; `v51-recovery.spec.ts` asserted `inspector-hidden` on `.main-layout`).
Both specs were migrated to the new authorities in `91f9fde` — not weakened, skipped or retried — and
the full suite was re-run green on that revision. `e2e/camera-transition-stability.spec.ts` passed in
both full runs (no flake observed on this revision).

## Live surfaces (unchanged by this task)

- 5173 QA preview: vite listener pid **33512** serving THIS worktree on branch
  `fix/manual-qa-round1-remediation`; **never stopped or restarted**; `/` answers 200.
- API 5000: pid **8872** — **never stopped or restarted**; `/api/health` answers 200.
