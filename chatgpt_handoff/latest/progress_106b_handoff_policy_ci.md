# Progress 106B — Handoff Policy Correction, Desktop KCS Cleanup, and GitHub CI Failure Investigation

## 1. Scope

Documentation, handoff, and staging-folder work only. No source, test, package, or workflow change.

1. Investigate the GitHub CI failure that appeared after the last push, using `gh`, without guessing.
2. Correct the ChatGPT handoff policy so `chatgpt_handoff/latest/` is a minimal, task-specific upload bundle instead of a broad context dump.
3. Remove the accidental handoff dump from `C:\Users\ertugrul.ak\Desktop\KCS` by moving those files into an archive, while preserving the user's project and asset folders untouched.

## 2. CI failure investigation

| Field | Value |
|---|---|
| Failed run | `35095655446` |
| URL | https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/35095655446 |
| Workflow | `CI Pipeline` — job `Build, Lint & Test Verification`, step `Run Unit & Integration Tests (Vitest)` |
| Head SHA | `a32df841f93e3b234e2d0c62dc6f4de05077c02c` (`docs: reconcile task 105 handoff cleanup`) |
| Head SHA equals current main | YES |
| Also failing | run `35094144225` at `9f7114877e111527e8757668237e41fde8388a99` |
| Last successful run | `35094044341` at `9fdbf0fe59c28d3d6f07c8ee37081fc93f2ff6db` |

Failing step summary from `gh run view 35095655446 --log-failed`:

```
FAIL chatgpt_handoff/latest/src__tests__ografBrowserZip.test.tsx
FAIL chatgpt_handoff/latest/src__tests__ografDiagnostics.test.ts
FAIL chatgpt_handoff/latest/src__tests__ografExport.test.ts
FAIL chatgpt_handoff/latest/src__tests__ografPackage.test.ts
FAIL chatgpt_handoff/latest/src__tests__ografSvg.test.ts
FAIL chatgpt_handoff/latest/src__tests__toastPortal.test.tsx
FAIL chatgpt_handoff/latest/src__tests__useToast.test.ts
 Test Files  7 failed | 103 passed (110)
Error: Failed to resolve import "../ograf/diagnostics" from "chatgpt_handoff/latest/src__tests__ografDiagnostics.test.ts". Does the file exist?
```

### Root cause classification: C — checked-in handoff files included in the test run

- The repository handoff folder contained flattened *copies* of Task 105 source and test files, named with a `src__` prefix.
- Seven of those copies end in `.test.ts` / `.test.tsx`, so Vitest's default include glob (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) discovered them.
- Those copies live in `chatgpt_handoff/latest/`, not in `src/tests/`, so their relative imports (`../ograf/diagnostics`, `../components/...`, `../types/...`) cannot resolve. Vitest therefore failed to load the files, and the job exited non-zero.
- `vitest.config.ts` excludes only `node_modules`, `dist`, and `e2e/**`, so `chatgpt_handoff/**` is scanned.
- The regression was introduced by commit `9f71148`, the first commit that added the flattened source/test copies to the repository handoff folder. The push immediately before it (`9fdbf0f`) passed, and the failing runs line up exactly with the two commits that carried those copies.

No source, test, package, or workflow defect is involved: the real suite (103 files / 1,557 tests) is green both in CI logs and locally.

### Local validation to reproduce

| Check | Command | Before cleanup | After cleanup |
|---|---|---|---|
| Full Vitest | `npm test` | FAIL — 7 failed / 103 passed files, 1,557 tests passed | PASS — 103 files / 1,557 tests |
| Lint | `npm run lint` | — | PASS — existing Fast Refresh warning only |
| TypeScript | `npx tsc --noEmit` | — | PASS |
| OGraf fixture | `npm run validate:ograf` | — | PASS |
| Build | `npm run build` | — | PASS — existing Vite chunk-size warning only |
| Whitespace | `git diff --check` | — | PASS |

The CI failure was reproduced locally by the same seven `chatgpt_handoff/latest/src__tests__*` files before cleanup, and disappeared once the bundle contained no test-matching files.

### Fix needed

The fix is the corrected handoff policy itself: the minimal bundle no longer contains flattened source or test copies, so no test-matching file exists under `chatgpt_handoff/`. No source, test, package, or workflow edit was needed, and none was made.

## 3. Corrected handoff policy

- `chatgpt_handoff/latest/` is a per-response upload bundle: clean the folder first, then place only the files this specific ChatGPT conversation needs.
- Flattened source or test copies are never placed there. They duplicate files that already exist in the repository, and the ones whose names end in `.test.*` are executed by Vitest, which breaks CI.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination; bundles are not copied there unless the user explicitly asks.
- Omitted files are not deleted from the repository; they are simply not part of the bundle.
- The policy is recorded in `NEXT_SESSION.md` and `PROJECT_STATE.md` so the next session follows it without re-deriving it.

## 4. Repository `chatgpt_handoff/latest` minimal refresh result

- Path verified inside the repository root and ending with `chatgpt_handoff/latest`; all previous children were deleted and the folder itself was kept.
- The folder went from 35 files (15 documents + 19 flattened source/test copies + instructions/manifest) to 6 files:
  - `README.md` — bundle instructions
  - `manifest.txt` — inventory, purpose, omitted categories, CI status, SHA map
  - `progress_106b_handoff_policy_ci.md` — this report
  - `progress_106_handoff_cleanup.md` — the Task 106 cleanup context this task corrects
  - `NEXT_SESSION.md`, `PROJECT_STATE.md` — current next action and state
- Removed from the bundle: all 19 flattened Task 105 source/test copies, `progress_104.md`, `progress_105.md`, `KCS_POST_RC_ROADMAP.md`, `KCS_CURRENT_STATE.md`, `KCS_RELEASE_CANDIDATE_SUMMARY.md`, `KCS_CI_STATUS.md`, `CHANGELOG.md`, `package.json`, `ci.yml`, `release-smoke.yml`, and `PROJECT_README.md`. None of those files were deleted from the repository.
- No test-matching file remains anywhere under `chatgpt_handoff/`, which is what restores CI.

## 5. Desktop KCS cleanup result

Folder: `C:\Users\ertugrul.ak\Desktop\KCS`.

Archived — the 35 ChatGPT handoff files accidentally copied there by Task 106:

- `README.md`, `manifest.txt`, `PROJECT_README.md`, `progress_104.md`, `progress_105.md`, `progress_106_handoff_cleanup.md`
- `KCS_POST_RC_ROADMAP.md`, `NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_CURRENT_STATE.md`, `KCS_RELEASE_CANDIDATE_SUMMARY.md`, `KCS_CI_STATUS.md`
- `CHANGELOG.md`, `package.json`, `ci.yml`, `release-smoke.yml`
- the 19 flattened `src__*.ts` / `src__*.tsx` copies

Archive path: `C:\Users\ertugrul.ak\Desktop\KCS\_archive_chatgpt_handoff_dump_20260916-123414` (moved, never deleted; 35 files).

Preserved untouched:

- `KCS ASSET/` (including `assets/images/logo.png` and `assets/images/logo_alt.svg`)
- `KCS BASIC/`
- `KCS COMPOSITING/`
- `kcs-safe-backups/`
- `_archive_before_upload_cleanup_20260916-122257/` (the earlier Task 106 archive of stale QA folders)

Nothing was copied back into Desktop KCS. The folder now holds the user's project/asset folders plus the two archives, and no handoff files at its root.

No separate desktop upload folder was created; the repository bundle at `chatgpt_handoff/latest/` is the upload source.

## 6. Release safety

- `v1.1.0-rc.1` tag was not moved, recreated, or deleted; target remains `46d2a3e59e065816d972dcd56951803951b577f6`.
- The GitHub release remains an unpublished draft prerelease; no publish, finalize, or edit occurred.
- npm publish was not performed; the package remains private at `1.1.0-rc.1`.
- `without-mask` was not touched; global OMP configuration, model roles, provider mappings, `memory.backend: mnemopi`, and `task.maxConcurrency: 8` were unchanged.
- No source, test, package, lockfile, or workflow file was modified.
- No user asset, image, or SVG file was deleted; desktop files were moved into archives.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` was not modified.
- No secrets, tokens, or API keys were printed or copied.

## 7. Validation

- `npm test`: PASS — 103 files / 1,557 tests (before the cleanup it failed with the same 7 handoff copies CI reported).
- `npm run lint`: PASS — existing `AnimatorContext` Fast Refresh warning only.
- `npx tsc --noEmit`: PASS.
- `npm run validate:ograf`: PASS.
- `npm run build`: PASS — existing Vite chunk-size warning only.
- `git diff --check`: PASS.
- Allowed-change check: only `reports/progress_106b_handoff_policy_ci.md`, `NEXT_SESSION.md`, `PROJECT_STATE.md`, and `chatgpt_handoff/latest/**` changed.

## 8. Next action

- Upload only `chatgpt_handoff/latest/` when ChatGPT needs this cleanup and CI context.
- Next roadmap task remains `feat/track-matte-source-picker` (roadmap item 2); this investigation found no blocker for it.
