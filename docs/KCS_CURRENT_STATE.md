# KCS Current State

The accepted KCS product and security follow-up line is integrated into `main@1ad3f60`, synchronized with `origin/main`. Tasks 1–6 are complete; Task 7 is documentation reconciliation and Task 8 is a release-readiness audit only.

## Completed security and OGraf work

- Public Controls V1 and OGraf Package Export V2 remain active.
- Windows path and package filesystem hardening is integrated.
- Parent-cycle and broadcast-state map hardening is integrated.
- SourcePath/filesystem trust hardening is integrated; pathname-write TOCTOU remains a documented warning.
- Canonical OGraf SVG and generated runtime mask filter parity is integrated.
- `validate:ograf` validates a committed fixture with complete discovered remote schema hash pinning; network access remains required.
- `qa:release` runs the committed manifest validation and isolated Chromium OGraf import/export/runtime smoke.

## `without-mask` branch decision

`origin/without-mask` remains a standalone root-commit archive candidate. Keep it untouched; any rename, archive, deletion, merge, cherry-pick, or selected import requires explicit approval.

## Protected state

- `main` remains integrated at `1ad3f60`.
- Release tag `v1.1.0-public-controls` remains unchanged.
- Historical reports and old host QA folders are preserved.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, global configuration, and OMP tooling remain unchanged.

## Validation status

- Full Vitest: PASS — 101 files / 1,495 tests.
- Focused OGraf/security suites: PASS.
- `validate:ograf`: PASS for the committed minimal fixture.
- `qa:release`: PASS — candidate `b0d0177`; 2 Playwright tests.
- TypeScript, lint, and production build: PASS with existing warnings.
- Production release/tag remains HOLD pending Task 8 and separate explicit approval.

## Next order

1. Complete Task 7 living-document reconciliation.
2. Run Task 8 release-readiness decision audit only.
3. Request separate approval before any release/tag operation.
