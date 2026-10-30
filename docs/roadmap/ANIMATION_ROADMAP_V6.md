# V6+ Animation Roadmap

V6 establishes the canonical path, compositing, interpolation, and graph contracts. Future work must extend those authorities instead of introducing parallel evaluators or serialized aliases.

## V6 delivered boundary

- Canonical cubic Bezier paths with deterministic IDs and explicit topology compatibility.
- Legacy freeform points retained as a migration-compatible field.
- Ordered same-layer masks with additive, subtractive, intersecting, and difference composition.
- V2 alpha/luminance track mattes with source visibility and cycle validation.
- Shared channel interpolation with hold, temporal handles, and auto-Bezier controls.
- Value Graph and derived Speed Graph views backed by the shared evaluator.
- SceneData version 2 export with additive migration from legacy scenes.
- OGraf freeform path parity; unsupported V6 compositing is reported and preserved in `scene.kcs`.

## Next milestones

### V6.1 — Authoring depth

1. Add direct tangent-handle editing to the canvas path authoring surface while reusing `BezierPathEditor` and `src/utils/bezierPath.ts`.
2. Add explicit track-matte source selection affordances to the outliner without duplicating validation rules.
3. Extend graph selection and channel-aware editing coverage as remaining polish around the delivered active-sequence graph contract.

### V6.2 — Interchange

1. Define a versioned Lottie import mapping for path tangents, hold segments, temporal handles, masks, and track mattes.
2. Add round-trip fixtures for supported fields and diagnostics for fields that cannot be represented losslessly.
3. Extend OGraf capability diagnostics and add an opt-in SVG mask adapter only when semantics are equivalent to the KCS compositor.
4. Keep unsupported export data in `scene.kcs`; never flatten it into an irreversible approximation by default.

### V6.3 — Graph editing and runtime scale

1. Add editable speed-graph controls only after a mathematically explicit conversion back to the shared temporal-handle model is specified.
2. Profile large path and mask stacks before introducing caching; cache only measured hot paths with invalidation tests.
3. Add sampled-path memoization only at the canonical evaluator boundary and only when output determinism remains byte-stable.
4. Add accessibility coverage for graph keyboard movement, tangent editing, and mask/matte relationship controls.

## Non-goals

- No second animation engine.
- No parallel path representation.
- No silent topology correspondence guesses.
- No implicit conversion of alpha/luminance mattes into clip paths.
- No new runtime dependency unless its license, maintenance, bundle cost, and semantic coverage are reviewed first.
