# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 12 OGraf Package Import

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The OGraf package import (Milestone F item 12, second half), merged into `main` at `419fc6a`:

- One **Import** control classifies a selected file by what it **contains**. A KCS project, a legacy
  project, an OGraf manifest/package and a Lottie animation each reach their existing importer.
- An **OGraf package** (`.zip`/`.ograf`) is decoded in memory under entry-count, per-entry size,
  cumulative size and package-path guards, and the `scene.kcs` it carries opens a report with the
  scene it would apply. Cancel changes nothing; **Import and replace project** applies it through the
  same validated path the project import uses.
- A package the reader cannot accept (unsafe path, duplicate name, reserved key, no scene, too large)
  is refused with its own code, and its confirm button stays disabled — it can never apply or report
  success. A bare `.ograf.json` manifest still points the user at the package.
- An import that cannot be applied leaves the project untouched: the scene is prepared completely
  before any editor state changes, which is pinned by a regression test proven red before the fix.

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
