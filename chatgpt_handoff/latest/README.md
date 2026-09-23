# KCS Minimal ChatGPT Upload Bundle — Task G (live documents and the state checker)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

M-05 from the full-project review, on `fix/state-consistency-live-docs` from `main` at `16e1610`:

- The state consistency check read four documents plus this bundle, so six stale live documents sat
  next to a `PASS`. `LIVE_DOCUMENTS` in `scripts/check-state-consistency.mjs` is now the authority:
  it names the documents that describe the current state, a missing one fails the check, and two new
  rules catch a live document that claims the wrong checkout, puts `main` at another revision, or ties
  the release tag to another candidate. A past merge — "merged into `main` at `<sha>`" — is history and
  is deliberately not matched.
- The closed-programme documents (`SESSION.md`, `docs/KCS_CURRENT_STATE.md`, `docs/KCS_OPEN_TASKS.md`,
  `docs/KCS_BRANCH_STATUS.md`) are marked as historical records naming the live set; the live ones were
  reconciled (`PROJECT_STATE.md`, `NEXT_SESSION.md`, the roadmap, the release summary, the docs index
  and the cleanup map). The roadmap records milestone F as complete and the post-review follow-up as
  NEXT.
- Proven on identical content: against the pre-task tree the old rules passed (including "F next"),
  while the new ones name the contradictions.
- Six new checker tests: a stale checkout, a stale `main` revision, an accepted ancestor claim, a stale
  release candidate, an old revision kept by a historical record, and a missing live document.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_140_state_consistency_live_docs.md` — the task record
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap, now with milestone F complete and G as NEXT
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
