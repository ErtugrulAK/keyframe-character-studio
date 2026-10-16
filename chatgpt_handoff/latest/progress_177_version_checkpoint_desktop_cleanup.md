# Progress 177 — Version Checkpoint Audit + Safe Desktop Cleanup — 2026-10-16

Sequential task on the integrated `main`: verify the post-integration state, audit the version history, decide the next release candidate (report only), clean the retired desktop worktrees, establish the workspace folder standard, re-gate, and refresh the handoff. **No tag, no GitHub release change, no npm publication, no deployment** in this round.

## Starting state (verified)

- `main` == `origin/main` == `30cea0f` (docs head) over the fully tested code head `73fc000`; tracked tree clean; the user's untracked `EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md` and the research model's processes/files were never touched.
- Live surfaces intact throughout: 5173 serves the canonical `main` checkout (this session's service), API 5000 (listener 2308) never restarted.

## Version history inventory (read-only audit)

- Tags on `origin`: `v1.1.0-rc.1` → `46d2a3e…` (GitHub draft prerelease), `v1.1.0-rc.2` → `6c27ef3…` (public prerelease, run 37752015020), `v1.1.0-public-controls` → `6351d1a…`. All left exactly as found.
- `package.json` / `package-lock.json`: `1.1.0-rc.1`, `private: true`; npm was never published. The rc.2 cut deliberately introduced no metadata commit (PATH A precedent).
- Schema/format state: OGraf export targets the EBU OGraf v1 graphics schema (unchanged); project documents stay `version: 1` with the `project-unit-center-v1` coordinate contract and keep accepting legacy inputs. No in-app version string exists.
- Release procedure: `.github/workflows/ci.yml` + `release-smoke.yml` + `scripts/run-release-gate.mjs` — candidates are tagged at the exact workflow/smoke-tested SHA.

## Recommendation (awaiting user approval — nothing was bumped or tagged)

- **`v1.2.0-rc.1`** (minor). Since `6c27ef3`, `main` gained backward-compatible capability (V3.4–V3.7 authoring rounds: opacity-channel keyframing, text stroke, bonds, Boolean freeform/text operands, OGraf package import, unified import dispatch, Lottie import with report, affine group resize, timeline marquee/grouping gestures, ungroup bake, timebase contract, GIF sampling contract) plus defect fixes; no REST API, OGraf schema, or project-format break. The approved removals of the legacy single-file `.mjs` OGraf export entry, the header `?` help button, and the duplicate Inspector keyframe controls are surface removals to be disclosed in the changelog's Removed section, not format breaks.
- Files to change when (and only when) the user approves: `package.json` + `package-lock.json` version fields, `CHANGELOG.md` (`[Unreleased]` cut), `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md` candidate section, the live-document tag claims (PROJECT_STATE/NEXT_SESSION + handoff mirrors/one-file); then the tag + smoke run follow the rc.1/rc.2 procedure at the exact tested SHA.

## Desktop worktree audit and cleanup

Audited with `git worktree list --porcelain`, per-folder status/untracked/ignored sweeps, `merge-base --is-ancestor` proofs, `ls-remote` ref preservation, and a live-process/port scan (no process referenced any worktree path; 5173/5000 owners confirmed elsewhere).

Removed via `git worktree remove` (no force):

| Folder | Branch @ SHA | Why safe |
|---|---|---|
| `keyframe-character-studio-omp-combined-qa` | `qa/pr9-pr10-combined` @ `2b14fa5` | ancestor of `main`; clean; ignored files only (dist/node_modules/reports/runtime DB — regenerable QA artifacts) |
| `keyframe-character-studio-omp-manual-qa-r1` | `fix/manual-qa-round1-remediation` @ `fac2bc1` | ancestor of `main`; clean; ignored artifacts only |
| `keyframe-character-studio-omp-ae-layout` | `feat/ae-layout-crop-snapping` @ `74603de` | NOT an ancestor of `main`, but the exact SHA is preserved on `origin/feat/ae-layout-crop-snapping` (verified byte-equal); clean; ignored artifacts only |

Kept untouched (not KCS linked worktrees, or user data): `Desktop\KCS\` (host QA folders, `kcs-safe-backups`, archives), `Desktop\ograf-studio-stable\`, `Desktop\effectcraft-reference-20261015\` (active research), and all unrelated desktop folders. No `git clean`, no `git reset --hard`, no force removal, no branch deletion, no file moves.

## Workspace folder standard

- Temporary worktrees now live under `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.worktrees\`; external research clones under `…\.research\`. Both covered by **repo-local** `.git/info/exclude` only — no global Git/OMP/OpenCode configuration was changed. Nothing already in use was moved.
- Consequence found and fixed: the research model's reference clones under `.research/reference-repos/` made a bare `npm run test` on the canonical tree collect 152 external test files (88 failing — they are not KCS tests and never were). `vitest.config.ts` now excludes `.worktrees/**` and `.research/**` (collector hardening only; no KCS test, assertion or threshold was touched) — tooling commit `ef1d43e`.

## Re-validation on the delivered head

- Gates ran in the isolated standard location `.worktrees/qc-checkpoint` (detached at the gated SHA `ef1d43eab73ff101b4c9cf0fdb0215a3b33d2f41`, own `npm ci`): `npm run qa:release` — **Release gate passed for candidate SHA `ef1d43e…`** (2/2); FULL Chromium **436 passed / 0 failed / 0 flaky** (workers 8, retries 0, 3.3 m); `timeline-marquee` **6/6** (workers 1, retries 0). Canonical re-ran unit with the hardened collector: 173 files / **2602 tests** passed.
- Canonical statics on the delivered head: tsc `-b --pretty false`, oxlint, production build, `validate:ograf`, `npm audit --audit-level=low` (0) — all clean; state consistency PASS (57 checks); live API 5000 (200) and canonical-served 5173 (200) were never restarted.
- Behaviour spot-check on the live canonical 5173 surface: first-paint chrome static (`animationName: none`), the Edit ↔ Broadcast swap animates through `kcs-mode-enter` under `kcs-mode-swap` and the flag lowers on the animation's own end event. The marquee, camera, toolbar, GIF and OGraf contracts are carried by their permanent specs inside the green 436-test run — no spec was relaxed, skipped or slept on.

## Open items for the user

1. Approve (or amend) the `v1.2.0-rc.1` recommendation; only then do the metadata bump, candidate cut, smoke run and tag.
2. The three retired QA branches on `origin` (`qa/pr9-pr10-combined`, `fix/manual-qa-round1-remediation`, `feat/ae-layout-crop-snapping`) are now only remote refs; deleting them needs a separate explicit approval.
3. Observation (not caused by this session): the earlier audit's `Desktop\kcs-ograf-*-qa` folders are no longer on this PC's Desktop (`KCS\` carries archives; `ograf-graphics` was already absent at that audit).
