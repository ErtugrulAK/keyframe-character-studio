# WP-01 — Mask authoring scope consistency: plan

## Source facts revalidated at base `39f6414`

| Finding | Current source | Status |
|---|---|---|
| C-02 | `DetailsPanel.tsx:59` calls `evaluateLayerMasks(part, track, frame)` without the active sequence; the evaluator defaults to `'Sequence'`. `evaluateFrame.ts:111` passes the sequence. | SOURCE confirmed |
| C-03 | `usePartPropertyAuthoring.handleDisplayedPartPropChange` writes a mask scalar to a keyframe only when one exists at the exact frame; between keys the edited value lands on the base mask, where the keyed channel hides it. It also copies the EVALUATED value of every other keyed scalar onto the base mask. | SOURCE confirmed (extra: evaluated→base copy) |
| C-04 | `StyleMatteSection.tsx:285` builds `mask-${length + 1}`. | SOURCE confirmed |
| C-05 | `useTimeline.authorMaskPath` (line 345–349) checks `keyframes.length` across all sequences. | SOURCE confirmed |
| Extra | `authorMaskPath` → `addMaskPathKeyframeMutator` replaces an exact-frame key with a fresh object and the default `easeInOut` easing, dropping the key's easing and bezier metadata. | SOURCE confirmed |
| Lock | `track.locked` and `LayerMask.locked` are stored and serialized but no authoring path enforces them (Inspector transform edits do not either). | SOURCE — product decision, see below |

## Smallest change (existing authorities reused)

1. `DetailsPanel`: pass `activeTemplateId || 'Sequence'` to `evaluateLayerMasks`.
2. `trackMutations`: one pure mutator that authors a scalar property value at the current frame of
   an animated channel: exact (frame, sequence) key → value-only update (existing
   `updatePropertyKeyframeValueMutator`); otherwise insert one key with the sequence's easing
   (existing `addPropertyKeyframeMutator`). Same convention as `updateCurrentPropertyChannel`.
3. `usePartPropertyAuthoring`: compare the edited masks against the evaluated masks of the active
   sequence; only a CHANGED scalar is written — to its channel when animated in the active sequence,
   to the base mask otherwise. Unchanged scalars and the path keep their base values.
4. `useTimeline.authorMaskPath`: scope the animated decision to the active sequence; update an
   exact-frame key in place (metadata preserved); insert with the sequence's easing between keys;
   no-op for a missing owner or a deleted mask.
5. `layerMasks`: pure `nextLayerMaskId(masks, reservedIds)` that never returns an ID used by the
   owner's masks or by mask channels still stored on the owner's track. `StyleMatteSection` uses it
   via an optional `reservedMaskIds` prop. Existing IDs are never renamed.

Forbidden and not touched: renderer math, scene version, other properties, existing mask IDs.

## Lock decision (recorded, no hidden behavior added)

No current authoring path enforces `track.locked`/`LayerMask.locked`. WP-01 keeps the mask
Inspector consistent with the transform Inspector (edits are allowed, the flag is preserved).
Enforcing locks would be a cross-cutting product change and needs a separate decision.

## Regression plan

- Pure: mutator exact-key update keeps easing/bezier/template; insert uses sequence easing; other
  sequences untouched.
- Hook: between-key scalar → new key at the frame, base unchanged; other-sequence keys → base write;
  unchanged keyed scalars are not copied onto base; no track → base write; Intro sequence.
- `authorMaskPath`: other-sequence keys → base write; active-sequence between keys → insert;
  exact key → metadata preserved; deleted mask → no-op.
- `nextLayerMaskId`: imported `mask-2` single mask, reserved channel IDs, empty list.
- Component: DetailsPanel shows the active sequence's mask value.
- History: parts + tracks restore together for one edit.
- Browser: feather at frames 0/10/20 in the Intro sequence, Sequence unchanged, Undo/Redo.
