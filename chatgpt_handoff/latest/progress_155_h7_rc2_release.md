# Progress 155 — H7 GO: v1.1.0-rc.2 release candidate

Date: 2026-10-08. Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.

The approved H7 GO decision was executed: a **new** release candidate, `v1.1.0-rc.2`, was created from the **exact smoke-tested code commit**. `v1.1.0-rc.1` was not moved, rewritten or deleted, and no npm publication occurred.

## Candidate identity

| Field | Value |
|---|---|
| **TESTED CODE SHA (candidate)** | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Annotated tag | `v1.1.0-rc.2` (tag object `3d17e584704fcf534f9e885167ad300e904a332f`) |
| Tag dereferences to | `6c27ef35d48d61a5e1163d2c91734c864fcafa01` — exact match |
| Release Smoke Gate | run `37752015020` — success, `headSha` = the candidate |
| GitHub release | `KCS v1.1.0-rc.2`, id `RE_kwDOTexJrc4YPnCt`, **draft + prerelease** |
| `targetCommitish` | pinned to `6c27ef35d48d61a5e1163d2c91734c864fcafa01` |
| Documentation tip at the time of this record | `c650da18c731dfac85d31ba00d059a8430c40b43` (docs-only, **not** the candidate) |

**Why the draft tip is not the candidate.** The only commit after the tested SHA is `c650da1 docs: record exact-sha release smoke`, whose changed files are documentation only (CHANGELOG, NEXT_SESSION, PROJECT_STATE, the handoff bundle, the report indexes and the progress report). No source, test, workflow, package, lock or asset byte changed, so the exact-SHA smoke result still describes it. The candidate tag therefore points at `6c27ef3`, not at the newer docs tip.

## Package metadata decision — PATH A

`package.json` stays at the private version `1.1.0-rc.1`; no metadata commit was introduced. Chosen because:

- the package is private and never published, so the npm version is inert metadata;
- no repository policy requires the package version to equal the tag name (searched: none found);
- PATH B would require a metadata commit that creates a **new** SHA, plus a fresh exact-SHA smoke run — and the candidate identity rule forbids tagging an untested commit;
- PATH A keeps the candidate equal to the smoke-tested commit.

The release notes and the state documents state the mismatch explicitly, and npm remains unpublished.

## Phase results

| Phase | Result |
|---|---|
| Preflight | clean tree, no in-progress Git operation, `main` == `origin/main`, rc.1 unchanged at `46d2a3e`, no existing rc.2 tag or release, smoke run success |
| Metadata decision | PATH A — package stays private `1.1.0-rc.1` |
| Pre-tag checks | target SHA resolves exactly, no tag collision (local and remote), no release collision, origin reachable |
| Tag | annotated `v1.1.0-rc.2` created; `git rev-list -n 1 v1.1.0-rc.2` == the tested SHA |
| Push | only `refs/tags/v1.1.0-rc.2` pushed; remote dereference == the tested SHA; rc.1 remote unchanged |
| GitHub release | draft prerelease created for `v1.1.0-rc.2`, `targetCommitish` pinned to the tested SHA; rc.1 release untouched |
| Post-release verification | local and remote tags, dereference, release flags, rc.1 unchanged, npm unpublished, tree clean |

## Release notes content

The `v1.1.0-rc.2` notes cover: the 16 post-Astra correctness fixes (text Boolean geometry, bonded layer movement, Motion Curves targeting/mask dispatch/zero-duration guards, Playfair OGraf portability), the authoring and presentation work (layer bonds, Boolean operands, text stroke parity, opacity keyframes, sequence isolation, segment editing, the visual-only editor refresh), the hardening shipped in the same line (Lottie import, OGraf package import, loopback API bind with an exact CORS allowlist, inverted matte, Lottie parent resolution, boundary scene validation), and the toolchain/dependency work (TypeScript 7, Vitest 5, Oxlint 1.85, jsdom 30.1.1, the CI type-check and state-consistency gates, and the audit at 0 vulnerabilities).

The notes state plainly that the smoke gate is not the full suite: the Vitest suite (135 files / 2,055 tests) and the full Chromium suite (268 tests with `--retries=0`) were validated locally on the same code line.

## Release state after this task

| Check | Result |
|---|---|
| `v1.1.0-rc.2` tag (local + remote) | present, dereferences to `6c27ef3…` |
| `v1.1.0-rc.1` | unchanged — `46d2a3e59e065816d972dcd56951803951b577f6`, draft prerelease untouched |
| GitHub release rc.2 | draft, prerelease, `publishedAt: null` |
| `package.json` | `1.1.0-rc.1`, `private: true` |
| npm registry | 404 — not published |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| Working tree | clean; `main` == `origin/main` |

## Notes for the next step

- The rc.2 GitHub release is a **draft** prerelease, matching the `v1.1.0-rc.1` convention. Publishing it turns it into a public prerelease; it does not create a tag (the tag already exists) and does not publish to npm.
- `scripts/check-state-consistency.mjs` still pins `v1.1.0-rc.1` to `46d2a3e` — that assertion remains correct and valuable (that candidate must never move). Adding rc.2 to the checker is a tooling change and needs separate approval.
- Any later commit that touches source, tests, workflows, packages or assets invalidates this exact-SHA smoke result for the new SHA; re-run the gate before making a further release decision.
