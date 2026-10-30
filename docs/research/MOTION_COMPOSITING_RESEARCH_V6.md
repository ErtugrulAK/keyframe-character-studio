# KCS V6 Motion Core and Compositing Research

## Scope

This document records the external research and repository evidence used for the KCS V6 Motion Core and Compositing upgrade. It is a design input, not a license to copy implementation code or reproduce another product's UI.

## Repository baseline

The V5.1 checkpoint established these authorities:

- `src/types/animator.ts` owns runtime parts, tracks, masks, legacy mattes, easing names, and per-property channels.
- `src/utils/defaults.ts` owns numeric interpolation and cubic-Bezier solving.
- `src/utils/evaluateTransform.ts` and `src/utils/evaluateFrame.ts` own frame evaluation and hierarchy composition.
- `src/utils/freeform.ts` owns freeform point normalization and the current line-only SVG path builder.
- `src/utils/matte.ts` and `src/components/Canvas/StagePartLayers.tsx` own the existing SVG clipPath/mask track-matte pipeline.
- `src/hooks/useSerialization.ts` owns scene migration and channels-only export.
- `src/hooks/useTimeline.ts` and `src/utils/trackMutations.ts` own timeline mutation and history boundaries.

The V6 implementation must extend these authorities rather than introduce a second animation evaluator, renderer, serialization store, or history mechanism.

## External reference findings

### Adobe After Effects

Adobe's current documentation describes masks as editable paths and track mattes as a relationship in which one layer reveals another layer. The references distinguish layer masks from track mattes and document alpha/luminance workflows:

- [Creating shapes and masks](https://helpx.adobe.com/after-effects/desktop/drawing-painting-and-paths/shapes-and-shape-attributes/creating-shapes-masks.html)
- [Alpha channels and masks](https://helpx.adobe.com/after-effects/desktop/work-with-transparency-and-compositing/work-with-alpha-channels-and-masks/alpha-channels-masks-mattes.html)
- [Track mattes and traveling mattes](https://helpx.adobe.com/after-effects/desktop/work-with-transparency-and-compositing/work-with-track-mattes-and-traveling-mattes/track-mattes-and-traveling-mattes.html)
- [Animating shape paths and masks](https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animate-shape-paths-and-masks/animating-shape-paths-masks.html)
- [Keyframe interpolation](https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/animation-keyframes/keyframe-interpolation.html)
- [Speed between keyframes](https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/speed-between-keyframes/speed.html)

KCS consequence: path topology and mask/track-matte relationships are separate concerns. A mask can be animated as a path; a track matte references another layer and must not be reduced to a shape-local boolean.

### Lottie common layer model

The Lottie Animation Community specification documents common layer properties including transforms, `masksProperties`, track-matte type (`tt`), masking-layer marker (`td`), and masking-layer index (`tp`). It also specifies independent animatable properties and explicit layer ordering:

- [Lottie common layer properties](https://lottie-animation-community.github.io/docs/specs/layers/common/)
- [Lottie matte mask types](https://lottie-animation-community.github.io/docs/specs/properties/matte-mask-types/)
- [Lottie animatable properties](https://lottie-animation-community.github.io/docs/specs/properties/animatable-properties/)

KCS consequence: V6 keeps an explicit source relationship and a separate same-layer mask stack. Lottie export is an adapter with a documented lossy boundary, not the internal data model.

### Motion Canvas

Motion Canvas describes a TypeScript animation library plus an editor with real-time preview. Its design confirms that authoring-time controls and runtime evaluation can share a deterministic scene model without making the editor itself the renderer authority:

- [Motion Canvas introduction](https://motioncanvas.io/docs/)
- [Motion Canvas repository](https://github.com/motion-canvas/motion-canvas)

KCS consequence: graph editing belongs in the editor layer; value evaluation remains a pure utility consumed by the existing composition pipeline.

### Theatre.js

Theatre.js documents a design tool organized around projects, sheets, sheet objects, property types, and sequences. Its UI is a reference for discoverable property editing and timeline authoring, not a dependency target:

- [Theatre.js manual](https://www.theatrejs.com/docs/latest/manual)
- [Theatre.js repository](https://github.com/theatre-js/theatre)

KCS consequence: V6 graph/editor controls should expose the current selected property and write through the existing timeline mutation/history authority. Studio-specific behavior is not copied.

### Vector path and morphing references

These references were reviewed for geometric responsibilities and maintenance signals:

- [Paper.js repository](https://github.com/paperjs/paper.js) — vector path model and geometry tooling.
- [Bezier.js repository](https://github.com/Pomax/bezierjs) — cubic Bezier evaluation, extrema, length, and projection utilities.
- [Flubber repository](https://github.com/veltman/flubber) — polygon/path interpolation and topology considerations.
- [Glaxnimate official source](https://invent.kde.org/graphics/glaxnimate) — GPL-licensed desktop vector animation application; conceptual reference only.

KCS consequence: V6 implements only the required deterministic cubic path operations locally. It does not copy source code and does not add a dependency solely to mirror an editor.

## License and maintenance review

| Reference | License evidence | V6 decision |
| --- | --- | --- |
| Motionity | Repository `LICENSE` is MIT. [License](https://raw.githubusercontent.com/alyssaxuu/motionity/main/LICENSE) | No code copied; conceptual UI reference only. |
| Motion Canvas | Repository `LICENSE` is MIT. [License](https://raw.githubusercontent.com/motion-canvas/motion-canvas/main/LICENSE) | No dependency; existing KCS pipeline is retained. |
| Theatre.js core | Repository `LICENSE` contains Apache-2.0 terms; the repository also contains Studio material under AGPL terms. [License](https://raw.githubusercontent.com/theatre-js/theatre/main/LICENSE) | No dependency and no Studio code copied. |
| Paper.js | Repository `LICENSE.txt` is MIT. [License](https://raw.githubusercontent.com/paperjs/paper.js/develop/LICENSE.txt) | No dependency; KCS needs a smaller SVG-specific path authority. |
| Bezier.js | Repository declares MIT; `LICENSE.md` is MIT. [Repository](https://github.com/Pomax/bezierjs), [License](https://raw.githubusercontent.com/Pomax/bezierjs/master/LICENSE.md) | No dependency in V6; implement the narrow required contract. |
| Flubber | Repository `LICENSE` is MIT. [License](https://raw.githubusercontent.com/veltman/flubber/master/LICENSE) | No dependency; topology policy is explicit instead of implicit polygon resampling. |
| Glaxnimate | Official project is GPLv3-or-later. [Official source](https://invent.kde.org/graphics/glaxnimate), [Contributing/licensing](https://glaxnimate.org/contributing/introduction/) | Conceptual/reference use only; no source or runtime dependency. |

Maintenance decision: no new runtime dependency is justified for V6. KCS already depends on `polygon-clipping`; V6 may reuse it only where its existing boolean-geometry authority applies. Any future dependency requires a separate license, bundle-size, maintenance, and browser-compatibility review.

## Design decisions derived from research

1. **One path representation.** A normalized ordered vertex contract carries anchor points, optional in/out tangents, closed state, and stable vertex identity. Legacy `points` and `MaskPoint` data are adapted at boundaries.
2. **Explicit topology policy.** Path morphing is supported only for matching vertex topology. Mismatches hold the previous authored path and surface a recoverable diagnostic; silent index-based truncation is prohibited.
3. **Separate compositing layers.** Same-layer masks are an ordered stack with explicit blend semantics. Track mattes are source-layer relationships. Legacy `matte` data remains readable and render-compatible.
4. **SVG-first rendering.** Existing user-space SVG defs, explicit coverage regions, and the current source transform pipeline remain the rendering authority. Feather uses SVG-supported effects; unsupported boolean or offset behavior is not faked.
5. **Single interpolation authority.** Hold, linear, cubic-Bezier temporal handles, and auto handles extend `src/utils/defaults.ts`. Graphs only edit keyframe metadata and never evaluate independently.
6. **Serialization is additive.** Existing V1 scenes load unchanged. V6 fields are optional and exported with a versioned schema. Legacy fields are preserved until a deliberate migration can prove byte-compatible behavior.
7. **Browser proof for visual behavior.** Unit tests prove pure geometry/evaluation contracts. Playwright proves DOM-level defs, attributes, authoring controls, persistence, and representative rendered output where pixel behavior is material.

## Non-goals

- Copying third-party source code or UI.
- Adding a second runtime animation or compositing engine.
- Full parity with After Effects, Lottie, Theatre Studio, or Glaxnimate.
- Silent topology resampling, arbitrary geometry tolerances, or renderer fallbacks that hide unsupported data.
- Rewriting the V5.1 compatibility path without regression evidence.
