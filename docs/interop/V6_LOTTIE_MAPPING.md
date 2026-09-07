# V6 Lottie and OGraf Mapping

## Purpose

This document defines the interoperability boundary for KCS V6 Motion Core and Compositing. KCS remains the canonical authoring format. Importers and exporters must preserve unsupported data rather than silently reinterpret it.

## Canonical KCS fields

| KCS V6 field | Runtime authority | Lottie relationship | OGraf status |
| --- | --- | --- | --- |
| `BezierPath` (`version: 1`, `coordinateSpace`, `closed`, ordered vertex IDs) | `src/utils/bezierPath.ts` | Maps to shape path vertices and tangents when topology is compatible | Supported for evaluated freeform SVG output |
| `LayerMask[]` | `src/utils/layerMasks.ts` and `StagePartLayers` | Maps conceptually to ordered mask shapes and mask modes | Deferred from OGraf Export V1; preserve in `scene.kcs` |
| `TrackMatteV2` | `StagePartLayers` and `validateScene` | Maps to alpha/luma track matte relationships and inversion | Deferred from OGraf Export V1; preserve in `scene.kcs` |
| `maskChannels` | `trackMutations`, `useTimeline`, `interpolateChannel` | Maps to animated mask opacity/feather/expansion where the target supports them | Deferred from OGraf Export V1 |
| `PropertyKeyframe.bezierIn/bezierOut` | `interpolateChannel` and `TemporalGraphPanel` | Maps to temporal easing handles; target-specific conversion required | Preserved in scene data; OGraf runtime currently evaluates canonical channels only |
| `hold` easing | `applyEasing` | Maps to a hold/step segment | Preserved and evaluated by KCS; target must support stepped interpolation |

## Current OGraf implementation boundary

- `evaluateOGrafScene` now carries the canonical freeform path into evaluated content.
- `renderOGrafSvg` prefers `LayerContent.path` and falls back to legacy `points` for old scenes.
- Primitive geometry, text, images, trim path, stroke alignment, hierarchy, and deterministic channel evaluation remain supported by the existing OGraf SVG adapter.
- Legacy clip mattes remain conditionally supported by the existing validation contract.
- Alpha/luminance mattes, inverted mattes, feathered/gradient mattes, same-layer masks, V2 track mattes, and animated mask properties are not silently downgraded. OGraf validation reports the existing deferred diagnostics and package compilation fails on error diagnostics.

## Lossless export policy

Every V6 field remains in `scene.kcs`. The OGraf package runtime is an adapter, not a second scene authority. Unsupported V6 features therefore remain inspectable in the packaged scene and are reported before runtime generation.

## Import policy

- Preserve path vertex order and IDs.
- Preserve explicit topology changes as holds; do not infer vertex correspondence.
- Preserve mask and track-matte relationships even when the target adapter cannot render them.
- Preserve temporal handles and `hold` easing when the target format has no direct equivalent; report conversion requirements instead of flattening silently.

## Implementation references

- KCS path authority: `src/utils/bezierPath.ts`
- KCS V6 migration: `src/utils/v6Migration.ts`
- OGraf evaluation: `src/ograf/evaluation.ts`
- OGraf SVG adapter: `src/ograf/svgRenderer.ts`
- OGraf capability diagnostics: `src/ograf/validation.ts`
- Lottie and reference-format research: `docs/research/V6_MOTION_COMPOSITING_RESEARCH.md`
