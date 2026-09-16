# Next Session Handoff

## Repository state

- Checkout: main at the Task 107 merge commit; `origin/main` synchronized
- Task 107 implementation is integrated by fast-forward; the track-matte source relation is now visible in the outliner and authorable from the existing Track Matte V2 card
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- `feat/export-diagnostics-ux` and `feat/track-matte-source-picker`: merged by fast-forward and retained
- Release tag: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged

## Current result

The four release blockers are resolved or explicitly accepted. Annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate. No npm publication occurred.

Task 105 delivered export diagnostics remediation UX: blocking diagnostics now report a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; and user-authored values no longer reach diagnostics, thrown errors, or toasts raw — a canonical formatter renders machine paths, URL credentials/query, and embedded payloads safely at every construction site.

## Validation

Post-merge full Vitest (103 files / 1557 tests), `validate:ograf`, `qa:release` (2 Chromium tests), TypeScript, lint, production build, and `git diff --check` passed, plus an independent review pass that returned `READY`. Existing Fast Refresh, Vite chunk-size, npm install-script, and schema-network warnings remain.

## Guardrails

- Do not reset, force-push, rebase, tag, or delete branches/reports.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml`, model roles, provider mappings, task concurrency, and global tooling unchanged.
- Keep `origin/without-mask` untouched and classified ARCHIVE.
- Production draft is not published; publish/finalize requires further explicit user instruction.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` is a per-response, task-specific upload bundle: clean it first, then place only the files that this specific ChatGPT conversation needs.
- Never store flattened source or test copies there. Those copies are separate files, and the ones named `src__*test*` are picked up by the Vitest default include glob, which breaks CI.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset folder, not a handoff dump. Never copy the bundle there unless the user explicitly asks.
- Omitted files are never deleted from the repository; they simply are not part of the bundle.

## Next scoped work

1. Read `docs/KCS_POST_RC_ROADMAP.md` and `reports/progress_107.md`.
2. Next candidate: roadmap item 3, direct canvas tangent handles (`feat/canvas-tangent-authoring`) — start with the design contract it needs (coordinate transforms, topology, selection, undo, keyboard) before coding.
3. Preserve the tag/draft release and request independent review before merge.
4. Publish/finalize the GitHub draft only after explicit user instruction.
