# KCS Release Candidate Summary

## Release boundary

The release-readiness blocker work is prepared on `fix/release-readiness-blockers` from `main@449ca898a30442e906b802f9824b2ad1dc278e5e`. This document does not authorize tag creation, release publication, or branch deletion.

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
- `validate:ograf`: previously PASS for the committed fixture; network-dependent.
- `qa:release`: previously PASS for 2 Chromium tests; manual CI workflow added in this branch.

## Accepted blocker constraints

1. **SourcePath/output TOCTOU:** Existing source and output protections remain. Two residual hostile-concurrency races are explicitly accepted: `lstat → open` on the source pathname and output preflight → pathname write. These are not claimed as complete OS-level no-follow protection. Release materialization requires trusted, dedicated source ownership and output directories; hostile multi-tenant filesystem mutation is outside the supported threat model.

## Release decision

Release/tag creation remains **NO**. Final readiness is determined only after branch validation and independent review; separate explicit user approval remains required.
