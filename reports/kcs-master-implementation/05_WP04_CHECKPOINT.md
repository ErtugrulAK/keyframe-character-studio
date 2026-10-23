# WP-04 checkpoint — Track Matte target/source navigation

Decisions held: D-04 not applied (new relationships keep the current `sourceVisible` default; the
any-false aggregation is unchanged). Legacy and V2 data are read, never migrated or deleted.

## What changed

| File | Reason |
|---|---|
| `src/utils/matteRelationship.ts` (new) | `resolveEffectiveMatteRelationship` / `matteTargetsOfSource`: one product-language reading built ONLY from `resolveMatteSource` (V2-over-legacy precedence) and `suppressedMatteSourceIds` (aggregation). Missing vs self distinguished; other targets that hide a shared source listed; shadowed legacy flagged. |
| `src/hooks/useMatteNavigation.ts` (new) | Transient "Select Source" / "Back to Target" trail; selection-only, dropped when the source stops being the selection or the target disappears; never redirected. |
| `src/context/AnimatorContext.tsx` | Thin wiring of the trail. |
| `src/components/Inspector/sections/style/TrackMatteSummary.tsx` (new) + `StyleMatteSection.tsx`, `StyleTab.tsx`, `DetailsPanel.tsx` | Summary above the matte settings: source name · mode · inverted · legacy badge; Select Source; "Used as the matte of …" with Back to <target> / Select <target>; missing-source and self warnings; shared-visibility conflict ("Show source is on, but … hidden by …"); "Legacy clip matte settings are preserved but inactive". Card titles lose version terms: `TRACK MATTE V2` → `TRACK MATTE`, `MASK / TRACK MATTE` → `LEGACY CLIP MATTE` (all controls kept). |
| `src/components/Canvas/SelectionGizmo.tsx` | A selected HIDDEN matte source gets the edit-only move area (`data-hidden-matte-source`) — it is not painted, so it had nothing to press; its visibility is never written. |
| `src/components/Inspector/PropertyInspector.css` | Summary styles. |
| Tests | `src/tests/wp04MatteRelationship.test.ts`, `src/tests/wp04MatteNavigation.test.tsx`, `e2e/wp04-matte-navigation.spec.ts`; selector updates for the renamed cards in `k5MatteVisibility.test.tsx`, `styleMatteSection.test.tsx`, `e2e/m22-matte-relationship.spec.ts`, `e2e/track-matte.spec.ts`, `e2e/m21-image-matte.spec.ts` (selectors only; no assertion changed). |

## Evidence

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/tests/wp04MatteRelationship.test.ts` | 0 | 5 tests |
| `npx vitest run src/tests/styleMatteSection.test.tsx src/tests/k5MatteVisibility.test.tsx src/tests/outlinerPanel.test.tsx src/tests/matte.test.ts src/tests/wp04MatteRelationship.test.ts` | 0 | 5 files, 335 tests |
| `npx vitest run src/tests/wp04MatteNavigation.test.tsx` | 0 | 3 tests (first run failed on MY fixture's array-order assumption, fixed in the test by name lookup) |
| `npx playwright test -c playwright.isolated.config.ts --project=e2e wp04` | 0 | 1 passed (hidden source selected, moved by real pointer: source x changes, target x/y/trackMatte/track unchanged, matte mask geometry changes; Back; conflict; delete → missing (reference kept) → Undo) |
| `npx playwright test -c playwright.isolated.config.ts --project=e2e m22-matte-relationship track-matte k5-matte-visibility m21-image-matte` | 1 → fixed | 118 passed, 1 failed: V-M20 used a regex for the old card title; selector updated, re-run PASS |
| `npx playwright test ... --project=evidence wp04` | 0 | screenshots `evidence/wp04/01…07` |

## Not done / limits

- Pre-delete confirmation listing affected targets (spec suggestion) is not added; delete keeps the
  existing behaviour, the target shows "missing", and Undo restores the same ID (tested).
- Pick-whip / drag-and-drop source assignment: not in scope (list selection stays).
- Nested/multi/video matte: unchanged, not claimed.

IMPLEMENTED: YES
TESTED: PASS (unit, integration, real-browser E2E, related matte E2E suites after the rename)
USER ACCEPTED: PENDING
MERGED: NO
