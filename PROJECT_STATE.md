# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into `main@449ca898a30442e906b802f9824b2ad1dc278e5e`. Release-readiness blocker resolution is prepared on `fix/release-readiness-blockers`; no release or tag has been created.

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

- Validate the four accepted release-readiness blocker outcomes on `fix/release-readiness-blockers`.
- Complete independent review and decide READY, READY WITH WARNINGS, or NOT READY.
- Production release/tag remains HOLD; separate explicit approval is required.

## Protected state

- `main` baseline and `origin/main` were synchronized at `449ca898a30442e906b802f9824b2ad1dc278e5e`.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- Candidate package version is `1.1.0-rc.1`; package remains private and unreleased.
