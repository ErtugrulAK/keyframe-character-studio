# KCS Current State

## Executive summary

The accepted KCS product/documentation line remains available through `integration/v6-ui-ograf-release-candidate@4e4c269`. `feat/ograf-public-controls-v1` is based on that release candidate and adds host-editable OGraf text, image, and color controls. `main` remains untouched.

## Existing host behavior

The prior target-host QA passed for BASIC, ASSET, and COMPOSITING using manifest-rooted folders:

- BASIC exposed a text field and changed text rendered during PLAY.
- ASSET rendered the packaged image but had no complete public image-choice contract.
- COMPOSITING rendered its rectangle/color transition but exported no public color controls.

BASIC worked because its manifest declared `headline` and the generated runtime binding mapped it to `textValue`. The previous image path was renderable through package asset references, but public image fields were not synthesized by the production export path and the old runtime guard was not an enum-bound control. Colors had no public schema or runtime binding.

## Public Controls V1

- Text: deterministic fields for visible text layers; explicit `headline` compatibility remains supported.
- Image: package-relative enum/default fields for verified portable image assets; runtime swaps `imageUrl` only to an allowed packaged path.
- Color: deterministic fill/stroke fields for eligible visible layers using `gddType: color-rrggbb` and lowercase `#rrggbb` validation.
- Matte helper/source layers are excluded from generated controls.
- Current transform, opacity, trim, mask, and path animation channels remain authoritative. No color channels exist in the current animation contract, so public color writes update the stable base paint.

Specification: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.

## Branch

`feat/ograf-public-controls-v1`, based on `integration/v6-ui-ograf-release-candidate@4e4c269`.

The OMP tooling branch `chore/omp-kcs-config-optimization@50b42d4` remains separate. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, and `.omp/backups/` are unchanged/preserved.

## Generated QA

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa`

- BASIC: explicit `Headline`, generated fill/stroke controls, existing motion.
- ASSET: `Logo` image selector with the packaged default and generated caption text/color controls.
- COMPOSITING: generated `Content Fill Color` and `Content Stroke Color` controls with existing motion.
- Turkish instructions: `README_PUBLIC_CONTROLS_QA_TR.txt`.

The prior host QA folder remains preserved:

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa`

## Validation status

- TypeScript: PASS.
- Lint: PASS with the pre-existing Fast Refresh warning.
- Vitest: PASS, 100 files / 1,437 tests.
- Build: PASS with the existing chunk-size warning.
- V6 QA: PASS, 3/3.
- Full Playwright: PASS, 254/254.
- Public-controls OGraf manifests: PASS, 3/3.
- `git diff --check`: PASS.

## Known limitations

- Manual public-controls host smoke is pending.
- A package with one portable image intentionally exposes one image option; multiple packaged images are required for meaningful selection choices.
- OGraf Package → editable KCS import remains intentionally unimplemented.
- Windows case/device-name hardening remains technical debt.
- Unowned system fonts remain blocked when portable font bytes are unavailable.
- The official Simple Rendering System was not run.

## Next order

1. Test the new BASIC, ASSET, and COMPOSITING folders in the target host.
2. Record exact controls, changed values, output, and failures in `reports/progress_052.md` or attached QA evidence.
3. Request explicit release approval.
4. Only after approval, consider a separate protected `main` integration.
