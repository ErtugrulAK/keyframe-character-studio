# KCS Minimal ChatGPT Upload Bundle — Milestone E Item 7 (Offline OGraf Schema Closure)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The approved **Option 7-A** of the Milestone E study: the pinned OGraf schema closure is vendored into the repository and `npm run validate:ograf` resolves it locally by default, so the validator and the CI step that calls it no longer depend on two remote hosts.

- `fixtures/ograf/schema/` holds unmodified copies of all 8 pinned documents (33,567 bytes) plus `NOTICE.md` with both upstream notices (EBU MIT; JSON Schema Specification Authors BSD-style) and the refresh procedure.
- `scripts/ografSchemaClosure.mjs` owns the pins, the vendored map, `verifyPinnedBytes` and `loadSchemaDocument({ online, root, readFile, fetchBytes })`.
- `scripts/validate-ograf-manifest.mjs` keeps its behaviour and exit codes, resolves locally by default and fetches only with `--online` (the refresh path).
- `src/tests/ografSchemaClosure.test.ts` pins the contract in 8 cases, including the tamper and unpinned-reference failures.

The fail-closed contract is unchanged: every document is verified against its pinned SHA-256 on both paths. No workflow change was needed — `.github/workflows/ci.yml:27-28` already ran the validator, which is now offline and deterministic.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_115_ograf_offline_schema_closure.md` — the task record (scope, changes, validation, residual risks)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the item-7 and item-8 status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test, script and fixture files are intentionally omitted (the validator, the closure module, its tests and the vendored schema documents live in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
