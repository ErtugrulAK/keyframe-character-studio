# Progress 069 — Windows Reserved Superscript Device Names

Date: 2026-09-14
Branch: `feat/windows-path-hardening-v1`

## Scope

- Centralized Unicode NFKC normalization in `isReservedWindowsName`.
- Added regression coverage for `COM¹`/`COM²`/`COM³` and `LPT¹`/`LPT²`/`LPT³`, including mixed case and extensions.
- Added sanitizer fallback and package-relative path rejection coverage.
- Updated `docs/KCS_WINDOWS_PATH_HARDENING.md`.

## Validation

- `npm ci` — passed; npm reported the existing `sqlite3` install script as blocked by the configured install-script policy.
- `npx vitest run src/tests/pathSafety.test.ts` — passed, 1 file / 8 tests.
- `npm test -- --run` — passed, 101 files / 1,447 tests.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with the existing `react(only-export-components)` warning in `src/context/AnimatorContext.tsx`.
- `npm run build` — passed with the existing Vite chunk-size warning.
- `git diff --check` — passed after removing the test-file trailing blank line.
- `npm run validate:ograf` — not applicable; no `*.ograf.json` fixtures exist in the repository.

## Security and Scope Audit

- Reserved-name detection now applies NFKC before extension parsing and uppercasing, so Windows-equivalent superscript device names share the existing reserved-name policy.
- Sanitizer behavior remains compatible because it already normalized with NFKC.
- Package-relative paths continue to reject non-ASCII components before filesystem emission.
- No changes to global configuration, secrets, `main`, `origin/without-mask`, tags, routes, servers, or unrelated export logic.

## Delivery

- Commit message: `fix: cover superscript windows device names`
- Feature branch only; no merge to `main`.
