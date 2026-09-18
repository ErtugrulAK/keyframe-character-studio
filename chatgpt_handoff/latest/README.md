# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 10 First Slice (Lottie Import Core)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The first implementation slice of the approved Lottie mapping design (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`): the **import core**. It maps a Lottie document to a normal KCS `SceneData` plus a loss report — document timing, shape/solid/null layers, transforms, paths, primitives, fill/stroke/trim, and the segment-to-keyframe easing rules. Everything it does not convert is **reported**, never guessed:

- Lottie's `o` on keyframe k becomes `bezierOut` on that keyframe and its `i` becomes `bezierIn` on the **next** one; `h: 1` maps to `hold`; a segment without handles is `linear`; roving and expression-driven segments are reported and fall back to linear.
- Precomps, text, images, effects, expressions, masks and track mattes are reported and skipped (the approved first-cut decisions), with the design's limits (512 keyframes per channel, 4096 vertices, 32 MB) enforced as reports rather than silent truncation.
- Untrusted input is handled like the project import boundary: size limit, JSON syntax, and a depth-bounded prototype-key walk.

No UI entry point is wired yet; the following slices (masks/mattes, text/image/precomp, the import entry point with the report-before-replace UX) each need their own approval.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_123_lottie_import_core.md` — the task record (scope, changes, validation, residual risks)
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone F status
- `CHANGELOG.md` — the repository changelog
- `NEXT_SESSION.md` — repository state and the current next action
- `PROJECT_STATE.md` — project state, validation status and the handoff policy
- `manifest.txt` — this bundle's inventory

`NEXT_SESSION.md`, `PROJECT_STATE.md`, `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` and `CHANGELOG.md` are copies of their root documents; `node scripts/check-state-consistency.mjs` compares them after CRLF→LF normalization and a whole-document `trim()` and fails on content drift.

## Deliberately not included

Source, test and design files are intentionally omitted (they live in the repository). Flattened copies named `src__*test*` previously matched Vitest's default include glob and broke CI. Also omitted: `package.json`, `package-lock.json`, CI/release workflows, older reports, release/current-state documents, QA output, assets, archives, and caches.

Omitted files were not deleted from the repository; they are simply not part of this bundle.

## Staging note

`C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination. Nothing was copied there, and nothing should be.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT. The files in this folder are its sources.
