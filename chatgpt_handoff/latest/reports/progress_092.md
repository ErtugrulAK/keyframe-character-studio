# Progress 092 — Deterministic OGraf Fixture Validation Patch

## Task

Task 4: OGraf fixture/schema validation and CI gate.

## Baseline and Branch

- Baseline `main`: `6889771`
- Branch: `chore/ograf-fixture-schema-ci-gate`
- Scope: committed valid/invalid fixtures, deterministic default validation target, complete remote schema hash pinning, and CI wiring.

## Implemented

- Added `fixtures/ograf/minimal.ograf.json` as the committed valid minimal OGraf v1 manifest.
- Added `fixtures/ograf/invalid.ograf.json` for the failure path.
- `npm run validate:ograf` now validates the committed valid fixture when no path is supplied.
- The official OGraf root schema and every discovered transitive remote `$ref` are pinned by SHA-256.
- Validation rejects any unpinned remote schema reference and any hash mismatch.
- `.github/workflows/ci.yml` runs `npm run validate:ograf` immediately after dependency installation.

## Validation

- `npm run validate:ograf`: passed; valid fixture accepted.
- `npm run validate:ograf -- fixtures/ograf/invalid.ograf.json`: correctly failed with `/supportsRealTime must be boolean`.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.

## Independent Review

**READY WITH WARNINGS** after the full schema graph hash closure was added.

Warning: schema bytes are still fetched from the official network URLs at validation time. The bytes are integrity-pinned, but offline execution remains unsupported and network availability remains a CI prerequisite. No schema was vendored because redistribution/licensing was not established.

## Files Changed

- `.github/workflows/ci.yml`
- `scripts/validate-ograf-manifest.mjs`
- `fixtures/ograf/minimal.ograf.json`
- `fixtures/ograf/invalid.ograf.json`

## Contracts and Safety

- OGraf package export V2 and public controls remain unchanged.
- Browser ZIP behavior and runtime rendering remain unchanged.
- No release or tag operation performed.
