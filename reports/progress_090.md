# Progress 090 — Mask/Matte Visual Parity Patch

## Task

Task 3: align canonical OGraf SVG rendering with generated runtime rendering for layer-mask feather and expansion behavior.

## Baseline and Branch

- Baseline `main`: `6736335`
- Branch: `fix/mask-matte-visual-parity`
- Scope: focused mask filter identifier/application parity; no renderer rewrite.

## Implemented

- Canonical `src/ograf/svgRenderer.ts` now applies the generated layer-mask filter to first-mask, add, intersect, and subtract path branches when feather or expansion is active.
- Generated runtime `src/ograf/runtimeTemplate.ts` now uses the canonical `kcs-layer-mask-filter-${maskId}` identifier namespace.
- Generated runtime applies the same filter reference to the same mask path branches.
- Difference auxiliary composition remains unchanged because it uses inverse masks rather than a direct path branch.
- Existing add/subtract/intersect/difference and inversion dispatch remains unchanged.
- Added canonical/generated parity assertions for deterministic filter IDs and references.

## Files Changed

- `src/ograf/svgRenderer.ts`
- `src/ograf/runtimeTemplate.ts`
- `src/tests/ografGeneratedParity.test.ts`

## Validation

- Focused mask/matte parity suite: 5 files, 270 tests passed.
- TypeScript: passed.
- `git diff --check`: passed.

## Independent Review

**READY**. No concrete blocker found. Review confirmed identical filter IDs/references across canonical and generated renderers and limited scope.

## Contracts and Safety

- V6 masks and Track Matte V2 semantics preserved.
- Browser ZIP behavior unchanged.
- OGraf package layout and public controls unchanged.
- SourcePath/filesystem and parent/broadcast hardening unchanged.
- No release or tag operation performed.
