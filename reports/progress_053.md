# Progress 053 — Public Controls Host QA Fixup

## Executive Summary

The first manual host QA passed BASIC, but ASSET was unclear because its package exposed only one image choice. COMPOSITING was partial/failing because the host did not visibly expose usable color controls. This fixup makes the external QA package explicit and reproducible without changing `main`, global OMP settings, model mappings, or `memory.backend: mnemopi`.

## User manual QA result

- BASIC: PASS — `Headline` changes and PLAY keeps motion.
- ASSET: NEEDS CLEARER IMAGE-REPLACEMENT TEST — the previous package exposed one image choice.
- COMPOSITING: COLOR CONTROL NOT VISIBLE/USABLE IN HOST — animation played, but color editing was not evident.

## Root causes

### ASSET

The production compiler already generated package-relative image enums and safe runtime allow-lists. The external ASSET QA artifact contained only `assets/images/logo.png`, so there was no alternate choice that could prove replacement.

### COMPOSITING

The production compiler already generated `Content Fill Color` and `Content Stroke Color` controls using `type: string`, `gddType: color-rrggbb`, and lowercase hex validation. The host did not visibly surface those controls in the first manual pass. The schema now also advertises the standard `format: color` hint while retaining the OGraf metadata and string fallback instructions.

## Implementation fix

- Added `scripts/generate-public-controls-qa-assets.mjs`, a deterministic updater for the external ASSET QA package.
- Added the locally generated, non-proprietary `assets/images/logo_alt.svg` test image.
- Updated the ASSET manifest enum/default and generated runtime image reference map.
- Added `format: color` to generated color properties in `src/ograf/validation.ts` while preserving `gddType: color-rrggbb` and the six-digit lowercase hex pattern.
- Extended generated-runtime coverage for alternate image selection, fill/stroke writes, and traversal/absolute/external image rejection.
- Updated Turkish QA instructions with exact values and expected results.

## New ASSET image replacement proof

QA package:

`C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa\ASSET`

Choices:

- `assets/images/logo.png` — default existing image.
- `assets/images/logo_alt.svg` — deterministic alternate image with a blue background, yellow circle, and white bars.

Select `assets/images/logo_alt.svg` through the `Logo` field. The runtime accepts only the two listed package-relative values and maps the alternate path to the packaged resource.

## New COMPOSITING color-control proof

QA package:

`C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa\COMPOSITING`

Visible fields:

- `Content Fill Color` — `#00ff00` test value.
- `Content Stroke Color` — `#0000ff` test value.

Each field is a string with `format: color`, `gddType: color-rrggbb`, and `^#[0-9a-f]{6}$` validation. Runtime `updateAction` applies both properties before rendering.

## Regenerated QA folder

`C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa`

The pre-fix folder was preserved as:

`C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa.before-fix-20260913-152710`

## Exact test instructions

1. BASIC: open the package, change `Headline`, press PLAY, and confirm changed text plus motion.
2. ASSET: open `Logo`, switch from `assets/images/logo.png` to `assets/images/logo_alt.svg`, and confirm the visible image changes.
3. COMPOSITING: set `Content Fill Color` to `#00ff00` and `Content Stroke Color` to `#0000ff`; run update/PLAY as required and confirm colors plus motion.

## Validation results

- Focused OGraf Vitest: PASS, 2 files / 19 tests.
- TypeScript: PASS.
- Vitest: PASS, 100 files / 1,437 tests.
- Lint: PASS with the existing Fast Refresh warning.
- Build: PASS with the existing chunk-size warning.
- V6 QA: PASS, 3/3.
- Full Playwright: FAIL/TIMEOUT — `CI=true npm run test:e2e` exceeded the 600-second command timeout after starting 254 tests; no final aggregate result was emitted.
- OGraf manifest validation: BLOCKED in this environment because `scripts/validate-ograf-manifest.mjs` could not import the declared `ajv` package; independent JSON parsing passed for BASIC, ASSET, and COMPOSITING.
- `git diff --check`: PASS.

## Git summary

- Branch: `feat/ograf-public-controls-v1`.
- `main`: untouched.
- Global OMP configuration: unchanged.
- `memory.backend`: remains `mnemopi`.
- Commit: pending.
- Push: pending.

## Next user QA action

Run the second host QA pass using the updated Turkish README and record the exact host controls, values, render result, and any screenshot or error.
