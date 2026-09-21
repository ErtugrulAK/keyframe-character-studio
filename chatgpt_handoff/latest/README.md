# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 10 Text / Image / Precomp

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The third implementation slice of the approved Lottie mapping design
(`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`), merged into `main` at `bda62cb`:

- **Text layers** map their static text document onto the KCS text fields (`textValue`, `fontSize`,
  `fontFamily`, `fillColor`). One canonical list of renderable families lives in
  `src/utils/textFonts.ts` and the inspector renders from it; a family outside it falls back to the
  default font and is reported once per document. Animators, text boxes, text paths and the
  justification/tracking/leading/baseline/caps properties are reported.
- **Image layers** resolve their `refId` against the document asset table. Only an embedded data URL
  that already passes the application's embedded-image policy is imported; a file path or URL is
  never read, fetched or resolved, so it is reported and the layer skipped.
- **Precomp layers** stay *unsupported, preserved* per the design: one report per layer naming its
  `refId`, plus cycle, nesting-limit and missing-asset reports from a depth-bounded asset-graph walk.
- Every report carries the source document's own node path, and a layer that is skipped leaves no id
  behind — a later layer pointing at it reports `LOTTIE_BROKEN_PARENT` instead.

No UI or import entry point exists yet; the import entry point with the report-before-replace UX is the
next slice and needs its own approval.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_126_lottie_text_image_precomp_slice.md` — the task record
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the roadmap with the Milestone F status
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
