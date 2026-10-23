# C4 — progress and handoff (live document)

Worktree `kcs-master-implementation`, branch `feature/motion/kcs-master-implementation`, HEAD `39f6414`,
nothing committed/staged/merged/pushed. USER ACCEPTED: PENDING for every item. Baseline of the
pre-C4 working tree: scratchpad `c4/baseline-status.txt` + `baseline-hashes.txt` (415 entries).

## Done (implemented + focused tests green)

| # | Item | What | Tests |
|---|---|---|---|
| 1 | Edit ⇄ Broadcast | Measured cause: the edit chrome mounted ~11 400 DOM elements on the 150-layer scene (layer tree 4 000, timeline rows 4 650, lanes 1 050) — render+DOM build ≈108 ms, forced layout ≈44 ms; evaluation 2 ms. Fix: row windowing for long lists (≥ 60 rows; `utils/rowWindow.ts`, `hooks/useRowWindow.ts`) in the Inspector tree and both timeline columns (shared spacers, measured track heights, pinned focused/renamed/dragged/selected rows), list scroll positions retained across the round trip (`useRetainedScrollTop`). Also found and fixed: Broadcast passed every editor shortcut (Delete deleted the selected layer, Ctrl+Z, paste…) to the hidden editor — now only the shortcut reference. | unit `c4RowWindow`, `useKeyboardShortcuts` (+1); E2E `c4-long-lists` (6) |
| 2 | Panel toggle | With a clean harness (clicks by coordinates, no role/name locator inside measured frames) the C3 "83–117 ms frame" was MEASUREMENT ARTEFACT: Playwright's `getByRole(name)` computed accessible names over the 12 000-element DOM in the page (8 clicks: 514 ms `getTextAlternativeInternal`). Base and current: p95 16.7–16.8, max 16.8 ms, 0 frames > 50 ms. Resize while sliding: contract tested (resize applies to the stage box current at that moment). | E2E `c4-dock-slide` (2) |
| 4 | Locks | Layer lock enforced on the write path (guarded setters in `AnimatorContext`, `utils/layerLocks.ts`) + pre-flight refusal for compound ops (group/ungroup, reparent/drop, arrange, delete incl. released children, rename, reorder, canvas drag/rotate/scale). Canvas does not pick locked layers; marquee and Select All skip them; list selection + Inspector inspection (banner, Unlock, read-only controls via `useLockedRegion`); Ctrl+L / Ctrl+Shift+L; tree lock switch. Mask lock: "Lock path" control, path + path transform + path keyframes protected. | unit `c4LayerLocks` (13); E2E `c4-locks` (6) |
| 5 | Mask open/close + point order | `utils/maskPathOrder.ts`: close/open, reverse direction, make first point, move earlier/later — id-level edits applied to the static path AND every keyframe (one undo step, `applyMaskPathOrder`). Open mask keeps the existing SVG fill contract (implied straight closing edge, now drawn dotted on the canvas and explained in the Inspector). | unit `c4MaskPathOrder` (8), `BezierPathEditor` (+3); E2E `c4-mask-path-order` (3) |
| 6 | Mask point keyboard focus | Point list = one roving Tab stop (`listbox`/`option`, names "Point n of N, corner/smooth, first point"), focus follows selection, Home/End, C = Corner/Smooth, Delete hands focus to the neighbour, Esc returns focus to "Edit on Canvas", visible focus ring, keyboard entry focuses the points. | E2E `c4-mask-keyboard` (3) |

Perf series (5 runs × 5 rounds, same build/machine, `scratchpad/c4/perf-series.sh`, summary
`evidence/c4-mode/series-summary.json`): Broadcast → Edit long tasks 25/25 switches 166–177 ms →
2/25 switches 53 ms (max frame 167–183 → 33–50 ms, p95 16.8). Target "no long task" NOT fully met
(2 of 25).

| 3 | Narrow/short layout | header one row (actions no longer wrap) + compact 48 px header only when height ≤ 820; timeline OPENS at 320 (≥ 860 px tall) / 34 % of a shorter window / collapsed below 520 (session-retained height, collapse, column width — the user's choice wins after the first mount, also across Broadcast); Outliner split no longer permanently lowered (render-time cap), Details min 140; ≤ 860 px Boolean / Crop / View fold into menus (on/off as menuitemcheckbox, trigger shows active). Metrics `evidence/c4-layout/{before,step6}`: 1024×768 stage 424×329 → 424×419, rows 3 → 6; real 200 % stage 462×135 → 462×276, toolbar hidden 115 → 0 px; 768 toolbar 59 → 0 px; 1440×900 unchanged. 200 %: still 3 full layer rows (sidebar 276 px). | E2E `c4-narrow-layout` (4); updated `timeline-workspace`, `camera-invariance`, `camera-transition-stability`, `c3-narrow-start` to the opening rule |
| 7 | Track Matte pick-whip | `TrackMattePickWhip` (drag to tree row / timeline row / canvas layer; valid/invalid marking + reason; Esc/empty/refused = no write; Enter → source list), verdict via `validateCritical` (`utils/trackMattePick.ts`); writes `target.trackMatte` (see decision below) | unit `c4TrackMattePick` (5); E2E `c4-track-matte-pick-whip` (3) |
| 8 | Re-parent animated layers | `rebaseLayerOntoParent` (layerGrouping): base + per-sequence bake via the ungroup ladder, verified at key frames + gap mid-frames + rest scope; refusal on skew; confirmation dialog (keys before→after, per-frame) before adding keys; fixed a shared bake bug (re-easing never re-measured → needless per-frame bakes). Fractional deviation (project units, ¼-frame sampling): ball→rotating wheel 0.51; static child out of moving+rotating parent 0.19; static/translating parents 0; integer frames ≤ 1e-13. | unit `c4ReparentAnimated` (10), updated `c2LayerParenting`; E2E `c4-reparent-animated` (1), updated `c2-layer-tree` |
| 9 | WP-08 | STOPPED for schema approval: `09_WP08_DESIGN_PROPOSAL.md`; SVG feasibility spike (plus-lighter graph: alpha error 0.002 vs 0.253 for source-over) | spike `qa/evidence/c4-wp08-spike.evidence.ts` |

Pick-whip field (corrected in C5 — no decision is pending): the current Track Matte relationship is
`targetPart.trackMatte.sourceLayerId` (V6). It is the field the renderer (`StagePartLayers`
`getEffectiveMatte`, which lets an enabled V6 record win over the legacy one), the validator
(`validateCritical`: missing source and cycles), serialization (`useSerialization`, both directions),
navigation (`resolveMatteSource` → Select Source / Back) and the layer-list badge all read; the
pick-whip writes it. `matte.sourcePartId` is the LEGACY clip matte, kept for compatibility. The older
prompt's field name was outdated; the pick-whip stays on the V6 field (unit test
`c5QaUiHelpers` › Track Matte authority). Note: AGENTS.md §11 and the kcs-track-matte skill still
describe `matte.sourcePartId` as canonical — a documentation update to propose with the merge, not
changed here.

## Next

10 Sprint 1 overlay integration · 11 full validation, results table, manual checklist, main
integration plan.
