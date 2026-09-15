# KCS Release Candidate Summary

## Release boundary

The release-readiness blocker work is integrated into main. Annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease were created at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. This document does not authorize draft publication or npm publication.

## Accepted milestones

- Public Controls V1 and OGraf Package Export V2.
- Windows path, parent-cycle/broadcast, SourcePath/filesystem, and mask/matte parity hardening.
- Deterministic OGraf fixture/schema validation gate.
- Isolated full OGraf release smoke gate.

## Validation status

- Full Vitest: PASS — 101 files / 1,495 tests.
- TypeScript: PASS.
- Lint: PASS with existing Fast Refresh warning.
- Build: PASS with existing chunk-size warning.
- `validate:ograf`: PASS for the committed fixture; network-dependent.
- `qa:release`: PASS for 2 Chromium tests; manual CI workflow is checked in and requires an explicit candidate SHA.
- Remote manual `release-smoke.yml`: PASS — run `34983770238` for code candidate `46d2a3e59e065816d972dcd56951803951b577f6`.

## Accepted blocker constraints

1. **SourcePath/output TOCTOU:** Existing source and output protections remain. Two residual hostile-concurrency races are explicitly accepted: `lstat → open` on the source pathname and output preflight → pathname write. These are not claimed as complete OS-level no-follow protection. Release materialization requires trusted, dedicated source ownership and output directories; hostile multi-tenant filesystem mutation is outside the supported threat model.
2. **OGraf schema validation:** The complete discovered remote schema graph remains SHA-256 pinned and fails closed on mismatch or unpinned references. Schema bytes are fetched from official URLs at validation time; offline validation is not claimed. Candidate approval requires network availability and a successful `npm run validate:ograf`.
3. **Playwright browser gate:** `.github/workflows/release-smoke.yml` provides a manual, checked-in Ubuntu Chromium gate. It requires a full candidate SHA, verifies the resolved checkout, installs Chromium, and runs `npm run qa:release`.
4. **Release metadata:** `package.json` and `package-lock.json` use private version `1.1.0-rc.1`. `CHANGELOG.md` retains `[Unreleased]` for package metadata; npm publication was not performed.

## Release decision

**READY WITH WARNINGS.** The annotated tag and draft prerelease exist. Publish/finalize the draft only with further explicit user instruction. No npm publication occurred.
