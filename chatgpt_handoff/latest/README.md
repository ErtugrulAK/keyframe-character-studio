# KCS Task 105 Handoff — Export Diagnostics Remediation UX

This handoff was clean-refreshed after Task 105 was integrated into `main`.

## Scope

- Task 105 delivers user-actionable OGraf export diagnostics: a stable title, the failing layer or feature, and a concrete next step for every blocking diagnostic, plus grouped non-blocking warnings.
- User-authored values are formatted at every construction site, so machine paths, URL credentials and query secrets, embedded data payloads, and raw OS error text no longer reach a diagnostic, a thrown error, or a toast.
- `v1.1.0-rc.1` tag and GitHub draft prerelease were not changed; npm publish was not performed.
- Integration: `main` at `9fdbf0fe59c28d3d6f07c8ee37081fc93f2ff6db` (fast-forward merge of `feat/export-diagnostics-ux`).

## Included review files

This bundle contains the Task 105 report, the post-RC roadmap, current project/release documents, package metadata, CI and release workflows, README, and the source and test files changed by this task (flattened with `src__` path prefixes).

Omitted files were not deleted from the repository. Not copied: `.git`, `node_modules`, `.omp`, backups, secrets and environment files, binary caches, and unchanged files.

## Validation

- Full Vitest: PASS (103 files / 1,557 tests).
- `npm run validate:ograf`: PASS.
- `npm run qa:release`: PASS (2 Chromium tests).
- `npm run build`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`: PASS with the pre-existing Fast Refresh, Vite chunk-size, and npm install-script warnings only.
- Independent review at the merge gate: `READY`.
- UI verification: blocking export card renders title, explanation, and next step; no download on a blocked export.

## Release restrictions

The GitHub draft prerelease must not be published or finalized without explicit user instruction, the tag must not move, and npm publish must not be performed. The tag remains on workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`.

## Next action

Review `reports/progress_105.md` and `docs/KCS_POST_RC_ROADMAP.md`. The next candidate is roadmap item 2, the track-matte source selection affordance (`feat/track-matte-source-picker`).

Upload the contents of `chatgpt_handoff/latest/` to ChatGPT.
