# Releasing KCS

One way to cut a version. The changelog is `CHANGELOG.md`; the version lives in
`package.json` and `package-lock.json`; a release is an annotated Git tag plus a
GitHub release. npm is never published (the package is private).

## Version numbers

[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`, with release
candidates as `-rc.N`.

- **PATCH** (`1.1.1`): fixes only.
- **MINOR** (`1.2.0`): new features, existing projects still open unchanged.
- **MAJOR** (`2.0.0`): a saved project or an export format changes incompatibly.
- **Release candidate** (`1.1.0-rc.3`): a version under manual QA. Candidates of
  one version are numbered on (`rc.1`, `rc.2`, `rc.3` …). The candidate the user
  accepts becomes the final version on the same code (`1.1.0`).

Tags are `v` + the version (`v1.1.0-rc.3`). A tag is never moved or reused; a
fix after a candidate is the next candidate.

## Flow

1. **Work on a branch**, never on `main` (`.agents/BRANCH_STRATEGY.md`).
2. **Prepare the version on the branch**, in one commit
   `chore(release): prepare X.Y.Z[-rc.N]`:
   - set the version in `package.json` and `package-lock.json` (both `version`
     fields at the top of the lockfile);
   - in `CHANGELOG.md`, turn the work into a dated `## [X.Y.Z[-rc.N]] - YYYY-MM-DD`
     section (Added / Changed / Fixed / Removed / Security) under an empty
     `## [Unreleased]`.
3. **Validate**: `npx tsc -b`, `npm run lint`, `npx vitest run`, `npm run build`
   and the full Chromium E2E suite.
4. **Open a pull request into `main`** with the changelog section and the
   validation results.
5. **Merge with "Create a merge commit"** (or "Rebase and merge"). Do not squash:
   the individual commits keep their authors and dates, so the history (and the
   GitHub contribution graph) shows when the work was done.
6. **Smoke-test the merged commit**: run the `Release Smoke Gate` workflow
   (`.github/workflows/release-smoke.yml`) with the merge commit's full SHA.
7. **Tag that exact commit** with an annotated tag:
   `git tag -a vX.Y.Z[-rc.N] <sha> -m "KCS vX.Y.Z[-rc.N]"`, then
   `git push origin vX.Y.Z[-rc.N]`.
8. **Create the GitHub release** from the tag, with the changelog section as its
   notes: a candidate is a **pre-release**; the final version is a normal release.
9. **Manual QA** runs on a fixed build of the tagged commit (`.qa-artifacts`, the
   build id names the commit). The user's acceptance turns the candidate into the
   final version: repeat steps 2–8 with `X.Y.Z` (no code changes, only the version
   and the changelog heading).
10. **Clean up**: delete the merged working branch. Branches that are kept for
    history are tagged `archive/<branch>` before they are deleted.

## History

- `v1.0.0` (2026-08-02).
- `v1.1.0-rc.1` (2026-09-15, draft pre-release) and `v1.1.0-rc.2` (2026-10-08,
  pre-release). Their package metadata kept reading `1.1.0-rc.1`.
- `v1.1.0-rc.3`: prepared on 2026-10-27; from here on the package metadata
  matches the tag.
- `v1.1.0-rc.4`: prepared on 2026-10-30; rc.3 plus the Neutral Pro editor look.
- `v1.1.0-rc.5`: prepared on 2026-10-30; rc.4 plus text matte and exported text
  on the editor's baseline.
- On 2026-10-27 the remote was cleaned: 75 merged, integrated or stale branches
  were deleted; the 18 that were not ancestors of `main` are kept as
  `archive/<branch>` tags (list and SHAs in the local workspace manifest).
