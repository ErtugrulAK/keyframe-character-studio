# KCS Development Report — Windows Path Hardening V1

## Metadata

- Date: 2026-09-14
- Branch: `feat/windows-path-hardening-v1`
- Base: `main@b34879a`
- Release tag observed: `v1.1.0-public-controls@0a71bd8`
- Scope: low-risk filename, package-path, asset-path, ZIP, and download hardening.

## Summary

Implemented a browser-compatible Windows path safety utility and applied it to standard KCS export filenames, OGraf IDs, OGraf package asset paths, browser ZIP entries, and filesystem materialization. Existing valid package structure and public-controls contracts remain unchanged.

## Safety behavior

- Invalid Windows filename characters and ASCII controls are sanitized.
- Trailing dots/spaces and reserved device names are rejected or replaced with deterministic fallbacks.
- Backslashes normalize to package `/` separators.
- Absolute, drive-letter, UNC, traversal, encoded traversal, invalid, directory, reserved, and trailing-dot/space package entries are rejected.
- Asset package collisions are case-insensitive and remain deterministic.
- Browser ZIP and Node materialization independently revalidate paths.
- Standard KCS export downloads now sanitize `sceneTitle` before appending `.json`.

## Files changed

- `src/utils/pathSafety.ts`
- `src/ograf/compiler.ts`
- `src/ograf/validation.ts`
- `src/ograf/packageCompiler.ts`
- `src/ograf/browserZip.ts`
- `src/ograf/packageWriter.ts`
- `src/components/Header/HeaderBar.tsx`
- `src/tests/pathSafety.test.ts`
- `src/tests/ografPackage.test.ts`
- `docs/KCS_WINDOWS_PATH_HARDENING.md`
- `docs/KCS_OPEN_TASKS.md`
- `docs/KCS_CURRENT_STATE.md`
- `docs/README_INDEX.md`
- `reports/README.md`
- `SESSION.md`
- `NEXT_SESSION.md`
- `PROJECT_STATE.md`

## Validation

- `npm ci`: PASS.
- Focused Vitest: PASS — 3 files, 27 tests.
- Full Vitest: PASS — 101 files, 1,444 tests.
- TypeScript: PASS (`npx tsc --noEmit`).
- Lint: PASS; one pre-existing `AnimatorContext.tsx` Fast Refresh warning remains.
- Production build: PASS; existing bundle-size warning remains.
- `git diff --check`: PASS; only expected CRLF normalization warnings were reported by Git.
- `validate:ograf`: no manifests are present in the repository, so the script printed its usage and exited 2; no fixture validation was possible.

## Protected boundaries

- No global OMP tooling/configuration changed.
- `memory.backend`, model roles, and task concurrency were not changed.
- `without-mask` remains untouched and classified ARCHIVE.
- No release tag was changed.
- No secret was written.
