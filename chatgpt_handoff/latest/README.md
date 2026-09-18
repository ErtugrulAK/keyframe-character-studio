# KCS Minimal ChatGPT Upload Bundle — Milestone E (OGraf QA Study: Schema Closure + Folder QA)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

Milestone E items 7 and 8 as **study and plan only** (`docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`, task record `reports/progress_114_ograf_qa_study.md`):

- **Item 7 (offline schema closure):** the validator fetches 8 documents pinned by SHA-256; a read-only check confirmed 8/8 pins still match and measured the closure at 33,567 bytes; `ebu/ograf` is MIT and the JSON Schema meta-schema carries a BSD-style notice. Options 7-A (vendor + offline mode, recommended), 7-B (verified cache), 7-C (status quo), plus the negative controls that keep validation failing closed and a separate CI-wiring decision.
- **Item 8 (downstream folder QA automation):** plan for a generator, an artifact comparison against the ZIP, and a host-limited report on `test/ograf-folder-qa-automation`, reusing the canonical compiler and path-safety authorities, with no host contract invention.

Milestone D is complete in `main` (`3923141`); nothing from this study is implemented, and every implementation step states the approval it needs.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_114_ograf_qa_study.md` — the Milestone E task record (scope, findings, validation, decisions)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with milestone D complete and E next
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source and test files are intentionally omitted (the study document lives at `docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md` in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, design contracts, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
