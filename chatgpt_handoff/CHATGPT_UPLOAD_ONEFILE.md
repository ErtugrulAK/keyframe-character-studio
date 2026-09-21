# KCS ChatGPT One-File Handoff

---

## 0. Upload Instructions

- This file is always the latest current handoff.
- It is overwritten/rebuilt for every task; the previous file is deleted before writing.
- It is not an archive, and old task sections are never appended or preserved.
- It is generated only from `chatgpt_handoff/latest/` plus `latest/OMP_FINAL_RESPONSE.md`.
- Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT; the files in `chatgpt_handoff\latest` are its sources.
- The repository root is `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user project/asset workspace, not a handoff destination; nothing was copied there.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` is untouched by this workflow.
- The previous checkpoint folder `docs/checkpoints/2026-09-18-after-lottie-core/` stays in the repository; its copies left this bundle with the refresh.

---

## 1. OMP Final Response

# KCS Milestone F Item 10 Second Slice — Final Response (Masks + Track Mattes)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** done and merged. `feat/lottie-mask-matte-slice` was fast-forward merged into `main` at `8670b2a` (base `main` was `bf8632a`) and pushed; the branch is kept.
- **Report:** `reports/progress_125_lottie_mask_matte_slice.md`. **Design:** `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`.
- No UI entry point is wired yet: the importer returns a scene plus a loss report, and nothing in the editor calls it.

## 2) WHAT CHANGED

| File | Change |
|---|---|
| `src/interop/lottie/temporal.ts` | The segment-split timing decision moved into `mapLottieSegmentTiming`, so the numeric channels and the mask-geometry channel share one easing authority; `mapLottieKeyframes` is a thin value mapper over it |
| `src/interop/lottie/mapDocument.ts` | `mapLayerMasks` (mode map, static geometry, animated geometry and scalars, limit, unreadable payloads), the four track-matte types, `tp`/`td` handling, and mask channels on the layer's existing track; the path reader now accepts the specification's `[x, y]` pairs as well as `{ x, y }` objects |
| `src/interop/lottie/diagnostics.ts` | `LOTTIE_IMPORT_LIMITS.masksPerLayer: 8` restored |
| `src/tests/lottieImport.test.ts` | Mask/matte group with 19 cases (56 in total, was 37); fixtures moved to the specification's path form; the superseded blanket-report test re-pinned to the constructs that are still reported |
| `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` | §3/§5 record the specification facts this slice follows (`[x, y]` pairs, `td` as a 0/1 flag, `tp` reported, the limit counts source masks, unreadable fields reported) |

## 3) VALIDATION

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| `npx vitest run src/tests/lottieImport.test.ts` | PASS — 56 cases |
| `npm test` (full Vitest) | PASS — 120 files / 1,792 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests, candidate `8670b2a` |
| `node scripts/check-state-consistency.mjs` | PASS once the handoff bundle mirrors the updated root documents (this refresh) |
| `git diff --check` | clean |

## 4) REVIEW

Three independent read-only review rounds (`reviewer-agent`, evidence-cited):

| Round | Verdict | Findings |
|---|---|---|
| 1 | BLOCKED | 3 high + 3 medium: the path reader ignored the specification's `[x, y]` pairs; `td` was misread as an index; animated mask-path timing diagnostics were dropped; the mask limit counted imported masks instead of source masks; present-but-unreadable mask fields fell back silently; one diagnostic path pointed at the wrong layer |
| 2 | BLOCKED | 4 findings closed; one partially open (`hasMask: true` with no mask list, and an animated scalar with no readable keyframe, still fell back silently) |
| 3 | READY | Every finding closed, no new blocker |

The first round's high findings were verified against the published Lottie specification before the fix: `v`/`i`/`o` are arrays of `[x, y]` pairs and `td` is a 0/1 flag with `tp` naming an explicit matte parent.

The review also surfaced a **pre-existing defect in the merged import core** that this slice fixes: the path reader only accepted `{ x, y }` objects, so real documents lost every shape path and mask.

## 5) SAFETY

- No UI, editor or import entry point; no evaluator or renderer change.
- No `package.json`, lockfile, dependency or workflow change; the changed paths are the Lottie importer, its tests and documentation.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the GitHub draft release, npm metadata, `origin/without-mask`, the OMP configuration (`memory.backend: mnemopi`, model roles, provider mappings, `task.maxConcurrency: 8`) and the user folders are unchanged.
- Integration was fast-forward only: no merge commit, no rebase, no force push, no tag change, no branch deletion.

## 6) NEXT

The next item-10 slice is **text/image/precomp conversion**, followed by the import entry point with
the report-before-replace UX (which is also where the imported layer type can be reconciled with the
OGraf export types). Everything that touches `package.json`, lockfiles or workflows stays behind its
own approval.

---

## 2. Handoff Manifest

# KCS ChatGPT Upload Manifest — Milestone F Item 10 Second Slice (Masks + Track Mattes)

Clean refreshed: YES
Bundle purpose: the Lottie importer's mask + track matte slice (Milestone F item 10, second slice)
Bundle scope: minimal and task-specific; this folder is not an archive

Branch: feat/lottie-mask-matte-slice, fast-forward merged into main at 8670b2a (base main was bf8632a) and pushed; the branch is kept
Task record: reports/progress_125_lottie_mask_matte_slice.md; design: docs/design/KCS_LOTTIE_IMPORT_MAPPING.md (in the repository)
What changed: src/interop/lottie/temporal.ts (shared segment-split timing), src/interop/lottie/mapDocument.ts (mask mapping onto LayerMask + maskChannels/maskPathChannels, four track matte types onto TrackMatteV2, tp/td handling, the specification's [x, y] path form), src/interop/lottie/diagnostics.ts (masksPerLayer limit), src/tests/lottieImport.test.ts (56 cases, was 37)
Not changed: no UI, import entry point, evaluator, renderer, dependency, package.json, lockfile or workflow change
Validation: npm run build PASS; lottie core suite PASS (56); full suite PASS (120 files / 1,792 tests); lint clean; npm run validate:ograf PASS; npm run qa:release PASS (2 Chromium tests, candidate 8670b2a); state check PASS; git diff --check clean
Reviews: three independent read-only rounds — BLOCKED, BLOCKED, READY — every finding closed; the first round's high findings were verified against the published Lottie specification before the fix
Next slices (each needs its own approval): text/image/precomp conversion; the import entry point with the report-before-replace UX
v1.1.0-rc.1 tag target: 46d2a3e59e065816d972dcd56951803951b577f6 (unchanged)
Tag/release/npm changed: NO
GitHub release: existing draft prerelease, not published/finalized
npm publish: NO

Copied files (7):
- README.md — bundle instructions
- manifest.txt — this inventory
- OMP_FINAL_RESPONSE.md — the second-slice final response
- progress_125_lottie_mask_matte_slice.md — the task record
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md — roadmap plan (copy of the root document)
- CHANGELOG.md — changelog (copy of the root document)
- NEXT_SESSION.md — current state and next action (copy of the root document)
- PROJECT_STATE.md — project state (copy of the root document)

Omitted categories:
- Source, test and design files (they live in the repository, including docs/design/KCS_LOTTIE_IMPORT_MAPPING.md)
- package.json, package-lock.json, ci.yml, release-smoke.yml files
- Older reports, current-state/release documents, the previous checkpoint bundle copies
- QA output, zip files, asset folders, screenshots, archives, dependencies, secrets, caches

Omitted files were not deleted from the repository. Not copied and never touched: .git, secrets/env/API keys, backups, binary caches, `C:\Users\ertugrul.ak\Desktop\KCS`, `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

Validation at this revision (each command run separately):
- npm run build (tsc -b && vite build): PASS — the type gate CI runs
- npx vitest run src/tests/lottieImport.test.ts: PASS — 56 cases
- npm test: PASS — 120 files / 1,792 tests; npm run lint: clean
- npm run validate:ograf: PASS; npm run qa:release: PASS (2 Chromium tests)
- node scripts/check-state-consistency.mjs: PASS; git diff --check: clean

Next: the text/image/precomp slice, then the import entry point with the report-before-replace UX.

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md to ChatGPT. The files listed above are the sources of that one-file artifact.

---

## 3. Bundle README

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

---

## 4. Task Record

# Progress 125 — Lottie Mask + Track Matte Slice

## 1. Scope

The second implementation slice of the approved Lottie mapping design
(`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`), on top of the import core merged at `ff32d6c`:

- Convert Lottie layer masks (`hasMask`, `masksProperties[]`) through the existing KCS layer-mask
  authority, or report what cannot be represented (design §5).
- Convert Lottie track mattes (`tt`, `td`) through the existing KCS `TrackMatteV2` relation, or
  report the cases the relation cannot carry (design §3).
- Restore the mask limit the first slice deliberately left out of `LOTTIE_IMPORT_LIMITS`.
- Cover the new behaviour with contract tests.

Out of scope by instruction: any UI or import entry point, text/image/precomp conversion, the item-12
unified import entry, and every `package.json`, lockfile, dependency or workflow change. No
evaluator or renderer change was needed — the importer fills fields those authorities already read.

## 2. Branch

`feat/lottie-mask-matte-slice`, created from `main` at `bf8632a`.

## 3. Existing authorities reused

| Authority | Where | How this slice uses it |
|---|---|---|
| `LayerMask`, `LayerMaskMode`, `LayerMaskStack` | `src/types/animator.ts:58-75` | Each Lottie mask becomes one `LayerMask`; no parallel mask model was introduced |
| `maskChannels` / `maskPathChannels` + `layerMaskChannel()` / `layerMaskPathChannel()` | `src/types/animator.ts:197-232` | Animated mask opacity/feather/expansion and mask geometry use the only mask animation channels that exist |
| `TrackMatteV2` | `src/types/animator.ts:77-83` | `tt` 1–4 map onto `mode`/`inverted`; the relation is the same field the inspector, renderer and export validation already read |
| `mapLottieSegmentTiming` (extracted from `mapLottieKeyframes`) | `src/interop/lottie/temporal.ts` | One segment-split/easing rule now feeds both the numeric channels and the mask-geometry channel — a second copy would have been a second authority |
| `toBezierPath` / vertex limit | `src/interop/lottie/mapDocument.ts` | Mask geometry uses the same reader, the same `coordinateSpace: 'local'` and the same `LOTTIE_PATH_LIMIT` as layer shapes |
| `evaluateLayerMasks`, `runtimeTemplate.maskDefs`, `svgRenderer`, `validateSceneForOGraf` | `src/utils/evaluateLayerMasks.ts`, `src/ograf/**` | Unchanged; they already evaluate `maskChannels`/`maskPathChannels` (falling back to `mask.path`) and validate the matte relation |

## 4. What changed

| File | Change |
|---|---|
| `src/interop/lottie/temporal.ts` | Extracted `mapLottieSegmentTiming` (frames, easing, the `in`/`out` split, roving/expression reports, keyframe limit); `mapLottieKeyframes` is now a thin value mapper over it. Behaviour is unchanged — the existing core tests still pin the same split |
| `src/interop/lottie/mapDocument.ts` | Added `mapLayerMasks` (mode map, static geometry, animated geometry/properties, limit, unreadable payloads), the four-type track-matte mapping, and mask channels on the layer's existing track. Removed the two blanket reports (`LOTTIE_UNSUPPORTED_MASK`, `LOTTIE_UNSUPPORTED_TRACK_MATTE`) the first slice used |
| `src/interop/lottie/diagnostics.ts` | `LOTTIE_IMPORT_LIMITS.masksPerLayer: 8` restored |
| `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` | §3/§5 record the specification facts this slice follows: `v`/`i`/`o` are `[x, y]` pairs, `td` is the 0/1 matte flag (`tp` is reported and dropped), the mask limit counts source masks, and a present-but-unreadable mask field is reported |
| `src/tests/lottieImport.test.ts` | New mask/matte group (12 cases); one existing case re-pinned from the old blanket reports to the constructs that are still reported |

## 5. Mask behavior

- **Modes** — `a` → `add`, `s` → `subtract`, `i` → `intersect`. `n` (Lottie's "none") and any other
  value (`f`, `d`, `l`) are **skipped and reported** per mask (`LOTTIE_UNSUPPORTED_MASK_MODE`),
  because KCS has no mode for them and guessing one would change the picture.
- **Geometry** — a static `pt` becomes the mask's `path`; a keyframed `pt` becomes the existing
  `mask-<i>:path` channel with one `PathKeyframe` per keyframe, using the same segment-to-keyframe
  split as the transform channels (verified: `bezierOut` on the starting keyframe, `bezierIn` on the
  one that ends the segment), and the same `ip`/`st` frame shift. `mask.path` keeps the first
  keyframe as its base value, which is the fallback `evaluateLayerMasks` uses when a channel is
  absent.
- **Scalars** — `o` → `opacity` (percent → 0..1), `f` → `feather`, `x` → `expansion`; an animated
  form of any of them becomes `mask-<i>:opacity|feather|expansion` on the same track.
- **`inv`** → `inverted`; `nm` → `name` (falling back to `Mask <i+1>`); ids are deterministic
  (`mask-<i>`), never taken from the document.
- **Limit** — at most 8 masks per layer; each mask above it is reported (`LOTTIE_MASK_LIMIT`). The limit counts the masks in the **source**, so an unreadable mask never lets a later one through in its place.
- **Unreadable payloads** — a mask that is not an object, or whose `pt` carries no readable
  vertices, is skipped with `LOTTIE_UNREADABLE_MASK`; a mask list that is not an array reports the
  same code whether or not `hasMask` is set, and `hasMask: true` without any list reports it too; and
  is not a boolean, `nm` that is not a string, `o`/`f`/`x` whose static value or animated keyframes
  instead of defaulted, so "absent" and "unreadable" never look the same in the report.

## 6. Track matte behavior

- `tt` 1/2 → `mode: 'alpha'`, 3/4 → `mode: 'luminance'`; 2 and 4 additionally set `inverted: true`.
  KCS supports both modes and inversion, so no matte type is reported merely for being luma or
  inverted.
- The source is **the layer directly above** (`index - 1`), which is Lottie's rule when `tp` is
  absent; the relation is written as `{ sourceLayerId, mode, enabled: true, sourceVisible: false }`
  because Lottie never draws a matte layer on its own — the same thing `sourceVisible: false`
  means in KCS.
- `td` is the specification's **0/1 flag** ("this layer is used as a track matte"), not an index:
  `td: 1` on the layer above confirms the positional rule and is silent, while `td: 0` on that
  layer contradicts it (`LOTTIE_TRACK_MATTE_AMBIGUOUS`, reported at `layers[<source>].td`) and the
  relation is dropped.
- An explicit `tp` matte-parent index is reported (`LOTTIE_TRACK_MATTE_UNSUPPORTED`, at
  `layers[<target>].tp`) and the relation dropped: this slice cannot resolve which layer that index
  names, and guessing would silently attach the wrong source.
- A matte whose source layer was not imported (for example a precomp or text layer above it) reports
  `LOTTIE_TRACK_MATTE_MISSING_SOURCE` and drops the relation instead of pointing at a layer that
  does not exist.
- An unknown or non-numeric `tt` value reports `LOTTIE_TRACK_MATTE_UNSUPPORTED`; a layer that flags
  itself as a matte source (`td: 1`) while the layer below declares no matte reports the same code
  at `layers[<source>].td`.

## 7. Diagnostics added

Stable code, `severity: 'warning'`, `feature: 'lottie-import'`, a source-document path, a message and
a concrete action, as the design §8 requires:

| Code | When |
|---|---|
| `LOTTIE_MASK_LIMIT` | A layer carries more than 8 masks |
| `LOTTIE_UNSUPPORTED_MASK_MODE` | Mask mode `n` or an unknown mode |
| `LOTTIE_UNREADABLE_MASK` | Mask entry not an object, no readable path, or `hasMask` without a list |
| `LOTTIE_TRACK_MATTE_UNSUPPORTED` | Unknown or non-numeric `tt`; an explicit `tp` matte parent; a `td: 1` layer whose neighbour declares no matte |
| `LOTTIE_TRACK_MATTE_MISSING_SOURCE` | The layer above the target was not imported |
| `LOTTIE_TRACK_MATTE_AMBIGUOUS` | The layer above carries a contradicting `td` hint |

One report per affected mask or matte item, with the item's own path
(`layers[2].masksProperties[1].pt`), so the author can find it in the source document.

## 8. Tests

`src/tests/lottieImport.test.ts` — 56 cases (was 37). The new group covers:

1. A static mask maps to `LayerMask` (mode, path, opacity, feather, expansion, inversion, name).
2. `n` and `f` mask modes report and are skipped while a valid sibling mask still imports.
3. An animated mask path lands on `mask-0:path` with the documented split and frame shift, and the
   layer keeps the first keyframe as the mask base path.
4. Animated mask opacity lands on `mask-0:opacity` with the percent → factor conversion.
5. Nine masks import the first eight and report `LOTTIE_MASK_LIMIT` once.
6. A mask with no readable path reports `LOTTIE_UNREADABLE_MASK` and leaves no empty mask behind.
7. All four `tt` types map to the expected `mode`/`inverted`/`sourceVisible`, with no matte report.
8. A matte whose source layer was not imported reports and drops the relation.
9. A contradicting `td` hint reports `LOTTIE_TRACK_MATTE_AMBIGUOUS`.
10. An unknown `tt` reports `LOTTIE_TRACK_MATTE_UNSUPPORTED`.
11. The produced masked/matted scene passes the existing import boundary
    (`validateImportedDocument`) and carries no matte/mask error in the OGraf export validation.
12. The spec path form (`v`/`i`/`o` as `[x, y]` pairs) reaches the layer shape, and an animated mask
    path that carries a roving segment reports `LOTTIE_ROVING_KEYFRAME` while still importing both
    keyframes.
13. A present-but-unreadable mask field (`inv`, `o`, `nm`, and an animated scalar whose keyframes
    carry no value) reports `LOTTIE_UNREADABLE_MASK` at that field, and a broken or missing mask list
    reports it with or without the `hasMask` flag.
14. A contradicting `td: 0` reports at the source layer's own path; an explicit `tp` and a `td: 1`
    layer with no matte below report `LOTTIE_TRACK_MATTE_UNSUPPORTED`.
15. The superseded blanket-report test was re-pinned to effects and expressions, which are still
    reported.

## 9. Validation matrix

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| `npx vitest run src/tests/lottieImport.test.ts` | PASS — 56 cases |
| `npm test` (full Vitest) | PASS — 120 files / 1,792 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 10. Protected invariants

- No `package.json`, lockfile, dependency or `.github/workflows/**` change.
- No UI, editor or import entry point; nothing calls the importer yet.
- No evaluator or renderer change: the slice fills the fields those authorities already read.
- Tag `v1.1.0-rc.1`, the GitHub draft release, npm state, `origin/without-mask`, the OMP
  configuration and the user folders are untouched.

## 11. Residual risks

- The importer maps every Lottie layer to the KCS `custom` layer type, which the OGraf export
  validation does not accept as a target type. That is a pre-existing property of the merged import
  core (it predates this slice) and is only observable once an import entry point exists; it is
  pinned by a comment in the new boundary test rather than silently worked around.
- Mask geometry is stored in layer-local coordinates. The KCS mask authority applies the layer
  transform, so a Lottie mask authored against a different anchor point can sit offset until the
  anchor is converted — the same open item the import core records for anchors
  (`LOTTIE_UNSUPPORTED_ANCHOR`).
- A track matte is only as good as the layer order: a document that names an explicit matte parent
  (`tp`) is reported rather than guessed, and a `td: 0` contradiction drops the relation.
- Mask opacity/feather/expansion animation uses the existing channels; a document that animates a
  mask property on a *sequence* other than `Sequence` keeps the default sequence, exactly like the
  other imported channels.

## 12. Next slices

1. Item 10 — text/image/precomp conversion.
2. Item 10 — the import entry point with the report-before-replace UX (this also gives the layer-type
   gap above a visible surface to close).
3. Item 12 — the unified import entry.

---

## 5. Next Session

# Next Session Handoff

## Repository state

- Checkout: `feat/lottie-mask-matte-slice` (Milestone F item 10, masks + track mattes) on top of `main` at `bf8632a…`, which matches `origin/main` — the checkpoint `docs/checkpoints/2026-09-18-after-lottie-core/` plus its final tip. Milestones A–E, the Milestone F study, the item-11 harness, item 12's first step and product half, the CI hotfix and **Milestone F item 10's first slice (the Lottie import core, merged with `--no-ff` at `ff32d6c`, pushed)** are in `main`. The feature branches `feat/export-onboarding`, `chore/state-hygiene-gate`, `chore/dependency-warning-audit`, `chore/warning-maintenance`, `docs/milestone-e-ograf-qa-study` and `feat/lottie-import-core` are retained as review artefacts.
- Milestone A (canvas tangent handles) is integrated into `main` by approved replay + fast-forward; `main` is a strict superset of its previous state
- Task 105 (export diagnostics UX) and Task 107 (track-matte source selection) are integrated by fast-forward; both are retained
- Workflow-tested release code candidate (tag target): `46d2a3e59e065816d972dcd56951803951b577f6`
- Release tags: `v1.1.0-rc.1` (annotated) and `v1.1.0-public-controls`, both unchanged
- Branches kept: `feat/canvas-tangent-authoring` (Milestone A review artefact) and `feat/canvas-tangent-authoring-replay` (identical to `main`; deleting it needs approval)

## Current result

Milestones A–E are complete, and Milestone F is the active milestone; its item-10 first slice is merged:

- Milestone F item 10 first slice — **the Lottie import core is merged into `main`** at `ff32d6c` (base `06a5dfcf`, `--no-ff`, pushed; branch `feat/lottie-import-core` kept at `f76ae6a`): `importLottieDocument(text)` maps document timing, shape/solid/null layers, transforms, paths, primitives and fill/stroke/trim, applies the segment-to-keyframe easing rules, and reports every construct it does not convert through the loss-report contract. 37 contract cases; five independent read-only review rounds (BLOCKED, BLOCKED, BLOCKED, READY WITH WARNINGS, READY WITH WARNINGS) plus a merge-eligibility review of the last delta. There is **no UI entry point** yet: nothing in the editor calls the importer.

- Milestone A — canvas tangent authoring (`077911b`): vertex selection shows Bezier handles on the stage, dragging reshapes the path live, one history entry per completed drag, `Escape` cancels.
- Milestone B — graph + keyboard accessibility (`96e8f9d`): named keyframe diamonds with a lane-local arrow walk, a labelled value graph with keyboard-editable points, decorative SVG hidden from assistive tech, focus rings.
- Milestone C — first export / onboarding (`c2dcb22`): opt-in "First export help" panel, readiness check reading the same OGraf diagnostics authority as the export, one shared compile path for readiness and both export actions.
- Milestone D item 6 — state consistency check (`b91e8b9`, CI follow-up `be76df9`): `node scripts/check-state-consistency.mjs`.
- Milestone D item 9 — dependency and warning maintenance: **the audit is complete** (`reports/progress_112_dependency_warning_audit.md`, review closed READY WITH WARNINGS in round 6 of six) and **the approved Option A is implemented on `chore/warning-maintenance`** (`reports/progress_113_warning_maintenance.md`): W1 Fast Refresh split, W2 chunk splitting, W3 jsdom stubs, W4 honest dependency arrays, W5 `.gitattributes`, the D9-2 checker rule, plus the local SQLite binding repair — the API starts again and `GET /api/health` returns 200 in this working copy. `package.json`, `package-lock.json`, `.github/workflows/**` and every dependency version are unchanged. Audit findings that remain open by decision: 20 outdated rows over 21 package names (7 patch / 12 minor / 1 no-wanted-update; across two toolchain groups / three package names a newer major is available — `typescript` 6→7 and the Vitest pair `vitest` + `@vitest/coverage-v8` 4→5), `npm audit` 7 findings (6 moderate, 1 high; only `qs` and `undici` moderate in the production tree), the `engines` declaration and the npm-12 `allowScripts` pin. The branch is not merged: it is subject to the user merge decision.

The release stance is unchanged: annotated tag `v1.1.0-rc.1` and a GitHub draft prerelease exist at the workflow-tested code candidate; nothing was published, finalized, or pushed to npm.

## Validation

Full Vitest (120 files / 1,785 tests), `npx vitest run src/tests/lottieImport.test.ts` (49 cases), `npm run validate:ograf`, `npm run qa:release` (2 Chromium tests, candidate `47d3368`), `npm run build`, `npm run lint` (clean), `git diff --check` and `node scripts/check-state-consistency.mjs` (PASS, 32 checks) all pass on `main` at the `2026-09-18-after-lottie-core` checkpoint; the newest CI run on `main` is `35355797739` (success).

## Next scoped work

1. **Milestone F — item 10 masks + track matte slice is implemented on `feat/lottie-mask-matte-slice`** (`reports/progress_125_lottie_mask_matte_slice.md`): `masksProperties` map onto the existing `LayerMask` stack plus the existing `maskChannels`/`maskPathChannels`, `tt` 1–4 map onto the existing `TrackMatteV2` relation, the 8-mask limit is restored, and every remaining mask/matte construct is reported. **The merge decision for that branch is with the user.** Still open afterwards: item 10's text/image/precomp conversion (the next slice), item 10's import entry point with the report-before-replace UX, item 12's unified import entry, and OGraf package import. Also open, each approval-gated: Option B (7 patch + 12 minor updates + a bounded `npm audit fix`, needs `package.json`/lockfile approval), Option C (TypeScript 7 / Vitest 5 majors on their own branch), the `engines` declaration, and the npm-12 `allowScripts` decision.
2. Milestone F's delivered work: the study, item 10's design, its merged first slice (the import core) and its mask/matte slice on `feat/lottie-mask-matte-slice`, item 11 (measurement only, on `chore/evaluator-profiling-harness`), and item 12's first step (merged) plus product half (on `feat/kcs-import-product-half`). Anything beyond those scopes — item 10's remaining slices, item 12's unified import entry, OGraf package import, Milestone E beyond items 7 and 8 — needs its own approval, and **D's dependency/package part (item 9 Option B) requires explicit user approval** before any `package.json`/lockfile work; all release/tag/draft-release changes need explicit approval.
3. Preserve the tag and draft release, and run an independent review before every merge.
4. Publish/finalize the GitHub draft only with further explicit user instruction.

## Guardrails

- Do not reset, force-push, rebase, tag, or delete branches/reports. Integrate by fast-forward, or by an approved replay.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml`, model roles, provider mappings, task concurrency, and global tooling unchanged.
- Keep `origin/without-mask` untouched and classified ARCHIVE.
- Production draft is not published; publish/finalize requires further explicit user instruction.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` is a per-response, task-specific upload bundle: clean it first, then place only the files that this specific ChatGPT conversation needs.
- Preferred upload artifact: `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. If a historical handoff archive is ever needed, create a separate explicitly named archive file under `chatgpt_handoff/archive/` only after user approval. The default ChatGPT upload is always this one file.
- Handoff documents must state one current truth: never append a correction block on top of stale sections — rewrite the stale section instead.
- Never store flattened source or test copies there. Those copies are separate files, and the ones named `src__*test*` are picked up by the Vitest default include glob, which breaks CI.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset folder, not a handoff dump. Never copy the bundle there unless the user explicitly asks.
- Omitted files are never deleted from the repository; they simply are not part of the bundle.

## Milestone B merged — graph + keyboard accessibility

- Branch `feat/graph-accessibility` was fast-forward-merged into `main` at `96e8f9d0313cb81752c04fe58d6e7d00d700a6f4` (no merge commit, no rebase, no history rewrite).
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; the selected-keyframe panel is a group scoped to its frame; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- Roadmap status when this milestone landed: D was next (items 6 and 9) and C was merged. Current status: A–E are complete and Milestone F is the active milestone (see "Current result" above).

---

## 6. Project State

# KCS Project State

## Current position

The accepted product and security follow-up line is integrated into main, and the grouped post-RC roadmap has completed milestones A–E plus the first implementation slice of Milestone F item 10.

Annotated tag `v1.1.0-rc.1` was created and pushed at workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`. The GitHub release exists as a draft prerelease; no npm publication occurred.

**Checkpoint `2026-09-18-after-lottie-core`** (`docs/checkpoints/2026-09-18-after-lottie-core/`) records this state: `main` / `origin/main` is at `47d3368a2b54…`, the Lottie import core (Milestone F item 10, first slice) was merged with `--no-ff` at `ff32d6c` and pushed, and its branch `feat/lottie-import-core` is kept at `f76ae6a` as the review artefact. The checkpoint folder carries the summary (`README.md`), the tasklist (`TASKLIST.md`), a copy-paste next-session prompt (`RESUME_PROMPT.md`) and a machine-readable summary (`STATE.json`); the task record is `reports/progress_124_checkpoint_after_lottie_core.md`. The Milestone F study is merged (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`); **item 11 (evaluator profiling) is implemented** on `chore/evaluator-profiling-harness` as measurement only (`reports/progress_118_evaluator_profiling.md`), **item 12’s first step (validated import boundary)** is merged at `44218a6` (`reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix executed as fixtures, the legacy migration report, and the autosave restore routed through the same boundary) is implemented on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design** is delivered in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`; item 10’s **first implementation slice (the import core)** is **merged into `main`** at `ff32d6c` (`reports/progress_123_lottie_import_core.md`), and its **second slice — layer masks + track mattes — is implemented on `feat/lottie-mask-matte-slice`** (`reports/progress_125_lottie_mask_matte_slice.md`): masks map onto the existing `LayerMask` stack plus the existing `maskChannels`/`maskPathChannels`, `tt` 1–4 map onto the existing `TrackMatteV2` relation, the 8-mask limit is restored, and every mask/matte construct the slice cannot represent is reported; the merge decision for that branch is with the user. Remaining item-10 slices: text/image/precomp, and the import entry point with the report-before-replace UX.

- Task 105 (export diagnostics remediation UX): blocking OGraf export diagnostics carry a stable title, the failing layer or feature, and a concrete next step; warnings are grouped into one non-blocking notification; user-authored values are formatted at every construction site so machine paths, URL credentials/query, embedded payloads, and raw OS messages never reach a diagnostic, a thrown error, or a toast.
- Task 107 (track-matte source selection affordance): the matte source relation, whichever model holds it, is resolved by one shared helper that mirrors the rendered relationship, so the outliner indicator shows what the stage actually applies; the Track Matte V2 card keeps its self-excluded source list, `None` clearing, and field preservation, and unnamed layers fall back to their ids in both source pickers.
- **Milestone A (canvas tangent handle authoring) — MERGED.** Selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex reveals its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-clicking a vertex toggles corner ↔ smooth with neighbour-derived symmetric handles. One history entry per completed drag; `Escape` cancels a drag without recording one.
  - Integration path: the original branch `feat/canvas-tangent-authoring` was reviewed across six rounds (final verdict `READY`, all five findings closed) and replayed onto current `main` as `feat/canvas-tangent-authoring-replay`, then fast-forward merged. No rebase, no merge commit, no force push, no history rewrite.
  - Not covered: vertex add/remove, multi-vertex transforms, keyboard nudging, handle constraints, boolean or trim-enabled freeform layers, broadcast mode.

The release tag `v1.1.0-public-controls` remains unchanged. The `without-mask` branch remains a preserved archive candidate.

## Accepted baseline

Public Controls V1, OGraf Package Export V2, host compatibility work, Windows path hardening, parent/broadcast hardening, SourcePath/filesystem hardening, mask/matte parity, deterministic OGraf fixture validation, the isolated release smoke gate, the export diagnostics remediation UX, the track-matte source selection affordance, and Milestone A canvas tangent handle authoring are present in the accepted main line. OMP tooling remains separate.

## Validation status

| Area | Status | Evidence |
|---|---|---|
| Full Vitest | PASS | 120 files / 1,773 tests |
| OGraf fixture validation | PASS | `npm run validate:ograf` — offline against the vendored closure, every document pin-verified (`reports/progress_115_ograf_offline_schema_closure.md`) |
| OGraf release smoke | PASS | `npm run qa:release`; 2 Playwright tests — latest run at `47d3368` on `main` at the `2026-09-18-after-lottie-core` checkpoint |
| Real-browser milestone smoke | PASS | `e2e/graph-accessibility.spec.ts` and the live editor smoke with port 5000 closed (layer authoring, readiness check, real export) |
| State consistency | PASS | `node scripts/check-state-consistency.mjs` — 32 checks on `main` at the `2026-09-18-after-lottie-core` checkpoint (the total scales with the number of bundle documents scanned) |
| TypeScript | PASS | `npm run build` (`tsc -b && vite build`) — the gate CI runs; `npx tsc --noEmit` alone does not cover the same project program (see `reports/progress_122_ci_hotfix_import_boundary_types.md`) |
| Lint | PASS | clean — the Fast Refresh warning was removed in `reports/progress_113_warning_maintenance.md` |
| Production build | PASS | no chunk-size advisory — split into 382.19 kB app + react-vendor/icons/geometry chunks (see `reports/progress_113_warning_maintenance.md`) |
| Independent review | PASS | Milestone A `READY` in round 6 of six; the item-9 audit closed `READY WITH WARNINGS` in round 6 of six (`reports/progress_112_dependency_warning_audit.md` §12); the Option A change closed with `READY WITH WARNINGS` from the read-only `scout` round (the reviewer model hit a provider usage limit) after `reviewer-agent` rounds 1–3 closed every finding (`reports/progress_113_warning_maintenance.md` §2) |
| CI on `main` | PASS | runs `35355797739` (Lottie import core handoff) and `35355585227` (Lottie import core merge) — both success |

## Remaining work

- Grouped roadmap execution plan: `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`; roadmap items 1 and 2 are completed, and **Milestone A is merged**.
- **Milestone B (graph + keyboard accessibility, item 4) — MERGED** at `96e8f9d`: the timeline keyframe diamonds are named keyboard buttons with a lane-local arrow walk, the value graph exposes a labelled group with keyboard-editable points, decorative SVG geometry is hidden from assistive tech, and focus rings were added. One review round returned BLOCKED (3 findings, 6 over-claims), all closed; the re-review returned READY WITH WARNINGS.
- **Milestone C (first export / onboarding flow, item 5) — MERGED** at `c2dcb22` (final gate verdict READY WITH WARNINGS): an opt-in "First export help" panel, a readiness check that reads the same OGraf diagnostics authority the export reads, and one shared compile path used by the readiness check and both export actions. **Milestone D is complete** — item 6 and item 9 (audit, the approved Option A and the local SQLite repair) are merged at `3923141` (`reports/progress_112_dependency_warning_audit.md`, `reports/progress_113_warning_maintenance.md`). Milestone E (study plus items 7 and 8) is complete, and Milestone F is the active milestone: its study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`), item 11 is implemented as measurement only, item 12's first step and product half are merged, item 10's mapping design is delivered (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`) and **item 10's first implementation slice — the Lottie import core — is merged at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`). Remaining item-10 slices: masks + track mattes (the recommended next task), text/image/precomp, and the import entry point with the report-before-replace UX. Follow-ups stay approval-gated before any `package.json`, lockfile, or workflow change: Option B, Option C, the `engines` declaration and the npm-12 `allowScripts` pin.
- Publish/finalize the GitHub draft only with further explicit user instruction.
- No npm publication occurred; package remains private at `1.1.0-rc.1`.
- Branch cleanup needs approval: `feat/canvas-tangent-authoring-replay` is identical to `main` and can be deleted whenever the user approves; `feat/canvas-tangent-authoring` is kept as the Milestone A review artefact.

## ChatGPT handoff policy

- `chatgpt_handoff/latest/` holds a minimal, task-specific upload bundle, refreshed for each ChatGPT response instead of accumulating context files.
- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` is regenerated from scratch for each task/milestone. Before writing it, delete or overwrite the old file. Build it only from the current `chatgpt_handoff/latest/` bundle plus `latest/OMP_FINAL_RESPONSE.md`. Do not append old content, do not preserve previous task sections, and do not use it as an archive. A historical handoff archive, if ever needed, is a separate explicitly named file under `chatgpt_handoff/archive/` and only after user approval.
- Every handoff document states one current truth: a correction is never appended on top of a stale section — the stale section is rewritten.
- Flattened source and test copies must not live there: the Vitest default include glob picks up files named `src__*test*`, which failed CI runs `35094144225` and `35095655446`.
- `C:\Users\ertugrul.ak\Desktop\KCS` is the user's project/asset workspace, not a handoff destination.

## Protected state

- The current main documentation commits are intentionally newer than the tag target; the tag remains on the workflow-tested code candidate.
- `v1.1.0-public-controls` remains unchanged.
- `origin/without-mask` remains untouched and classified ARCHIVE.
- `.omp/config.yml` retains `memory.backend: mnemopi`.
- Model roles, provider mappings, task concurrency, and global OMP configuration remain unchanged.
- Candidate package version is `1.1.0-rc.1`; package remains private and unreleased.

## Milestone B merged — graph + keyboard accessibility

- Branch `feat/graph-accessibility` was fast-forward-merged into `main` at `96e8f9d0313cb81752c04fe58d6e7d00d700a6f4` (no merge commit, no rebase, no history rewrite).
- What it adds: timeline keyframe diamonds are named, focusable buttons (`Enter`/`Space` selects the keyframe and moves the playhead, `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and are consumed at the ends); the value graph is a labelled group whose keyframe points are Tab-reachable and announced with frame and value, editable with the arrow keys; decorative SVG geometry is hidden from assistive technology; the selected-keyframe panel is a group scoped to its frame; focus rings were added for the diamonds and the graph points.
- Review: one focused round returned BLOCKED (3 findings, 6 documentation over-claims) — all closed; the re-review returned READY WITH WARNINGS.
- Validation: 109 files / 1,652 Vitest tests, `validate:ograf`, `qa:release`, build, TypeScript, lint, `git diff --check`, plus the real-browser spec `e2e/graph-accessibility.spec.ts`.
- Out of scope (unchanged): graph engine or evaluator changes, new shortcut registry, keyframe model or drag redesign, new dependencies, release/package/workflow changes.
- **Milestone D item 6 — state consistency check — MERGED** at `b91e8b9` (follow-up `be76df9`): `node scripts/check-state-consistency.mjs` fails when the live docs contradict the tag/`main` SHA, when the roadmap and the next action disagree, when the handoff upload instruction is superseded, or when the bundle carries source/test/binary copies, collapsed Windows paths or secret markers (see `reports/progress_111_state_hygiene_gate.md`).
- **Item 9 (dependency and warning maintenance) — MERGED at `3923141`** (audit, Option A warning maintenance and the local SQLite repair). The audit is complete (`reports/progress_112_dependency_warning_audit.md`, review closed READY WITH WARNINGS in round 6 of six) and the approved **Option A is implemented** on `chore/warning-maintenance` (`reports/progress_113_warning_maintenance.md`): W1 Fast Refresh split, W2 chunk splitting, W3 jsdom stubs, W4 honest dependency arrays, W5 `.gitattributes`, the D9-2 checker rule and the repair of **D9-1** (the local `sqlite3` NAPI binding is extracted; `node server/index.js` starts and `GET /api/health` returns 200 in this working copy). No dependency was updated and `package.json`, `package-lock.json` and the workflows are unchanged; nothing is merged. The 7 catalogued warnings are resolved except W6 (`e2e/**` outside the Vitest glob by design) and W7 (environment `NO_COLOR`/`FORCE_COLOR`). Still open by decision: 20 outdated rows over 21 package names (7 patch / 12 minor / 1 no-wanted-update; majors available for `typescript` 6→7 and the Vitest pair 4→5), the 7 `npm audit` findings (6 moderate, 1 high; `qs` and `undici` moderate in the production tree), the `engines` declaration and the npm-12 `allowScripts` pin.

---

## 7. Current Roadmap Plan and Changelog

# KCS Grouped Roadmap Execution Plan

Orchestrator close-out for the grouped post-RC roadmap run. Milestone A was later completed, re-reviewed, and fast-forward merged into `main` (see `reports/progress_108_canvas_tangent_authoring.md`); milestone B was completed, re-reviewed, and fast-forward merged into `main` (see `reports/progress_109_graph_accessibility.md`); milestone C was completed, re-reviewed (final gate verdict READY WITH WARNINGS), and fast-forward merged into `main` (see `reports/progress_110_export_onboarding.md`); milestone D item 6 (state consistency check) was completed, re-reviewed, and fast-forward merged into `main` while item 9's audit and its approved Option A are merged and only its follow-ups (Option B, Option C, `engines`, the npm-12 `allowScripts` pin) stay behind an explicit approval gate (see `reports/progress_111_state_hygiene_gate.md`); milestone E items 7 and 8 are implemented and merged at `22335a5`, and Milestone F's study is delivered while its implementation proceeds slice by slice under separate approvals (item 11, item 12's first step and product half, and item 10's first slice are merged; the remaining item-10 slices are the next work).

## Milestone map and status

| Milestone | Roadmap items | Branch | Status |
|---|---|---|---|
| A — Canvas path authoring UX (tangent handles) | 3 | `feat/canvas-tangent-authoring` (replayed as `feat/canvas-tangent-authoring-replay`) | **MERGED** — five review findings closed across six rounds (final verdict READY), fast-forward merged into `main` |
| B — Graph + keyboard accessibility | 4 | `feat/graph-accessibility` | **MERGED** — one review round returned BLOCKED (3 findings, 6 over-claims), all closed; re-review returned READY WITH WARNINGS; fast-forward merged at `96e8f9d` |
| C — First export / onboarding flow | 5 | `feat/export-onboarding` | **MERGED** — six review rounds; final gate verdict READY WITH WARNINGS; fast-forward merged into `main` at `c2dcb22` |
| D — State / CI / warning hygiene | 6, 9 | `chore/state-hygiene-gate`, `chore/dependency-warning-audit`, `chore/warning-maintenance` | **COMPLETE** — **item 6 MERGED** (`node scripts/check-state-consistency.mjs`); **item 9 MERGED** at `3923141` (`reports/progress_112_dependency_warning_audit.md`, `reports/progress_113_warning_maintenance.md`): the audit, then the approved Option A (W1, W2, W3, W4, W5, D9-2) and the local SQLite repair, fast-forward merged with green CI run `35322372675`. Follow-ups stay approval-gated: Option B (patch/minor updates + `npm audit fix`), Option C (TypeScript 7 / Vitest 5), the `engines` declaration and the npm-12 `allowScripts` pin |
| E — OGraf QA / schema hardening study | 7, 8 | `docs/milestone-e-ograf-qa-study`, `chore/ograf-offline-schema-closure`, `test/ograf-folder-qa-automation` | **COMPLETE** — study and plan delivered (`docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`, `reports/progress_114_ograf_qa_study.md`); **item 7 (7-A) implemented and merged** on `chore/ograf-offline-schema-closure` (`reports/progress_115_ograf_offline_schema_closure.md`) and **item 8 implemented and merged** on `test/ograf-folder-qa-automation` (`reports/progress_116_ograf_folder_qa.md`), integrated at `22335a5` with green CI. **Plan only** for anything beyond those two approved scopes |
| F — Interop design and its approved slices | 10, 11, 12 | `docs/milestone-f-interop-study` | **NEXT** — the study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`, `reports/progress_117_interop_study.md`): item 10 Lottie mapping contract, item 11 evaluator profiling plan, item 12 editable-KCS-import product/security plan. **Plan only** for every slice that has not been approved yet. **Item 11 approved and implemented** on `chore/evaluator-profiling-harness` (`reports/progress_118_evaluator_profiling.md`): deterministic scenes, an on-demand harness and a first baseline; measurement only, no caching. **Item 12 first step implemented** on `fix/kcs-import-boundary-hardening` (`reports/progress_119_kcs_import_boundary.md`): a validated import boundary with stable refusal codes and limits; item 10 is designed in `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, and **item 10's first implementation slice (the Lottie import core) is merged at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`); its **second slice (layer masks + track mattes) is implemented on `feat/lottie-mask-matte-slice`** (`reports/progress_125_lottie_mask_matte_slice.md`); its remaining slices — text/image/precomp, and the import entry point with the report-before-replace UX — need separate approval. Checkpoint `2026-09-18-after-lottie-core` |

Completed earlier: item 1 (export diagnostics remediation UX, Task 105), item 2 (track-matte source selection affordance, Task 107).

## Milestone A — the blocker list that was closed (historical record)

From `reports/progress_108_canvas_tangent_authoring.md` §7:

1. Normalize legacy points in `resolveFreeformPath` (`normalizeClosedPoints`) to match the contract.
2. Complete the §7 selection model: handle-selection state, empty-canvas "clear overlay selection only", and resetting the overlay selection when the selected layer changes.
3. Restrict the Escape listener to the drag lifetime and close the batch deterministically for a pointerdown-then-Escape with no move.
4. Build the contract's verification matrix: real-origin coordinate parity under rotation/non-uniform/negative scale; behaviour tests for every `StageCanvas` eligibility guard (extract the guard list into a pure predicate so it is testable); canonical-path priority; real `useHistory` undo/redo/cancel entry counts; serialization/import round-trip of a materialized path; OGraf byte-parity for an untouched canonical path; one manual editor smoke.
5. Decide the smooth-handle-at-anchor edge: dragging a handle exactly onto its anchor must not silently collapse the counterpart (`Math.hypot(...) || 1`).

All five items were closed, the focused re-review and its follow-up rounds returned READY, and the milestone was replayed and fast-forward merged into `main` (`077911b`) with a green CI run. This list is history, not open work.

## Milestone B — Graph + keyboard accessibility (roadmap item 4)

- Scope: keyboard reachability and screen-reader labelling for graph/path editing surfaces that already exist (`TemporalGraphPanel`, keyframe rows, selected-keyframe sections).
- Constraints: no graph engine rewrite, no broad style churn, reuse existing graph/value/channel authorities.
- Validation: focused keyboard/a11y tests, one Playwright smoke, full suite, independent review.
- Gate: stop if the work grows beyond narrow UI/accessibility.

## Milestone C — First export / onboarding flow (roadmap item 5)

- Scope: a short "first successful OGraf export" path for new users, reusing the Task 105 diagnostics, existing templates, and the existing export UI.
- Constraints: no host/vendor contract invention, no package format change, no `Desktop\KCS` interaction.
- Validation: onboarding/sample fixture tests, `qa:release`, full suite, independent review.

## Milestone D — State / CI / warning hygiene (roadmap items 6, 9)

- Item 6 (current-state consistency check) is a documentation/tooling task: a small script or CI check that fails when live docs contradict the tag/main SHA. No gate beyond normal review.
- Item 9 (dependency and warning maintenance) **requires explicit user approval for anything that touches `package.json`/`package-lock.json`**. The audit is complete (`reports/progress_112_dependency_warning_audit.md`), the approved **Option A** (warning fixes only, no package change) is implemented and **merged** at `3923141` (`reports/progress_113_warning_maintenance.md`); Option B, Option C, the `engines` declaration and the npm-12 `allowScripts` pin stay approval-gated.

## Milestone E — OGraf QA / schema hardening study (roadmap items 7, 8)

- Item 7 (offline schema closure): **7-A approved and implemented** — the eight pinned documents (33,567 B) are vendored under `fixtures/ograf/schema/` with both upstream notices in `NOTICE.md`; `npm run validate:ograf` is offline and deterministic by default and verifies every pin, `--online` is the refresh path, and the existing CI step needed no change. Evidence: `reports/progress_115_ograf_offline_schema_closure.md`.
- Item 8 (downstream folder QA automation): **approved and implemented** — the generator, the ZIP/folder comparison and the host-limited report live on `test/ograf-folder-qa-automation` and reuse the canonical compiler and path-safety authorities, with the QA root as an explicit required argument. Evidence: `reports/progress_116_ograf_folder_qa.md`.

## Milestone F — Interop design and its approved slices (roadmap items 10, 11, 12)

The deliverables are the study, the Lottie import mapping design and the editable-KCS-import plan; implementation runs slice by slice, each slice behind its own approval. The study is delivered (`docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`) and fixes each deliverable contract; **item 11 is implemented** (`perf/sceneBuilder.ts`, `perf/evaluator-profile.perf.ts`, `src/tests/evaluatorProfileScenes.test.ts`, `reports/progress_118_evaluator_profiling.md`) as measurement only — no caching, no threshold; **item 12’s first step (validated import boundary) is implemented** (`src/utils/importValidation.ts`, `reports/progress_119_kcs_import_boundary.md`), its **product half** (compatibility matrix, migration report, autosave through the boundary) on `feat/kcs-import-product-half` (`reports/progress_121_kcs_import_product_half.md`), and **item 10’s mapping design is delivered** (`docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, `reports/progress_120_lottie_mapping_design.md`) with its four open questions settled by the user, and its **first implementation slice (the import core)** is **merged into `main` at `ff32d6c`** (`reports/progress_123_lottie_import_core.md`): document timing, shape/solid/null layers, transforms, shapes and the segment-to-keyframe easing rules, with every unconverted construct reported; its **second slice (layer masks + track mattes)** is implemented on `feat/lottie-mask-matte-slice` (`reports/progress_125_lottie_mask_matte_slice.md`) with the 8-mask limit restored; the text/image/precomp slice and the UI entry point remain approval-gated; **no further implementation without a separate explicit approval**, and the design gate in §Approval gates applies before any code. Checkpoint `2026-09-18-after-lottie-core` records this state.

## Approval gates

- Package/lockfile/workflow/dependency changes: explicit user approval required before editing.
- Release/tag/draft-release/npm: explicit user approval required; unchanged by this run.
- Interchange work (Lottie, editable KCS import): design approval before code.
- Any milestone that grows into a broad refactor: stop and report.

## Handoff policy (unchanged)

`chatgpt_handoff/latest/` is a minimal, task-specific bundle: `README.md`, `manifest.txt`, the current report(s), `NEXT_SESSION.md`, `PROJECT_STATE.md`, and optionally the directly relevant contract/plan docs. Never source or test files — flattened copies named `src__*test*` matched Vitest's include glob and broke CI in runs `35094144225`/`35095655446`. Never copy the bundle into `C:\Users\ertugrul.ak\Desktop\KCS`.

## Recommended next prompt

"KCS MILESTONE F — ITEM 10 MASKS + TRACK MATTE SLICE (approval-gated). Resume from checkpoint `2026-09-18-after-lottie-core` (`docs/checkpoints/2026-09-18-after-lottie-core/RESUME_PROMPT.md`): `main` is at `47d3368` and the item-10 first slice (the Lottie import core) is merged at `ff32d6c`. Extend `src/interop/lottie/**` so Lottie masks (`masksProperties`, `hasMask`) and track mattes (`tt`, `td`) are converted through the existing KCS mask/matte authority or reported through the loss-report contract, and restore the mask limit the first slice left out. Suggested branch `feat/lottie-mask-matte-slice`; the UI entry point, the text/image/precomp slice, item 12's unified import entry, package/lockfile/workflow work (Option B, Option C, `engines`, the npm-12 `allowScripts` decision) and every release action stay behind their own approval."

Historical notes: "KCS MILESTONE A COMPLETION …" was carried out (five items closed, READY, replayed and fast-forward merged at `077911b`); "KCS MILESTONE B — GRAPH + KEYBOARD ACCESSIBILITY …" was carried out (merged at `96e8f9d`); "KCS MILESTONE C — FIRST EXPORT / ONBOARDING FLOW …" was carried out: implemented on `feat/export-onboarding`, gate-reviewed (READY WITH WARNINGS) and fast-forward merged at `c2dcb22` (see `reports/progress_110_export_onboarding.md`).

---

# Changelog

All notable changes to **Keyframe Character Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- A state consistency check for the repository: `node scripts/check-state-consistency.mjs` fails when the live documents contradict the tag/`main` SHA, when the roadmap and the next action disagree, or when the handoff bundle carries a stale status, a superseded upload instruction, source/test copies, collapsed Windows paths or secret markers.
- A first-export path for new users: a labelled "First export help" panel next to Export lists the three steps, offers a readiness check that reports what would block an OGraf export (reusing the existing export diagnostics), and states that nothing is written until you export. The readiness answer is a pre-flight summary; a scene changed afterwards is recompiled when the export runs.
- The timeline keyframe diamonds are keyboard operable: each one is a named button in the tab order, `Enter`/`Space` selects the keyframe and moves the playhead (and selects the part on the parent lane), and `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order.
- The value graph's keyframe points are announced with their frame and value, and its decorative axes and curve stay out of the accessibility tree; the selected-keyframe panel is exposed as a group scoped to its frame.
- Bezier tangent handles can be authored directly on the stage: select a single freeform layer, click a vertex to reveal its handles, drag a handle to reshape the path live, and double-click a vertex to toggle corner ↔ smooth. Each drag is a single undo step and `Escape` cancels one without recording history.
- Track-matte source relationships are now visible in the outliner for both relationship models (`Mask → <source name>`), and unnamed layers fall back to their ids in the matte source pickers.
- The Track Matte V2 card's source select carries an accessible label.
- Actionable OGraf export diagnostics: every blocking diagnostic now reports a stable title, the failing layer or feature, the reason, and a concrete next step, and it never reports success while export is blocked.
- Non-blocking OGraf warnings are surfaced as a compact grouped notification instead of being silently dropped.
- Package materialization failures now carry stable failure codes; filesystem guidance states the trusted-directory requirement, the unsupported hostile-concurrency case, and avoids claiming perfect OS-level protection. Machine paths are reduced to a display-safe form.

### Changed
- The value and speed graphs are exposed as labelled groups instead of images, and focus rings were added for the timeline diamonds and the graph keyframe points.
- Freeform paths that only carry legacy `points` normalize a repeated closing vertex before the editing overlay materializes a canonical `path` on first edit; the legacy array itself is preserved.
- Matte relationship resolution went through one shared helper that mirrors the rendered result, so the outliner indicator and the stage agree for enabled, disabled, missing, and unusable sources.

### Release candidate `1.1.0-rc.1` (unreleased package metadata)
- Consolidates the accepted Public Controls, OGraf packaging, filesystem hardening, schema-validation, and release-smoke work.
- The Git tag and GitHub draft prerelease exist; this changelog entry remains under `[Unreleased]` because the package is private and was not published.

### Security
- Hardened prototype-sensitive imported OGraf keys, package paths, MIME lookups, and generated runtime maps.
- Hardened SVG input boundaries, source-path handling, output filesystem checks, hierarchy, broadcast state, and mask/matte parity.
- The `1.1.0-rc.1` candidate records accepted operational warnings for hostile-concurrency filesystem mutation and network-dependent schema validation.

---


## [1.0.0] - 2026-08-02

### Added
- **Motion Design Sequencer**:
  - Multi-track timeline hierarchy supporting track lock, eye visibility, and z-index ordering.
  - Precision keyframing engine for position (`x`, `y`), scale (`scaleX`, `scaleY`), rotation, and opacity at 60 FPS.
  - Interactive Cubic Bezier Easing editor with velocity curve presets and real-time canvas preview.
  - Sequence management tabs with inline double-click renaming and deletion safety.
- **Directional Transform Gizmo**:
  - 8-handle transform controls featuring 4 corner square handles for uniform scaling and 4 midpoint circle handles for single-edge directional stretching.
  - Trigonometric matrix math for directional single-edge resizing preserving fixed opposite edge world coordinates.
  - 360° interactive rotation handle.
- **Media & Shape Masking Engine**:
  - Dynamic vector geometric clipping masks supporting 6 geometries: Circle, Pill/Capsule, Star, Hexagon, Heart, and Rectangle.
  - Interactive crop positioning and custom text caption overlays.
- **Live Broadcast Director Panel (Reji Mode)**:
  - Zero-latency broadcast triggers for streaming tools (OBS Studio, vMix, NDI).
  - Individual and global `PLAY IN` / `PLAY OUT` transition animations.
  - Live broadcast stunts including Bounce, Pulse, Wobble, Spin 360, Shake, Float, and custom keyframe loops.
- **Dual Database Architecture**:
  - Production-ready PostgreSQL database with schema (`schema.sql`) and seed data (`seed.sql`).
  - Zero-config local embedded SQLite database fallback (`keyframe_studio.sqlite`).
  - Express 5 REST API backend providing `/api/projects`, `/api/presets`, and `/api/health` endpoints.
- **Testing & Quality Infrastructure**:
  - Vitest test suite featuring 21 unit and integration test files (62 tests).
  - Playwright end-to-end (E2E) workflow test suite (`e2e/workflow.spec.ts`).
  - TypeScript strict mode compilation and Oxlint linting integration.
  - Agent governance guidelines, project context specification, and domain-driven branch strategy (`.agents/`).

---

## 8. File Inventory

Every file present in `chatgpt_handoff/latest/` at generation time:

- `CHANGELOG.md` — 6149 bytes
- `KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — 12730 bytes
- `NEXT_SESSION.md` — 9972 bytes
- `OMP_FINAL_RESPONSE.md` — 4405 bytes
- `PROJECT_STATE.md` — 13753 bytes
- `README.md` — 3016 bytes
- `manifest.txt` — 3554 bytes
- `progress_125_lottie_mask_matte_slice.md` — 12162 bytes

- Source/test copies present: NO
- Test-glob matching files present: NO
- Desktop\KCS copied: NO

