# KCS Windows Path Hardening V1

## Scope

Windows-safe filename and package-relative path handling for KCS exports, OGraf package generation, browser ZIP creation, and filesystem materialization.

## Policy

- Filename components reject Windows-invalid characters and ASCII control characters.
- Trailing dots and spaces are removed from generated filename components.
- Reserved device names are rejected case-insensitively, including extensions: `CON`, `PRN`, `AUX`, `NUL`, `CLOCK$`, `COM0`-`COM9`, and `LPT0`-`LPT9`.
- Empty, whitespace-only, dot-only, and reserved generated names use deterministic safe fallbacks.
- Unicode filename content is preserved by the filename sanitizer where it is otherwise safe.
- Package-internal paths normalize `\\` to `/`.
- Package paths reject absolute paths, drive-letter paths, UNC paths, traversal segments, empty/dot segments, encoded-percent traversal markers, invalid characters, non-ASCII package entry characters, trailing dots/spaces, reserved device-name segments, and directory entries.
- Package asset collisions are compared case-insensitively and receive deterministic suffixes where the existing collision policy permits recovery.
- Browser ZIP creation and filesystem materialization revalidate normalized paths and reject case-insensitive duplicate entries.
- Standard KCS download filenames now use the same filename-component sanitizer.

## Implementation

- `src/utils/pathSafety.ts` centralizes filename sanitization, package-path normalization, Windows device-name checks, package-relative validation, and case-insensitive collision detection.
- `src/ograf/compiler.ts` uses the central package-path policy and hardens generated OGraf IDs.
- `src/ograf/validation.ts` normalizes configured packaged paths before they reach package compilation.
- `src/ograf/packageCompiler.ts` normalizes asset paths and resolves collisions case-insensitively.
- `src/ograf/browserZip.ts` validates normalized ZIP paths and rejects case-insensitive duplicates.
- `src/ograf/packageWriter.ts` validates normalized filesystem paths and materialized asset records.
- `src/components/Header/HeaderBar.tsx` sanitizes standard KCS export filenames.

## Contract preservation

The OGraf package structure remains:

```text
<sanitized-graphic-name>-ograf.zip
├── <sanitized-graphic-name>.ograf.json
├── graphic.mjs
├── scene.kcs
└── assets/{images,fonts only when present}
```

Public Controls V1 image values remain package-relative and are still restricted to generated packaged asset values. Existing KCS import classification, legacy OGraf single-file export, runtime generation, animation, masks, track mattes, serialization, history, clipboard, and playback authorities were not redesigned.

## Tests

- `src/tests/pathSafety.test.ts` covers invalid characters, reserved names, trailing separators, Unicode preservation, slash normalization, traversal, absolute/UNC paths, allowed asset prefixes, and case-insensitive collisions.
- `src/tests/ografPackage.test.ts` covers reserved graphic fallback, reserved asset rejection, and case-insensitive asset collision handling.
- Existing OGraf browser ZIP and package tests remain passing.

## Known limitations

- This V1 policy validates generated/package paths; it does not add a new OGraf ZIP import implementation because KCS currently classifies OGraf ZIP/manifest files rather than importing them.
- Long-path filesystem behavior is delegated to Windows and Node filesystem limits; no arbitrary truncation was introduced because truncation could create silent collisions.
- The package path validator retains its existing printable-ASCII package-entry policy; Unicode preservation applies to safe filename components, not arbitrary package entry names.

## Validation record

- Base `main`: `b34879a`, clean and synchronized with `origin/main`.
- Release tag observed: `v1.1.0-public-controls` at `0a71bd8`.
- Feature branch: `feat/windows-path-hardening-v1`.
- No global OMP configuration changed.
- No `without-mask` branch/tag/report was modified.
