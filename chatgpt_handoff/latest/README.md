# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 10 Import Entry Point + Report UX

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The final product slice of the approved Lottie mapping design
(`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`), merged into `main` at `3b30bff`:

- The header offers a separate **Import Lottie** control. Selecting a file parses the document **in
  memory** and opens a report that lists the blockers and the losses — each with its stable code, its
  source path and the concrete next step — **before** anything is applied.
- **Cancel** (button, Escape or backdrop) clears the pending import and nothing else: no project
  mutation, no history entry, no autosave, no success message. Only **Import and replace project**
  applies the scene, through the same validated path the project import uses.
- A refused document never applies and never reports success, and the confirm button is disabled
  while a blocker is present.
- Imported layers keep what the source drew: a path, a rectangle, a rounded rectangle, an ellipse and
  a solid all arrive as a freeform whose own path draws the imported geometry (with Lottie's tangents
  converted to the absolute handles the renderer reads), while text and images keep their existing KCS
  types. Every one of those types is accepted by the OGraf export, so an imported scene no longer
  risks a refusal caused only by the layer type the importer picked.

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
