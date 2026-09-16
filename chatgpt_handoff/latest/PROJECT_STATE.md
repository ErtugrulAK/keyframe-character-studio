# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into main. Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

Task 105 (export diagnostics remediation UX) was integrated into main by fast-forward at `9fdbf0fe59c28d3d6f07c8ee37081fc93f2ff6db`. Current `main`/`origin/main` HEAD is `9f7114877e111527e8757668237e41fde8388a99`, which adds docs and handoff commits only and is therefore newer than the integration commit. Blocking OGraf export diagnostics now carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; and user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, and the export diagnostics remediation UX are present in the accepted main line. OMP tooling remains separate.

## Validation status

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 103 files / 1,557 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf`; committed minimal fixture |
| OGraf release smoke | PASS | `npm run qa:release`; run against Task 105 integration commit `9fdbf0f`; 2 Playwright tests |
| TypeScript | PASS | `npx tsc --noEmit` and build typecheck |
| Lint | PASS | Existing Fast Refresh warning only |
| Production build | PASS | Existing Vite chunk-size warning only |
| Independent review | PASS | `READY` at the Task 105 merge gate |

## Remaining work

- Post-RC roadmap: `docs/KCS_POST_RC_ROADMAP.md`; task 1 is completed, task 2 is the next candidate.
- Next coding task: track-matte source selection affordance (`feat/track-matte-source-picker`).
- Publish/finalize the GitHub draft only with further explicit user instruction.
- No npm publication occurred; package remains private at `1.1.0-rc.1`.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` holds a minimal, task-specific upload bundle, refreshed for each ChatGPT response instead of accumulating context files.
- Flattened source and test copies must not live there: the Vitest default include glob picks up files named `src__*test*`, which failed CI runs `35094144225` and `35095655446`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.

## Protected state

- The current main documentation commits are intentionally newer than the tag target; the tag remains on the workflow-tested code candidate.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- Candidate package version is `1.1.0-rc.1`; package remains private and unreleased.
