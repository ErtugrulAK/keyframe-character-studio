# KCS UI V3 Before / After

## Evidence

Baseline screenshots: `docs/design/baseline/v3/`

Final screenshots: `docs/design/after/v3/`

All evidence was captured from the real browser surface on `feat/v6-ui-bold-v3`.

## Full editor

- **BASELINE:** Dark editor frame was functional but read as repeated bordered regions. Header actions, side panels, and timeline competed with the canvas.
- **FINAL:** Shell ownership is explicit, side panels are calmer technical surfaces, and the canvas remains the visual anchor.
- **WHAT CHANGED:** Added header grouping/separators, muted panel hierarchy, stronger outliner/timeline boundaries, and secondary canvas chrome.
- **WHY BETTER:** The workspace reads as one professional editor instead of adjacent web cards.
- **WHAT BEHAVIOR WAS PRESERVED:** Stage frame, selection, navigation, playback, panel visibility, and shell dimensions.

## Shell / Header

- **BASELINE:** Template tabs, mode controls, status, and Export had competing emphasis.
- **FINAL:** Project identity, mode, passive status, and actions occupy clear left/center/right ownership groups.
- **WHAT CHANGED:** Internal grouping, separators, muted mode state, primary Export treatment.
- **WHY BETTER:** Mode and action priority are legible at a glance without changing the 79px frame.
- **WHAT BEHAVIOR WAS PRESERVED:** Template tabs, rename/delete, mode switching, FPS, Import, Export, OGraf, Reset, autosave.

## Inspector

- **BASELINE:** Inspector properties were visually fragmented by repeated cards and inconsistent row rhythm.
- **FINAL:** Selected-object identity and disclosure rows read as a technical property editor with stable density.
- **WHAT CHANGED:** Flattened panel cards, stronger object header, selected row treatment, label/value rhythm, focus rules.
- **WHY BETTER:** Frequent properties scan faster and advanced sections remain subordinate.
- **WHAT BEHAVIOR WAS PRESERVED:** Corner Radius remains in Appearance; Geometry remains absent; Text Fill/Stroke and canonical color picker remain in their existing domains.

## Timeline

- **BASELINE:** Transport, timing, zoom, ruler, and tracks competed; lane ownership was weak.
- **FINAL:** Sequence tabs, timing, transport, actions, layer pane, ruler, and graph pane have explicit hierarchy.
- **WHAT CHANGED:** Added timing/transport/action bands and layer/graph pane hooks; normalized controls and grid/lane boundaries.
- **WHY BETTER:** The surface immediately reads as a professional animation timeline.
- **WHAT BEHAVIOR WAS PRESERVED:** Sequence switching, transport, scrubbing, crop, zoom, disclosures, keyframe semantics, `Track.channels`, scrolling.

## Curve Editor

- **BASELINE:** Graph, handles, preview, presets, CSS output, and actions shared a fragmented modal hierarchy.
- **FINAL:** Graph dominates the main column; support controls occupy a restrained technical rail.
- **WHAT CHANGED:** Added modal header/main/support regions, graph-first sizing, subordinate support surfaces, and clearer Value/Speed presentation.
- **WHY BETTER:** Easing authoring focus is immediate and support actions remain discoverable without competing with the graph.
- **WHAT BEHAVIOR WAS PRESERVED:** Bézier/easing math, handle edits, presets, preview, CSS copy, Apply/Cancel, editable Value Graph, read-only Speed Graph.

## Outliner / Toolbar

- **BASELINE:** Layer rows and toolbar existed but inactive affordances and family grouping were weak.
- **FINAL:** Toolbar reads as a 56px creative-tool rail; Outliner reads as a layer tree with stronger indentation and selected-row identity.
- **WHAT CHANGED:** Muted selected fills, semantic separators, readable eye/lock controls, truncation, quieter headers.
- **WHY BETTER:** Structural hierarchy is clearer without adding decorative chrome.
- **WHAT BEHAVIOR WAS PRESERVED:** Tool commands, drawer selection, keyboard shortcuts, layer selection, visibility, lock, reorder, hierarchy, count.

## Responsive result

At 1920x1080, 1440x900, and 1366x768:

- Header remained 79px.
- Left navigation remained 56px.
- Document scroll dimensions matched the viewport.
- No console errors or NaN transforms were observed.
- 1366x768 remained usable.
