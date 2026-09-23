# KCS Minimal ChatGPT Upload Bundle — Task C (Lottie structure correctness)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

M-01, M-02 and H-05 from the full-project review, on `fix/lottie-structure-correctness` from
`main` at `fc672f2`:

- **M-01** — a Lottie layer's parent is resolved through the layer index it names (`ind`) instead of
  the layer's position in the array, so non-sequential indexes and a child that precedes its parent
  both import correctly. A reference no imported layer declares, a self-reference, and an index two
  layers share are reported instead of guessed; the depth check walks the resolved graph and
  terminates on a cycle.
- **M-02** — a layer with no animation track now inherits its parent transform. The hierarchy is
  resolved for every layer and only the keyframe evaluation is skipped.
- **H-05** — a Lottie layer carrying more than one geometry item is reported instead of silently
  keeping only the last one; the layer still imports.
- Reproduced before the change at every level (4 cases for M-01, 3 for M-02, 1 for H-05) and closed
  after it. No new dependency, workflow, tag or release action.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_136_lottie_structure_correctness.md` — the task record
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
