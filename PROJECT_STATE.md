# KCS Project State

## Current position

The accepted product line and narrow prototype-key security hardening are integrated into `main@0f321c4`. The release tag `v1.1.0-public-controls` remains unchanged at `0a71bd8`. The `without-mask` branch remains a preserved archive candidate.

## Accepted baseline

Public Controls V1, OGraf package milestones, host compatibility work, presentation documentation, Windows path hardening, and prototype-sensitive imported-key hardening are present in the accepted main line. OMP tooling remains separate.

## Validation status

| Area | Status | Evidence |
|---|---|---|
| Prototype-key security hardening | MERGED | `reports/progress_075.md`, `reports/progress_076.md` |
| Full Vitest | PASS | 101 files / 1,479 tests |
| TypeScript | PASS | `npx tsc --noEmit` and build typecheck |
| Lint | PASS | Existing Fast Refresh warning only |
| Production build | PASS | Existing Vite chunk-size warning only |
| OGraf fixture validation | N/A | No `*.ograf.json` manifests exist |

## Open security follow-ups

Numeric/style SVG validation and escaping; mask/matte mode allowlisting and escaping; OGraf parent-cycle detection; caller-provided sourcePath containment; filesystem symlink/junction/reparse and TOCTOU hardening; imported broadcast-state key handling; and direct malformed-plan materialization tests remain open and must be handled as separate scoped work.

## Protected state

- `main` and `origin/main` are synchronized at `0f321c4`.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- No release tag or production release was prepared.

## Next action

Perform a separate threat-model and implementation review for the listed follow-ups. Do not weaken tests, add retries, or merge broad security changes without scoped validation.
