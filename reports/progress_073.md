# Progress 073 — Post-Merge Hardening Follow-up Audit

Date: 2026-09-14
Branch: `main`
Baseline: `2570698` (`docs: record windows path hardening merge`)

## Scope

Read-only follow-up audit after the Windows Path Hardening V1 merge. No source, test, or configuration implementation changes were made.

## Findings

### 1. Prototype-sensitive keys — follow-up required

Plain-object maps and property assignment remain vulnerable to integrity/availability edge cases for exact keys such as `__proto__`, `constructor`, and `prototype`:

- `src/ograf/browserZip.ts` builds ZIP entries in `{}`; an exact `__proto__` package path can be accepted by the path policy but omitted or mishandled by object assignment and ZIP flattening.
- `src/ograf/validation.ts` uses plain record/property assignment for public field IDs; `__proto__` can disappear from serialized schema output.
- Generated runtime maps for transforms, masks, mattes, clip definitions, image/font references, and related IDs use plain objects in several paths; hostile IDs can produce inherited-key cache hits, missing references, or malformed output.
- `SUPPORTED_LAYER_TYPES[layer.type]` can accept inherited `constructor`/`__proto__` values instead of requiring an own supported key.

Classification: high-priority integrity/availability blocker for untrusted imported scene JSON. No confirmed code execution or global prototype pollution. Implement on a separate feature branch with own-key/null-prototype/Map hardening and hostile-ID regression tests before any production release.

### 2. Embedded image MIME allowlist — follow-up required

`src/ograf/legacyCompatibility.ts` uses a normal object for embedded-image MIME allowlisting. Inherited keys such as `constructor` or `__proto__` can bypass the intended allowlist check and reach embedded-image preparation with an unsupported MIME value. This can weaken SVG sanitization and produce an unsafe portable asset classification.

Classification: high-priority asset-boundary follow-up. Use an explicit own-key allowlist or null-prototype table and add `constructor`, `__proto__`, and `prototype` MIME regression cases. No implementation was made on `main`.

### 3. Filesystem symlink/junction and TOCTOU risk

`src/ograf/packageWriter.ts` performs lexical containment checks before `mkdir`/`writeFile`, but does not canonicalize or no-follow existing output-root descendants. A hostile pre-populated output tree or race can redirect writes through a symlink, junction, or Windows reparse point.

Classification: high conditional filesystem risk when an attacker can control the output tree; latent in the current application because no production route was identified. Implement separately with Windows-aware reparse-point/no-follow handling and direct hostile-tree tests.

### 4. ZIP/materialization parity coverage

Existing tests cover successful package generation and core path policy, but direct malformed ready-plan cases are under-tested:

- prototype-sensitive package paths
- duplicate normalized paths at writer boundaries
- missing binary/content payloads
- blocked plans
- symlink/junction/reparse-point output trees

Add deterministic browser ZIP and Node materialization guard tests in the follow-up branch.

### 5. OGraf fixture gap

No committed `*.ograf.json` fixtures exist. `validate:ograf` therefore remains not applicable. Add a deterministic, offline-validatable fixture and invoke the validator explicitly in CI when the fixture policy is approved.


## Existing Warnings

- `AnimatorContext.tsx:655` Fast Refresh lint warning.
- Vite generated chunk exceeds the 500 kB advisory threshold.
- jsdom navigation/canvas warnings during full Vitest.
- `prebuild-install` deprecation and blocked `sqlite3` install script under the current install policy.
- Documentation/status files require post-merge reconciliation.

## Recommended Separate Tasks

1. Harden generated runtime and OGraf schema/package maps against prototype-sensitive keys.
2. Harden packageWriter against symlink/junction/reparse-point and TOCTOU escapes.
3. Add direct ZIP/materialization guard tests for malformed plans and hostile IDs.
4. Add a deterministic OGraf manifest/package fixture and CI validation path.
5. Reconcile post-merge state documentation and update release gate metadata.

No follow-up source implementation was performed on `main`.
