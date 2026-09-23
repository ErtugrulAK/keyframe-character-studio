# KCS Release Candidate Summary

## Release boundary

The release-readiness blocker work is integrated into main. Annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease were created at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. This document does not authorize draft publication or npm publication.

## Accepted milestones

- Public Controls V1 and OGraf Package Export V2.
- Windows path, parent-cycle/broadcast, SourcePath/filesystem, and mask/matte parity hardening.
- Deterministic OGraf fixture/schema validation gate.
- Isolated full OGraf release smoke gate.

## Validation status

The release gate is the method, not a stored count: `npm test`, `npm run build` (`tsc -b` + vite — the type gate CI runs), `npm run lint`, `npm run validate:ograf` and `npm run qa:release`, plus the per-task browser specs. The current numbers and the run ids live in `NEXT_SESSION.md` and in the task reports under `reports/`; they are deliberately not repeated here, because a count copied into a boundary document goes stale faster than it is read.

- `validate:ograf`: PASS — offline and deterministic by default against the vendored closure, every pin verified; `--online` is the refresh path that fetches the pinned bytes.
- `qa:release`: PASS — 2 Chromium tests. `.github/workflows/release-smoke.yml` is the manual gate and requires an explicit candidate SHA.

## Accepted blocker constraints

1. **SourcePath/output TOCTOU:** Existing source and output protections remain. Two residual hostile-concurrency races are explicitly accepted: `lstat → open` on the source pathname and output preflight → pathname write. These are not claimed as complete OS-level no-follow protection. Release materialization requires trusted, dedicated source ownership and output directories; hostile multi-tenant filesystem mutation is outside the supported threat model.
2. **OGraf schema validation:** The complete schema graph is SHA-256 pinned and fails closed on mismatch or unpinned references. The eight pinned documents are vendored under `fixtures/ograf/schema/`, so `npm run validate:ograf` validates offline and deterministically; `--online` re-fetches the pinned bytes and needs network access.
3. **Playwright browser gate:** `.github/workflows/release-smoke.yml` provides a manual, checked-in Ubuntu Chromium gate. It requires a full candidate SHA, verifies the resolved checkout, installs Chromium, and runs `npm run qa:release`.
4. **Release metadata:** `package.json` and `package-lock.json` use private version `1.1.0-rc.1`. `CHANGELOG.md` retains `[Unreleased]` for package metadata; npm publication was not performed.

## Release decision

**READY WITH WARNINGS.** The annotated tag and draft prerelease exist. Publish/finalize the draft only with further explicit user instruction. No npm publication occurred.
