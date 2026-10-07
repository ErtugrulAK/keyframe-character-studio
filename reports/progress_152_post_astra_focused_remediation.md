# Progress 152 — Post-Astra focused remediation of the dirty authoring tree

Date: 2026-10-07. Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.

A read-only Astra review had found 16 concrete defects (3 HIGH, 12 MEDIUM, 1 LOW; no BLOCKER) in the authoring work that was sitting uncommitted on `main`. This report records the remediation: every finding reproduced, fixed, covered by a focused regression, published in six commits, and validated end to end.

## Baseline and dirty-tree classification

| Field | Value |
|---|---|
| Branch | `main` |
| HEAD / `main` / `origin/main` at start | `ed75ea4304a85be7c931893e0316bdfe92255a3d` |
| Staged | 0 |
| Tracked unstaged | 28 files |
| Untracked | `src/assets/fonts/playfair-display/` (normal TTF, italic TTF, OFL.txt) |

Classification of every dirty path:

- **A — approved visual-only UI refresh (12):** `HeaderBar.css`, `PropertyInspector.css`, `Inspector/sections/StyleTab.tsx`, `Inspector/sections/TransformTab.tsx`, `ConfirmationDialog.css`, `ImportReportDialog.css`, `NewItemModal.css`, `SequencerTimeline.css`, `ToastPortal.tsx`, `LeftToolbar.css`, `Toolbar/drawers/ProjectDrawer.tsx`, `kcsEditorTheme.css`.
- **B — Playfair / OGraf (5 + 3 untracked):** `index.css`, `ograf/legacyCompatibility.ts`, `ograf/packageCompiler.ts`, `ograf/types.ts`, `ograf/validation.ts`, `tests/ografLegacyCompatibility.test.ts`, and the three untracked Playfair source files.
- **C — docs / handoff (10):** `CHANGELOG.md`, `NEXT_SESSION.md`, `PROJECT_STATE.md`, `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`, and the six mirrored/auxiliary files under `chatgpt_handoff/latest/`.
- **D — unknown:** none. No divergence, no in-progress Git operation, no corruption.

### External safety copy

Created outside the repository, under the OS temp directory:

`C:\Users\ertugrul.ak\AppData\Local\Temp\kcs-post-astra-safety-20261007-172448\`

- `tracked-diff.patch` — the full tracked diff (141,877 bytes).
- `untracked-inventory.txt` — the untracked file list plus SHA-256 and size of each Playfair file.
- `fonts/` — copies of `OFL.txt`, `PlayfairDisplay.ttf`, `PlayfairDisplay-Italic.ttf`.

Owned-font hashes recorded before any edit: normal `c40f2293766a503bc70cce9e512ef844a4ccb7cbcde792fe2ea31d191917d8d6`, italic `a5e26dc5e2e77fb2803a0bf02fd4f81ee136ec8dea863ccdb0c59a263b21378b`. No `reset`, `stash` or `checkout --` was used at any point.

## Per-finding remediation

Every finding below was reproduced first, then fixed, then covered. "Unit" means a Vitest case; "browser" means a real-Chromium Playwright case.

### A — Text Boolean geometry

| ID | Repro / root cause | Fix | Test | Result |
|---|---|---|---|---|
| A-01 | `traceText` rejected any family the canvas re-serialised, because it matched the caller's raw string against `context.font`. A quoted name or a fallback list (`"'Playfair Display', serif"`) traced nothing. | The accepted family is read from the canvas's serialized family list (`canvasAcceptedFamilies`), compared against the primary family of the requested CSS list (`primaryFontFamily`). | Unit: quoted/unquoted/fallback-list identity. Browser: bare, quoted, fallback-list and JetBrains Mono each trace an `O` with its counter. | PASS |
| A-02 | The outline cache returned a raster traced before the faces settled, forever: `document.fonts.status` became `loaded` but the provisional entry was still served. | The cache entry records whether it was traced while settled. While loading the provisional raster is reused (no per-frame thrash); once settled it is retraced exactly once. | Browser probe: `document.fonts.status` is `loading` during the trace, the provisional array is reused, the post-load trace is a different object, and that one is reused. | PASS |
| A-03 | `computeBooleanContours` filtered out any operand whose geometry could not be produced, so a three-operand Subtract with an untraceable text silently ran as a two-box Subtract. | The operation refuses atomically when any operand has no geometry; `inspectBooleanOperands` names the unresolved layers, and the Inspector refuses creation and operation switches with that list. | Unit: readiness inspection + atomic refusal + the two-box result still differs. Browser: a text too large to rasterise refuses the three-operand Subtract (no group is created). | PASS |
| A-04 | `sampleBezierPath` pushed the last authored vertex at the end of a closed path, dropping the curved closing edge back to the first point. | A closed path closes on its first point; an open path is unchanged. | Unit: last sample is the first vertex, area matches a high-resolution sample within 2 %, and the straight-edge ring keeps its exact polygon area. | PASS |
| A-05 | The trace drew the raw text while the renderer draws it with SVG's default whitespace handling, so `"A A"` and `"A  A"` produced different geometry. | `normalizeSvgText` collapses internal whitespace runs and trims the edges before both the metrics and the raster. | Unit: normalisation table and equal-geometry mapping. Browser: `"A A"`, `"A  A"`, `"A   A"` and `"  A A  "` trace to identical JSON. | PASS |

### B — Bonded layer movement

One contract now: every caller passes world x/y, and `updateCurrentTransform` converts each written part to its own container-local space.

| ID | Repro / root cause | Fix | Test | Result |
|---|---|---|---|---|
| B-01 | The stage drag converted a parented layer to container-local space and the helper converted it again, so a parented bonded drag landed wrong and pushed the partner the wrong way (buddy 300 → 210 instead of 310). | The stage passes world coordinates for every drag mode; the helper owns the conversion. `initialTransforms` became dead and was removed. | Unit: parented drag reaches the requested world position and the buddy moves by the same delta, matching the Inspector path. Browser: a parented bonded drag calibrated against a parentless group moves both by the same world delta. | PASS |
| B-02 | A multi-selection propagated only the primary layer's bond. | Every selected source propagates its own bond once; a part already written by the gesture is never written again. | Unit: `A↔B`, `C↔D` with `A`+`C` selected moves all four exactly once. | PASS |
| B-03 | A partner parented to a layer moving in the same gesture was converted against the parent's old world, so it received the delta twice (120 → 140 instead of 130). | Conversion uses the parent's post-gesture world, tracked per gesture. | Unit: `A↔B` with `B` under `P`, `A`+`P` selected, moves `B` by the total delta once. | PASS |
| B-04 | An X-only edit wrote both axes for a parentless partner, adding a keyframe to the partner's untouched Y animation and changing its evaluation. | Only the axes that actually move are written; a rotated parent still writes the local Y it genuinely changes. | Unit: the partner's Y channel and its frame-10 evaluation are unchanged; the rotated-parent case still lands on the requested world point. | PASS |

### C — Timeline curve targeting

| ID | Repro / root cause | Fix | Test | Result |
|---|---|---|---|---|
| C-01 | The modal resolved its target with a fallback chain that could leave the selected layer: with layer A holding canonical `x` keyframes and the selected layer B holding live legacy keyframes, applying an easing preset to B's F30 segment changed A's `x@0` easing. | `resolveCurveTarget` resolves the exact channel (or the legacy keyframe list) inside the selected track only — the channel that owns the selected keyframe, else the first active channel, else that track's legacy keyframes — and never falls back to another layer. | Unit: exact repro, two canonical layers, multiple properties, multiple sequences, unknown selection, mask channel, no-data → null, reorder/delete. Integration: the real `SequencerTimeline` inside the real `AnimatorProvider` — the preset edits B's legacy segment and leaves A untouched, and re-selecting A while the modal is open retargets the edit. | PASS |
| C-02 | `updateKeyframeBezierPointsMutator` covered legacy and canonical channels but not `maskChannels`, so a mask scalar segment resolved in the modal changed nothing. | The mutator also writes mask channels. | Unit: the mask curve is written, a transform channel is unaffected, and the evaluator's mid-frame value changes (0.5 → 0.3153). | PASS |
| C-03 | `resolveCurveSegment` accepted two keyframes on the same frame as an editable segment. | A strictly positive duration is required; a zero-duration selection offers no edit and never silently picks another segment. | Unit: duplicate-frame selection returns null while distinct first/middle/reordered cases stay correct. | PASS |

### D — Playfair OGraf portability

| ID | Repro / root cause | Fix | Test | Result |
|---|---|---|---|---|
| D-01 | The `@font-face` family came from the layer's raw `fontFamily`, so a fallback list produced a family-list descriptor the browser cannot register as one face; the text fell back to serif although the font shipped. | `fontFaceFamily` reduces the reference to the primary family (unquoted); the element keeps the authored fallback list. | Unit: the runtime registers `[["Playfair Display","assets/fonts/playfair-display.ttf"]]`, the element keeps `"'Playfair Display', serif"`, bare and quoted forms match, and the ZIP keeps the font and its license. | PASS |
| D-02 | The legacy single-file export wrote only the runtime `.mjs`, silently dropping the packaged font and its license. | It fails closed with an actionable message when the plan carries asset or license files, and points at the ZIP package; an asset-free graphic still exports. | Browser: a Playfair title refuses the legacy export with no download; a shape-only scene still downloads a `.mjs`. | PASS |
| D-03 | The bundled font was accepted on its 4-byte sfnt signature alone. | The project-owned bytes are pinned to their exact SHA-256; a caller-supplied catalog font is never checked against it. | Unit: the real font is accepted; a 4-byte signature, a one-byte mutation and a truncated file are refused with `OGRAF_FONT_UNVERIFIED`; an explicit catalog font still passes. | PASS |

### DOC — Live-document accuracy

| ID | Repro / root cause | Fix | Test | Result |
|---|---|---|---|---|
| DOC-01 | Live documents listed the no-op root `npx tsc --noEmit` as project type-check evidence; the root `tsconfig.json` only references the app and node projects, so it checks no project file. | The false PASS evidence was removed from `PROJECT_STATE.md`, `NEXT_SESSION.md` and the handoff mirrors; `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md` and `docs/KCS_CI_STATUS.md` now name the effective gate `npx tsc -b --pretty false`. Historical explanatory mentions (the CI-step story and the F-10 record) were kept. | `node scripts/check-state-consistency.mjs` (35 checks) plus a `--listFilesOnly` probe confirming the root command lists no project file. | PASS |

## Verdicts by area

- **Boolean / text:** the trace now accepts every family form the editor offers, follows the renderer's whitespace semantics, retraces once the faces settle, refuses a Boolean atomically when an operand has no geometry, and closes a closed freeform ring on the right vertex.
- **Bonding:** one explicit world/local contract; every selected source propagates its bond exactly once; a moving ancestor is not applied twice; an untouched axis is never written. Bonding remains position-write propagation, not a playback constraint.
- **Timeline / Motion Curves:** the modal edits the selected layer's own channel, mask scalar segments reach persisted state and the evaluator, and only strictly positive-duration segments are editable.
- **OGraf / Playfair:** the `@font-face` identity is the primary face, the legacy single-file export fails closed when it cannot carry its assets, and the owned font bytes are pinned to their exact SHA-256.

## Validation

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | PASS |
| `npm run lint` (Oxlint 1.85.0) | PASS — clean, no new warnings |
| `npm test` (Vitest 5) | PASS — 135 files / 2,055 tests |
| `npm run build` | PASS — Vite 8.3.0, 2,034 modules |
| `npm run validate:ograf` | PASS — offline against the vendored closure |
| `npm run qa:release` | PASS — 2 Chromium tests |
| `npm run qa:v6` | PASS — 3 Chromium tests |
| `npx playwright test --retries=0` | PASS — 268 tests |
| `node scripts/check-state-consistency.mjs` | PASS — 35 checks |
| `git diff --check` | One trailing-whitespace line in the verbatim upstream `OFL.txt` (deliberately not edited) |
| `npm audit --audit-level=low` | WARNING — `concurrently`/`shell-quote` (critical, dev), `proxy-addr` (critical, transitive through Express), `source-map-js` (high, transitive), moderate `fast-uri`; no `npm audit fix` was run |

## Commit split

| Commit | Message | Scope |
|---|---|---|
| `a3f5b09` | `fix: harden text boolean geometry` | A-01…A-05 + tests |
| `78450f5` | `fix: correct bonded layer movement` | B-01…B-04 + tests |
| `0a20dd6` | `fix: target timeline curve edits correctly` | C-01…C-03 + tests |
| `aa392a9` | `fix: harden playfair ograf portability` | D-01…D-03 + the owned Playfair source and license |
| `fb8ed96` | `style: finalize editor visual refresh` | the pre-existing approved visual-only changes |
| (this commit) | `docs: reconcile post-astra authoring fixes` | DOC-01 + live docs, this report and the handoff rebuild |

The six already-published authoring commits were not rewritten.

## Remaining limitations

1. **Dependency advisories** — the four advisories above are recorded, not fixed; remediation needs a separately approved dependency change. The API server does not enable `trust proxy`, so the `proxy-addr` code path is not reachable from the current configuration, but the advisory remains in the production tree.
2. **`OFL.txt` trailing whitespace** — the verbatim upstream license carries one trailing-whitespace line; editing a license file to satisfy a diff check is worse than leaving it.
3. **Boolean browser matrix** — Union/Subtract/Intersect/Exclude, text+shape, text+freeform, text+text and a three-operand Subtract are covered in Chromium, but the letter matrix (O/A/B/P/R/8/i/j/punctuation) is asserted as "traces with its counter" rather than per-letter ring counts.
4. **Bonding coverage** — parentless, parented source, parented partner, moving ancestor, two bond groups, selected source+partner, X-only with an animated other axis, rotated parent, deleted partner and stage-vs-Inspector parity are covered. A full browser Bind → move → undo/redo → copy/paste → save/reload → delete → reorder chain is still not exercised end to end.
5. **`.agents/*` and `AGENTS.md`** — these agent templates still name `npx tsc --noEmit` as an example; `AGENTS.md` already allows "the repository's equivalent local runner", and both files are outside this approved scope.
6. **A-03 renderer surface** — when the derived geometry refuses, the group renders no path for that frame rather than a stale result; there is no separate in-stage refusal banner.
