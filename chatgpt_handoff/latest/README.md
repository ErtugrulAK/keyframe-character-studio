# KCS Minimal ChatGPT Upload Bundle — Milestone F Item 10 Masks + Track Mattes

This is a minimal, task-specific ChatGPT upload bundle. It was clean-refreshed for this task.

## What this bundle covers

The second implementation slice of the approved Lottie mapping design
(`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`), merged into `main` at `8670b2a`:

- **Layer masks** — `masksProperties` map onto the existing KCS `LayerMask` stack (`mode`,
  `inverted`, `opacity`, `feather`, `expansion`), animated mask geometry maps onto the existing
  `maskPathChannels`, animated mask scalars onto the existing `maskChannels`, and the design's
  8-mask limit is restored. Modes KCS cannot represent, unreadable payloads and every mask above the
  limit are reported.
- **Track mattes** — `tt` 1/2 → alpha (± inverted), 3/4 → luminance (± inverted) on the existing
  `TrackMatteV2` relation, sourced from the layer directly above with `sourceVisible: false`. An
  explicit `tp` matte parent, a contradicting `td: 0` and a missing/unimported source are reported
  instead of guessed.
- **Spec conformance** — vertices and tangents are read in the specification's own `[x, y]` form
  (the previous reader only accepted `{ x, y }` objects, which real documents do not use), and `td`
  is handled as the specification's 0/1 matte flag rather than an index.

No UI or import entry point exists yet; the text/image/precomp slice and the import entry point with
the report-before-replace UX each need their own approval.

## Files

- `OMP_FINAL_RESPONSE.md` — the final response for this task
- `progress_125_lottie_mask_matte_slice.md` — the task record
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
