# Progress 125 — Lottie Mask + Track Matte Slice

## 1. Scope

The second implementation slice of the approved Lottie mapping design
(`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`), on top of the import core merged at `ff32d6c`:

- Convert Lottie layer masks (`hasMask`, `masksProperties[]`) through the existing KCS layer-mask
  authority, or report what cannot be represented (design §5).
- Convert Lottie track mattes (`tt`, `td`) through the existing KCS `TrackMatteV2` relation, or
  report the cases the relation cannot carry (design §3).
- Restore the mask limit the first slice deliberately left out of `LOTTIE_IMPORT_LIMITS`.
- Cover the new behaviour with contract tests.

Out of scope by instruction: any UI or import entry point, text/image/precomp conversion, the item-12
unified import entry, and every `package.json`, lockfile, dependency or workflow change. No
evaluator or renderer change was needed — the importer fills fields those authorities already read.

## 2. Branch

`feat/lottie-mask-matte-slice`, created from `main` at `bf8632a`.

## 3. Existing authorities reused

| Authority | Where | How this slice uses it |
|---|---|---|
| `LayerMask`, `LayerMaskMode`, `LayerMaskStack` | `src/types/animator.ts:58-75` | Each Lottie mask becomes one `LayerMask`; no parallel mask model was introduced |
| `maskChannels` / `maskPathChannels` + `layerMaskChannel()` / `layerMaskPathChannel()` | `src/types/animator.ts:197-232` | Animated mask opacity/feather/expansion and mask geometry use the only mask animation channels that exist |
| `TrackMatteV2` | `src/types/animator.ts:77-83` | `tt` 1–4 map onto `mode`/`inverted`; the relation is the same field the inspector, renderer and export validation already read |
| `mapLottieSegmentTiming` (extracted from `mapLottieKeyframes`) | `src/interop/lottie/temporal.ts` | One segment-split/easing rule now feeds both the numeric channels and the mask-geometry channel — a second copy would have been a second authority |
| `toBezierPath` / vertex limit | `src/interop/lottie/mapDocument.ts` | Mask geometry uses the same reader, the same `coordinateSpace: 'local'` and the same `LOTTIE_PATH_LIMIT` as layer shapes |
| `evaluateLayerMasks`, `runtimeTemplate.maskDefs`, `svgRenderer`, `validateSceneForOGraf` | `src/utils/evaluateLayerMasks.ts`, `src/ograf/**` | Unchanged; they already evaluate `maskChannels`/`maskPathChannels` (falling back to `mask.path`) and validate the matte relation |

## 4. What changed

| File | Change |
|---|---|
| `src/interop/lottie/temporal.ts` | Extracted `mapLottieSegmentTiming` (frames, easing, the `in`/`out` split, roving/expression reports, keyframe limit); `mapLottieKeyframes` is now a thin value mapper over it. Behaviour is unchanged — the existing core tests still pin the same split |
| `src/interop/lottie/mapDocument.ts` | Added `mapLayerMasks` (mode map, static geometry, animated geometry/properties, limit, unreadable payloads), the four-type track-matte mapping, and mask channels on the layer's existing track. Removed the two blanket reports (`LOTTIE_UNSUPPORTED_MASK`, `LOTTIE_UNSUPPORTED_TRACK_MATTE`) the first slice used |
| `src/interop/lottie/diagnostics.ts` | `LOTTIE_IMPORT_LIMITS.masksPerLayer: 8` restored |
| `src/tests/lottieImport.test.ts` | New mask/matte group (12 cases); one existing case re-pinned from the old blanket reports to the constructs that are still reported |

## 5. Mask behavior

- **Modes** — `a` → `add`, `s` → `subtract`, `i` → `intersect`. `n` (Lottie's "none") and any other
  value (`f`, `d`, `l`) are **skipped and reported** per mask (`LOTTIE_UNSUPPORTED_MASK_MODE`),
  because KCS has no mode for them and guessing one would change the picture.
- **Geometry** — a static `pt` becomes the mask's `path`; a keyframed `pt` becomes the existing
  `mask-<i>:path` channel with one `PathKeyframe` per keyframe, using the same segment-to-keyframe
  split as the transform channels (verified: `bezierOut` on the starting keyframe, `bezierIn` on the
  one that ends the segment), and the same `ip`/`st` frame shift. `mask.path` keeps the first
  keyframe as its base value, which is the fallback `evaluateLayerMasks` uses when a channel is
  absent.
- **Scalars** — `o` → `opacity` (percent → 0..1), `f` → `feather`, `x` → `expansion`; an animated
  form of any of them becomes `mask-<i>:opacity|feather|expansion` on the same track.
- **`inv`** → `inverted`; `nm` → `name` (falling back to `Mask <i+1>`); ids are deterministic
  (`mask-<i>`), never taken from the document.
- **Limit** — at most 8 masks per layer; each mask above it is reported (`LOTTIE_MASK_LIMIT`).
- **Unreadable payloads** — a mask that is not an object, or whose `pt` carries no readable
  vertices, is skipped with `LOTTIE_UNREADABLE_MASK`; a layer flagged `hasMask` without a mask list
  reports the same code.

## 6. Track matte behavior

- `tt` 1/2 → `mode: 'alpha'`, 3/4 → `mode: 'luminance'`; 2 and 4 additionally set `inverted: true`.
  KCS supports both modes and inversion, so no matte type is reported merely for being luma or
  inverted.
- The source is **the layer directly above** (`index - 1`), which is Lottie's own rule; the relation
  is written as `{ sourceLayerId, mode, enabled: true, sourceVisible: false }` because Lottie never
  draws a matte layer on its own — the same thing `sourceVisible: false` means in KCS.
- `td` is treated as a hint, never as the authority: a `td` on the layer above that names a
  different target makes the relation **ambiguous** (`LOTTIE_TRACK_MATTE_AMBIGUOUS`) and it is
  dropped; a `td` that names the layer declaring the matte confirms it and is silent.
- A matte whose source layer was not imported (for example a precomp or text layer above it) reports
  `LOTTIE_TRACK_MATTE_MISSING_SOURCE` and drops the relation instead of pointing at a layer that
  does not exist.
- An unknown `tt` value, and a lone `td` that names a layer that declares no matte, report
  `LOTTIE_TRACK_MATTE_UNSUPPORTED`.

## 7. Diagnostics added

Stable code, `severity: 'warning'`, `feature: 'lottie-import'`, a source-document path, a message and
a concrete action, as the design §8 requires:

| Code | When |
|---|---|
| `LOTTIE_MASK_LIMIT` | A layer carries more than 8 masks |
| `LOTTIE_UNSUPPORTED_MASK_MODE` | Mask mode `n` or an unknown mode |
| `LOTTIE_UNREADABLE_MASK` | Mask entry not an object, no readable path, or `hasMask` without a list |
| `LOTTIE_TRACK_MATTE_UNSUPPORTED` | Unknown `tt` type; a lone `td` with no matte on its target |
| `LOTTIE_TRACK_MATTE_MISSING_SOURCE` | The layer above the target was not imported |
| `LOTTIE_TRACK_MATTE_AMBIGUOUS` | The layer above carries a contradicting `td` hint |

One report per affected mask or matte item, with the item's own path
(`layers[2].masksProperties[1].pt`), so the author can find it in the source document.

## 8. Tests

`src/tests/lottieImport.test.ts` — 49 cases (was 37). The new group covers:

1. A static mask maps to `LayerMask` (mode, path, opacity, feather, expansion, inversion, name).
2. `n` and `f` mask modes report and are skipped while a valid sibling mask still imports.
3. An animated mask path lands on `mask-0:path` with the documented split and frame shift, and the
   layer keeps the first keyframe as the mask base path.
4. Animated mask opacity lands on `mask-0:opacity` with the percent → factor conversion.
5. Nine masks import the first eight and report `LOTTIE_MASK_LIMIT` once.
6. A mask with no readable path reports `LOTTIE_UNREADABLE_MASK` and leaves no empty mask behind.
7. All four `tt` types map to the expected `mode`/`inverted`/`sourceVisible`, with no matte report.
8. A matte whose source layer was not imported reports and drops the relation.
9. A contradicting `td` hint reports `LOTTIE_TRACK_MATTE_AMBIGUOUS`.
10. An unknown `tt` reports `LOTTIE_TRACK_MATTE_UNSUPPORTED`.
11. The produced masked/matted scene passes the existing import boundary
    (`validateImportedDocument`) and carries no matte/mask error in the OGraf export validation.
12. The superseded blanket-report test was re-pinned to effects and expressions, which are still
    reported.

## 9. Validation matrix

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| `npx vitest run src/tests/lottieImport.test.ts` | PASS — 49 cases |
| `npm test` (full Vitest) | PASS — 120 files / 1,785 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 10. Protected invariants

- No `package.json`, lockfile, dependency or `.github/workflows/**` change.
- No UI, editor or import entry point; nothing calls the importer yet.
- No evaluator or renderer change: the slice fills the fields those authorities already read.
- Tag `v1.1.0-rc.1`, the GitHub draft release, npm state, `origin/without-mask`, the OMP
  configuration and the user folders are untouched.

## 11. Residual risks

- The importer maps every Lottie layer to the KCS `custom` layer type, which the OGraf export
  validation does not accept as a target type. That is a pre-existing property of the merged import
  core (it predates this slice) and is only observable once an import entry point exists; it is
  pinned by a comment in the new boundary test rather than silently worked around.
- Mask geometry is stored in layer-local coordinates. The KCS mask authority applies the layer
  transform, so a Lottie mask authored against a different anchor point can sit offset until the
  anchor is converted — the same open item the import core records for anchors
  (`LOTTIE_UNSUPPORTED_ANCHOR`).
- A track matte is only as good as the layer order: a document whose matte source is not the layer
  directly above is reported as ambiguous rather than guessed.
- Mask opacity/feather/expansion animation uses the existing channels; a document that animates a
  mask property on a *sequence* other than `Sequence` keeps the default sequence, exactly like the
  other imported channels.

## 12. Next slices

1. Item 10 — text/image/precomp conversion.
2. Item 10 — the import entry point with the report-before-replace UX (this also gives the layer-type
   gap above a visible surface to close).
3. Item 12 — the unified import entry.
