# Progress 084 — OGraf SVG Input Boundary Security Patch

- Baseline SHA: `437d5816dce57abd142bd9136ddc2374d45210e2`
- Branch: `fix/ograf-svg-input-boundary`
- Scope: runtime validation for OGraf layer, geometry, mask/matte, and animation-channel inputs; defensive finite-number and SVG attribute handling; generated-runtime scene guard.
- No release or tag was created.

## Files changed

- `src/ograf/validation.ts`
- `src/ograf/svgRenderer.ts`
- `src/ograf/runtimeTemplate.ts`
- `src/tests/ografExport.test.ts`

## Security boundary

- Required layer numeric fields must be finite numbers and optional SVG-relevant numeric fields reject strings, objects, arrays, `NaN`, and infinities.
- Layer points, Bezier handles, mask paths, legacy composite keyframes, property channels, mask channels, and mask-path channels are checked at the OGraf export boundary.
- Layer, mask, legacy matte, track-matte, gradient, and stroke-alignment values use explicit supported-value checks while preserving omitted legacy matte defaults.
- Canonical SVG numeric output uses a finite-number formatter for touched geometry, text, image, and transform paths; enum-derived mask attributes are XML escaped as defense in depth.
- Generated `graphic.mjs` validates embedded scene numeric fields and mask/matte modes before constructing/rendering the custom element.
- Invalid input produces `OGRAF_INVALID_PROJECT` diagnostics and blocks package compilation through the existing compiler gate.

## Tests and validation

- `npm ci`: PASS. npm reported the existing blocked `sqlite3` install script; no approval was added.
- Focused OGraf tests: PASS — 3 files, 55 tests.
- Full Vitest: PASS — 101 files, 1,484 tests.
- `npm run build`: PASS. Existing Vite chunk-size warning remains.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with the existing Fast Refresh warning in `src/context/AnimatorContext.tsx:655`.
- `git diff --check`: PASS.
- `npm run validate:ograf`: NOT APPLICABLE; no OGraf manifest fixture was present.

## Preserved contracts

- Existing OGraf package file names/order and browser ZIP behavior.
- Package-relative public image controls and unsafe image-path rejection.
- `.ograf`/ZIP versus `.kcs` import distinction.
- `evaluateTransform`/`evaluateFrame` authority.
- Active-sequence and `Track.channels` behavior.
- V6 masks, Track Matte V2, and existing legacy matte defaults.
- No renderer rewrite, parity rewrite, sourcePath/filesystem hardening, or strict-TypeScript migration.

## Out of scope and remaining blockers

- Mask/matte visual parity is unchanged and requires a separate review.
- Parent-cycle protection, broadcast map hardening, Node `sourcePath` trust, filesystem TOCTOU/symlink policy, and offline OGraf schema fixtures remain separate work.
- Production release remains HOLD until the independent merge-readiness review and required host/browser validation.

## Subagents and workflow

- Three read-only audits were used: input/sink inventory, contract/test inventory, and security payload design.
- Patch integration remained single-owner; no subagent edited source.
- No global OMP configuration, model roles, memory backend, hooks, routing, or references were changed or activated.
- No secrets were read or written. `without-mask` was not touched.

## Targeted Review Follow-up

- The independent review identified incomplete validation for legacy composite keyframe transforms, missing scalar keyframe fields, mask-path keyframe metadata, and Bézier control-point shape.
- Legacy composite transforms now require finite `x`, `y`, `rotation`, `scaleX`, `scaleY`, and `opacity`.
- Scalar and mask-path keyframes now require finite `frame` values; scalar values are required finite numbers.
- Present temporal handles require finite `x`/`y`; Bézier control points require exactly four finite numbers.
- Generated runtime validation now covers legacy tracks, scalar channels, mask channels, mask-path metadata, path points, and path handles.
- Added focused regression coverage for malformed legacy, scalar, and mask-path keyframes plus valid negative/zero and legacy cases.
- Branch validation: focused OGraf tests PASS (6 files / 93 tests), full Vitest PASS (101 files / 1,488 tests), build PASS, TypeScript PASS, lint PASS with the existing Fast Refresh warning, and `git diff --check` PASS.
- No release/tag, main merge, global configuration, hook, or routing change was performed in this follow-up.
- Remaining blockers: parent-cycle protection, broadcast map hardening, Node sourcePath/filesystem trust, mask/matte visual parity, offline OGraf schema fixtures, and final release gates.
