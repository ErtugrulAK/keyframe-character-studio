# Progress 070 — URL-Unsafe Package Path Characters

Date: 2026-09-14
Branch: `feat/windows-path-hardening-v1`

## Scope

- Restored the centralized package-relative path rejection policy for `?`, `#`, and `%`.
- Preserved filename sanitizer behavior and the superscript Windows device-name policy.
- Added focused regression coverage for unsafe URL characters and valid image/font package paths.
- Updated `docs/KCS_WINDOWS_PATH_HARDENING.md`.

## Validation

- `npm ci` — passed; npm reported the existing `sqlite3` install script as blocked by the configured install-script policy.
- `npx vitest run src/tests/pathSafety.test.ts` — passed, 1 file / 14 tests.
- OGraf package/browser ZIP tests — passed, 7 files / 60 tests.
- `npm test -- --run` — passed, 101 files / 1,453 tests.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with the existing `react(only-export-components)` warning in `src/context/AnimatorContext.tsx`.
- `npm run build` — passed with the existing Vite chunk-size warning.
- `git diff --check` — passed.
- `npm run validate:ograf` — not applicable; no `*.ograf.json` fixtures exist in the repository.

## Security and Contract Review

- `assets/images/logo#2.png`, `assets/images/logo?2.png`, and percent-containing package paths are rejected centrally.
- Valid printable-ASCII image and font package paths remain accepted.
- Browser ZIP and Node materialization continue to consume the same central package-path policy.
- Superscript reserved-name rejection remains covered.
- Public Controls V1 package-relative image values and OGraf package structure are unchanged.
- No source, test, documentation, global configuration, tag, main, or `without-mask` changes outside the approved patch surfaces.

## Delivery

- Commit message: `fix: reject url-unsafe package path characters`
- Feature branch only; no merge to `main`.
