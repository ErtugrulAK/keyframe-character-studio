# WP-05 checkpoint — Stable layer ordinal

Decision D-09 applied: the ordinal is a transient, derived authored rank; no zIndex renumbering on
delete; IDs, tracks and relationships never change for a number.

## What changed

| File | Reason |
|---|---|
| `src/utils/layerOrdinal.ts` (new) | `projectLayerOrdinals(parts)`: 1-based rank over the Outliner's own layout (authored array order, containers then children depth-first; groups and Boolean operands included; missing parent → root; cycle-safe). Pure; nothing written. |
| `src/components/Inspector/OutlinerPanel.tsx` | Ordinal badge + `data-layer-ordinal` per row ("a display number, not an ID" in the tooltip). |
| `src/components/Timeline/SequencerTimeline.tsx`, `TrackOutlinerRow.tsx` | Same projection, same badge on the timeline layer rows. |
| `src/index.css` | `.layer-ordinal` style (tabular numerals). |
| Tests | `src/tests/wp05LayerOrdinal.test.ts`, `e2e/wp05-layer-ordinal.spec.ts`; evidence `qa/evidence/wp05-layer-ordinal.evidence.ts`. |

## Evidence

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/tests/wp05LayerOrdinal.test.ts` | 0 | 4 tests (A..E → delete C → 1..4 with zIndex gap kept; F fresh; groups/Boolean depth-first; cycle/missing parent; purity) |
| `npx vitest run src/tests/outlinerPanel.test.tsx src/tests/k3MaskOutlinerRows.test.tsx src/tests/wp05LayerOrdinal.test.ts` | 0 | 3 files, 38 tests |
| `npx playwright test -c playwright.isolated.config.ts --project=e2e wp05` | 0 | 1 passed: Outliner and Timeline both 1..5 → delete C → 1..4 (IDs and zIndex `[5,4,2,1]` unchanged, no "ordinal" in the saved JSON) → Outliner drag reorder (B below D; E's Track Matte still `b`) → 2× Undo → A..E with C's own id → reload → same numbers |
| `npx playwright test ... --project=evidence wp05` | 0 | `evidence/wp05/01_five_layers.png`, `02_deleted_c_renumbered.png`, `03_b_reordered_below_d.png` |

## Notes

- The Timeline lists tracks in the tracks array order; for a flat scene it matches the Outliner.
  In a nested scene a timeline row shows the SAME ordinal as its Outliner row (the identity of the
  number is shared), even if the two panels order nested rows differently. No order was changed to
  hide that difference.
- Arrange commands (Bring Forward/Send Backward) were not added; reordering stays on the existing
  `reorderParts` authority (Outliner drag).

IMPLEMENTED: YES
TESTED: PASS
USER ACCEPTED: PENDING
MERGED: NO
