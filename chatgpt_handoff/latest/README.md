# KCS Minimal ChatGPT Upload Bundle — Task 107

This is a minimal, task-specific ChatGPT upload bundle for Task 107 only. It was clean-refreshed for this task.

## What this bundle covers

Track-matte source selection affordance: the matte source relationship is resolved by one shared helper that mirrors the rendered result, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps its self-excluded source list, `None` clearing, and field preservation; unnamed layers fall back to their ids in both source pickers.

## Files

- `progress_107.md` — full Task 107 report: scope, implementation, review rounds, validation matrix, UI verification
- `NEXT_SESSION.md` — current state and the next scoped task
- `PROJECT_STATE.md` — project state, validation status, and the ChatGPT handoff policy

## Deliberately not included

Source and test files are intentionally omitted. Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI (runs `35094144225` and `35095655446`), and the real files live under `src/` in the repository. Also omitted: `package.json`, CI/release workflows, older reports, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload the contents of `chatgpt_handoff/latest/` to ChatGPT.
