# KCS Lottie Import Mapping Design (Milestone F, item 10)

Design deliverable for roadmap item 10. It fixes the mapping from a Lottie (`bodymovin`) document into the canonical KCS model, the loss taxonomy, and the validation plan. **It designs no code**: implementation needs the design approval this document asks for, and `docs/interop/V6_LOTTIE_MAPPING.md` remains the authority for the canonical-field ↔ interop principle (KCS stays canonical; unsupported data is preserved, never silently reinterpreted).

## 1. Mapping kinds

Every construct is classified as exactly one of:

| Kind | Meaning | Behaviour |
|---|---|---|
| **Lossless** | A direct, invertible mapping to a canonical field | Imported; nothing reported |
| **Lossy with report** | Convertible, but the conversion changes or drops detail | Imported **and** one diagnostic entry per affected construct |
| **Unsupported, preserved** | No faithful mapping in the first cut | Not imported into the model; the original node is kept in the source document and one diagnostic entry reports it |

A construct never becomes *lossless* by silence: if any part of it is dropped (a channel, a keyframe, an easing shortcut), it is at least *lossy with report*.

## 2. Document-level mapping

| Lottie | KCS | Kind | Rule |
|---|---|---|---|
| `v`, `nm`, `ddd` | — | Unsupported, preserved | Version/name are informational; `ddd: 1` means 3D and is reported once per document |
| `fr` | scene `fps` | Lossless | Integer round; a non-integer `fr` is rounded and reported |
| `ip`, `op` | scene `totalFrames` | Lossy with report | `totalFrames = ceil((op − ip) / fr × fps)`; a document whose `ip ≠ 0` shifts every keyframe by `−ip` and is reported once |
| `assets` | media/asset references | Lossy with report | Image assets import only when the referenced file is present and passes the existing path-safety checks; otherwise the layer is reported and skipped |
| `fonts.list` | text font references | Lossy with report | Unknown families fall back to the KCS default font and are reported per family |
| `layers[]` | `CharacterPart[]` + one canonical track per layer | — | Layer order maps to `zIndex` (Lottie draws first-in-list on top, so `zIndex` counts upward from the last entry) |

## 3. Layer mapping

| Lottie `ty` | KCS | Kind | Rule |
|---|---|---|---|
| `4` shape | part + channels + masks | Lossless / lossy per shape (see §4) | The layer's shapes are grouped into the part's own shape content; a group with mixed primitive and path items is preserved as separate items in order |
| `3` null | part without shape content | Lossless | Used as a parent target; `parent` links map to `parentId` |
| `5` text | text part | Lossy with report | Static text (`t.d.k[0].s`) maps to a text part; `t.a` animators and `t.m` masks are reported and skipped |
| `2` image | media layer (part with an image source) | Lossy with report | Requires a resolvable asset; scale/rotation map normally, `ty:2`-specific matte behaviour is reported |
| `1` solid | rectangle part from `sc`/`sw`/`sh` | Lossless | Colour and size map directly |
| `0` precomp | — | Unsupported, preserved | A precomp carries its own timeline; flattening it would silently change timing. Reported once per precomp layer, with its `refId` named |

Common per-layer fields:

| Lottie | KCS | Kind | Rule |
|---|---|---|---|
| `nm` | `name` | Lossless | — |
| `parent` | `parentId` | Lossless | Index → id of the already-imported layer; a forward or cyclic reference is broken and reported |
| `ks.a` (anchor) | `pivot` | Lossless | Normalised against the layer's own bounds; a layer with no computable bounds is reported |
| `ks.p` (position) | `x`, `y` channels | Lossless | Lottie is centre-origin, KCS scene units are top-left; the conversion is the existing coordinate authority (`migrateSceneCoordinates`), not a new formula |
| `ks.s` (scale) | `scaleX`, `scaleY` channels | Lossless | Lottie stores percent; KCS stores a factor (÷ 100) |
| `ks.r` (rotation) | `rotation` channel | Lossless | Degrees in both models |
| `ks.o` (opacity) | `opacity` channel | Lossless | Lottie percent → 0..1 |
| `ks.sk`, `ks.sa` (skew) | — | Unsupported, preserved | Reported per layer |
| `ip`, `op` (layer in/out) | — | Unsupported, preserved | KCS has no layer in/out; reported per layer with both frames so the author can trim manually |
| `tt`, `td`, `tp` (track matte) | `TrackMatteV2` | Lossy with report | `tt` 1/2 → `mode: 'alpha'` (+ `inverted` for 2), 3/4 → `'luminance'` (+ `inverted`); the matte source is the layer directly above, which must pass KCS's self-reference and cycle validation or the relation is reported and dropped. `td` is the specification's 0/1 flag marking a layer as someone's matte, so it can only confirm or contradict that rule; an explicit `tp` matte-parent index is reported and the relation dropped, because this slice cannot resolve which layer it names |
| `hasMask`, `masksProperties[]` | `LayerMask[]` | Lossy with report | See §5 |
| `ef` (effects) | — | Unsupported, preserved | Reported per effect with its `nm` |
| `hasExpressions`, `x` (expressions) | — | Unsupported, preserved | Reported once per layer, never evaluated |
| `ao` (auto-orient) | — | Unsupported, preserved | Reported per layer |

## 4. Shape mapping

| Lottie item | KCS | Kind | Rule |
|---|---|---|---|
| `sh` (path) | `BezierPath` (`version: 1`) | Lossless | `ks.k` supplies `v` (vertices), `i`/`o` (in/out tangents) and `c` (closed); KCS vertex ids are generated deterministically from the index, never from the document |
| `rc` (rectangle) | rectangle primitive | Lossless | `s` (size), `p` (position), `r` (corner radius → the KCS corner-radius property when present; otherwise reported) |
| `el` (ellipse) | ellipse primitive | Lossless | `s`, `p` |
| `sr` (star/polygon) | star primitive | Lossy with report | Point count and outer/inner radius map; `sy` (star type) variants are reported |
| `gr` (group) | shape group | Lossless | Groups are flattened in order; a group transform (`tr` inside the group) that cannot be folded into its children is reported |
| `fl` (fill) | `fillColor` / `fillOpacity` | Lossless | `c` (colour) and `o` (opacity) |
| `st` (stroke) | `strokeColor` / `strokeWidth` / `strokeOpacity` | Lossless | `w` maps to stroke width; `lc`/`lj` (cap/join) map where KCS has an equivalent, otherwise reported |
| `tm` (trim path) | `trimPathStart` / `trimPathEnd` / `trimPathOffset` channels | Lossless | `s`, `e`, `o`; Lottie percent → 0..1 |
| `mm` (merge) | boolean group | Lossy with report | Maps to the existing boolean operand model when both operands are closed paths; otherwise reported |
| `rp` (repeater) | — | Unsupported, preserved | Reported per repeater |
| `tr` (transform) inside a group | parent transform of the group's items | Lossy with report | Folded when the group has a single child; otherwise each child is reported |
| `gs`/`gf`/`gb` (gradients) | — | Unsupported, preserved | Reported per gradient |

## 5. Masks and mattes

- Each entry in `masksProperties[]` becomes one `LayerMask` with `mode` mapped onto the four values KCS actually has (`LayerMaskMode = 'add' | 'subtract' | 'intersect' | 'difference'`): `a` → `add`, `s` → `subtract`, `i` → `intersect`, `n` (Lottie has no mask contribution there) → the mask is **skipped and reported**, because KCS has no "none" mode. KCS's `difference` has no Lottie equivalent in the first cut, so an imported document never produces it. Any other mode value is reported rather than guessed.
- Static mask geometry (`pt.k` without keyframes) maps into `path`; animated geometry maps into the existing `maskPathChannels` (canonical `PathKeyframe`), not into a new channel.
- Path geometry uses the specification's own shape form: `v`, `i` and `o` are arrays of `[x, y]` pairs. A document that writes `{ x, y }` objects instead is accepted as well, because this is an untrusted boundary and both forms describe the same geometry.
- A mask field that is present but unreadable (a non-boolean `inv`, a non-string `nm`, a scalar that carries no number, a mask list that is not an array) is reported rather than defaulted, so `absent` and `unreadable` never look the same in the import report.
- Masks above the first-cut limit (see §7) are reported per mask instead of being silently reduced: the limit counts the masks in the source, so an unreadable mask never lets a later one through in its place.
- `f` (feather) and `o` (opacity) map to the mask's `feather`/`opacity`; a mask *animated* on those properties uses `maskChannels` with the same per-mask id.
- Track mattes map to `TrackMatteV2` as in §3, and the importer must run the existing validation before accepting the relation.

## 6. Temporal and easing conversion (the part that must not be guessed)

Lottie keyframes carry `t` (time in frames), `s`/`e` (start/end values) and, unless `h: 1`, an `i`/`o` pair describing the **segment** from this keyframe to the next: `o` is the outgoing control point, `i` the incoming one, both normalised in [0,1]² of the value range.

KCS stores per-keyframe `bezierIn`/`bezierOut` handles (`TemporalHandle {x, y}`) plus an `easing` name. The rule:

| Lottie | KCS | Rule |
|---|---|---|
| `t` | `frame` | `frame = round((t − document.ip) / fr × fps)`; the document shift from §2 is applied once, here |
| `s` (scalar) | `value` | Direct |
| `h: 1` | `easing: 'hold'` | The segment holds the start value until the next keyframe |
| `i`/`o` | `easing: 'bezier'` + handles | `keyframe[i].bezierOut = { x: o.x, y: o.y }` and `keyframe[i+1].bezierIn = { x: i.x, y: i.y }` — Lottie describes the **segment**, KCS describes the **keyframe**, so the pair is split across the two keyframes it connects |
| multiple dimensions (`s: [x, y]`) | one keyframe per channel | A single Lottie keyframe becomes one entry in each affected channel, sharing the same frame and handles |
| `r` (roving) | — | Unsupported, preserved on the segment; reported per keyframe range |
| no `i`/`o` and no `h` | `easing: 'linear'` | The default |

Two clarifications the implementation must keep:

1. **Never invent easing.** An unsupported expression-driven or roving segment becomes `linear` **and** a report entry; it is not silently approximated with a curve.
2. **Handles are copied, not reinterpreted.** If the KCS evaluator's handle convention differs from Lottie's (normalised in [0,1]² vs offsets), that difference is resolved once, in one documented conversion, with a fixture that pins it — not per call site.

## 7. First-cut limits (reported, not silently reduced)

- Masks per layer: at most 8 imported; further masks are reported.
- Keyframes per channel: at most 512 imported per channel; the excess is reported with the channel name.
- Hierarchy depth: at most 32 levels; deeper chains are flattened to the limit and reported.
- Path vertices per shape: at most 4096; the shape is reported and skipped.

These are *import* limits that keep a hostile or accidental document from becoming unbounded work; they are not model limits.

## 8. Diagnostics contract

One entry per affected construct, shaped like the existing export diagnostics so the UI needs no second reporting model:

```
{ code, severity: 'error' | 'warning', feature, path, message, action }
```

- `code` — stable, e.g. `LOTTIE_UNSUPPORTED_EFFECT`, `LOTTIE_ROVING_KEYFRAME`, `LOTTIE_MASK_LIMIT`, `LOTTIE_PRECOMP_UNMAPPED`.
- `path` — the Lottie node path (`layers[3].shapes[1].ef[0]`) so the author can find it in the source document.
- `severity` — `error` only when the construct cannot be represented at all; everything reported-but-imported is a `warning`.
- `action` — the concrete next step ("remove the expression in the source document and re-export", "raise the mask limit for this import", …).

Import UX: the report is shown **before** the document replaces the user's work, with counts by kind, and the user may cancel.

## 9. Validation plan (once approved)

1. **Per-construct golden tests** — one fixture per row of §2–§5, asserting the canonical field(s) produced and the diagnostic code emitted.
2. **Round-trip fixtures** — Lottie → KCS → Lottie for the lossless subset; the comparison ignores only fields the report declares as lossy.
3. **Limit tests** — documents that exceed each §7 limit produce the documented report and no unbounded work.
4. **Negative fixtures** — cyclic `parent`, self-referencing track matte, missing asset, unknown mask mode: each must report and continue, never throw.
5. **UI smoke** — one browser test that imports a fixture and shows the report before replacing the work.

## 10. Open questions this design asks the user to settle

1. **Precomps**: confirm *unsupported, preserved* in the first cut (the alternative, flattening, changes timing and needs its own design).
2. **Layer in/out (`ip`/`op`)**: confirm *reported, not converted* rather than mapping to keyframed visibility.
3. **Limit defaults**: confirm the §7 numbers, or set them.
4. **Report surface**: confirm the report appears before replacement (recommended) rather than after.

With these settled, implementation proceeds on its own branch and needs the explicit approval this design asks for.
