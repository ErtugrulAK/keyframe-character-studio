# Progress 107 — Track-Matte Source Selection Affordance

## Scope

Implement roadmap item 2: make the track-matte / matte source relationship visible and safe to author in the KCS editor, reusing the existing relationship models, the existing update path, and the existing validation authority. No new matte, rendering, evaluator, animation, or state engine.

Out of scope (unchanged): matte geometry/modes, legacy matte field semantics, OGraf package format, new animation channels, drag-and-drop matte authoring, timeline matte indicators, folder-backed asset library, Desktop workspace.

## Branch

- Implementation branch: `feat/track-matte-source-picker`
- Feature commit: `1390acd` — `feat: add track matte source selection affordance`
- No branch deletion, no tag movement, no release publication.

## Baseline main SHA

- Baseline `main`: `14c84afc9f3b2004282f75fa4e6d64548a0a15ab` (Task 106B; `main == origin/main`)
- `v1.1.0-rc.1` tag target (unchanged): `46d2a3e59e065816d972dcd56951803951b577f6`

## Implementation summary

Discovery showed the Track Matte V2 **card** already existed (source select with `None`, self-excluded candidate list, missing-source warning, mode/enabled/inverted/sourceVisible controls, per-field preservation). Task 107 therefore closed the remaining authoring gaps instead of rebuilding the card:

1. **Relationship resolution now has one display authority.** `resolveMatteSource` was added to the existing matte utility (`src/utils/matte.ts`). It returns `{ sourceId, kind: 'track' | 'legacy' }` and mirrors the render path exactly: an enabled Track Matte V2 record is authoritative even when it does not name a usable source (the stage then selects it and applies nothing instead of falling back), the legacy `matte` applies only when Track Matte V2 is absent or disabled and it names a source while not being disabled, and otherwise no relationship is reported. Only persisted fields are read.
2. **The outliner indicator covers both models and follows the effective relationship.** The row indicator previously derived from `part.matte?.sourcePartId` only, so a layer whose relationship lived in `trackMatte` showed nothing. It now renders whatever the stage selects, through the shared helper: a resolvable source shows `Mask → <name>`, an enabled V2 whose source cannot be resolved shows the missing indicator (which is exactly the case where the stage applies no matte), and a disabled relationship shows nothing. It names the model in its accessible label (`Track matte source: X` / `Missing track matte source`), omits empty parentheses when the id is empty, and falls back to the layer id when a name is empty. Legacy labels are byte-for-byte unchanged.
3. **Candidate labels fall back to ids** in both the legacy and the V2 source selects, so an unnamed layer is still selectable and identifiable.
4. **Accessibility/test seam:** the V2 source select gained `aria-label="Track matte source"` (consistent with the existing `aria-label="Inverted"` / `"Feather"` controls in the same card).

Explicit non-goal recorded during implementation: **matte cycles are not re-detected in the UI.** The export validator (`src/ograf/validation.ts`) builds its relationship graph from `trackMatte?.sourceLayerId ?? matte?.sourcePartId` and ignores `enabled`, while the app-level `validateCritical` walk is V2-only and skips disabled edges. A partial UI warning derived from either walk would disagree with the authority that actually blocks the export, so the card deliberately relies on the existing export diagnostics (Task 105 remediation: "Invalid track matte — Point the track matte at an existing layer that is not this layer and does not create a matte cycle, then export again."). The picker still makes self-reference impossible, which is the one case a local guard can decide truthfully.

Behaviour intentionally left unchanged: selecting a source writes the same field with the same preservation rules; `None` clears the relation without touching layers; a missing source deselects to `None` and never auto-mutates; legacy matte card DOM order and queries are unchanged.

## Existing authority reused

| Concern | Authority | Used for |
|---|---|---|
| Relationship state | `CharacterPart.trackMatte` (V2), `CharacterPart.matte` (legacy) | the only persisted relationship fields |
| Relationship precedence | new `resolveMatteSource` in `src/utils/matte.ts`, mirroring `StagePartLayers.getEffectiveMatte` plus the `isMatteActive` gates at both render sites (enabled V2 stays authoritative even without a usable source) | outliner indicator |
| Edit + history | `onPartPropChange` → `handlePartPropChange` (existing single history path) | every write |
| Cycle / missing detection | `validateCritical` (canvas safety) and `src/ograf/validation.ts` (export) — both untouched; neither is re-implemented in the UI | not surfaced by this change (see non-goal) |
| Eligibility (legacy card) | `isMatteEligible` | unchanged source list |
| Rendering | `StagePartLayers`, `utils/matte.ts`, `ograf/svgRenderer.ts` | untouched |

Known, pre-existing divergence left untouched: `ograf/svgRenderer.getMatteRelationship` does **not** fall back to the legacy matte when a V2 record exists but is disabled, so export semantics can differ from the stage for that specific combination. Aligning the two validators is a separate decision and was deliberately not attempted here.

## Files changed

Source:

- `src/utils/matte.ts` — added `MatteSourceRef` and `resolveMatteSource`
- `src/components/Inspector/OutlinerPanel.tsx` — indicator now covers both relationship models
- `src/components/Inspector/sections/style/StyleMatteSection.tsx` — id-fallback labels for both source selects and an `aria-label` on the V2 source select (no cycle warning; see the non-goal above)

Tests:

- `src/tests/matte.test.ts` — `resolveMatteSource` unit tests
- `src/tests/matteRender.test.tsx` — resolver/stage parity tests
- `src/tests/outlinerPanel.test.tsx` — Track Matte V2 indicator tests
- `src/tests/styleMatteSection.test.tsx` — Track Matte V2 authoring tests

## User-facing behavior added

- A layer whose relationship lives in Track Matte V2 now shows it in the outliner (`Mask → <source name>`, with an accessible label naming the model), including the missing-source state that the stage renders as "no matte applied"; a disabled relationship shows nothing, because nothing is applied.
- Unnamed layers are selectable and identifiable in both source pickers (id fallback).
- No change to how a matte is chosen, cleared, rendered, validated, exported, or undone.

## Tests added/updated

- `src/tests/matte.test.ts` (4 new tests): an enabled V2 relationship wins over legacy; only an absent or disabled V2 falls back to the legacy matte; an enabled V2 with an unusable id stays authoritative instead of falling back; a disabled relationship (either model) or a layer without a relationship yields `undefined`.
- `src/tests/matteRender.test.tsx` (2 new tests): an enabled V2 with an unusable id suppresses the legacy clip on the rendered stage and the resolver agrees; a disabled V2 lets the legacy clip render and the resolver agrees — these observe the renderer and the indicator authority together, which is what the previous review asked for.
- `src/tests/outlinerPanel.test.tsx` (6 new tests): a V2 relation shows the source name; a missing V2 source reports missing; an enabled V2 wins over a legacy matte in the same row; a **disabled** V2 falls back to the legacy label the stage renders; a disabled relationship renders no indicator; an unnamed source falls back to its id.
- `src/tests/styleMatteSection.test.tsx` (6 new tests): the candidate list excludes the selected layer and falls back to ids; selecting a source preserves mode/enabled/inverted/sourceVisible; the first selection builds the canonical V2 record; `None` clears the relation with a single callback; a missing saved source stays visible, selects None, and never auto-mutates; a disabled relation keeps the card usable and preserves its settings.

## Validation matrix

| Check | Command | Result |
|---|---|---|
| Focused tests | `npx vitest run src/tests/matte.test.ts src/tests/matteRender.test.tsx src/tests/outlinerPanel.test.tsx src/tests/styleMatteSection.test.tsx` | PASS — 4 files / 412 tests |
| Full Vitest | `npm test` | PASS — 103 files / 1,575 tests |
| OGraf fixture | `npm run validate:ograf` | PASS |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| Production build | `npm run build` | PASS — existing Vite chunk-size warning only |
| TypeScript | `npx tsc --noEmit` | PASS |
| Lint | `npm run lint` | PASS — existing `AnimatorContext` Fast Refresh warning only |
| Whitespace | `git diff --check` | PASS |
| UI verification | Vite dev server + headless Chromium, two text layers | PASS — see below |

UI verification performed on the running editor (not only tests):

1. Two layers added; selecting one and opening `TRACK MATTE V2` listed `None` + the other layer only (self excluded).
2. Choosing that source wrote the relation and the outliner row immediately showed `Mask → Display Title`.
3. Pointing the other layer back at the first produced `Mask → Subheading` on both rows and **no** cycle warning line in the card — matching the documented decision that cycle reporting stays with the export validator. That authority (`src/ograf/validation.ts`) still rejects matte cycles as `OGRAF_INVALID_TRACK_MATTE`; its own tests cover self-reference and missing-source cases, while a direct mixed-graph cycle test does not exist today. That is a documented pre-existing coverage gap, not something this change altered.
4. `Ctrl+Z` reverted a relationship edit through the existing history path (the indicator disappeared, the untouched relation stayed intact). This was verified before the follow-up commits, which did not touch the write path.
5. Choosing `None` on an existing relation removed it, both layers stayed in the outliner, and the indicator disappeared.

## Known warnings

Pre-existing and unrelated:

- Oxlint `react(only-export-components)` Fast Refresh warning in `src/context/AnimatorContext.tsx`.
- Vite chunk-size warning for the single production bundle.
- npm install-script warning for `sqlite3`.
- OGraf schema validation still requires network access.
- Hostile concurrent filesystem mutation remains outside the supported threat model.

No new warning was introduced.

## Protected invariants

- Tag `v1.1.0-rc.1` was not moved, recreated, or deleted; target remains `46d2a3e59e065816d972dcd56951803951b577f6`.
- The GitHub release remains an unpublished draft prerelease.
- npm publish was not performed; the package remains private at `1.1.0-rc.1`.
- `without-mask` was not touched; global OMP configuration, model roles, provider mappings, `memory.backend: mnemopi`, and `task.maxConcurrency: 8` were unchanged.
- No new matte/rendering/evaluator/validation/state engine; `validateCritical`, `isMatteEligible`, `StagePartLayers`, `utils/matte.ts` geometry, and `ograf/*` authorities are reused, not replaced.
- No secrets handled; `C:\Users\ertugrul.ak\Desktop\ograf-graphics` and `C:\Users\ertugrul.ak\Desktop\KCS` untouched.
- `chatgpt_handoff/latest/` stays a minimal bundle with no source or test copies.

## Independent review result

Three independent review rounds ran on this branch; the merge gate opened only after the third round's findings were addressed.

- Round 1 — `BLOCKED`: `resolveMatteSource` ignored `enabled`, so the outliner could name a V2 source while the stage rendered the legacy matte; and a new cycle warning surfaced only a narrower graph than the export validator.
- Round 2 (commit `ebc4b93`) — `BLOCKED`: `enabled` was honoured and the partial cycle warning was removed (deeper cycles deliberately stay with the export validator), but an enabled V2 record with an empty/unusable source plus a legacy matte still diverged, because the resolver fell back to legacy while the stage selected the V2 record and applied nothing.
- Round 3 (commit `d3775cb`) — behaviour CLOSED: an enabled V2 record is authoritative regardless of whether it names a usable source; the resolver/stage/outliner parity matrix was confirmed for all eight combinations; the two new `matteRender` tests were confirmed to fail if either side regressed to the divergent behaviour. The remaining finding was documentation-only (the summary still described the round-2 precedence and over-claimed indicator parity), and those sentences were corrected in this report.

No runtime finding remained open at the merge gate.

## Merge/push status

- Feature commit: `1390acd` on `feat/track-matte-source-picker`.
- Fast-forward merge into `main` and push to `origin/main` follow once the review verdict allows it; no normal merge commit, rebase, or force push.
- Branch is retained; nothing is deleted.

## Next recommended task

Roadmap item 3: **Direct canvas tangent handles** (`feat/canvas-tangent-authoring`). It is the highest-value remaining authoring item but needs a design contract for coordinate transforms, topology, selection, undo, and keyboard behaviour before implementation, so it should start with a design/review gate rather than direct coding.
