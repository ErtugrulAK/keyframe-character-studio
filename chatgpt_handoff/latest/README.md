# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 12 Unified Import Entry

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The unified import entry (Milestone F item 12), merged into `main` at `ce6cec2`:

- One **Import** control in the header. The selected file is classified by what it **contains**, so a
  KCS project, a legacy project, an OGraf manifest/package and a Lottie animation all reach their
  existing importer (and the refusals) through the same button.
- A Lottie animation still parses in memory and opens a report that lists its blockers and losses
  with their source paths and next steps **before** anything is applied; **Cancel** clears the pending
  import and nothing else, and only **Import and replace project** applies the scene through the same
  validated path the project import uses.
- Imported Lottie layer types stay ones the editor renders and the OGraf export accepts, and Lottie's
  relative tangents become the absolute handles the renderer reads, so the imported geometry draws
  what the source drew.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_127_lottie_import_entry_report_ux.md` — the task record
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone F status
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
