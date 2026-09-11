# KCS Development Report — OGraf Public Controls V1

## Executive Summary

Implemented `feat/ograf-public-controls-v1` from `integration/v6-ui-ograf-release-candidate@4e4c269`. OGraf export now generates deterministic host-editable text, image, and color controls for real scene content. The generated runtime applies these values through `updateAction` without accepting unsafe image paths or invalid colors.

`main` remains untouched. The OMP tooling branch and all protected configuration remain separate.

## User request

The target host already exposed and applied BASIC text, but ASSET only displayed a packaged image and COMPOSITING only rendered its color transition. The requested milestone adds explicit public controls so host users can edit text, choose packaged images, and change fill/stroke colors while preserving standard OGraf package and legacy export compatibility.

## Current host behavior and root cause

- BASIC was editable because its manifest declared `headline` as a public string and the runtime binding mapped that key to `textValue`.
- ASSET rendered because the runtime resolved a packaged image reference, but the production export path did not synthesize image public fields. The previous schema/runtime also used a broad reference map rather than a per-field packaged enum contract.
- COMPOSITING had no public color field, binding, or runtime update path. Its authored color was static scene data, not host public state.

## Public control contract

Specification: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.

- Text fields use deterministic IDs such as `text_<layer>`; a `Headline` layer preserves the `headline` compatibility ID when no explicit field overrides it.
- Image fields use deterministic IDs such as `image_<layer>`, package-relative enum values, and a package-relative default path.
- Fill/stroke fields use deterministic IDs such as `fill_<layer>` and `stroke_<layer>`.
- Color schema uses `type: string`, `gddType: color-rrggbb`, and lowercase `#rrggbb` pattern validation.
- Visible matte helper/source layers are excluded from generated controls.
- Existing transform, opacity, trim, mask, and path channels remain authoritative. Current OGraf animation has no color channels, so public color updates modify the stable base paint without corrupting animation.

## Implementation details

- `src/ograf/publicControls.ts` resolves explicit and automatically generated controls with collision-safe IDs.
- `src/ograf/types.ts` adds public color fields, image options, and validated control collections.
- `src/ograf/validation.ts` emits text/image/color manifest properties and official color metadata.
- `src/ograf/compiler.ts` includes all resolved public controls in compiler diagnostics.
- `src/ograf/packageCompiler.ts` rematerializes public controls after deterministic asset path collision handling so manifest/runtime paths stay aligned.
- `src/ograf/runtimeTemplate.ts` binds text/image/color properties and validates image enum membership, packaged references, and `#rrggbb` color values in `load`/`updateAction`.
- `src/tests/ografExport.test.ts` covers deterministic generated schema and compatibility fields.
- `src/tests/ografGeneratedParity.test.ts` covers text update, packaged image swap, color update, unsafe image rejection, and rendered output.

## Asset/image safety rules

Only verified local assets or browser-owned bytes are packaged. Public image values must be in the field enum and packaged reference map. Absolute paths, traversal paths, external URLs, data URLs, and arbitrary unlisted values are rejected. Package writer and ZIP writer containment checks remain active.

## Color precedence and animation behavior

Public color values are written to the mutable runtime scene before rendering. The current track model has no color channels. Transform, opacity, trim, mask, and path channels continue through the existing evaluator. Matte helper sources are not exposed, avoiding accidental edits to luminance/alpha matte geometry.

## Generated QA folder

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa`

- `BASIC/` — explicit `Headline`, generated fill/stroke controls, existing text motion.
- `ASSET/` — `Logo` image field with packaged default, caption text, and caption colors.
- `COMPOSITING/` — `Content Fill Color` and `Content Stroke Color` controls with existing motion.
- `README_PUBLIC_CONTROLS_QA_TR.txt` — Turkish host test instructions and failure evidence requirements.

The older `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa` folder was preserved.

## Tests and exact outcomes

- `git diff --check`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS; existing `src/context/AnimatorContext.tsx:655` Fast Refresh warning only.
- `npm test`: PASS, 100 files / 1,437 tests.
- `npm run build`: PASS; existing Vite chunk-size warning only.
- `npm run qa:v6`: PASS, 3/3.
- `CI=true npm run test:e2e`: PASS, 254/254.
- `node scripts/validate-ograf-manifest.mjs` for BASIC, ASSET, COMPOSITING: PASS, 3/3.

Focused security coverage also rejects URL-encoded package traversal, unsafe image update values, and invalid color updates.

## Reviewer findings

Independent reviewer recheck: 0 blockers after fixes. The review specifically covered active matte-source filtering, invalid/`none` color defaults, and URL-semantics package traversal. Non-blocking follow-up candidates remain for broader legacy disabled-matte render semantics and mixed invalid payload atomicity.

## Git summary

- Branch: `feat/ograf-public-controls-v1`.
- Base: `integration/v6-ui-ograf-release-candidate@4e4c269`.
- `main`: unchanged at `8024d4f`.
- `memory.backend`: `mnemopi`.
- Model/provider mappings and global OMP configuration: unchanged.
- `.omp/backups/`: preserved and ignored.
- Read-only corpus: untouched.

## Next user QA action

In the target host/downstream app, import the manifest-rooted folders in this order: BASIC, ASSET, COMPOSITING. Change the exact controls named in `README_PUBLIC_CONTROLS_QA_TR.txt`, run PLAY/update as required, and record screenshots/errors plus whether the old host-compat folder still works.

## Verdict

READY FOR PUBLIC-CONTROLS HOST QA.
