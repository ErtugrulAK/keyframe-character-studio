# C2 follow-up — scope map (request → implementation → evidence → remaining gap)

Session: 2026-10-22 (Claude Code continuation). Worktree `C:\Users\ertugrul.ak\Desktop\kcs-master-implementation`,
branch `feature/motion/kcs-master-implementation`, HEAD `39f6414`, nothing committed.

Sources mapped: Master Review package (`KCS_ASTRA_RESEARCH/KCS_MASTER_REVIEW/00, 03, 11, 14`), WP
checkpoints `00…08`, C2 reports `00…03`, `SESSION_HANDOFF_FOR_CLAUDE_CODE.md`, and the seven follow-up
items the user gave in this session (F1…F7).

Evidence limit: the original C2 request text (the "§10 / §14 / §16 / §17" sections the C2 reports cite)
is NOT on disk; only the reports' paraphrases exist. Rows that depend on that text are marked
`UNVERIFIED (request text not available)`. Nothing below is counted as done because a report said so;
"evidence" names a test, log or screenshot that exists in the worktree.

Status vocabulary: IMPLEMENTED / TESTED / BROWSER VERIFIED / USER ACCEPTED: PENDING / MERGED: NO.
USER ACCEPTED is PENDING for every row. WP-08 and the Sprint 1 integration are NOT part of this work.

## A. Master Review packages (WP-01 … WP-08)

| Request | Current implementation | Test / visual evidence | Remaining gap |
|---|---|---|---|
| WP-01 mask authoring scope (active sequence, between-key scalar, ID collision) | `trackMutations` authoring mutators, `layerMasks` helpers, `usePartPropertyAuthoring`, `useTimeline.authorMaskPath` | `src/tests/wp01*`, `qa/evidence/wp01-mask-authoring.evidence.ts`, report 02 | Lock (`track.locked`, `LayerMask.locked`) not enforced by any authoring path — product decision open |
| WP-02 edit an existing mask on canvas | `maskPathEditing`, `useMaskEditing`, `MaskPathOverlay` | `e2e/wp02*`, evidence wp02, report 03 | roving tabindex over canvas points not built (numeric editor + `]`/`[` + arrows are the keyboard path) |
| WP-03 create Circle/Rectangle/Pen mask, path rotate/scale | `maskPathCreation`, `MaskDrawOverlay`, Inspector commands | `e2e/wp03*`, report 04 | open/close toggle + vertex reorder not offered; no free-transform box (fixed-step commands) |
| WP-04 one Track Matte surface, source/target navigation | `matteRelationship`, `useMatteNavigation`, `TrackMatteSummary` | `e2e/wp04*`, `m22-matte-relationship`, report 05 | pick-whip / drag source assignment not in scope; D-04 (`sourceVisible` default) not applied |
| WP-05 display ordinals | `layerOrdinal` | `e2e/wp05*`, report 06 | none known |
| WP-06 tool/focus and narrow layout | CSS/layout, keyboard nudge, `resolveOutlinerHeight` | wp06 before/after screenshots, report 07 | real 200 % browser zoom never run (see F5) |
| WP-07 OGraf capability surface | `ograf/capabilityReport`, `OGrafCapabilityDialog` | `e2e/wp07*`, report 08 | TESTED: PARTIAL in report 08 (one racy pre-existing E2E) |
| WP-08 masked color correction | NOT implemented (out of scope, two-gate decision) | — | entirely open; not claimed |

## B. C2 continuation slices (reported in C2 00–03)

| Request (paraphrased from C2 reports) | Current implementation | Test / visual evidence | Remaining gap |
|---|---|---|---|
| Draw over an image; the tool must win | capture-phase ownership in `StageCanvas` | `e2e/c2-tool-ownership-draft-undo.spec.ts` (fails on base, passes here) | armed shape tool yields to the selection's handles (H fix) — F3 |
| Pen draft Undo/Redo, close on first point, Finish/Cancel | `registerDraftHistory`, `useFreeformDraw`, `MaskDrawOverlay` | `c2DraftHistoryOwnership.test.tsx`, `c2-mask-pen-close.spec.ts` | none known |
| Mask path editing ergonomics | `BezierPathEditor` rewrite | `c2-mask-point-type.spec.ts`, `BezierPathEditor.test.tsx` | — |
| "Canvas jumps" on show/hide | backdrop anchored to camera | `c2-stage-backdrop-anchor.spec.ts`, toggle probe (0 px content movement) | — |
| Performance | memoized `OutlinerRow`, memo'd shell surfaces | `evidence/c2-perf/*` (prod + attribution) | heavy-scene playback not solved — F6 |
| Layer tree rename/parent/reorder | `layerParenting`, `useLayerParenting`, `OutlinerRow`, `LayerParentField` | `c2LayerParenting.test.ts`, `c2-layer-tree.spec.ts` | animated reparent refused, not re-based; delete of non-group parent — F2 |
| Delete with matte dependents | `matteDependentsOfDeletion`, `DeleteDependentsDialog` | `m22` E2E-2/8, `wp04MatteNavigation` | — |
| Keyboard / shortcut reference / toolbar / right-click | `shortcuts.ts` scopes, aria-keyshortcuts, right-press pan vs menu | `keyboard-shortcuts`, `c2-right-click-pan.spec.ts` | toolbar visual grouping/icon consistency NOT done — F7 |
| UI library evaluation (§14) | report `02_UI_LIBRARY_EVALUATION.md`, nothing installed | — | UNVERIFIED (request text not available) |
| Edit ⇄ Broadcast keeps working state | `useRetainedUiState` (tree rows, split) | `c2-mode-transition.spec.ts` | Inspector card disclosure lost — F4 |
| Acceptance scenario (§17) | `qa/evidence/c2-acceptance.evidence.ts` | 3/3 variants, screenshots | "200 %" variant is a DPR-2 viewport, not browser zoom — F5 |
| Full regression | — | Vitest 3 061 PASS; full E2E: see §D | — |

## C. Follow-up items given in this session

| # | Request | Current state (verified in source) | Evidence so far | Remaining gap / proposal |
|---|---|---|---|---|
| F1 | Exact full E2E result | run in progress at session start | `logs/c2_e2e_full.log` | see §D |
| F2 | Non-group parent delete leaves children on a deleted parent | `deleteParts` only cascades Boolean operands and `isGroup` children; a plain parent's children keep `parentId` → `evaluateTransform` finds no parent and falls back to the child's LOCAL pose, so they jump on screen | source: `utils/partDeletion.ts:19-44`, `utils/evaluateTransform.ts:85-90` | plan in §E.1 (needs approval: deletion contract, high-risk evaluation chain) |
| F3 | Drawing tool vs selection handles | armed Rectangle/Circle EXCLUDES the transform gizmo from tool ownership (`StageCanvas.tsx:1321`), so a press on any handle of the current selection (e.g. a full-canvas image's corner) resizes instead of drawing; Pen does not have this exclusion | source; the H-fix was made to satisfy `canvas-interaction-v1.spec.ts:95`, which never switches to Select | plan in §E.2 (needs approval: changes a base interaction contract) |
| F4 | Inspector card open/closed lost on Edit → Broadcast → Edit | `StyleCard` keeps disclosure in `useState`; 15 cards, titles not unique ("APPEARANCE" ×3) | source | plan in §E.3 |
| F5 | Real 200 % browser zoom | never run; only 720×450@DPR2 viewport | — | measured separately, §D |
| F6 | Heavy-scene smoothness | prior report named `PartRenderer` as the remaining bound; the existing dev attribution actually ranks `TrackOutlinerRow` (209 ms / 2 s), `StagePartLayers` 108, `PartRenderer` 106, `TrackLane` 91, `SequencerTimeline` 89, and a per-frame eager crop-bounds scan (`createStageCropActions` ~45 ms) | `evidence/c2-perf/attr-worktree-post/attribution.json` | production re-measurement, §D |
| F7 | Toolbar grouping, icons, shortcut menu, Template Elements / mask / matte visuals | C2 only added `aria-keyshortcuts` and a tooltip fix; no visual design pass was done | — | before/after visual review, §D |

## D. Results of this session

(filled in below as each item completes)

## E. Proposed solution plans (NOT implemented; each needs explicit approval)

### E.1 — F2: deleting a non-group parent keeps its children in place

Current contract: `collectOwnedDeletionIds` cascades only Boolean operands and `isGroup` children.
A plain parent's surviving children keep a dangling `parentId`; `evaluateTransform` then skips the
parent composition and the children jump to their LOCAL pose. Saved scenes carry the dangling id;
`validateScene` only checks cycles.

Existing authority to reuse: `dissolveLayerGroup` (`utils/layerGrouping.ts`) already removes a
container while keeping every child's evaluated world pose at EVERY frame: affine fold when the
container is static and unrotated (keys keep their times/easing), sampled per-frame bake otherwise
(recorded in `bakeNotes`), anchored-child refusal for an animated container. Deleting a plain parent
is the same operation: "the children move up to the deleted layer's parent, carrying its motion".

Proposal:
1. Pure helper (utils): `releaseChildrenOfDeletedParents(parts, tracks, deletedIds)` — for each
   deleted non-group, non-Boolean layer that has SURVIVING children, run the dissolve math with the
   `isGroup` precondition lifted (deepest deleted parent first, so a chain of deleted parents folds
   into the nearest surviving ancestor). Returns parts/tracks/notes or a refusal reason
   (`ungroupBlockReason` anchor case).
2. `useTimeline.deletePart`: apply the release, then the unchanged `deleteParts`, in the same
   state transaction → still ONE undo step; Undo restores parent, children, parentIds and tracks.
3. UI: no new dialog by default; a status toast names how many child layers kept their place and,
   when a bake happened, that their motion was baked. A refusal (anchored child of an animated
   parent) blocks the delete with the reason — no partial delete.
4. Tests: unit (static parent, rotated/scaled parent, animated parent → world pose equal at sampled
   frames for every sequence, chain of two deleted parents, Boolean/group paths unchanged, refusal),
   history (one undo/redo restores JSON exactly), E2E (delete parent in the tree, child stays at the
   same screen box, Undo).
Affected: edit evaluation (child poses), timeline (child tracks may gain baked keys), history,
serialization (no schema change; dangling ids no longer produced). Playback/broadcast/renderer/matte:
no change. Alternative (smaller, weaker): keep dangling ids but compose nothing — that is today's
jump. Alternative (After-Effects-like dialog "Delete children too / Keep children"): can be layered
on top later; not needed for safety.

### E.2 — F3: an armed drawing tool owns every stage press

Current contract: Pen owns all presses; an armed Rectangle/Circle yields to the transform gizmo
(C2-H fix), so its handles — including those of a large, previously selected image — resize instead
of draw. The fix was made to keep `canvas-interaction-v1.spec.ts:95` green; that test draws a
rectangle and then resizes it WITHOUT leaving the tool. The Master Review spec (`03_SELECTION_TOOLS`)
models drawing as a state (`ShapeDraw → LayerIdle: explicit exit`).

Proposal (consistent with Pen and the spec):
1. While Rectangle/Circle is armed or Pen is active, the tool owns every primary press on the stage
   (remove the gizmo exception). The selection gizmo is still drawn, but passive and dimmed
   (`pointer-events: none`) so the user sees what is selected without it being grabbable.
2. Resizing needs Select: `V`, `Esc` or the Select button (all existing). The "stays armed for
   consecutive shapes" contract (`interactive-shape-creation-v1`) is kept.
3. Test changes: `canvas-interaction-v1.spec.ts:95` gets an explicit Select step (press `V`) before
   the handle drag — its assertion (the transform changes through the existing pipeline) stays;
   new E2E: armed Rectangle over a selected full-canvas image, drag starting ON a corner handle →
   a new rectangle, image box unchanged.
Alternative B (not recommended): after placing a shape, return to Select automatically (Figma
style) — this breaks the consecutive-shapes contract. Alternative C: keep handles active — conflicts
with the stated expectation.

### E.3 — F4: Inspector card disclosure survives Edit → Broadcast → Edit

Proposal: an optional `retainKey` prop on `StyleCard`, backed by the existing `useRetainedUiState`
(session-only, not scene, not history). Keys are explicit and unique per card kind
(`inspector:transform`, `inspector:appearance:shape`, `inspector:appearance:text`, `inspector:track-matte`
…) — titles are not unique, so the title is not the key. Cards without `retainKey` keep today's
per-mount behaviour. The previous session reports that retaining every card broke nine per-mount
tests; which tests and why is not recorded (UNVERIFIED) and must be reproduced before this change. Open product question: should a card's open state also carry over when the user selects a
different layer of the same kind (it does in most pro tools)? With session keys per card kind it
will — this must be confirmed.
