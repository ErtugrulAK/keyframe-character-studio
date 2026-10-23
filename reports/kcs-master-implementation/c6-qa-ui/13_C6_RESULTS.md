# C6 — manual QA round 1 follow-up: results

Worktree `kcs-master-implementation`, branch `feature/motion/kcs-master-implementation` (no upstream).
Commits were approved for this branch only; main and Sprint 1 are untouched (main `39f6414`,
22 status entries; Sprint 1 `39f6414`, 19 entries). Nothing merged or pushed. USER ACCEPTED:
**PENDING** (yours).

## 1. What changed

| # | Request | Result | Commit |
|---|---|---|---|
| 1 | Autosave + header | Root cause: the 10 s interval depended on `performSave`, which every edit re-created — each edit restarted the countdown, so a user who kept editing was never saved while "Ns ago" kept climbing. Now: one stable 1 s check; the save is due 10 s after the FIRST unsaved change; idle/undone-back sessions write nothing; the badge says Unsaved changes / Saving… / Save failed / Autosave paused / Just saved / Saved 12s ago (since the last SUCCESSFUL save; clock time in the tooltip). The status text has a fixed 15ch box with tabular digits. | `d2beb7e` |
| 2 | Pen click vs drag | Click = corner; press-drag = ONE smooth point whose tangent follows the mouse; no point rain; release ends the point; first point closes; Finish/double-click/Enter kept; point + its tangent = one draft undo step; finished shape = one scene step. Same rules for the mask Pen. Freehand sampling was removed (not hidden in the Pen); it can return as a separate tool. | `e6fc79e` |
| 3 | Rectangle → editable path | Inspector "Shape geometry › Convert to editable path" (and context menu). Same id/order/parent/children/mask/Track Matte; transform, fill, stroke kept — **0 differing pixels** after conversion (the check fails with round joins). Canvas: drag points (with handles), double-click the outline to add a point (curve kept), double-click a point for Corner/Smooth, Delete removes a point; Inspector "Path points" editor shares the selection. Undo/redo per step; save/reload keeps the path. Refused with a reason: banner/card, Boolean structures, Trim Path / stroke reveal. | `60ce860`, `d3ab600` |
| 4 | Sidebar hide/show | Frame-by-frame (controlled clock) showed a SECOND, CSS-driven animation after the JS slide: a fade + 12 px nudge on settle, the left dock fading while sliding (`!important` beat the inline `transition: none`) and its 56 px rail flashing back at the edge; opening ended with a second ~56 px slide; the edge handles ran their own lagging transition. Now one slide, handles ride the edge, nothing moves after settling; camera/selected object unmoved; reversal and rapid clicks clean; hidden dock inert; reduced motion snaps. | `af8f361` |
| 5 | Colour correction (WP-08, option B) | Images: brightness, contrast, saturation, amount; enable, reset, remove; whole layer or one mask; effect-only masks (`affectsAlpha: false`) drawn on the canvas; a missing/disabled mask = not applied + reason; outside/alpha preserved. v3 only when the feature is used, v2 otherwise; reader 1–3; old build refuses v3 (checked). Edit = Broadcast = GIF pixels; OGraf blocked with a reason. Animation transfer leaves effects untouched. | `7fbac16` |
| 6 | Element / Parent area | Plain kind ("Rectangle", "Path", "Group"…), long names contained; one aligned Parent row (Groups/Layers separated, remove action) + one sentence: group membership vs transform parent; matte not shown there. | `e26e374` |
| 7 | Track Matte vs legacy | Track Matte first with an explanation and On/Off badge. Legacy clip matte kept, never converted: unused → quiet "Advanced" card; used → "In use" or "Kept · not applied" while a Track Matte is on (renderer rule). Its Remove no longer says "Remove Track Matte". | `e26e374` |

Accumulated C1–C5 work was split into 12 commits (`961f414` … `ec3dc4f`) before this round; each
commit was type-checked, linted and unit-tested on its own (scratch checkout of exactly that
commit's tree).

## 2. Limits

- **Freehand drawing** is gone from the Pen (by request); no separate Pencil tool was added.
- **Basic shapes → path**: exact for rectangles without rounding and polygons; rounded corners,
  capsule and ellipse become standard cubic arcs (≤ 0.03 % of the radius). Converted shapes save a
  new optional `strokeLinejoin: 'miter'`; a build before C6 ignores it and draws round stroke
  corners (no data loss, scene version unchanged).
- **Colour correction**: images only; one correction per layer; parameters are not animatable yet;
  OGraf export is blocked while a correction or an effect-only mask exists (GIF renders them).
- **Slider undo**: while keyboard focus stays on an Inspector field, Ctrl+Z belongs to the field
  (editor-wide rule); use the toolbar Undo or click elsewhere first.
- **Rollback of the QA build**: a build before C6 cannot open a v3 autosave; it starts empty, and
  an edit there would autosave over the v3 data. Export the project before switching back.
- The Inspector "Path points" editor's open-path tooltip still uses mask wording.

## 3. Validation (after the last source change)

| Gate | Result | Log |
|---|---|---|
| `npx tsc -b` | exit 0 | `logs/c6_tsc.log` |
| `npm run lint` | exit 0; 1 pre-existing warning | `logs/c6_lint.log` |
| `npm run build` | exit 0 | `logs/c6_build.log` |
| `npx vitest run` | 227 files, 3 186 tests passed | `logs/c6_vitest_full.log` |
| full E2E (isolated port 5196) | E2E_RESULT | `logs/c6_e2e_full.log` |

New tests: `c6AutosaveTiming`, `c6PenDraw`, `c6ShapeToPath`, `c6FreeformPathEditing`,
`c6ColorCorrection`; e2e `c6-autosave-header`, `c6-pen-click-drag`, `c6-rectangle-to-path`,
`c6-dock-visual-continuity`, `c6-inspector-relations`, `c6-color-correction`.
Contract updates (no assertion weakened): `c2-tool-ownership-draft-undo` ("a drag adds many
samples" → "a drag adds one smooth point, one undo removes it"), `importValidation` (unknown
version example 3 → 4).

Evidence: `evidence/c6-inspector/before-*|after-*` (Details header, Parent row, matte cards).
