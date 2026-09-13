# KCS Current State

## Executive summary

The accepted KCS product/documentation line remains available through `integration/v6-ui-ograf-release-candidate@4e4c269`. `feat/ograf-public-controls-v1` is based on that release candidate and adds host-editable OGraf text, image, and color controls. `main` remains untouched.

## Existing host behavior

The first manual target-host QA produced a mixed result:

- BASIC passed: `Headline` changed and PLAY preserved motion.
- ASSET was unclear because the package exposed only one image choice.
- COMPOSITING was partial/failing because the host did not visibly expose usable color controls.

The implementation already generated safe image/color bindings, but the ASSET artifact lacked a second resource and the color schema did not advertise the standard `format: color` hint.

## Public Controls V1

- Text: deterministic fields for visible text layers; explicit `headline` compatibility remains supported.
- Image: package-relative enum/default fields for verified portable image assets; runtime swaps `imageUrl` only to an allowed packaged path.
- Color: deterministic fill/stroke fields for eligible visible layers using `format: color`, `gddType: color-rrggbb`, and lowercase `#rrggbb` validation.
- Matte helper/source layers are excluded from generated controls.
- Current transform, opacity, trim, mask, and path animation channels remain authoritative. No color channels exist in the current animation contract, so public color writes update the stable base paint.

Specification: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.

## Branch

`feat/ograf-public-controls-v1`, based on `integration/v6-ui-ograf-release-candidate@4e4c269`.

The OMP tooling branch `chore/omp-kcs-config-optimization@50b42d4` remains separate. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, and `.omp/backups/` are unchanged/preserved.

## Generated QA

`C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa`

- BASIC: explicit `Headline`, generated fill/stroke controls, existing motion.
- ASSET: `Logo` selector now contains `assets/images/logo.png` and deterministic `assets/images/logo_alt.svg`.
- COMPOSITING: `Content Fill Color` and `Content Stroke Color` include `format: color` plus `gddType: color-rrggbb`.
- Turkish instructions explain exact field names, values, and expected render changes.

The prior host QA folder remains preserved:

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa`

## Validation status

- TypeScript: PASS.
- Lint: PASS with the pre-existing Fast Refresh warning.
- Vitest: PASS, 100 files / 1,437 tests.
- Build: PASS with the existing chunk-size warning.
- V6 QA: PASS, 3/3.
- Full Playwright: PASS, 254/254.
- Public-controls OGraf manifest validation: BLOCKED by missing local `ajv` import; independent JSON parsing PASS, 3/3.
- `git diff --check`: PASS.

## Known limitations

- Second manual public-controls host smoke is pending.
- Host support for native color controls is not independently confirmed; the manifest retains both standard `format: color` and OGraf `gddType: color-rrggbb`, with string `#rrggbb` fallback instructions.
- OGraf Package → editable KCS import remains intentionally unimplemented.
- Windows case/device-name hardening remains technical debt.
- Unowned system fonts remain blocked when portable font bytes are unavailable.
- The official Simple Rendering System was not run.

## Next order

1. Test the new BASIC, ASSET, and COMPOSITING folders in the target host.
2. Record exact controls, changed values, output, and failures in `reports/progress_053.md`.
3. Request explicit release approval.
4. Only after approval, consider a separate protected `main` integration.
