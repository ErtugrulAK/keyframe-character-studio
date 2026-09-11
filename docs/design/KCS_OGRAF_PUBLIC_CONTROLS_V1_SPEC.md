# KCS OGraf Public Controls V1

## Scope

OGraf export exposes a small, deterministic public state surface for host-side editing. The public state is separate from `scene.kcs`; it contains only values intended for host controls.

## Evidence from the existing implementation

- `src/ograf/validation.ts:createPublicStateSchema` emits the manifest public schema.
- `src/ograf/runtimeTemplate.ts:generateGraphicModule` emits `PUBLIC_BINDINGS` and `_applyData` handles `load` and `updateAction`.
- BASIC text was editable because its manifest declared `headline` and its runtime binding mapped that key to `textValue`.
- Images rendered because package assets were materialized and `image()` resolved source references, but image editing was not a complete host contract: no production export path synthesized public image fields, the old enum used source keys, and runtime validation only checked the global reference map.
- Colors were not editable because no public color field type, manifest property, binding, or runtime update path existed.
- `SceneLayer` paint values are base values. Current animation channels contain transforms, opacity, trim, masks, and paths; no color channels exist. A public color write therefore changes the base paint without overriding an animated transform/opacity channel.

## Field naming

Generated IDs are deterministic, lowercase, ASCII, collision-safe, and contain no path separators:

- Text: `text_<sanitized-layer-id>`.
- Image: `image_<sanitized-layer-id>`.
- Fill: `fill_<sanitized-layer-id>`.
- Stroke: `stroke_<sanitized-layer-id>`.
- A text layer whose name is `Headline` uses the compatibility ID `headline` when no explicit field overrides it.

Titles use the authored layer name and a human-readable suffix. Raw unsafe IDs never appear in labels.

## Text controls

For every visible, non-matte-source `custom_text` layer without an explicit field:

- Schema type: `string`.
- Default: the authored `textValue` or an empty string.
- Runtime property: `textValue`.
- Existing explicit `headline` bindings remain unchanged.

The generated runtime escapes text as XML before rendering.

## Image controls

For every visible, non-matte-source `custom_image` layer with a verified portable asset:

- Schema type: `string`.
- Enum: packaged, package-relative image paths.
- Default: the current layer image's packaged path.
- Runtime property: `imageUrl`.
- `updateAction` accepts only values in the generated field enum and the packaged reference map.

The runtime never accepts an absolute path, traversal path, external URL, data URL, or arbitrary unlisted value. The package compiler still requires a local source or browser-owned bytes for each image. A one-image package intentionally exposes a one-option selector; multiple packaged image assets provide multiple choices.

## Color controls

For every eligible visible, non-matte-source shape/text/freeform layer:

- Fill field: `fill_<layer>`, when fill is enabled and a fill exists.
- Stroke field: `stroke_<layer>`, when stroke is enabled and a non-`none` stroke exists.
- Schema: `type: string`, `gddType: color-rrggbb`, `pattern: ^#[0-9a-f]{6}$`.
- Default: normalized lowercase `#rrggbb` value from the layer.
- Runtime property: `fillColor` or `strokeColor`.

The runtime rejects non-hex color updates. Values are escaped again by SVG rendering.

Matte source layers are excluded from generated controls so helper geometry does not pollute the host panel. This also avoids exposing a control whose paint is part of a luminance matte calculation. Track matte target layers remain eligible.

## Animation precedence

Public updates are applied to the mutable runtime scene before rendering. Existing transform, opacity, trim, mask, and path channels continue to be evaluated by the canonical runtime evaluator. Current OGraf animation data has no color channels, so public color writes are stable for every rendered frame. If color channels are introduced later, channel evaluation must explicitly define whether a channel overrides the public base value; this release does not invent that precedence.

## Compatibility

- Standard OGraf manifest fields remain unchanged.
- Existing `headline` text bindings remain supported.
- Legacy single-file export still uses the same generated runtime and public contract.
- KCS project serialization/import remains separate and unchanged.
- Package-relative resource materialization and path containment checks remain active.
- `.omp` settings, model/provider mappings, `memory.backend: mnemopi`, and the read-only reference corpus are outside this contract.

## Host QA acceptance

The generated QA folders are:

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa`

- BASIC: edit `Headline`, then PLAY; text changes and motion remains.
- ASSET: inspect `Logo`; select a packaged image when multiple choices exist, or confirm the single default option.
- COMPOSITING: edit `Content Fill Color`, update/play as required by the host, and confirm the color changes while motion remains.
