# KCS Minimal ChatGPT Upload Bundle — Task D (OGraf inverse alpha matte)

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

H-02 from the full-project review, on `fix/ograf-inverse-alpha-matte` from `main` at `85c3929`:

- An inverted track matte in an exported OGraf graphic now actually inverts. It was built as an
  **alpha** mask holding a white backdrop and the source painted black; in an alpha mask that black
  keeps its alpha at 1, so the "hole" stayed opaque and the target rendered as if it had no matte.
  It is now a **luminance** mask with a white backdrop and the source painted black — the technique
  the editor's own matte authority documents — verified by sampling pixels in Chromium.
- The inverted **luminance** matte had the same defect in the sibling branch: it had no backdrop, so
  the mask was transparent everywhere outside the source. Both inverted modes now share one
  construction and the `feComponentTransfer` branch is gone.
- Text matte sources are painted black for the hole; the text renderer had emitted its own `fill`
  first and appended the caller's, so a browser used the layer colour and a dark text produced no
  hole. The duplicate, invalid attributes that path emitted are gone with it.
- The generated runtime mirrors all of it, and the new browser spec renders both authorities and
  compares their pixels.
- Reproduced before the change (3 of 4 pixel cases fail) and closed after it. No new dependency,
  workflow, tag or release action.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_137_ograf_inverse_alpha_matte.md` — the task record
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
