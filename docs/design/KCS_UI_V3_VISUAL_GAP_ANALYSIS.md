# KCS UI V3 Visual Gap Analysis

## Evidence baseline

The baseline was captured from the real KCS browser surface on `feat/v6-ui-bold-v3` before implementation. The verified starting branch was `chore/kcs-role-aware-routing` at `4bb38b8`, based on the latest verified V2 UI gate. The shell measured 79px header, 56px left navigation, and no document overflow at 1920x1080, 1440x900, or 1366x768.

Evidence files:

- `docs/design/baseline/v3/baseline-full-1920x1080.webp`
- `docs/design/baseline/v3/baseline-full-1440x900.webp`
- `docs/design/baseline/v3/baseline-full-1366x768.webp`
- `docs/design/baseline/v3/baseline-inspector-selected-shape.webp`
- `docs/design/baseline/v3/baseline-timeline-expanded.webp`
- `docs/design/baseline/v3/baseline-curve-editor.webp`
- `docs/design/baseline/v3/baseline-mask-track-matte.webp`
- `docs/design/baseline/v3/baseline-outliner-toolbar.webp`

## Surface analysis

### Shell / Header

- **CURRENT:** Functional fixed 79px header with template identity, mode buttons, FPS, save/status, import/export, and reset. Several controls compete for teal emphasis.
- **REFERENCE QUALITY:** OGraf/Resolve-style ownership: project identity, authoring mode, passive status, then one primary action.
- **VISUAL GAP:** Medium-to-large. The shell reads as a web toolbar rather than a unified broadcast/motion editor frame; grouping and separators do not establish left/center/right ownership.
- **DESIRED CHANGE MAGNITUDE:** LARGE.
- **RISK:** Coordinate-sensitive header geometry and stage origin.
- **FUNCTIONAL CONTRACT:** Preserve 79px height, mode switching, FPS, Import, Export, Reset, and template tabs.

### Left Toolbar

- **CURRENT:** 56px rail with tools and drawer buttons; active states rely too much on accent treatment.
- **REFERENCE QUALITY:** Creative-tool rail with tool families, quiet separators, strong selected state, and discoverable tooltips.
- **VISUAL GAP:** Medium. Tool coverage is present but family grouping and hierarchy are weak.
- **DESIRED CHANGE MAGNITUDE:** MEDIUM/LARGE.
- **RISK:** Hit targets and keyboard shortcuts.
- **FUNCTIONAL CONTRACT:** Preserve 56px width, tool commands, drawer selection, labels, and keyboard access.

### Outliner

- **CURRENT:** Layer tree with selection, visibility, lock, reorder, and footer count. Header emphasis competes with layer data; inactive affordances are too quiet.
- **REFERENCE QUALITY:** Blender/After Effects layer tree: compact rows, clear indentation, readable affordances, quiet panel chrome.
- **VISUAL GAP:** Medium. Structure exists but hierarchy is inverted.
- **DESIRED CHANGE MAGNITUDE:** LARGE.
- **RISK:** Treeitem semantics, drag/reorder, selection, and action hit areas.
- **FUNCTIONAL CONTRACT:** Preserve layer hierarchy, selection, visibility, lock, reorder, and count.

### Inspector

- **CURRENT:** Right-side split Outliner/Details panel with correct domain controls, but repeated card borders and inconsistent property-row alignment.
- **REFERENCE QUALITY:** OGraf/Blender property editor with selected-object identity, stable label/value columns, progressive disclosure, and dense technical rows.
- **VISUAL GAP:** LARGE. Inspector does not yet feel like a professional property editor.
- **DESIRED CHANGE MAGNITUDE:** LARGE.
- **RISK:** Broad component markup changes can affect disclosure, keyframes, text, masks, and color picker integration.
- **FUNCTIONAL CONTRACT:** Corner Radius remains in Appearance; Geometry remains absent; Text Fill/Stroke remain in Text; canonical ColorPickerPopover remains authoritative; all existing mutations and keyframe affordances remain unchanged.

### Appearance / Text / Mask / Track Matte

- **CURRENT:** Semantically correct domains with dense controls; related rows do not share a strong visual grid.
- **REFERENCE QUALITY:** Domain-specific property groups with explicit relationships and compact technical hierarchy.
- **VISUAL GAP:** Medium. Clarity can improve without changing ownership.
- **DESIRED CHANGE MAGNITUDE:** MEDIUM.
- **RISK:** Mask and Track Matte semantics are authority-sensitive.
- **FUNCTIONAL CONTRACT:** Preserve mask stack, path animation, feather, opacity, expansion, matte source/type/inversion/source visibility, and Text Fill/Stroke.

### Timeline

- **CURRENT:** Rich sequence, transport, ruler, outliner, lanes, channels, keyframes, zoom, and curve controls. Transport and zoom compete; empty lanes lack rhythm; lane/ruler ownership is not immediately legible.
- **REFERENCE QUALITY:** After Effects/Resolve timeline density: tabs and transport in compact bands, shared ruler alignment, quiet rows, semantic playhead/keyframe contrast.
- **VISUAL GAP:** LARGE. The current timeline is functional but not immediately perceived as a professional animation timeline.
- **DESIRED CHANGE MAGNITUDE:** LARGE.
- **RISK:** Vertical alignment between TrackOutlinerRow and TrackLane; scroll ownership; playback performance.
- **FUNCTIONAL CONTRACT:** Preserve Track.channels authority, keyframe semantics, evaluator behavior, sequence switching, navigation, playback, crop, zoom, disclosures, and context actions.

### Curve / Graph Editor

- **CURRENT:** Modal with graph, handle controls, Value/Speed toggle, preview, presets, CSS representation, copy, Apply, Cancel. Supporting controls compete with graph identity.
- **REFERENCE QUALITY:** Graph-dominant technical editor with a clear selected channel, quiet grid, aligned numeric handle controls, and an explicit read-only derived Speed state.
- **VISUAL GAP:** LARGE. Graph should become the dominant authoring surface.
- **DESIRED CHANGE MAGNITUDE:** LARGE.
- **RISK:** Graph math, easing semantics, handle editing, and Value/Speed behavior.
- **FUNCTIONAL CONTRACT:** Do not change evaluator/easing math; Value Graph remains editable; Speed Graph remains read-only; Apply, Cancel, CSS output, presets, and preview remain compatible.

### Canvas chrome

- **CURRENT:** Stage remains central, but floating viewport controls can compete with authored selection bounds.
- **REFERENCE QUALITY:** Canvas-first composition with secondary, restrained viewport chrome.
- **VISUAL GAP:** Small/medium.
- **DESIRED CHANGE MAGNITUDE:** MEDIUM.
- **RISK:** Stage coordinates and selection gizmo geometry.
- **FUNCTIONAL CONTRACT:** Preserve stage origin, pan, zoom, grid, reset, selection, gizmo, and rendering.

### Popovers, dialogs, and empty states

- **CURRENT:** Functional but inherit generic card/dropzone presentation in some surfaces.
- **REFERENCE QUALITY:** Native editor surfaces with concise context, action footer, focus management, and no onboarding dashboard styling.
- **VISUAL GAP:** Medium.
- **DESIRED CHANGE MAGNITUDE:** MEDIUM.
- **RISK:** Focus return, dialog semantics, and existing confirmation behavior.
- **FUNCTIONAL CONTRACT:** Preserve existing flows, labels, confirmation semantics, undo behavior, and focus management.

## Cross-cutting decisions

- Preserve the 79px header and 56px left rail.
- Use existing theme authorities in `src/kcsEditorTheme.css` and `src/index.css`; add no dependency or parallel theme.
- Prefer semantic borders, compact rows, tabular numerics, and muted active fills over glow or decorative gradients.
- Preserve native controls, accessible names, focus-visible rings, keyboard alternatives, and reduced-motion behavior.
- Treat Inspector, Timeline, Curve/Graph Editor, and Shell as LARGE targets. A CSS-only color pass is insufficient.
