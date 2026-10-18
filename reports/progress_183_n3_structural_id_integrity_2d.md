# Progress 183 - N3 PR-2d Structural ID Integrity

Date: 2026-10-18T10:14Z (UTC)
Base: `main@0ec6ce2` (PR #18 merge lineage)
Head: `30d9802` (code) on `fix/n3-structural-id-integrity-2d`, worktree
`.worktrees/n3-pr2d-id-integrity`; docs-only commits follow it on the branch -
every pushed PR head is CI-verified (this file's own commit included).
PR: https://github.com/ErtugrulAK/keyframe-character-studio/pull/23 (OPEN, CI
`Build, Lint & Test Verification` green at the exact pushed head, 2m14s)
Task: N3 PR-2d - investigate and harden imported scene identity invariants
(duplicate track ids, duplicate tracks per part, duplicate keyframe ids,
duplicate mask ids), test-first, isolated worktree, ONE PR, no merges.

## Confirmed findings (all re-read first-hand at 0ec6ce2)

1. **Duplicate track ids (JSON) are inert - hypothesis disproven.** The apply
   path ignores the JSON `track.id` field entirely and derives
   `id: track_${partId}` (`useSerialization.ts:285`). Two tracks carrying the
   same JSON id import into distinct, correct state. Refusing them would
   reject documents nothing breaks on, so the matrix pins them as ACCEPTED.
2. **Two tracks naming one layer is a real defect (HIGH).** The evaluator
   addresses tracks by `partId` with a first-match `find`
   (`evaluateFrame.ts:108`), gizmo/inspector/outliner/timeline all read
   `tracks.find(partId===)`; a second track for the same layer is never
   evaluated, never selected, never edited - silent animation loss - and the
   two derived state ids collide for `SequencerTimeline.tsx:206` and React
   keys. The editor keeps one track per layer and cannot export the shape, so
   no legitimate document is invalidated.
3. **Keyframe ids repeated inside one track are a real defect (MEDIUM).**
   `locateKeyframe` (`trackMutations.ts:359`) resolves a keyframe by id across
   ALL stores of one track (legacy composite first, then channels, mask
   channels, mask path channels). A repeated id inside a track - same channel
   or different stores - makes every marquee/inspector/temporal-graph edit
   address the first holder. Ids shared between different tracks stay
   unambiguous and accepted.
4. **Mask ids repeated inside one layer are a real defect (MEDIUM).**
   `evaluateLayerMasks.ts` dereferences `${mask.id}:<prop>` channel keys and
   `layerMaskId(partId, mask.id)` SVG def ids; two masks of one layer sharing
   an id share their animated data and collide their defs. The same id across
   different layers stays accepted (the DOM id is namespaced by part).
5. **Missing optional ids keep their documented acceptance.** Validation never
   required keyframe ids, mask ids or JSON track ids; making them required
   would invalidate third-party files whose behavior cannot be proven safe.
   Normalization (generate-on-apply) is the open **C11** product decision -
   deliberately NOT introduced here. Only duplicates of PRESENT string ids
   refuse.
6. **Prototype-sensitive ids carry no new risk.** Keyframe/mask ids are
   compared or composed into prefixed strings, never used as bare object-index
   keys; object-key `__proto__`/`constructor` hazards remain covered by the
   pre-existing global `PROTOTYPE_KEYS` scan that runs before any semantic
   pass.

## Policy implemented (boundary-level, both routes, refuse-don't-repair)

| Invariant | Scope | Code | Path of the refusal row |
|---|---|---|---|
| one track per layer (canonical `partId` or legacy `layerId` alias) | document | `KCS_IMPORT_DUPLICATE_TRACK_TARGET` | `$.tracks[i].partId` |
| keyframe ids unique across all stores of one track | track | `KCS_IMPORT_DUPLICATE_KEYFRAME_ID` | `$.tracks[i].<store>[n].id` |
| mask ids unique inside one layer | layer | `KCS_IMPORT_DUPLICATE_MASK_ID` | `$.layers[i].masks[n].id` / `$.characterParts[i].masks[n].id` |

Store scan order matches `locateKeyframe` (legacy, channels, maskChannels,
maskPathChannels) so the first refusal names exactly the holder the UI would
have edited. Scene and legacy routes share `trackProblem` and
`sharedLayerValueProblem`, so one rule set covers both. Reuse-only diff: no
schema change, no rekeying, no repair, no UI/timeline/autosave/interpolation
touch.

## Changed files

- `src/utils/importValidation.ts` - `keyframeIdProblem` helper; per-track
  id register threaded into the three store checks (legacy store now scanned
  first, matching locate precedence); `trackProblem` takes the document-wide
  part-target register and refuses a second track for one layer BEFORE walking
  its stores; `masksProblem` carries the per-layer mask-id register.
- `src/tests/importValidation.test.ts` - +13 rows: the refusal matrix (track
  target incl. `layerId` alias, precedence over inner collisions, same-channel
  / cross-channel / legacy-vs-channel keyframe dupes, mask-channel and
  mask-path dupes, same-layer mask dupes, legacy-route mirrors of all three
  classes, exactly-one-error precedence) and the compat pins (cross-track
  reuse, distinct-id document, duplicated JSON track-id fields, every missing
  optional id shape).
- `src/tests/n3ImportApplyGuard.test.tsx` - T13: an id-integrity refusal fires
  zero state setters, zero baseline requests, and leaves state object-identical.
- `reports/progress_183_n3_structural_id_integrity_2d.md` (this file),
  `reports/README.md` index row.

## Test-first evidence

RED (before the production change): all 10 refusal rows (13 refusal
assertions) and T13 failed (codes `undefined`, T13 applied the whole tampered
document); all accept rows passed - the one initial accept-row failure was a
fixture bug (a track without `partId` is refused by the PRE-EXISTING `:514`
rule, which is correct), fixed by giving the fixture a `partId`. GREEN after:
focused 86/86.

## Validation ledger (final tree state)

- Full vitest: **179 files / 2723 tests passed** (+14).
- lint (`oxlint`): 0 errors; `tsc --noEmit` clean; production build clean
  (948 ms); `npm run validate:ograf` clean; `git diff --check` clean.
- State consistency: the refusal path provably never reaches `fromSceneData`
  (T13 reuses the PR-1 zero-setter harness for the new refusal class); export
  surface unchanged because only production behavior ADDED is boundary refusal
  - `ograf*`, `integration`, `useSerialization`, `importDispatch` suites green
  unmodified.
- Targeted Chromium (import surface, isolated release-gate port 5189):
  `stage-json-drop-boundary`, `m26-copy-paste-animation`, `v51-recovery`,
  `history-restore` - 12/12.
- Full Chromium on the branch: **439 passed (8.1 min)**; two rows flaked under
  workers-2 contention and passed on their run's own retry - the
  `history-restore` explicit-import transaction is the same environment flake
  documented in progress_181.
- PR CI green at exact head `30d9802`.
- E2E seed audit: every `tracks: [...]` literal in `e2e/` scanned
  programmatically - no seed carries a now-refused shape.
- Scope disjoint from #19-#22 (PR file lists verified: HeaderBar/usePresets/
  fileAdmission/ograf parity test files; zero overlap). #19-#22 branches,
  worktrees and PRs untouched.
- Protected surfaces untouched: canonical main checkout (`0ec6ce2`, the one
  untracked user file `EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md` left as-is),
  UI 5173, API 5000, 4312 never started, all other `.worktrees/`,
  `.research/`, `chatgpt_handoff/`, backups, Desktop KCS/QA folders.

## Compatibility decisions left open (reported, not implemented)

- **C11 id hygiene**: missing keyframe/mask ids import today and produce
  `undefined` React keys / `conv_undefined_<ch>` derived ids on legacy
  conversion. Normalizing (generate-at-apply) is the right fix but changes
  stored documents on import - needs its own decision + PR.
- Orphan tracks (partId with no layer) remain accepted: the evaluator loops
  layers, so dead tracks are harmless; refusing them would age-document a
  possible legacy delete bug's files.
- Duplicate keyframe FRAME values remain accepted everywhere (authored
  semantics, unchanged); only duplicate frame checks were deliberately NOT
  touched (out of authorization).

## Handoff

No merge, no release, no tag, no branch cleanup. PR #23 waits for review like
#19-#22 (OpenCode is reviewing #19-#22 in parallel; #23 is additive to that
queue). Revert lever: the three refusal checks are self-contained in
`importValidation.ts`.
