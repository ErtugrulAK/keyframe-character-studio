# Progress 101 — Release Readiness Blockers Resolution

## Scope

Resolve or explicitly accept the four release-readiness blockers. No production release or tag was created.

## Baseline and branch

- Baseline main/origin-main: `449ca898a30442e906b802f9824b2ad1dc278e5e`
- Branch: `fix/release-readiness-blockers`
- Candidate package version: `1.1.0-rc.1`
- Package remains private.

## Blocker outcomes

1. **SourcePath/output TOCTOU — accepted operational constraint.** Existing source file-handle validation and output ancestor/target checks remain. The residual pathname-write race under hostile concurrent filesystem mutation is not claimed to be eliminated. Release materialization requires a trusted, dedicated output directory; hostile multi-tenant filesystem mutation is outside the supported threat model.
2. **OGraf schema validation — accepted network constraint.** The complete discovered remote schema graph remains SHA-256 pinned and fails closed on unknown or mismatched bytes. Validation is not offline-capable because schema bytes are fetched from official URLs. Candidate approval requires network availability and a passing `npm run validate:ograf`.
3. **Playwright CI browser gate — established as manual workflow.** `.github/workflows/release-smoke.yml` is checked in with `workflow_dispatch`, optional candidate SHA selection, Node 22 setup, dependency installation, Chromium installation, and `npm run qa:release`. It is an explicit release-approval gate rather than an automatic push/PR gate.
4. **Release metadata — prepared without release.** `package.json` and `package-lock.json` now use private version `1.1.0-rc.1`. `CHANGELOG.md` retains `[Unreleased]` and records the candidate as unreleased. No package was published.

## Validation matrix

- `npm ci`: PASS; existing blocked `sqlite3@6.0.1` install-script warning remains.
- Focused package/filesystem tests: not rerun; existing merged evidence remains documented in Progress 089.
- `npm run validate:ograf`: PASS; committed minimal fixture accepted.
- `npm run qa:release`: PASS; candidate baseline SHA `449ca898a30442e906b802f9824b2ad1dc278e5e`, 2 Chromium tests passed.
- `npm test -- --run`: PASS; 101 files / 1,495 tests.
- `npm run build`: PASS; existing Vite chunk-size warning remains.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with existing Fast Refresh warning at `src/context/AnimatorContext.tsx:655`.
- `git diff --check`: PASS.
- Workflow safety sanity: PASS; no secrets or protected global configuration referenced.

## Changed files

- `.github/workflows/release-smoke.yml`
- `CHANGELOG.md`
- `NEXT_SESSION.md`
- `PROJECT_STATE.md`
- `docs/KCS_CURRENT_STATE.md`
- `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`
- `package.json`
- `package-lock.json`
- `reports/progress_101.md`

## Release decision

**READY WITH WARNINGS FOR INDEPENDENT REVIEW.** The accepted constraints remain material warnings: hostile-concurrency filesystem mutation is unsupported, schema validation requires network access, and the browser gate requires an explicitly dispatched workflow with browser installation. No tag or release was created.

## Protected invariants

- `v1.1.0-public-controls` unchanged.
- `without-mask` untouched.
- No force push, reset, rebase, or normal merge.
- Global OMP configuration, model roles, `memory.backend: mnemopi`, task concurrency, hooks, routing, and secrets unchanged.
