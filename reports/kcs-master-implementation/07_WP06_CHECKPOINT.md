# WP-06 checkpoint — Tool/focus and narrow-layout improvements

Decisions held: D-10 (Space playback and current shortcuts unchanged; Escape one level). D-11
(right-click pan vs menu) was NOT changed — it needs its own approval.

## Measured before → after (`qa/evidence/wp06-layout-probe.evidence.ts`, same fixture)

| Viewport | Before (`evidence/wp06/before/*_issues.json`) | After (`evidence/wp06/after/*_issues.json`) |
|---|---|---|
| 1024×720 | Header actions (Reset, Keyboard shortcuts) painted over the toolbar's Crop/Apply crop; timeline transport painted over "Crop to last keyframe"; Details pane ≈ 20 px tall | No covered chrome; timeline actions on a second row; Details usable (E2E asserts ≥ 120 px) |
| 768×720 | Same timeline overlap; Inspector header actions covered by the timeline's collapse control | Resolved; only the toolbar's own horizontal scroll remains (now with an edge affordance) |
| 1280 / 1440 | Only false positives from scrolled panel content | Same |

The probe's "covered" entries for controls scrolled out of their own panel and "offscreen-x" for
the toolbar's scroll region are expected (not page-level clipping).

## Root causes and fixes

| Problem | Root cause (verified) | Fix |
|---|---|---|
| Header icons over the toolbar | `kcsEditorTheme.css` pins the header at 79 px and `nowrap`; `.header-brand` reserved 34 % for two small controls, so actions wrapped to 3 rows and overflowed | ≤ 1100 px: brand `flex: 0 1 auto`; restore-provenance chip truncates its label (full text stays in `title`/accessible name). Header height unchanged. (A first attempt with `flex-shrink: 0` had no effect against the fixed height and was reverted.) |
| Transport over the timing band | header grid `minmax(0,1fr) auto minmax(0,1fr)` let the timing band overflow into the centre column; the 2-row rule started only at 980 px and the theme's fixed 44 px height would clip its second row | 2-row rule from 1180 px; `height: auto` for that range in the theme |
| Details sliver | Outliner height bounded by the WINDOW height | `resolveOutlinerHeight` (utils/workspaceLayout): bounded by the sidebar's measured height at render time when the sidebar can hold both panes; a sidebar squeezed by a maximised timeline keeps the historic layout. A CSS-only cap was tried first and broke `panel-edge-handles` R5-01 (footer slid under the dock handle) — measured, then replaced by this bound. |
| Hidden toolbar commands | strip scrolls but showed no sign of it | scroll-shadow affordance on `.authoring-toolbar` (appears only while content is hidden on that side) |
| Mask banner over the artwork on narrow stages | — | ≤ 1100 px the how-to hint moves into the banner tooltip; refusal reasons stay visible |
| Keyboard access to mask editing | no keyboard alternative to dragging on the canvas | arrow keys nudge the selected point or the whole path by 1 project unit (Shift 10); one undo entry per press/hold; text fields, dialogs and the focused timeline keep their arrows |

## Evidence

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/tests/wp06WorkspaceLayout.test.ts` | 0 | 2 tests |
| `npx playwright test -c playwright.isolated.config.ts --project=e2e wp06` | 0 | 3 passed (1024×720 and 768×720 chrome/Undo/Redo/Motion Curves/Details/Exit reachability; arrow nudge 10+3 units = 13/480 normalized, one Undo = one press, image unchanged; Select Source / Back via keyboard) |
| Layout + WP-02 E2E (`left-toolbar-collapse panel-edge-handles timeline-workspace authoring-toolbar keyboard-shortcuts graph-accessibility ui-polish-v36 micro-polish-v37 coordinate-unit-v2 authoring-ux-slice1 wp06 wp02`) | 0 | 67 passed (log `logs/wp06_e2e_layout_rerun.log`); the first run caught the R5-01 regression described above |
| `KCS_EVIDENCE_TAG=before|after ... --project=evidence wp06` | 0 | screenshots + JSON in `evidence/wp06/{before,after}/` |

## Not done

- Roving tabindex over individual canvas points (the numeric path editor and arrow nudge are the
  keyboard alternatives); Move Up/Down keyboard reorder for layers; 200 % browser zoom was
  approximated by the 768-wide probe, not run as a real zoom.
- Right-click pan/menu conflict (D-11) untouched.

IMPLEMENTED: YES (scoped CSS/layout + keyboard nudge)
TESTED: PASS
USER ACCEPTED: PENDING
MERGED: NO
