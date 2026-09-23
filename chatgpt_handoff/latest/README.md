# KCS Minimal ChatGPT Upload Bundle — Task B (import / serialization transaction integrity)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

H-03, H-04 and M-03 from the full-project review, on `fix/import-serialization-transaction-integrity`
from `main` at `1291bb8`:

- **H-03** — the import boundary now also checks the values the renderers and the evaluator read at
  frame time (scene version, frame rate, timeline length, canvas size, layer ids and z-order, text and
  coordinate fields, paths, masks, channels, keyframes, sequence entries). A malformed document is
  refused with a stable code and the offending path before any state is touched. The legacy `layerId`
  track shape and every documented default stay accepted.
- **H-04** — a track's `visible`, `editVisible` and `locked` flags and its sequence link are written on
  export and read back on import, so a muted, canvas-hidden or locked track no longer returns visible
  after a save/load round-trip.
- **M-03** — the history snapshot now carries the document-level state, so undoing an import restores
  the whole document (frame rate, timeline length, canvas, coordinate contract, title, active
  sequence) with the layers instead of leaving the imported settings on top of the restored scene.
- Reproduced before the change at three levels (boundary, history hook, provider integration) and
  closed after it. No new dependency, workflow, tag or release action.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_135_import_serialization_integrity.md` — the task record
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the milestone status
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
