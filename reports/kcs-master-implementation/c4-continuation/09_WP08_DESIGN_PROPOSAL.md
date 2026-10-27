# WP-08 — mask-constrained colour correction: design proposal

> C6 update (2026-10-23): **option B approved by the user and implemented** in the first slice
> below (images: brightness, contrast, saturation, amount; enable/reset; whole layer or one mask;
> effect-only masks). Scenes that use an effect or an effect-only mask are written as version 3;
> every other scene is still written as version 2; this build reads 1–3; a build before C6 refuses
> v3 with "The file declares scene version 3, which this build does not know how to apply" (checked
> against the fixed QA build). Existing user files are never converted in bulk.
>
> Differences from the text below, found while implementing:
> - Copy/paste and duplicate: mask ids are unique only within a layer and the copies keep them
>   (`structuredClone`), so a copied effect's `maskId` already points at the COPY's own mask — no
>   remapping is needed. Effect ids are kept for the same reason (nothing outside the layer refers
>   to them).
> - GIF export renders the correction (it uses the same SVG renderer: pixel-checked); OGraf blocks
>   colour correction AND effect-only masks with an ERROR (its runtime would read an effect-only
>   mask as an alpha cut). There is no Lottie export (Lottie is import-only).
> - Undo of a slider drag is one step; with keyboard focus still on the slider, Ctrl+Z belongs to
>   the form field (the editor-wide rule for every Inspector field), so Undo is the toolbar control
>   or Ctrl+Z after leaving the field.
>
> C5 note (superseded): WP-08 still waits for your schema decision.

Status (C4/C5, superseded by the C6 update above): **waiting for the user's schema approval**. The instruction for item 9 says new persistent
data must be presented before implementation, and that the approval does not cover an incompatible
schema/migration change. WP-08 needs new persistent data, so only the feasibility spike (QA-only,
no product code, no scene data) was done.

Source compared: research `KCS_ASTRA_RESEARCH/KCS_MASTER_REVIEW/07_MASKED_COLOR_CORRECTION_SPEC.md`
(PROPOSED / class D) against the current code.

## 1. Current code vs. the research definition

| Topic | Current code | Gap |
|---|---|---|
| Mask geometry/visibility | `LayerMask[]` on the part (`mode`, `inverted`, `enabled`, `feather`, `opacity`, `expansion`, `locked`); rendered as SVG `<mask>` chains in `StagePartLayers`; every mask cuts alpha | no mask can be "effect-only" |
| Effects | drop shadow only (`shadowColor`…, `feDropShadow` in `PartRenderer`); no effect list | no effect instance model |
| Animation | canonical `Track.channels`, `maskChannels`, `maskPathChannels` | effect parameter animation = later slice (spec agrees) |
| Scene version | writer `version: 2`; reader accepts `[1, 2]` and REJECTS a higher version with a clear message (`utils/importValidation.ts`) | a v3 file is refused by this build, not mis-rendered |
| OGraf export | V6 masks / alpha-luminance mattes diagnosed as deferred | the new effect must be diagnosed as ERROR (blocks export) until the runtime renders it |

## 2. Feasibility spike (done) — `qa/evidence/c4-wp08-spike.evidence.ts`, `evidence/c4-wp08-spike/`

Equation (spec): `C_out = (1 − w)·C + w·F(C)`, `A_out = A`, `w = m·q`.
SVG graph tested inline in Chromium: `<g isolation:isolate>` → original under mask `1 − w`, plus
`F(original)` under mask `w` with `mix-blend-mode: plus-lighter` (premultiplied add). F =
brightness offset → contrast about 0.5 (`feComponentTransfer`) → saturation (`feColorMatrix`,
Rec.709 weights), `color-interpolation-filters="sRGB"`. Six patches (A = 1, 0.5, 0.25, 0), coverage
m = 1/0, amount q = 1/0.5/0, read back from a transparent screenshot:

| Graph | q | worst colour error | worst alpha error |
|---|---|---|---|
| **plus-lighter (proposed)** | 1 / 0.5 / 0 | 0.011 / 0.008 / 0.008 | **0.002** (8-bit rounding) |
| source-over copy (rejected) | 1 / 0.5 / 0 | 0.153 / 0.051 / 0.008 | **0.253** / 0.128 / 0.002 |

Result: the existing SVG renderer can express the equation exactly (within 8-bit premultiplied
rounding) without a second compositor; the naive overlay really breaks alpha. Note found: every
SVG filter primitive clamps its result, so the deterministic order is brightness → contrast →
**clamp** → saturation → clamp. Not yet proven: feathered coverage (the existing feather blur on
the mask), animated mask paths, image layers with real alpha, Track Matte + layer opacity on top,
performance at 1080p/4K — part of the implementation slice.

## 3. Proposed first slice

- Layer types: `custom_image` only (spec minimum); later shapes/text.
- One correction per layer, one same-layer effect mask, static parameters:
  brightness [−1, 1] neutral 0 · contrast [0, 2] neutral 1 · saturation [0, 2] neutral 1 ·
  amount [0, 1] default 1 · enabled default true. Neutral values = identity (pixel test).
- Order: decoded image / content transform → correction mix → layer masks (alpha) → Track Matte →
  layer opacity → stacking.
- Scope: `Whole layer` or `Mask` (explicit). A disabled or missing mask = effect NOT applied
  (never silently global) + diagnostic.
- UI: Inspector › Effects › Color Correction (enable/bypass, Reset to neutral, scope, sliders),
  "Create effect mask" (draws an effect-only mask and enters mask editing), edit-only "Show coverage".
- Exposure, hue, temperature/tint: deferred (spec).

## 4. Persistent data — the decision needed

```ts
interface LayerMask {
  // …existing fields…
  /** NEW, optional. Absent = true: the mask cuts the layer's alpha exactly as today. */
  affectsAlpha?: boolean;
}

interface ColorCorrectionEffect {
  id: string;
  type: 'colorCorrection';
  enabled?: boolean;            // absent = true
  amount?: number;              // absent = 1
  brightness?: number;          // absent = 0
  contrast?: number;            // absent = 1
  saturation?: number;          // absent = 1
  scope: 'layer' | 'mask';
  maskId?: string;              // required when scope = 'mask'; same part's masks[]
}

interface CharacterPart {
  // …existing fields…
  /** NEW, optional. Absent = no effects (every existing scene). */
  effects?: ColorCorrectionEffect[];
}
```

Old projects: nothing to migrate — absent fields mean today's behaviour. Writer options:

| Option | What an older KCS build does with a file that USES the feature | Recommendation |
|---|---|---|
| A. Stay `version: 2`, additive fields | ignores `affectsAlpha: false` → the effect mask CUTS the image (wrong picture, silently) | rejected (spec: "v2'ye sessiz ekleme güvenli sayılmaz") |
| B. Write `version: 3` only when a scene uses `effects` or `affectsAlpha: false`; otherwise keep writing 2 | this build and later refuse v3 with the existing clear message ("open it in the version that wrote it") | **recommended** |
| C. Always write 3 | every saved scene becomes unreadable for builds before the change | not recommended |

Serialization: `useSerialization` writes/reads the fields (no new serializer); `SUPPORTED_SCENE_VERSIONS`
becomes `[1, 2, 3]`; validation of ranges, `scope`/`maskId` consistency and unknown `type` through
the existing `importValidation` path (whole file refused before mutation); history snapshots
already cover `characterParts`.

Copy, duplicate and animation transfer (corrected in C5 — the earlier wording grouped them):
- **Part copy/paste and duplicate** create a NEW part from the source, so they copy its visual
  data with it: `effects` get fresh effect ids, and every `maskId` is remapped to the id of the
  copied mask (an effect never points at the source part's mask).
- **Animation transfer** (M26, AGENTS.md §14) copies ANIMATION only: channels, legacy keyframes,
  IN/OUT preset ids and durations. It must NOT change the target's `effects`, masks, matte
  (Track Matte or legacy), geometry, media, hierarchy or z-order — exactly as today for masks and
  mattes. If keyed effect parameters are ever added, transferring them is a separate design
  decision, not part of this proposal.
- Tests planned for this: a duplicate's effect `maskId` points at the duplicate's own mask; an
  animation transfer onto a part with effects leaves its `effects` deep-equal.

Export capability report: OGraf — ERROR "Colour correction is not rendered by the OGraf runtime
yet" (blocks export, never flattened); GIF export goes through the same SVG renderer (supported once
implemented, pixel-tested); Lottie — not supported, reported.

## 5. Tests planned (after approval)

Unit: schema defaults/validation/round-trip, v2/v3 writer selection, version refusal; evaluator
coverage (missing/disabled mask, scope). DOM: filter graph structure, neutral = no filter. Pixel
(Playwright): the spike oracle on the product renderer (ramps × A × m × q), feather edge smooth,
mask-outside identity, alpha unchanged on transparent edges, disable/reset identity, animated mask
path @0/10/20, edit vs broadcast parity; undo of one slider drag = one step; save/reload.

**Decision requested:** approve option B (fields as above, v3 only for scenes that use them) — or
name another option — before WP-08 implementation starts.
