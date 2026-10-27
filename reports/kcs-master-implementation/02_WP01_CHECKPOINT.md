# WP-01 checkpoint — Mask authoring scope consistency

- Worktree: `C:\Users\ertugrul.ak\Desktop\kcs-master-implementation`
- Branch: `feature/motion/kcs-master-implementation`; base HEAD = current HEAD = `39f6414` (no commits)
- Approval scope: user's session authorization (WP-01..WP-07 inside this worktree only).
- Protected baseline: main and Sprint 1 not written (verified again at final handoff).

## Changed files

| File | Reason |
|---|---|
| `src/utils/trackMutations.ts` | `authorPropertyValueAtFrameMutator`: exact (frame, sequence) key → value-only update; otherwise insert with the sequence's easing. Reuses the existing value/add mutators. |
| `src/utils/layerMasks.ts` | `layerMaskIdsReferencedByTrack`, `nextLayerMaskId` (collision-safe `mask-N`, never renames). |
| `src/hooks/usePartPropertyAuthoring.ts` | Mask scalar edits resolved against the active sequence's evaluated masks; only a changed scalar is written (channel when animated in the active sequence, base otherwise); unchanged scalars and path keep base values. |
| `src/hooks/useTimeline.ts` | `authorMaskPath`: active-sequence scope; exact key updated in place (metadata kept); between keys insert with sequence easing; missing owner / deleted mask no-op. |
| `src/components/Inspector/DetailsPanel.tsx` | Evaluates masks for the active sequence; passes reserved mask IDs. |
| `src/components/Inspector/sections/StyleTab.tsx`, `style/StyleMatteSection.tsx` | `reservedMaskIds` prop; `nextLayerMaskId`; accessible names `Mask feather/opacity/expansion`. |
| `src/tests/wp01MaskAuthoringScope.test.tsx` (new) | Pure, hook and provider+Inspector regressions incl. Undo/Redo. |
| `src/tests/authoringAuthorities.test.tsx` | Exact-key assertion now checks the written document (id/frame/easing kept) instead of an internal call; new no-track test. |

## Evidence

Failing first: with the helpers added but the old wiring, 7 behavioral tests in
`wp01MaskAuthoringScope.test.tsx` failed (C-02 display 5 vs 20; C-03 evaluated value copied to base;
C-04 `['mask-2','mask-2']`; C-05 base edit turned into a key; exact-key metadata lost; deleted mask wrote data).

| Command (cwd = worktree) | Exit | Result |
|---|---|---|
| `npx vitest run src/tests/wp01MaskAuthoringScope.test.tsx src/tests/authoringAuthorities.test.tsx src/tests/maskPathAnimation.test.ts src/tests/layerMaskAnimation.test.ts src/tests/useTimeline.test.ts src/tests/k3MaskOutlinerRows.test.tsx` | 0 | 6 files, 39 tests passed |
| `npx tsc -b --pretty false` | 0 | clean |
| `npm run lint` | 0 | 0 errors; 1 pre-existing warning in untouched `src/tests/k5MatteVisibility.test.tsx` |
| `npx vitest run` (full) | 0 | 200 files, 2994 tests passed (log: `logs/wp01_vitest_full.log`) |
| `npm run build` | 0 | built (pre-existing chunk-size/dynamic-import warnings) |
| `npx vitest run src/tests/authoringAuthorities.test.tsx src/tests/wp01MaskAuthoringScope.test.tsx src/tests/styleMatteSection.test.tsx src/tests/layerMasks.test.ts` (after the no-track test) | 0 | 4 files, 149 tests passed |
| `npx playwright test -c playwright.isolated.config.ts --project=evidence wp01` (cwd `reports/kcs-master-implementation/qa`) | 0 | 1 passed |
| `npx playwright test -c playwright.isolated.config.ts --project=e2e k3-mask-outliner-rows f-mask-matte-workflow k1-property-animation` | 0 | 6 passed |

Browser: Chromium (Playwright), origin `http://127.0.0.1:5196` (frontend only), viewport 1440×900,
synthetic landscape fixture, sequences Sequence/Intro, frames 0/10/20. Inspector value, renderer
feather filter (`stdDeviation × 2`) and saved JSON agree at each step; Undo reverts only the frame-20
edit; Redo re-applies it; Sequence stays 5; base mask feather stays 2; Add mask → `mask-2` next to `m1`.
No console errors or failed requests.

Screenshots: `evidence/wp01/01_sequence_f0_before.png` … `07_sequence_unchanged.png`.

## Decisions / open points

- Lock: `track.locked` / `LayerMask.locked` are not enforced by any current authoring path; WP-01 keeps
  mask Inspector edits consistent with transform edits. Enforcing locks is a separate product decision.
- A new between-key mask path key now uses the sequence's easing (previously the default `easeInOut`),
  matching `updateCurrentPropertyChannel`.

IMPLEMENTED: YES
TESTED: PASS (focused + full Vitest, tsc, lint, build, related E2E, browser task)
USER ACCEPTED: PENDING
MERGED: NO
