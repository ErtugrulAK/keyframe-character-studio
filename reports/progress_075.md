# Progress 075 — Imported Prototype-Key Security Hardening

Date: 2026-09-14
Branch: `feat/prototype-key-security-hardening`
Base main: `8b52b05`

## Scope

This isolated security patch hardens prototype-sensitive imported keys and inherited lookups without merging to `main` or preparing a release/tag.

Implemented:

- Own-key validation for supported OGraf layer types.
- Rejection of exact `__proto__`, `constructor`, and `prototype` layer IDs, mask IDs, matte/track-matte source IDs, and public field IDs at the OGraf validation boundary.
- Prototype-sensitive package path segment rejection through the central path policy.
- Own-key embedded MIME allowlist checks for data and blob image preparation.
- Null-prototype/own-key-safe generated runtime maps for transforms, matte/mask/clip bookkeeping, public bindings, image/font references, procedural broadcast state, and frame overrides.
- Regression coverage for hostile layer types/IDs, mask and matte IDs, public field IDs, exact package keys, embedded MIME values, and browser ZIP rejection.

## Validation

- `npm ci` — PASS; existing deprecated `prebuild-install` and blocked `sqlite3` install-script warnings remain.
- Focused hostile-key tests — PASS, 5 files / 69 tests.
- Full Vitest — PASS, 101 files / 1,473 tests.
- TypeScript — PASS.
- Lint — PASS with the existing `AnimatorContext.tsx:655` Fast Refresh warning.
- Build — PASS with the existing Vite chunk-size warning; generated JS is approximately 591.87 kB.
- `git diff --check` — PASS.
- `validate:ograf` — NOT APPLICABLE; no `*.ograf.json` fixtures exist.

## Security Disposition

Resolved in this branch:

- `SUPPORTED_LAYER_TYPES` inherited-key bypass.
- Imported layer/mask/matte/track-matte prototype-sensitive IDs.
- Public field schema prototype-sensitive IDs.
- Embedded MIME allowlist inherited-key bypass.
- Runtime transform/matte/mask/clip/reference map inherited-key behavior.
- Browser ZIP exact `__proto__` package-entry omission path.

Explicit follow-ups, not folded into this narrow patch:

- Imported numeric/style attribute validation and SVG markup injection.
- Mask/matte mode enum validation and raw SVG attribute escaping.
- Parent hierarchy cycle detection in the OGraf validation path.
- Caller-provided `sourcePath` trust boundary.
- Filesystem symlink/junction/reparse-point and TOCTOU hardening.
- Direct malformed-plan ZIP/materialization guard tests.

## Contract and Invariant Review

- Valid supported layer types, scenes, OGraf package structure, Public Controls V1 package-relative image values, KCS import classification, runtime parity, and legacy safe embedded image flows remain covered and passing.
- No dependency, lockfile, global OMP, tag, `main`, `without-mask`, secret, network, or runtime activation changes.
- `memory.backend` remains `mnemopi`; `task.maxConcurrency` remains `8`; model roles are preserved.

## Delivery

- Commit: `fix: harden prototype-sensitive imported keys`
- Push target: `origin/feat/prototype-key-security-hardening`
- Main merge: intentionally not performed.
- Production release/tag: intentionally not prepared.
