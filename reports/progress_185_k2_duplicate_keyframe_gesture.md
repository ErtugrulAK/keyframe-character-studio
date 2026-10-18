# Progress 185 - K2 Alt-Drag Keyframe Duplication (D1)

Date: 2026-10-18T16:10Z (UTC) · Base: `feat/k1-property-animation-controls@18e26d7`
· Branch: `feat/k2-duplicate-keyframe-gesture`
(worktree `.worktrees/k2-duplicate-keyframe-gesture`, stacked on K1)

## Scope (sprint decision D1)

Alt + press + travel on a timeline diamond duplicates the pressed frame group
onto the drop frame. One gesture, one history entry, silent on success. A
blocked drop (collision, out of range) or Escape cancels with **zero**
mutation and **exactly one** warning — never a silent clamp.

## Design: extend the authority, no second engine

The right-click "Duplicate Frame" already owns group duplication as the pure
`duplicateKeyframeGroup(track, sourceFrame, offset, totalFrames)` helper. K2
reuses it verbatim:

- `AnimatorContext.duplicateKeyframeGroupAt(trackId, source, target): boolean`
  — the same helper with a dynamic target frame and **no batch of its own**
  (the gesture already owns one; a nested pair recorded a spurious undo entry
  — found and fixed during GREEN).
- `KeyframePress.altKey` → `KeyframePressArm.altKey/trackId` →
  `KeyframeDrag.mode: 'move' | 'duplicate'`.
- The existing single gesture state machine branches at the travel threshold:
  alt mode never mutates in flight; each move only re-runs the pure helper as
  a dry-run preview and stamps `data-duplicate-target="valid|blocked"` on the
  grid (CSS: copy vs not-allowed cursor + edge tint).
- Release re-validates against the CURRENT document and commits, or emits the
  single D1 warning. A neutral drop (target === source) says nothing.
- Escape (new window keydown, duplicate mode only) neutralizes `appliedFrame`
  so the release path takes the silent neutral branch.
- Duplicate drop frames are read RAW (unclamped): clamping would turn a
  past-the-edge drop into a legal-looking frame; D1 demands refusal.

## Evidence

- RED: 6/8 new rows failed before production (the 2 passes are the
  pre-existing threshold and plain-move regression guards — honest by design).
- GREEN: focused 8/8; full Vitest **181 files / 2730 tests**; `tsc -b` 0;
  oxlint 0.
- Chromium (release-gate lane): isolated K2 spec **3/3** — valid drop copies
  silently (3 aggregate diamonds), collision refuses with one visible warning
  and zero mutation, Escape mid-drag cancels clean.
- The unit matrix additionally pins: one-undo data identity (deep-equal, not
  byte order — the helper legitimately re-creates objects), refusal adds no
  undo entry (the next success still undoes in one step), group-wide copy
  with values/easings intact, and the preview attribute lifecycle
  (valid → blocked → removed).

## Compatibility

Move-drag semantics byte-identical (regression row green); plain press-click
unaffected; `duplicateKeyframeGroup` (menu/hotkey) untouched; no serialized
field changed. K1 PR #24 CI: pass.
