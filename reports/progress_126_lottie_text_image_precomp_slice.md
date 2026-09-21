# Progress 126 — Lottie Text / Image / Precomp Slice

## 1. Scope

The third implementation slice of the approved Lottie mapping design
(`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`), on top of the merged import core (`ff32d6c`) and the
mask/matte slice (`8670b2a`):

- **Text layers** (`ty: 5`) — the static text document maps onto the KCS text fields; animators,
  text boxes/paths and the document properties KCS does not model are reported (design §3).
- **Image layers** (`ty: 2`) — the layer's asset resolves against the document asset table; only an
  embedded data URL that already passes the application's embedded-image policy is imported, and
  everything else is reported and skipped (design §2/§3).
- **Precomp layers** (`ty: 0`) — the design's decision stands: *unsupported, preserved*. They are
  reported once per layer with their `refId`, nothing is flattened, and the precomp asset graph is
  walked only to report a cycle, excessive nesting or a missing asset.
- `fonts.list` families are checked once per document, per the design's `fonts.list` row.

Out of scope by instruction: any UI or import entry point, the report-before-replace UX, the item-12
unified import entry, and every `package.json`, lockfile, dependency or workflow change.

## 2. Branch

`feat/lottie-text-image-precomp-slice`, created from `main` at `c66cc80`.

## 3. Existing authorities reused

| Authority | Where | How this slice uses it |
|---|---|---|
| KCS text fields (`textValue`, `fontSize`, `fontFamily`) + `custom_text` | `src/types/composition.ts`, rendered by `src/components/Canvas/renderers/parts/TextAndClonerRenderers.tsx` | A text layer becomes a normal text part; no parallel text model, no invented font metrics |
| `KCS_TEXT_FONT_FAMILIES` + `matchTextFontFamily` | new `src/utils/textFonts.ts`, also used by `StyleTextFields.tsx` | One list of renderable families; the importer maps onto it and the inspector renders from it, so a second list cannot drift |
| KCS media fields (`imageUrl`) + `custom_image`, `width`/`height` | `src/types/composition.ts`, rendered by `MediaPartRenderer` | An imported bitmap is an ordinary image part |
| Embedded-image policy (`EMBEDDED_IMAGE_MIME_TYPES`, `decodeDataUrl`, `isSafeEmbeddedImage`) | `src/ograf/legacyCompatibility.ts` | The importer calls the exported `isSupportedEmbeddedImage` predicate instead of carrying its own MIME list or SVG check |
| Document asset table (`assets[]`, `refId`) | Lottie document | Read once per import into the existing `Map` pattern; image and precomp layers resolve through it |
| Loss-report contract, transform/mask/matte mapping | `src/interop/lottie/{diagnostics,mapDocument}.ts` | The new layer types flow through the same layer pipeline, so masks, mattes, parents and transforms behave exactly as for shape layers |

## 4. Text mapping

| Lottie | KCS | Behaviour |
|---|---|---|
| `t.d.k[0].s` (the first text document) | `textValue` | Mapped (`t`, falling back to `s`) |
| `…s.f` | `fontFamily` | Mapped only when the name resolves to a family in `KCS_TEXT_FONT_FAMILIES` (`Roboto-Bold` → `Roboto`, `BebasNeue-Regular` → `'Bebas Neue'`); otherwise the renderer's default is used and the family is reported once per document |
| `…s.s` | `fontSize` | Mapped; a present but unreadable value is reported |
| `…s.fc` | `fillColor` | Mapped from `[r, g, b]`; an absent/unreadable colour is reported rather than defaulted |
| `t.d.k` with more than one document | — | The first document is imported and the animated text is reported (`LOTTIE_UNSUPPORTED_ANIMATED_TEXT`) |
| `t.a` (animators) | — | Reported (`LOTTIE_UNSUPPORTED_TEXT_ANIMATOR`) |
| `t.m` / `t.p` (text box, text path) | — | Reported (`LOTTIE_UNSUPPORTED_TEXT_LAYOUT`) |
| `j`, `tr`, `lh`, `ls`, `ca` (justification, tracking, line height, baseline shift, caps) | — | Reported when present and not the default (`LOTTIE_UNSUPPORTED_TEXT_STYLE`) |
| no readable `t`/`d`/`s`/text string | — | Reported (`LOTTIE_UNREADABLE_TEXT`) and the layer keeps no text |

## 5. Image mapping

| Case | Behaviour |
|---|---|
| `refId` missing | `LOTTIE_MISSING_ASSET`, layer skipped |
| `refId` not in `assets[]` | `LOTTIE_MISSING_ASSET`, layer skipped |
| `p` is a `data:` URL and passes `isSupportedEmbeddedImage` | `imageUrl` mapped, `w`/`h` → `width`/`height` |
| `p` is a `data:` URL with an unsupported MIME, or an SVG carrying a script/handler | `LOTTIE_UNSUPPORTED_IMAGE_TYPE`, layer skipped |
| `p`/`u` is a file path or URL | `LOTTIE_UNSUPPORTED_IMAGE_SOURCE` at the asset node, layer skipped — **nothing is read, fetched or resolved**, because the importer only receives the document text, and the message names the shape of the source rather than echoing a machine path or a URL that can carry credentials |
| `p` names a sequence (`%d`) | `LOTTIE_UNSUPPORTED_IMAGE_SEQUENCE`, layer skipped |
| asset without a readable width or height | `LOTTIE_UNREADABLE_IMAGE_ASSET` at `.w` or `.h` respectively, naming the missing or unreadable field; the bitmap still imports and keeps the layer's own size |

The importer performs no filesystem access and no network access; the asset is either inside the
document or the layer is reported.

## 6. Precomp behavior

The design keeps precomps **unsupported, preserved**, so nothing is flattened:

- One `LOTTIE_PRECOMP_UNMAPPED` per precomp layer, naming its `refId`.
- `LOTTIE_PRECOMP_MISSING_ASSET` when the layer's `refId` is not in `assets[]`, and when a nested
  precomp layer references an asset the document does not carry.
- `LOTTIE_PRECOMP_CYCLE` when the precomp asset graph re-enters an asset it is already inside.
- `LOTTIE_PRECOMP_DEPTH_LIMIT` when nesting exceeds `LOTTIE_IMPORT_LIMITS.hierarchyDepth` (32).
- The graph walk runs once per document, and only when a precomp layer is actually present. It is a
  true depth-first walk with a per-branch chain, so a diamond graph (two parents sharing one child) is
  not a cycle, a cycle is reported once per cycle rather than once per asset, and the nesting limit
  counts levels below the first precomposition exactly like the layer parent chain. A total expansion
  budget keeps a dense graph from making the import unbounded work.

## 7. Diagnostics

New stable codes (all `warning`, `feature: 'lottie-import'`, with the source-document path, a message
and a concrete action, per design §8):

| Code | When |
|---|---|
| `LOTTIE_UNREADABLE_TEXT` | Text layer without a readable document, text string or font size |
| `LOTTIE_UNSUPPORTED_ANIMATED_TEXT` | The text document carries more than one document (animated text) |
| `LOTTIE_UNKNOWN_FONT` | A family in `fonts.list` or on a text document that KCS cannot render |
| `LOTTIE_MISSING_TEXT_COLOUR` | Text document without a readable colour |
| `LOTTIE_UNSUPPORTED_TEXT_STYLE` | Justification/tracking/line height/baseline shift/caps set |
| `LOTTIE_UNSUPPORTED_TEXT_ANIMATOR` | `t.a` animators present |
| `LOTTIE_UNSUPPORTED_TEXT_LAYOUT` | `t.m` (text box) or `t.p` (text path) present |
| `LOTTIE_MISSING_ASSET` | Image layer without a usable asset reference |
| `LOTTIE_UNSUPPORTED_IMAGE_SOURCE` | Image asset outside the document (path/URL) |
| `LOTTIE_UNSUPPORTED_IMAGE_TYPE` | Embedded image MIME or payload rejected by the image policy |
| `LOTTIE_UNSUPPORTED_IMAGE_SEQUENCE` | Image asset that is a sequence |
| `LOTTIE_UNREADABLE_IMAGE_ASSET` | Asset without a readable size |
| `LOTTIE_PRECOMP_UNMAPPED` | A precomp layer (once per layer, with `refId`) |
| `LOTTIE_UNREADABLE_PRECOMP` | A precomp layer or a nested precomp reference with no readable asset reference, or a precomp asset whose `layers` is not an array |
| `LOTTIE_PRECOMP_MISSING_ASSET` | Precomp `refId` the document does not carry |
| `LOTTIE_PRECOMP_CYCLE` | Cycle in the precomp asset graph |
| `LOTTIE_PRECOMP_DEPTH_LIMIT` | Precomp nesting above the import limit |

Every entry carries the document's own node path (`layers[3].t.d.k[0].s.fc`, `assets[2].p`,
`assets[0].layers[1].refId`), so the path points at the node the author must fix. Per design §8 the
severity of every one of them is `warning`: the import still produces a scene, and only a document
that cannot be read at all is an `error`.

Text, image and precomp layers now flow through the shared layer pipeline, so masks, track mattes,
parents, transforms and layer order work for them exactly as for shape layers. A layer that is
skipped leaves no id behind: a later layer that pointed at it reports `LOTTIE_BROKEN_PARENT` instead
of carrying a `parentId` that does not exist.

## 8. Tests

`src/tests/lottieImport.test.ts` — **82 cases** (was 56). The new group covers:

1. A static text layer maps `textValue`/`fontFamily`/`fontSize`/`fillColor`.
2. An unknown family falls back to the renderer default and is reported **once** for two spellings of
   the same family.
3. A family declared by `fonts.list` but never used is reported.
4. An animated text document reports and imports its first document.
5. Justification/tracking/line height report `LOTTIE_UNSUPPORTED_TEXT_STYLE`, with `t.a` and `t.m`
   reporting their own codes, while the text itself still imports.
6. A text layer with no document and one with no string both report `LOTTIE_UNREADABLE_TEXT`.
7. A text layer without a colour reports instead of defaulting.
8. An embedded PNG asset maps `imageUrl`, `width` and `height`.
9. A missing asset reference reports and skips the layer.
10. An external path reports and is never read.
11. A sequence asset and an unsupported video MIME each report their own code.
12. An embedded SVG carrying `onload` is refused by the existing image policy.
13. A precomp layer reports `LOTTIE_PRECOMP_UNMAPPED` with its `refId` and leaves no layer behind.
14. A precomp whose asset is missing reports both codes.
15. A precomp cycle and an over-deep nesting report their own codes.
16. An image and a text layer keep deterministic order, `zIndex`, transform and opacity.
17. Every new diagnostic is asserted to carry a `warning` severity, the `lottie-import` feature, a
    non-empty path/message/action pair, and a shared sub-precomp reports its cycle exactly once.
18. Text diagnostics point at `layers[0].t.d.k[0].s*`, image diagnostics at `assets[0].p`, and
    precomp diagnostics at `assets[0].layers[0].refId`.
19. A quoted multi-word family (`BebasNeue-Regular` → `'Bebas Neue'`) maps, while a numeric font
    name and a string justification report `LOTTIE_UNREADABLE_TEXT`.
20. A stubbed `fetch` proves an external image asset triggers no network call, `file:///` never
    appears in a message, and an unreadable precomp reference or asset list reports
    `LOTTIE_UNREADABLE_PRECOMP`.
21. An image layer skipped for a missing asset leaves no dangling parent: the later layer reports
    `LOTTIE_BROKEN_PARENT` and carries no `parentId`.
22. The superseded test that pinned the generic `LOTTIE_UNSUPPORTED_LAYER_TYPE` for a precomp layer
    was re-pinned to an actually unsupported type (`ty: 6`), and the precomp contract is covered by
    its own case.

## 9. Validation matrix

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| `npx vitest run src/tests/lottieImport.test.ts` | PASS — 82 cases |
| `npm test` (full Vitest) | PASS — 120 files / 1,818 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 10. Protected invariants

- No UI surface added: the only inspector change is that its font list now comes from the shared
  constant (identical options), and no import entry point exists.
- No renderer or evaluator change; the new layer types use the fields those renderers already read.
- No `package.json`, lockfile, dependency or workflow change.
- No filesystem or network access from the importer: an image is either embedded in the document or
  the layer is reported.
- Tag `v1.1.0-rc.1`, the draft release, npm state, `origin/without-mask`, the OMP configuration and
  the user folders are untouched.

## 11. Residual risks

- **Fonts.** A matched family means "KCS can render this name"; it does not mean the source document's
  exact face is available, and KCS has no portable font file for any family yet (the OGraf export
  already reports that separately). Text metrics are also the renderer's, not the source's, so a text
  layer can sit or wrap differently than in the source player.
- **Text layout.** Justification, tracking, leading, baseline shift and caps are reported, not
  converted; a source document that relies on them will look different after import.
- **Images.** Only embedded data URLs are imported. A document that references external files imports
  without its bitmaps (each one reported) — the design's "the referenced file is present" test cannot
  be performed from document text alone, and the importer deliberately does not reach for the
  filesystem or the network.
- **Sequences.** An image-sequence asset is reported and skipped; a multi-frame sequence is not
  modelled by a single KCS image layer.
- **Precomps.** Nothing is flattened, so a document built mostly of precomps imports as a small scene
  with a clear report — by design, not by accident.
- The importer still maps every Lottie layer to the KCS `custom` family of types, which the OGraf
  export validation does not accept as a target type; that pre-existing gap is unchanged by this slice
  and is where the import entry point slice will have to reconcile the two.

## 12. Review

One independent read-only round (`reviewer-agent`) returned **BLOCKED** with four high, two medium
and one low finding; all were closed before the merge decision:

1. Diagnostic paths were not real document nodes (`t.d[0]` instead of `t.d.k[0]`, asset problems
   attached to the layer instead of the asset, precomp paths using an asset id as an array index,
   `fonts.list` without its entry) — every path now names the node the author must fix.
2. Present-but-unreadable text and precomp fields fell back silently (a non-string font name,
   non-numeric style fields, a non-array animator list, a precomp `refId` or `assets[].layers` that
   is not readable) — each now reports.
3. The precomp graph walk re-expanded shared assets, so one missing nested asset could be reported
   once per ancestor and a two-node cycle twice — the walk now expands each asset once and reports
   each finding once. The second round caught that the walk also treated a **diamond graph** as a
   cycle and could miss the depth limit; it is now a true depth-first walk with a per-branch chain,
   pinned by tests for the diamond, the cycle count and the exact depth boundary.
4. A skipped image layer could leave a dangling `parentId` — the asset is resolved before the layer
   enters the scene, and a parent must now be an imported layer, so the case reports
   `LOTTIE_BROKEN_PARENT` instead.
5. The external-image diagnostic echoed the raw path/URL — it now states the shape of the source
   only, and a stubbed `fetch` test proves nothing is reached for.
6. The new tests did not pin paths, the report shape, report counts or the no-network property —
   they now do, and the colour test asserts what it actually proves.
7. Design §8 now states the severity interpretation the implementation follows (a skipped construct
   is a `warning`; only a refused import is an `error`).

The second read-only round returned **BLOCKED** again with three findings, also closed: the DFS
ancestry handling, an unreadable asset *height* reported at the width path, and an unreadable
`fonts.list[].fFamily` falling back silently — each now has a test.

## 13. Next slice

The import entry point with the report-before-replace UX — the first slice that puts the importer in
front of a user, and the natural place to reconcile the imported layer types with the OGraf export
types. Everything that touches `package.json`, lockfiles or workflows stays behind its own approval.
