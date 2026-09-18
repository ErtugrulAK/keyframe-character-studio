# KCS Minimal ChatGPT Upload Bundle — Milestone E Item 8 (Folder QA Automation)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The approved item-8 plan of the Milestone E study: a repeatable way to produce and check a clean folder QA copy of an OGraf package — the host import unit — without inventing a host contract, a new exporter, or a fake host wrapper.

- `scripts/generate-ograf-folder-qa.mjs` generates a clean folder QA copy from a `.zip` or extracted package directory, excludes QA sidecars (`*.diagnostics.json`), validates the manifest through the existing offline validator (pin-verified schema closure), compares every file byte-for-byte on disk, and writes a host-limited report. `--verify <folder>` checks an existing copy without writing.
- The QA root is an explicit required argument, and a root that would overwrite the repository is refused. The source package is only read.
- `src/tests/ografFolderQa.test.ts` pins the contract in 8 cases, including byte drift, an extra file, an invalid manifest, and the repository-overwrite guard.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_116_ograf_folder_qa.md` — the task record (scope, changes, validation, residual risks)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone E status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and script files are intentionally omitted (the generator and its tests live in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be. The folder QA tool writes only where `--out` or `--verify` explicitly points.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
