# Progress 184 - K1 Property Animation (Stopwatch) Controls

Date: 2026-10-18T13:40Z (UTC)
Base: `main@0ec6ce2` · Branch: `feat/k1-property-animation-controls`
(worktree `.worktrees/k1-property-animation`)
Contract: sprint decision **D2** (per-property animation controls; never delete
authored animation silently).

## What shipped

A stopwatch on every animatable channel row of the timeline outliner tree
(Position X/Y, Rotation, Scale X/Y, Opacity, the 4 mask-offset channels, Trim
Path Start/End/Offset) with three honest states read from the ONE channel
store — `off` / `animated` / `keyed` — projected template-scoped (a key in
another sequence never lights this sequence's stopwatch).

- **Activate** (`off` → writes): the first key lands at the PLAYHEAD holding
  the property's evaluated current value, captured through the same
  `resolveAuthoredLocalTransform` authority the aggregate `+` uses (finding-F
  safe: container-local, parent-chain correct). No duplicate is ever written:
  an animated channel is never re-initialised.
- **Deactivate** (any on-state → asks first): a confirmation dialog names the
  property and its key count BEFORE any mutation. Cancel/Esc = zero state
  update (not even array identity). Confirm = the keys of the ACTIVE sequence
  are cleared and the value the timeline evaluates AT THE PLAYHEAD survives as
  the authored static value — in one state batch, restored by ONE undo.
  Other sequences' keys survive (D2: never silent, never cross-sequence).
- The Inspector's pre-existing **Clear Animation** button (which silently
  removed every key of the selected layer) now asks through the same dialog
  and reports the key count it is about to delete.
- Mask scalar/path properties keep their existing editors; their per-property
  stopwatches arrive with the K3 mask-row tree (the state resolver and the
  mutator already accept mask channels — no new storage).

## Changed files

- `src/utils/trackMutations.ts` — `clearChannelAnimationMutator` (scope-aware disarm writer).
- `src/utils/channelKeyframeGroups.ts` — `applyChannelStaticValue`, `channelArmValue` (exhaustive over all 13 TrackChannels: every property has a real static write path — nothing excluded).
- `src/utils/timelineMetrics.ts` — `resolveChannelAnimationState` (pure, accepts mask channels too).
- `src/hooks/useTimeline.ts` — `armChannel`, `disableChannelAnimation` (through the existing mutators; one batch).
- `src/context/AnimatorContext.tsx` — the two APIs published.
- `src/components/Timeline/TrackOutlinerRow.tsx` — stopwatch button (aria-pressed, data-animation-state, accessible names).
- `src/components/Timeline/SequencerTimeline.tsx` — the disarm ConfirmationDialog owner + the press dispatcher (arm direct / ask first).
- `src/components/Timeline/SequencerTimeline.css` — three-state styling.
- `src/components/Inspector/DetailsPanel.tsx` — Clear Animation now confirmation-gated (D2).
- `src/tests/k1PropertyAnimation.test.tsx` (new, 13), `e2e/k1-property-animation.spec.ts` (new, 3).
- `src/tests/channelAuthoredKeySemantics.test.tsx` — `channelNav` selector moved from button-index to accessible-name (K1 adds a button to the strip; the pinned contract — prev/next ENABLED state — is unchanged).

## Evidence

- RED: 13/13 new rows failed before production code (missing affordance).
- GREEN: focused 13/13; full Vitest **180 files / 2722 tests** (baseline 2709 + 13).
- `tsc -b` 0 errors (note: this repo's `tsc --noEmit` is a solution-config no-op — the real gate is `tsc -b`), oxlint 0, production build clean.
- Chromium (release-gate lane, webServer :5189): isolated K1 spec **3/3 passed**. The full-suite gate runs on the PR CI. Two honest corrections landed during e2e bring-up: the seed must be injected with a one-time `setItem` + reload (an `addInitScript` re-seeds on every reload and would fake the persistence check), and value reads go through the header badge's manual save (`flushSave` waits for `data-last-saved-at` to advance) because autosave's own cadence is a 10s interval — the same adoption gate m23 uses.
- Journey proof inside the tests: animate at playhead → value 120 captured; frame 15 linear 100→700 disarms to static **400** (independent arithmetic); ONE undo restores keys + original static **100**; reload keeps **400**.

## Compatibility

No schema change; no serialized field added; documents untouched by K1 import
and render bit-identically (the stopwatch writes through the same channels the
`+`/star buttons already use). Existing suites green unmodified apart from the
selector robustness update above.
