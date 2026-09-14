# Progress 078 — OGraf Materialization Content Guards

## Scope

This isolated branch adds one narrow materialization guard: text package files with `content === undefined` now fail before writing instead of becoming empty files. Explicit empty-string content remains valid. Asset handling and filesystem trust-boundary behavior remain unchanged and are tracked separately.

## Regression Coverage

Direct malformed ready-plan coverage covers missing content for the manifest, scene, and generated runtime files. The tests assert rejection and confirm the missing target is not created.

## Validation

- `npm ci` — PASS; existing deprecated `prebuild-install` and blocked `sqlite3` install-script warnings remain.
- Focused package tests — PASS, 1 file / 17 tests.
- Full Vitest — PASS, 101 files / 1,482 tests.
- TypeScript — PASS.
- Lint — PASS with the existing `AnimatorContext.tsx:655` Fast Refresh warning.
- Build — PASS with the existing Vite chunk-size warning.
- `git diff --check` — PASS.
- `validate:ograf` — NOT APPLICABLE; no repository `*.ograf.json` fixture exists.

## Delivery

- Branch: `feat/ograf-validation-fixtures-and-guards`
- Planned commit: `test: add ograf validation fixtures and guards`
- Main merge: intentionally not performed.
- Production release/tag: intentionally not prepared.
