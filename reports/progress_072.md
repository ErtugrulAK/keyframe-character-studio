# Progress 072 — Windows Path Hardening V1 Main Merge

Date: 2026-09-14
Source branch: `feat/windows-path-hardening-v1`
Target branch: `main`

## Merge

- Pre-merge gate: PASS WITH WARNINGS.
- Strategy: fast-forward only.
- Merged commits: `cdff2c9`, `cce5df3`, `b6fca49`.
- Main advanced from `b34879a` to `b6fca49`.
- No merge commit, conflict, rebase, reset, or force update.

## Validation

Pre-merge feature validation:

- `npm ci` — passed; existing deprecation and blocked `sqlite3` install-script warnings remain.
- Path safety tests — passed, 1 file / 14 tests.
- OGraf package/browser ZIP tests — passed, 7 files / 60 tests.
- Full Vitest — passed, 101 files / 1,453 tests.
- TypeScript — passed.
- Lint — passed with the existing `AnimatorContext.tsx:655` Fast Refresh warning.
- Build — passed with the existing Vite chunk-size warning.
- `git diff --check` — passed.
- `validate:ograf` — not applicable; no `*.ograf.json` fixtures exist.

Post-merge main validation:

- `npm ci` — passed; same existing warnings.
- Path safety tests — passed, 1 file / 14 tests.
- OGraf package/browser ZIP tests — passed, 7 files / 60 tests.
- Full Vitest — passed, 101 files / 1,453 tests.
- TypeScript — passed.
- Lint — passed with the existing `AnimatorContext.tsx:655` Fast Refresh warning.
- Build — passed with the existing Vite chunk-size warning.
- `git diff --check` — passed.
- `validate:ograf` — not applicable; no `*.ograf.json` fixtures exist.

## Protected Invariants

- No release tag was created, moved, or deleted.
- `origin/without-mask` was not modified.
- No secrets or credentials were written or committed.
- No global OMP configuration was changed; recorded `memory.backend` remains `mnemopi`, `task.maxConcurrency` remains `8`, and model roles are preserved.
- No dependency, lockfile, CI, network, process, or runtime-activation changes were introduced.

## Follow-up Risks

- `packageWriter.ts` still has a conditional symlink/junction and TOCTOU risk when a hostile output tree is pre-populated.
- Prototype-sensitive keys such as `__proto__`, `constructor`, and `prototype` can cause package/schema/runtime integrity or availability edge cases through plain-object maps.
- Direct ZIP/materialization revalidation guard coverage can be expanded.
- Existing lint, Vite chunk-size, npm install-script, and jsdom warnings remain non-blocking.

## Delivery

This report is committed on `main` after post-merge validation. The main branch is pushed to `origin/main`; the feature branch is retained.
