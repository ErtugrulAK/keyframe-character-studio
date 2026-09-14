# KCS Current State

The accepted KCS product and documentation line is integrated into `main@b51f4f3`; the release tag `v1.1.0-public-controls` points to `6351d1a`. Safe merged branch cleanup, safe Copilot cleanup, and the GitHub presentation import/cleanup are complete. `without-mask` remains a manual decision, and the OMP tooling branch remains separate.

The second target-host QA completed successfully:

- BASIC: PASS — `Headline` changes and PLAY motion remain functional.
- ASSET: PASS — `Logo` replacement works after the alternate-resource fixup.
- COMPOSITING: PASS — public color controls work after the color metadata fixup.

This was manifest-rooted target-host testing, not KCS Import. The host import unit remains the generated public-controls folder.

The previous ASSET and COMPOSITING uncertainty is closed for the tested host.

## Public Controls V1

- Text: deterministic fields for visible text layers; explicit `headline` compatibility remains supported.
- Image: package-relative enum/default fields for verified portable image assets; runtime swaps `imageUrl` only to an allowed packaged path.
- Color: deterministic fill/stroke fields for eligible visible layers using `format: color`, `gddType: color-rrggbb`, and lowercase `#rrggbb` validation.
- Matte helper/source layers are excluded from generated controls.
- Current transform, opacity, trim, mask, and path animation channels remain authoritative. No color channels exist in the current animation contract, so public color writes update the stable base paint.

Specification: `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`.

## Branch

`main@b51f4f3` is the current pushed checkpoint before this docs-only update. The release tag remains at `6351d1a`.

The OMP tooling branch remains separate:

- `chore/omp-kcs-config-optimization`

`docs/github-presentation` and the review branch cleanup are complete. `without-mask` remains preserved for manual review. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, and `.omp/backups/` are unchanged.

## Generated QA

`C:\Users\senmu\Masaüstü\KCS\kcs-ograf-public-controls-qa`

- BASIC: explicit `Headline`, generated fill/stroke controls, existing motion.
- ASSET: `Logo` selector contains `assets/images/logo.png` and deterministic `assets/images/logo_alt.svg`.
- COMPOSITING: `Content Fill Color` and `Content Stroke Color` include `format: color` plus `gddType: color-rrggbb`.
- Target-host QA: BASIC PASS, ASSET PASS, COMPOSITING PASS.

The desktop collection inventory and archive result are recorded in:

- `docs/KCS_DESKTOP_FOLDER_INVENTORY.md`
- `docs/KCS_DESKTOP_FOLDER_CLEANUP_PLAN.md`
- `docs/KCS_DESKTOP_FOLDER_CLEANUP_RESULT.md`
## Validation status

- TypeScript: PASS.
- Lint: PASS with the pre-existing Fast Refresh warning.
- Vitest: PASS, 100 files / 1,437 tests.
- Build: PASS with the existing chunk-size warning.
- V6 QA: PASS, 3/3.
- Public-controls OGraf manifest validation: PASS, 3/3.
- Playwright equivalent coverage on main: PASS, 254/254 via shard 1, shard 2 plus isolated V-H12 and V-T17.
- Full Playwright aggregate: TIMEOUT — the 254-test command exceeded the 600-second command timeout.
- `git diff --check`: PASS.

## Known limitations

- Full aggregate Playwright exceeds the 600-second command envelope; equivalent 254/254 coverage passed through shards plus isolated V-T17.
- OGraf Package → editable KCS import remains intentionally unimplemented.
- Windows case/device-name hardening remains technical debt.
- Unowned system fonts remain blocked when portable font bytes are unavailable.
- The official Simple Rendering System was not run.

## Next order

1. Sync the Work PC repository and global OMP tooling safely.
2. Decide the keep/archive policy for `without-mask`.
3. Move to GitHub Actions/CI.
