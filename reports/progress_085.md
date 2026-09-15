# Progress 085 — OGraf SVG Input Boundary Merge

## Scope

Completed the approved OGraf SVG input-boundary hardening on `fix/ograf-svg-input-boundary` and fast-forwarded it into `main`.

Merged feature commit:

- `2ada34d` — `fix: complete ograf svg input boundary validation`

Main advanced from `437d581` to `2ada34d` by fast-forward only. No normal merge, rebase, reset, force push, release, or tag operation was used.

## Blocking Fixes Completed

The export validator and generated runtime guard now reject:

- legacy composite keyframes with non-finite or non-numeric `x`, `y`, `rotation`, `scaleX`, `scaleY`, or `opacity`;
- scalar and mask scalar keyframes without finite `frame` and `value`;
- malformed optional Bézier handle metadata;
- Bézier control-point arrays that are not exactly four finite numbers;
- mask-path keyframes with invalid timing metadata, malformed path points, or non-finite point handles.

Valid legacy, scalar, mask scalar, and mask-path keyframes remain exportable. Negative scale values and zero values remain accepted when finite.

## Post-Merge Validation

Executed on merged `main` after `npm ci`:

- `npm ci` — passed; `sqlite3@6.0.1` install script remained blocked by the existing package-manager approval policy.
- Focused OGraf suite — 6 files, 93 tests passed.
- Full Vitest suite — 101 files, 1488 tests passed.
- `npm run build` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with the existing Fast Refresh warning in `src/context/AnimatorContext.tsx:655`.
- `git diff --check` — passed.

No OGraf fixture-validation command was run because no repository OGraf fixture target is configured for `validate:ograf`.

## Preserved Contracts

- `compileOGrafPackage` remains fail-closed and returns `blocked` for invalid input.
- Valid packages remain `ready-to-materialize`.
- Existing public APIs, legacy import compatibility, negative-scale behavior, and zero-value behavior were preserved.
- No changes were made to parent-cycle handling, sequence/broadcast authority, filesystem TOCTOU boundaries, or canonical/generated evaluator parity.

## Review Warnings

Independent review classified the change as READY WITH WARNINGS. The following remain separate follow-up risks and were not broadened into this patch:

- parentId cycle validation at the OGraf boundary;
- sourcePath symlink/junction/TOCTOU filesystem hardening;
- external OGraf fixture validation in CI;
- generated-runtime and canonical-renderer evaluation parity;
- path-envelope/topology validation and named-sequence propagation outside this input-boundary scope.

## Operational Safety

- No global OMP configuration, routing, model, hook, or plugin state was changed.
- No unrelated repository was modified.
- No release, tag, or without-mask branch operation was performed.
- `main` was pushed only after merge and post-merge validation.

## ChatGPT’ye Yüklenecek Dosyalar

- `reports/progress_084.md`
- `reports/progress_085.md`
- `src/ograf/validation.ts`
- `src/ograf/runtimeTemplate.ts`
- `src/ograf/svgRenderer.ts`
- `src/tests/ografExport.test.ts`

## Next Task

Parent-cycle and broadcast-state map hardening should be handled as a separate task with its own focused review and validation boundary.
