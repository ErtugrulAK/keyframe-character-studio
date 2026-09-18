# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 12 Product Half

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The item-12 product half, continuing the validated import boundary:

- **Compatibility matrix, executed** — `src/tests/importCompatibilityMatrix.test.ts` proves each supported document kind: scene v1/v2 apply with no report, the legacy project applies and reports exactly one migration warning, a scene never reports a migration, and a non-project document is refused.
- **Legacy migrations are reported** — a successful legacy import carries the `KCS_IMPORT_LEGACY_MIGRATED` warning, shown as an `info` toast with its code, message and action.
- **Autosave goes through the boundary** — the `localStorage` restore validates first: a corrupted or tampered entry is refused with a console warning naming the code, and the defaults stay in place.
- **Legacy fields are narrowed** — `LegacyProjectDocument` types the optional fields it reads as `unknown`, and consumers narrow with `typeof`/guards instead of the previous `any`.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_121_kcs_import_product_half.md` — the task record (scope, changes, validation, residual risks)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone F status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and design files are intentionally omitted (they live in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
