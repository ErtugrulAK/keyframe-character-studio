# KCS Minimal ChatGPT Upload Bundle — Task A (modal / global shortcut isolation)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

H-01 from the full-project review: a blocking dialog could be open while the editor's global
mutation shortcuts stayed live. Fixed on `fix/modal-shortcut-isolation`, fast-forward merged into
`main` at `0c19751`:

- The editor's global commands (Delete/Backspace, undo/redo, copy/paste, duplicate, the tool keys
  and the zoom keys) are now inert while a blocking dialog is on screen. The guard reads the
  dialogs' own `aria-modal` contract, so there is one authority — the dialog — and no second
  registry that could drift from what is rendered.
- `NewItemModal` was the one dialog that did not declare that contract, so the guard could not see
  it, and its `Escape` only worked from its input. It now declares the dialog and owns `Escape` at
  the dialog level, the same pattern `ConfirmationDialog` and `ImportReportDialog` already use.
- Reproduced before the change (16 of 18 new cases fail) and closed after it (18 of 18 pass).
- No change to the command set, to the text-input/contenteditable protection, or to any dialog's
  `Tab`/`Escape` contract. No dependency, workflow, tag or release change.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_134_modal_shortcut_isolation.md` — the task record
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
