# Progress 186 - K3 Mask Group in the Timeline Outliner

Date: 2026-10-18T16:50Z (UTC) · Base: `feat/k2-duplicate-keyframe-gesture@0d3f940`
· Branch: `feat/k3-mask-outliner-rows`
(worktree `.worktrees/k3-mask-outliner-rows`, stacked on K2 → #24)

## Scope

Per-mask animation channels (`maskId:opacity|feather|expansion|path`) lived
on the track and painted lanes but had no rows: they could not be armed,
navigated, or disarmed from the property strip. K3 adds a collapsible **Mask**
group to every layer's outliner tree — after Trim Path, one row per animatable
property per mask the layer owns — and moves the mask lanes to sit after the
trim lanes so tree and band stay row-for-row aligned (R4-06).

## Design: the same authorities, widened

No new stores, no new mutation paths:

- `TrackOutlinerRow.renderChannelRow` accepts `AnimationChannel`; its key
  read and label resolve through a store-switch (`maskPathChannels` /
  `maskChannels` / `channels`) and a mask-aware meta (`M1 opacity`, amber;
  path sky-blue — mirroring the lane's existing meta).
- `resolveChannelKeyframeFrames` (timelineMetrics) is the widened read the
  nav arrows use, so arrows and lane diamonds agree for mask channels too.
- Arm/disarm reuse K1 verbatim: `armChannel`/`disableChannelAnimation`
  widened to `AnimationChannel`; `channelArmValue`/`applyChannelStaticValue`
  gained the per-mask branches (arm reads `mask[property]`, static write
  lands on the owning mask). The stop-dialog label names the MASK (`"M2
  opacity" of Alpha`), not the raw key.
- A mask PATH row navigates its geometry keys but shows no stopwatch and a
  disabled plus: shape keys are authored on the path lane, and pretending
  otherwise would invite a meaningless key write.
- The group only exists when the layer owns masks. Default collapsed.

## Evidence

- Unit 5/5 (order after Trim, maskless silence, collapse/expand with all 8
  rows for 2 masks, arm keyed-at-playhead, D2 disarm with `M2` in the dialog
  and keys cleared after confirm, lane mirror order by `data-lane-channel`).
- Chromium (release-gate lane): isolated K3 spec **2/2 passed**:
  the group appears below Trim collapsed, expands to the three scalar
  stopwatches, arming flips `m1:opacity` to keyed; the disarm journey names
  the mask (`M1`) in the dialog, cancels to a still-keyed state, and the
  confirmed second press flips it back to off.
- Full Vitest 182 files / 2735 tests; `tsc -b` 0; oxlint 0.

## Compatibility

Transform/trim rows byte-identical (existing suites unmodified and green);
`onAddChannelKeyframe`/`onToggleChannelAnimation` widened, not changed in
behavior, for every previously valid call; documents without masks render
exactly as before.
