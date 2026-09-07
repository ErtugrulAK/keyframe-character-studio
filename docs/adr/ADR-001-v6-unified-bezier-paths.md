# ADR-001: V6 Unified Bezier Path Contract

- Status: Accepted
- Date: 2026-04-24
- Scope: freeform geometry, layer masks, path editing, path interpolation

## Context

KCS currently stores freeform geometry as straight `points` and advanced masks as `MaskPoint[]`. Rendering and editing therefore have separate assumptions about topology and tangent data. This makes curve authoring, path morphing, and serialization difficult to reason about.

## Decision

Introduce one normalized path contract in the existing animator type authority:

- ordered vertices have stable IDs and normalized coordinates;
- each vertex may carry `handleIn`, `handleOut`, and a corner/smooth mode;
- the path carries `closed` and a deterministic version marker;
- missing handles mean a straight segment;
- a cubic segment uses the previous vertex's outgoing handle and the next vertex's incoming handle;
- legacy `points` and `MaskPoint` values remain accepted through boundary adapters.

The pure geometry module owns:

- normalization and defensive validation;
- SVG path serialization;
- conversion from legacy straight points;
- deterministic cubic flattening for hit testing/derived geometry;
- topology comparison and matching-topology interpolation.

Path interpolation is not permitted across different vertex counts or incompatible ordering. The evaluator returns the previous authored path and a recoverable diagnostic for a mismatch; it does not truncate, pad, reorder, or silently resample vertices.

## Consequences

Positive:

- freeform and masks share the same geometry semantics;
- the renderer, editor, and serializer can use one path authority;
- path keyframes can preserve tangents and topology explicitly.

Trade-offs:

- legacy fields remain in the public model during migration;
- path animation requires a clear mismatch policy;
- cubic flattening is a derived operation and must not become a second source of truth.

## Alternatives rejected

- Keeping separate freeform and mask path builders: duplicates geometry behavior.
- Automatic point resampling: changes authored topology and hides malformed animation.
- Copying Paper.js or Bezier.js internals: unnecessary scope and maintenance/licensing overhead.
