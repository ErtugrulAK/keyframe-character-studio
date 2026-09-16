# KCS Task 105 Handoff (clean-refreshed) — Export Diagnostics Remediation UX

This handoff was clean-refreshed after Task 105 was integrated into `main` and after the Task 106 handoff/staging reconciliation.

## Scope

- Task 105 delivers user-actionable OGraf export diagnostics: a stable title, the failing layer or feature, and a concrete next step for every blocking diagnostic, plus grouped non-blocking warnings.
- User-authored values are formatted at every construction site, so machine paths, URL credentials and query secrets, embedded data payloads, and raw OS error text no longer reach a diagnostic, a thrown error, or a toast.
- Task 106 reconciled documentation and the staging folder only; it changed no product code.
- `v1.1.0-rc.1` tag and GitHub draft prerelease were not changed; npm publish was not performed.

## Commit and tag map

| Meaning | SHA |
|---|---|
| Current `main` = `origin/main` HEAD (docs/handoff commits) | `9f7114877e111527e8757668237e41fde8388a99` |
| Task 105 implementation/integration commit (fast-forward) | `9fdbf0fe59c28d3d6f07c8ee37081fc93f2ff6db` |
| Task 105 feature commit | `828f3fb` (`feat: improve export diagnostics remediation UX`) |
| `v1.1.0-rc.1` tag target (workflow-tested release code candidate) | `46d2a3e59e065816d972dcd56951803951b577f6` |

The tag intentionally stays on the workflow-tested code candidate; later documentation and handoff commits are newer than both the tag target and the implementation commit and must not move it.

## Included review files

This bundle contains the Task 106 cleanup report, the Task 105 report, the post-RC roadmap, current project/release documents, package metadata, CI and release workflows, README, and every source and test file changed by Task 105 (flattened with `src__` path prefixes).

Original file timestamps are preserved by the copy, so some files may look older than this refresh; timestamps alone do not indicate staleness. The authoritative inventory is `manifest.txt`.

Omitted files were not deleted from the repository. Not copied: `.git`, `node_modules`, `.omp`, backups, secrets and environment files, binary caches, and unchanged files.

## Validation

- Full Vitest: PASS (103 files / 1,557 tests) at the Task 105 integration commit.
- `npm run validate:ograf`: PASS.
- `npm run qa:release`: PASS (2 Chromium tests).
- `npm run build`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`: PASS with the pre-existing Fast Refresh, Vite chunk-size, and npm install-script warnings only.
- Independent review at the Task 105 merge gate: `READY`.
- UI verification: the blocking export card renders title, explanation, and next step, and no download occurs on a blocked export.
- `docs/KCS_CI_STATUS.md` documents the tag-time release-candidate CI snapshot (101 files / 1,495 tests) and is included as historical context; the current numbers are the ones above.

## Release restrictions

The GitHub draft prerelease must not be published or finalized without explicit user instruction, the tag must not move, and npm publish must not be performed. The tag remains on workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`.

## Next action

Review `reports/progress_105.md` and `docs/KCS_POST_RC_ROADMAP.md`. The next candidate is roadmap item 2, the track-matte source selection affordance (`feat/track-matte-source-picker`).

Upload the contents of `chatgpt_handoff/latest/` to ChatGPT.
