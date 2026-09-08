# KCS V6 Pre-UI Redesign Safe Core Checkpoint

## Scope

Completed the approved KCS V6 pre-UI-redesign checkpoint. No UI redesign work was started. The remaining C5 ordered mask compositor gap from `progress_030.md` was implemented across the React preview, static OGraf SVG renderer, and generated runtime.

## C5 Resolution

Enabled masks now build cumulative ordered SVG mask definitions. Add composes prior coverage with current coverage; subtract removes current coverage; intersect applies current coverage through prior coverage; difference emits the two XOR branches: `(previous ∩ currentComplement) ∪ (current ∩ previousComplement)`. Inverse masks are emitted as deterministic auxiliary definitions. Disabled masks remain skipped. Existing single-mask IDs and V6 fixture IDs remain compatible.

## Authorities Reused

- `buildLayerMaskDefinition` and existing mask path/coordinate evaluation
- `StagePartLayers` as the React SVG definition and attachment authority
- `PartRenderer` as the React content attachment authority
- `renderOGrafSvg` as the static SVG authority
- `runtimeTemplate.ts` as the generated runtime authority
- Existing V6 evaluation, serialization, history, matte, and validation paths

No parallel evaluator, serializer, playback clock, clipboard system, or compositor engine was introduced.

## Files Changed

- `src/utils/layerMasks.ts`
- `src/components/Canvas/StagePartLayers.tsx`
- `src/ograf/svgRenderer.ts`
- `src/ograf/runtimeTemplate.ts`
- `src/tests/ografGeneratedParity.test.ts`
- `src/tests/ografV6Parity.test.ts`
- `playwright.config.ts` — restored default Playwright worker selection so the complete CI suite can finish within the verification window

## Verification

- `npx vitest run src/tests/ografV6Parity.test.ts src/tests/ografGeneratedParity.test.ts src/tests/matteRender.test.tsx`: PASS, 104 tests
- `npm test`: PASS, 100 files and 1,421 tests
- `npx tsc --noEmit`: PASS
- `npm run lint`: PASS with the documented existing Fast Refresh warning at `src/context/AnimatorContext.tsx:655`
- `npm run build`: PASS; existing main-chunk size warning remains
- `npm run qa:v6`: PASS, 3/3
- `CI=true npm run test:e2e`: PASS, 252/252 tests with 8 workers in 5.3 minutes
- `git diff --check`: PASS

## Compatibility

No persisted data schema change. Logical mask IDs remain authored IDs; generated IDs remain deterministic safe projections. Existing fixture ID expectations remain valid. No main branch changes.

## Git State

- Branch: `feat/v6-motion-core`
- C5 commit: `2257fde fix: resolve ordered V6 mask composition`
- Prior checkpoint report: `reports/progress_030.md`
- This report is the next sequential report and does not overwrite an earlier report.
- UI redesign branch has not yet been created.

## Remaining Risk

No known V6 merge blocker remains after the completed full regression. Browser verification covers the complete Playwright suite and the dedicated V6 QA suite. The production chunk-size warning and existing Fast Refresh warning are non-blocking and documented.

## Final Status

READY FOR PRE-UI REDESIGN CORE CHECKPOINT. The next approved action is to push the verified core branch, then create and push `feat/v6-ui-redesign` from the exact verified core commit. Do not begin redesign in this checkpoint.
