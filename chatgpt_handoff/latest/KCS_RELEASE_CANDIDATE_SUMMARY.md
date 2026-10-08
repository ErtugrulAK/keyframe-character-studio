# KCS Release Candidate Summary

## Release boundary

The release-readiness blocker work is integrated into `main`. Annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease remain at workflow-tested candidate `46d2a3e59e065816d972dcd56951803951b577f6`; that candidate is historical and must not move.
The H7 GO decision then cut a NEW release candidate on 2026-10-08: the annotated `v1.1.0-rc.2` release candidate dereferences to the exact smoke-tested commit `6c27ef35d48d61a5e1163d2c91734c864fcafa01`, verified by Release Smoke Gate run `37752015020`. Its GitHub release entry is a draft prerelease whose `targetCommitish` is pinned to the same commit. `reports/progress_155_h7_rc2_release.md` records the run.
The later maintenance line through `37904fb` closed dialog focus restoration, runtime SQLite repository hygiene, the API CORS allowlist, Oxlint 1.85, and TypeScript 7 / Vitest 5 without moving the tag, publishing the draft, or publishing npm.
The post-hold Astra remediation then closed the correctness/security findings F-01…F-10 through `8a4ca22` (`reports/progress_151_astra_remediation.md`): mixed legacy/channel round trips, legacy import validation, Lottie numeric property forms, the OGraf procedural-animation mismatch, archive size accounting, dropped-media persistence, preset storage boundaries, the naming dialog's focus lifecycle, the suite's React `act` warnings, and the stale live-document claims. It added no dependency, workflow or package change. The post-compaction Astra review of the uncommitted authoring work then closed all 16 of its findings in six commits on `main` on 2026-10-07 (`reports/progress_152_post_astra_focused_remediation.md`), again with no dependency, workflow, package, tag, release or npm change; the release decision remains HOLD.

## Accepted milestones

- Public Controls V1 and OGraf Package Export V2.
- Windows path, parent-cycle/broadcast, SourcePath/filesystem, and mask/matte parity hardening.
- Deterministic OGraf fixture/schema validation gate.
- Isolated full OGraf release smoke gate.

## Validation status

The release gate is the method, not a stored count: type check, full Vitest, lint, production build, OGraf validation, release QA, focused browser specs, V6 QA, the combined check, state consistency, dependency audit, and diff hygiene. The latest maintenance baseline and command evidence are recorded in `NEXT_SESSION.md` and `reports/progress_150_final_maintenance_reconciliation.md`.

- `validate:ograf`: PASS — offline and deterministic by default against the vendored closure, every pin verified; `--online` is the refresh path that fetches the pinned bytes.
- `qa:release`: PASS — 2 Chromium tests. `.github/workflows/release-smoke.yml` is the manual gate and requires an explicit candidate SHA.
- **Exact-SHA release smoke: PASSED on 2026-10-08** — run `37752015020` against **TESTED CODE SHA `6c27ef35d48d61a5e1163d2c91734c864fcafa01`** (`reports/progress_154_exact_sha_release_smoke.md`). The workflow is verification-only (`contents: read`), pins the `candidate_sha` input, verifies `git rev-parse HEAD`, and runs `npm ci` + Chromium + `npm run qa:release`. It proves the candidate installs from its own lockfile, the OGraf fixture validates offline, a materialized package interoperates with Chromium, and the editor exports an OGraf ZIP; it is not the full Vitest or Chromium suite. The documentation commit that records this run is not itself smoke-tested — re-run the gate on any later code SHA.

## Accepted blocker constraints

1. **SourcePath/output TOCTOU:** Existing source and output protections remain. Two residual hostile-concurrency races are explicitly accepted: `lstat → open` on the source pathname and output preflight → pathname write. These are not claimed as complete OS-level no-follow protection. Release materialization requires trusted, dedicated source ownership and output directories; hostile multi-tenant filesystem mutation is outside the supported threat model.
2. **OGraf schema validation:** The complete schema graph is SHA-256 pinned and fails closed on mismatch or unpinned references. The eight pinned documents are vendored under `fixtures/ograf/schema/`, so `npm run validate:ograf` validates offline and deterministically; `--online` re-fetches the pinned bytes and needs network access.
3. **Playwright browser gate:** `.github/workflows/release-smoke.yml` provides a manual, checked-in Ubuntu Chromium gate. It requires a full candidate SHA, verifies the resolved checkout, installs Chromium, and runs `npm run qa:release`.
4. **Release metadata:** `package.json` and `package-lock.json` use private version `1.1.0-rc.1`, and the rc.2 candidate deliberately keeps that state (PATH A): the candidate is the exact smoke-tested commit, so no metadata commit was introduced. `CHANGELOG.md` retains `[Unreleased]` for package metadata; npm publication was not performed.

## Release decision

**READY WITH WARNINGS** remains the technical release stance. The original final gate at `c1431db` reported **RELEASE READY WITH DOCUMENTED DEFERRALS**; the maintenance run subsequently closed every deferral and follow-up named there, and the exact-SHA Release Smoke Gate then passed on the new candidate.

The H7 GO decision has been executed: the `v1.1.0-rc.2` candidate exists as an annotated release and a draft prerelease, and the earlier rc.1 candidate remains historical and unchanged. The package remains private at metadata version `1.1.0-rc.1` and no npm publication occurred.

Publishing the rc.2 draft prerelease, running the user QA pass, publishing to npm, or cutting a stable release each require a new explicit user instruction. Publishing the draft does not create a tag (it already exists) and does not publish to npm.

The prior maintenance deferrals are closed: Oxlint 1.85 at `feca773`, TypeScript 7 / Vitest 5 at `37904fb`, runtime SQLite repository hygiene at `b3f3c6c`, the API CORS allowlist at `2a313d7`, and dialog focus restoration at `5cb8a45`. GitHub Actions currently emits non-blocking annotations for Node 20-based action runtimes being forced onto Node 24 and for the announced `ubuntu-latest` migration to Ubuntu 26.
