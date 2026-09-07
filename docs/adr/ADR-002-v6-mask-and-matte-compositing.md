# ADR-002: V6 Layer Masks and Track Matte Compositing

- Status: Accepted
- Date: 2026-04-24
- Scope: same-layer masks, track mattes, SVG rendering, migration

## Context

V5.1 has a tested one-source `PartMatte` pipeline using SVG `clipPath` and `mask` definitions. V6 needs multiple same-layer masks, source relationships that do not depend on stack adjacency, and explicit alpha/luminance semantics without breaking existing projects.

## Decision

Add an optional V6 mask stack and an optional V2 track-matte relationship while retaining the legacy fields:

- `masks[]` is owned by a layer and is evaluated/rendered in authored order;
- each mask has a stable ID, a unified path, mode (`add`, `subtract`, `intersect`, `difference`), inversion, feather, opacity, expansion, and lock/visibility authoring state;
- `trackMatte` references a source layer by ID and declares alpha/luminance mode, inversion, and source visibility policy;
- legacy `matte` remains the compatibility representation and remains the runtime fallback when `trackMatte` is absent;
- missing sources and cycles are recoverable validation errors and never create recursive rendering;
- the source layer may be hidden from the final composite while remaining available to the matte definition;
- SVG user-space coverage regions and evaluated source transforms remain canonical.

Renderer adapters use the least powerful SVG primitive that is semantically correct: clip paths for hard positive clipping, masks for alpha/luminance/inversion/feather, and nested/combined definitions for stack operations. Unsupported combinations are diagnosed rather than silently approximated.

## Consequences

Positive:

- one source can be reused by many targets;
- same-layer masks and track mattes are distinct and composable;
- V5.1 projects retain their current matte behavior.

Trade-offs:

- two persisted relationship fields exist during the migration window;
- browser SVG behavior must be covered by DOM and visual tests;
- mask expansion may rely on SVG morphology and therefore needs explicit browser compatibility coverage.

## Alternatives rejected

- Replacing `matte` immediately: breaks existing files and V5.1 behavior.
- Treating track mattes as same-layer masks: loses source-layer transforms and visibility semantics.
- Rendering masks in React components independently of defs: duplicates the existing compositing authority and creates ordering bugs.
