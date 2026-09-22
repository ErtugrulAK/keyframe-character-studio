# KCS Minimal ChatGPT Upload Bundle — Milestone D Item 9 Option B Dependency Maintenance

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The approval-gated dependency maintenance (Milestone D item 9, Option B), applied on
`chore/dependency-maintenance-option-b` from `main` at `a4f8642`:

- Sixteen patch/minor packages were refreshed inside their current major versions — React and
  React DOM 19.3, Vite 8.3, Vitest 4.1.11, lucide-react 1.47, the testing-library patches, `pg`,
  `concurrently` and the `@types` packages — keeping the repository's caret convention, with no
  package added or removed.
- A **bounded `npm audit fix`** (no `--force`) took `npm audit` from one high and six moderate
  advisories to **zero** known vulnerabilities.
- Two minors were applied, verified and then **deferred with evidence**: `oxlint` 1.85 reports 33
  warnings the current version does not (and silencing rules or rewriting React code is not a
  dependency task), and `jsdom` 30.1 dropped its own `createObjectURL`, so any Blob download throws
  and the export-flow test fails.
- The upgrade also required four test selectors to use the attribute-value case the component
  actually renders (`Gradient angle`), because the current jsdom selector engine matches attribute
  values case-sensitively where the previous one did not.

No application behaviour changed: the only non-package edit is those four test selectors.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_130_dependency_maintenance_option_b.md` — the task record
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone D status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md`
are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after
CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and design files are intentionally omitted (they live in the repository). Flattened
copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also
omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports,
release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.
Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
