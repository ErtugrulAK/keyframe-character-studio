# Progress 076 — Prototype-Key Security Patch Merged

## Merge

- `feat/prototype-key-security-hardening` was reviewed and fast-forwarded into `main`.
- Main commit: `8a89538` (`fix: close prototype schema and mask gaps`), with the preceding security hardening commit `00d8e88`.
- `origin/main` was pushed successfully.
- No merge commit, force update, tag, release, or `without-mask` change was performed.

## Post-Merge Validation

- Full Vitest — PASS, 101 files / 1,479 tests.
- TypeScript — PASS.
- Build — PASS; generated JavaScript is approximately 591.93 kB.
- Lint — PASS with the existing `AnimatorContext.tsx:655` Fast Refresh warning.
- `git diff --check` — PASS.
- No `*.ograf.json` fixtures exist; `validate:ograf` remains not applicable.

## Security Result

The merged patch rejects prototype-sensitive imported layer, mask, matte/track-matte, public-field, and package-path keys; hardens inherited MIME checks; and uses own-key/null-prototype handling for affected generated runtime maps and caches.

The patch is intentionally narrow. Production security/release approval remains conditional on separately addressing:

- Imported numeric/style SVG attribute validation and escaping.
- Mask/matte mode enum validation and SVG attribute escaping.
- OGraf parent-cycle detection before recursive evaluation.
- Caller-provided `sourcePath` containment/trust handling.
- Symlink/junction/reparse-point and TOCTOU protection in package writing.
- Imported scene to broadcast-state prototype-sensitive IDs.
- Direct malformed-plan ZIP/materialization regression coverage.

## Protected Invariants

- `memory.backend` remains `mnemopi`.
- `task.maxConcurrency` remains `8`.
- Existing model roles, tags, `without-mask`, and global OMP configuration remain unchanged.
- No secrets or new network activation were introduced.

Production release/tag preparation: intentionally not performed.
