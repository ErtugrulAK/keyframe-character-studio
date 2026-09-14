# Progress 080 — General Project Health and Release-Gate Review

## Health

- Main integration is stable and synchronized with origin.
- The prototype-key security hardening is merged and independently validated.
- `feat/ograf-validation-fixtures-and-guards` is pushed for review and remains unmerged.
- Existing feature branches are preserved; no branch deletion was performed.

## CI and Validation

The checked-in CI workflow runs npm install, lint, TypeScript, Vitest, and build. It does not run Playwright or `validate:ograf`. Local main validation is green: 101 Vitest files / 1,479 tests, TypeScript, lint, build, and diff checks. Existing Fast Refresh and Vite chunk-size warnings remain.

## Risk Map

High-priority release blockers are imported SVG numeric/style validation and escaping, mask/matte mode validation and output parity, sourcePath provenance, and filesystem link/TOCTOU defenses. Medium-priority blockers are parent-cycle rejection and imported broadcast-state map hardening. Fixture/validator policy remains a deterministic tooling decision because the current validator fetches the live EBU schema closure.

## Detailed Follow-up Plans

### SourcePath provenance — branch plan only

Proposed branch: `feat/sourcepath-trust-boundary-hardening`. Replace caller-asserted trust with an explicit allowed-root/provenance contract, reject absolute/UNC/device/ADS and out-of-root paths, and prefer `binaryContent` for browser-facing callers. Acceptance requires allowed-root success, traversal/drive/UNC rejection, symlink-source policy tests, and no implicit CWD resolution. Do not implement until the public Node API contract and trusted-root ownership are approved.

### Filesystem materialization — branch plan only

Proposed branch: `feat/package-writer-filesystem-boundary-hardening`. Preflight every normalized package path and payload before creating output directories; use canonical containment checks and platform-specific no-follow handling. Windows coverage must address junctions/reparse points and rename races; POSIX coverage must address symlinked roots/descendants and rename races. Acceptance requires no outside writes, no partial output after late validation failure, and explicit behavior when safe no-follow primitives are unavailable. This is OS-specific/high risk; no implementation now.

### Parent hierarchy — branch plan only

Proposed branch: `feat/ograf-parent-cycle-hardening`. Add one deterministic hierarchy diagnostic at import/OGraf validation, reject self and multi-node cycles, and add evaluator/generated-runtime defense in depth. Acceptance requires blocked compile, stable diagnostic ordering, unchanged state after import rejection, and no recursive crash.

### SVG and matte/mask boundaries — branch plan only

Proposed branch: `feat/ograf-validation-security-boundaries`. Add shared numeric/channel type and finite checks, color grammar validation, explicit matte/mask enum/boolean validation, and canonical/generated output parity tests. Preserve legacy omitted-mode semantics while rejecting malformed V2 modes. Inverted luminance/image/legacy-clip parity must be resolved before implementation; do not ship a renderer-only workaround.

### Fixture and validator policy — plan only

The current `validate:ograf` command fetches the EBU schema and `$ref` closure live, while CI does not invoke it. A deterministic fixture requires vendoring the seven-file schema closure or adding a controlled schema cache; both are policy/maintenance decisions. Keep fixture addition and CI wiring separate from the small malformed-content guard branch until that policy is approved.

## Release Decision

Production release remains HOLD / CONDITIONAL. The existing `v1.1.0-public-controls` tag is an unchanged historical checkpoint, not a new release authorization. No tag or release metadata version was created or moved.

## Next Five Tasks

1. Design a shared imported numeric/style validation boundary and hostile regression matrix.
2. Design mask/matte enum, boolean, and inversion parity handling across editor, canonical SVG, and generated runtime.
3. Design parent-cycle validation plus evaluator defense in depth.
4. Define sourcePath provenance and cross-platform filesystem materialization policy.
5. Decide whether to vendor an offline OGraf schema closure or retain live-only validation, then expand malformed-plan guard coverage.
