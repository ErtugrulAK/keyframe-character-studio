# KCS Release Candidate Summary

## Release boundary

The release-readiness blocker work is prepared on `fix/release-readiness-blockers` from `main@449ca898a30442e906b802f9824b2ad1dc278e5e`. This document does not authorize tag creation, release publication, or branch deletion.

## Accepted milestones

- Public Controls V1 and OGraf Package Export V2.
- Windows path, parent-cycle/broadcast, SourcePath/filesystem, and mask/matte parity hardening.
- Deterministic OGraf fixture/schema validation gate.
- Isolated full OGraf release smoke gate.

## Validation status

- Full Vitest: pending branch validation.
- TypeScript: pending branch validation.
- Lint: pending branch validation.
- Build: pending branch validation.
- `validate:ograf`: previously PASS for the committed fixture; network-dependent.
- `qa:release`: previously PASS for 2 Chromium tests; manual CI workflow added in this branch.

## Accepted blocker constraints

1. **SourcePath/output TOCTOU:** Existing source-handle and output-ancestor protections remain. The residual pathname-write race under hostile concurrent filesystem mutation is explicitly accepted as an operational constraint, not claimed as complete OS-level no-follow protection. Release materialization must use a trusted, dedicated output directory; hostile multi-tenant filesystem use is outside the supported threat model.
2. **OGraf schema validation:** The complete discovered remote schema graph remains SHA-256 pinned and fails closed on mismatch or unpinned references. Schema bytes are fetched from official URLs at validation time; offline validation is not claimed. Candidate approval requires network availability and a successful `npm run validate:ograf`.
3. **Playwright browser gate:** `.github/workflows/release-smoke.yml` provides a manual, checked-in Ubuntu Chromium gate. It installs the pinned project Playwright browser dependency and runs `npm run qa:release`; dispatching it is an explicit release-approval prerequisite.
4. **Release metadata:** `package.json` and `package-lock.json` use private version `1.1.0-rc.1`. `CHANGELOG.md` retains `[Unreleased]` and records the candidate without implying publication, tag creation, or package release.

## Release decision

Release/tag creation remains **NO**. Final readiness is determined only after branch validation and independent review; separate explicit user approval remains required.
