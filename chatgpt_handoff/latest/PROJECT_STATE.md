# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into `main@1ad3f60`. Tasks 1–6 are complete. Task 7 is the current documentation reconciliation scope; Task 8 remains a release-readiness audit only.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, and the isolated release smoke gate are present in the accepted main line. OMP tooling remains separate.

## Validation status

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 101 files / 1,495 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf`; committed minimal fixture |
| OGraf release smoke | PASS | `npm run qa:release`; candidate `b0d0177`; 2 Playwright tests |
| TypeScript | PASS | `npx tsc --noEmit` and build typecheck |
| Lint | PASS | Existing Fast Refresh warning only |
| Production build | PASS | Existing Vite chunk-size warning only |

## Remaining work

- Task 7: current-state documentation reconciliation.
- Task 8: release-readiness decision audit only.
- Production release/tag remains HOLD; separate explicit approval is required.

## Protected state

- `main` and `origin/main` are synchronized at `1ad3f60`.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- No production release or new tag was prepared.
