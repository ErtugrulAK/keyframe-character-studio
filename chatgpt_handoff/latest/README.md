# KCS Minimal ChatGPT Upload Bundle — Task F (evaluator profile fixtures)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

M-04 from the full-project review, on `fix/evaluator-profile-fixtures` from `main` at `352d272`:

- The evaluator profile harness now builds the workload it measures. Its scenes carried `transform`
  instead of `baseTransform` and `layers` instead of `masks` — neither is a field the evaluator reads —
  behind an `as CharacterPart` cast that hid both, so the profile timed default transforms and **no
  masks at all** while reporting the scene parameters as if it had.
- The builder now writes the canonical fields (and real mask geometry on `masks`, with channel keys
  from the production helpers), and the harness **verifies the built scene before anything is timed**:
  layer, track, mask and parent counts, finite base transforms, finite evaluated transforms, opacity and
  mask values, and visible layers. The report carries that verification table.
- Reproduced: the new verification against the old builder fails with a `TypeError` on
  `layer.baseTransform`. A re-run baseline is recorded in the report — numbers only, with no comparison
  to the previous unverified run and no optimisation proposed.
- The report path also works now (`KCS_PROFILE_OUT`; Vitest rejects the `--out` flag the harness
  expected). No production code, dependency, workflow, tag or release change.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_139_evaluator_profile_fixture_fix.md` — the task record
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
