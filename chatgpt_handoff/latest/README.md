# KCS Minimal ChatGPT Upload Bundle — Milestone D Item 9, Option A (Warning Maintenance + SQLite Repair)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The approved **Option A** of the item-9 audit plus the approved **local SQLite repair**: W1 Fast Refresh split (`src/context/useAnimator.ts`), W2 real chunk splitting (no chunk above 500 kB), W3 jsdom canvas/navigation stubs, W4 honest dependency arrays with a latest-ref, W5 `.gitattributes`, D9-2 checker rule for item-level stale claims, and the D9-1 repair (`node_modules/sqlite3` binding extracted with the package's own install command, `/api/health` → 200). The refined D9-1 root cause is npm 12 blocking the `sqlite3` install script ("not covered by allowScripts"), not the Node 24 ABI.

No dependency was updated and `package.json`, `package-lock.json` and the workflows are byte-identical to `main`. The change is on branch `chore/warning-maintenance` and awaits its independent review and the user's merge decision.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_113_warning_maintenance.md` — the implementation report (per-item changes, evidence, before/after warnings, validation, invariants)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap plan with the item-9 status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source and test files are intentionally omitted. Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
