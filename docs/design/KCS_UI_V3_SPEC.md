# KCS UI V3 Screen-by-Screen Specification

## Shared contract

All screens preserve existing public props, native controls, keyboard behavior, serialized fields, evaluator behavior, `Track.channels`, history, masks, Track Matte, OGraf, and stage coordinates. Header remains 79px; left navigation remains 56px.

## A. Application Shell / Header

- **CURRENT LAYOUT:** Fixed single-row header containing project identity, mode buttons, FPS, save/status, Import, Export, and Reset.
- **NEW LAYOUT:** Three ownership groups: project identity at left, compact segmented authoring mode in center, passive status and actions at right.
- **HIERARCHY:** Identity → mode → passive status → Import → primary Export → Reset.
- **CONTROL GROUPING:** Use quiet separators between ownership groups; no nested cards.
- **SPACING:** 6–8px internal gaps; 28–30px controls; preserve 79px frame.
- **TYPOGRAPHY:** 10–12px labels; semibold identity; tabular FPS/status.
- **STATE COLORS:** Export is primary solid; active mode uses muted fill; save is passive.
- **ICON LOGIC:** Existing Lucide icons and accessible labels; do not introduce decorative icons.
- **RESPONSIVE:** Keep groups within the fixed header; compress gaps before changing geometry.
- **ACCESSIBILITY:** Native buttons/combobox, visible focus, descriptive labels.
- **FUNCTIONAL INVARIANTS:** Mode, FPS, Import, Export, Reset, template tabs unchanged.
- **IMPLEMENTATION NOTES:** Restructure internal wrappers only; do not alter stage origin calculations.

## B. Left Toolbar

- **CURRENT LAYOUT:** 56px rail with workspace drawers and viewport tools.
- **NEW LAYOUT:** Tool families separated by quiet dividers; selected tool gets muted solid fill and readable contrast.
- **HIERARCHY:** Workspace drawers → authoring tools → viewport tools.
- **CONTROL GROUPING:** Existing buttons remain individually addressable; group via CSS and semantic separators.
- **SPACING:** Preserve hit targets; 4–8px internal rhythm.
- **TYPOGRAPHY:** 10px muted labels, readable selected label/tooltip.
- **STATE COLORS:** No bright active border; use fill and icon/text contrast.
- **ICON LOGIC:** Existing Lucide family; icon-only controls retain title/aria-label.
- **RESPONSIVE:** Rail width fixed at 56px; drawer contents own their scroll.
- **ACCESSIBILITY:** Keyboard order follows visual order; 24px minimum target.
- **FUNCTIONAL INVARIANTS:** Project, Media, Elements, Texts, Select, Hand, Grid, Zoom, Reset unchanged.
- **IMPLEMENTATION NOTES:** Add group hooks without changing command handlers.

## C. Outliner

- **CURRENT LAYOUT:** Panel header, scene tree, row action cluster, footer count.
- **NEW LAYOUT:** Quiet panel header, stronger tree rows, type icon/indentation, readable eye/lock actions, selected row strip.
- **HIERARCHY:** Scene identity → tree → row actions → count.
- **CONTROL GROUPING:** Keep reorder actions adjacent to each row; align action columns.
- **SPACING:** 24–28px rows; consistent indentation increments.
- **TYPOGRAPHY:** 10px panel label; 11–12px layer names; ellipsis truncation.
- **STATE COLORS:** Selected row muted fill; hover subtle; inactive controls remain contrast-safe.
- **ICON LOGIC:** Type, visibility, lock, reorder icons retain existing meaning and names.
- **RESPONSIVE:** Truncate names before collapsing action columns.
- **ACCESSIBILITY:** Preserve treeitem semantics, labels, focus, drag/reorder alternatives.
- **FUNCTIONAL INVARIANTS:** Selection, visibility, lock, hierarchy, reorder, count unchanged.
- **IMPLEMENTATION NOTES:** Style row ownership rather than adding duplicate DOM.

## D. Canvas chrome

- **CURRENT LAYOUT:** Stage with floating viewport toolbar and selection gizmo.
- **NEW LAYOUT:** Compact low-contrast floating strip; authored selection bounds remain dominant.
- **HIERARCHY:** Composition → selection/gizmo → viewport controls.
- **CONTROL GROUPING:** Grid, zoom, reset remain in one strip.
- **SPACING:** 4–6px gaps; avoid extra padding.
- **TYPOGRAPHY:** Minimal labels; tooltips for icon-only buttons.
- **STATE COLORS:** Subdued grid/zoom active state; selection retains semantic contrast.
- **ICON LOGIC:** Existing viewport icon semantics.
- **RESPONSIVE:** Strip must remain inside canvas without covering critical selection controls.
- **ACCESSIBILITY:** Focus-visible remains unobscured; buttons remain named.
- **FUNCTIONAL INVARIANTS:** Pan, zoom, grid, reset, gizmo, stage coordinate frame unchanged.
- **IMPLEMENTATION NOTES:** CSS framing only unless existing markup lacks a hook.

## E. Inspector

- **CURRENT LAYOUT:** Right panel split between Outliner and Details; Details uses repeated section cards.
- **NEW LAYOUT:** Selected-object header and actions, then a stable disclosure rail with strict label/value property rows and advanced-density groups.
- **HIERARCHY:** Object identity → primary actions → frequent properties → advanced disclosures.
- **CONTROL GROUPING:** One object header; one Edit/Duplicate action cluster; domain sections separated by thin rules.
- **SPACING:** 8px section rhythm; 28px controls; stable two-column label/value grid.
- **TYPOGRAPHY:** 11–12px object identity; 10px section labels; tabular mono values.
- **STATE COLORS:** Selection and active edit mode use muted contrast; destructive actions stay explicit.
- **ICON LOGIC:** Existing edit, duplicate, delete, keyframe icons with tooltips.
- **RESPONSIVE:** Label column truncates/uses minimum width; value column remains usable; panel scroll is contained.
- **ACCESSIBILITY:** Native disclosures, labels, focus-visible, keyboard edit path, no color-only state.
- **FUNCTIONAL INVARIANTS:** Corner Radius remains in Appearance; no Geometry section; Text Fill/Stroke remain in Text; canonical picker unchanged.
- **IMPLEMENTATION NOTES:** Prefer shared row class/markup hooks; do not move mutation logic into UI styling components.

## F. Appearance

- **CURRENT LAYOUT:** Correct Appearance controls with inconsistent row alignment.
- **NEW LAYOUT:** Radius, Fill, Stroke, and supporting appearance properties share one technical row grid.
- **HIERARCHY:** Shape appearance identity → Corner Radius → Fill/Stroke → supporting fields.
- **CONTROL GROUPING:** Keep all appearance fields together; no Geometry section.
- **SPACING:** 4px unit gap; 8px group gap.
- **TYPOGRAPHY:** Tabular numeric values and explicit units.
- **STATE COLORS:** Focus and disabled states explicit through ring/text/icon.
- **ICON LOGIC:** Existing keyframe/color affordances.
- **RESPONSIVE:** Inputs shrink before labels disappear.
- **ACCESSIBILITY:** Field labels and color picker names preserved.
- **FUNCTIONAL INVARIANTS:** Shape eligibility, fill/stroke, Corner Radius, canonical picker unchanged.
- **IMPLEMENTATION NOTES:** Style existing StyleAppearanceSection and child rows.

## G. Text

- **CURRENT LAYOUT:** Text controls are dense and mixed with typography fields.
- **NEW LAYOUT:** Content → font/family/size → alignment/spacing → Text Fill/Stroke.
- **HIERARCHY:** Text content and identity first.
- **CONTROL GROUPING:** Text-specific rows remain in Text; Fill/Stroke do not move to Appearance.
- **SPACING:** Same row baseline as Appearance.
- **TYPOGRAPHY:** Readable text input; numeric values mono.
- **STATE COLORS:** Focus, disabled inherited fields, and color states explicit.
- **ICON LOGIC:** Existing typography and keyframe affordances.
- **RESPONSIVE:** Text content remains usable with ellipsis only for labels.
- **ACCESSIBILITY:** Labels, keyboard text editing, picker focus preserved.
- **FUNCTIONAL INVARIANTS:** Text content, fonts, alignment, fill/stroke, animation unchanged.
- **IMPLEMENTATION NOTES:** No text state rewrite.

## H. Mask / Track Matte

- **CURRENT LAYOUT:** Dense mask and matte disclosures in the style panel.
- **NEW LAYOUT:** Two visibly separate domains: Masks and Track Matte V2.
- **HIERARCHY:** Mask stack/path controls → Track Matte relationship controls.
- **CONTROL GROUPING:** Masks: stack/mode/invert/path/feather/opacity/expansion. Matte: source/type/invert/source visibility.
- **SPACING:** 8px between domains; 4–6px rows.
- **TYPOGRAPHY:** Source names readable; values mono.
- **STATE COLORS:** Invalid/disabled relationships include text and icon cues.
- **ICON LOGIC:** Existing mask/matte icons and labels.
- **RESPONSIVE:** Relationship labels truncate before controls collapse.
- **ACCESSIBILITY:** Preserve disclosure names, disabled explanations, keyboard operation.
- **FUNCTIONAL INVARIANTS:** Mask and Track Matte semantics, animated paths, source visibility unchanged.
- **IMPLEMENTATION NOTES:** Styling and separators only; no new authority.

## I. Timeline

- **CURRENT LAYOUT:** Sequence tabs, timing controls, transport, ruler, outliner, lanes, channels, keyframes, zoom.
- **NEW LAYOUT:** Compact sequence strip, technical timing/transport band, shared ruler boundary, then professional lane field with clear layer/property columns.
- **HIERARCHY:** Sequence → time/range → transport → ruler/layer headers → keyframe lanes.
- **CONTROL GROUPING:** Transport adjacent and normalized; zoom at the far technical edge; Motion Curves remains discoverable but subordinate.
- **SPACING:** 4–8px controls; stable lane/row heights; no oversized play control.
- **TYPOGRAPHY:** Timecode/frame values tabular mono; layer names readable.
- **STATE COLORS:** Playhead and selected keys semantic; lane hover quiet; disclosures clear.
- **ICON LOGIC:** Existing transport and keyframe icons; labels/tooltips retained.
- **RESPONSIVE:** Contained horizontal/vertical scrolling; layer column does not push ruler/keyframes out of alignment.
- **ACCESSIBILITY:** Buttons named, keyboard transport and disclosure operation preserved.
- **FUNCTIONAL INVARIANTS:** Sequence switching, navigation, playback, crop, zoom, channels, keyframes, context menus unchanged.
- **IMPLEMENTATION NOTES:** DOM regrouping allowed only if Track.channels and lane geometry remain authoritative.

## J. Curve / Graph Editor

- **CURRENT LAYOUT:** Graph and controls share a dense modal with weak dominant surface.
- **NEW LAYOUT:** Selected channel header, graph-dominant center, compact right control rail, bottom technical output/action strip.
- **HIERARCHY:** Channel identity → graph → handles/value fields → presets/preview → CSS output → Apply/Cancel.
- **CONTROL GROUPING:** Value/Speed state near channel identity; numeric handle inputs aligned in two columns; actions at bottom.
- **SPACING:** 8–12px modal rhythm; graph gets the largest area.
- **TYPOGRAPHY:** Channel and values explicit; mono numeric fields.
- **STATE COLORS:** Selected handles/keys contrast; read-only Speed visibly indicated without implying editability.
- **ICON LOGIC:** Existing graph, preview, copy, Apply, Cancel semantics.
- **RESPONSIVE:** Graph remains usable at 1366×768; support rail can compress before graph.
- **ACCESSIBILITY:** Value/Speed labels, focus-visible, numeric alternatives, dialog focus return.
- **FUNCTIONAL INVARIANTS:** Bézier/easing math, presets, preview, CSS copy, Apply/Cancel, Value editable, Speed read-only.
- **IMPLEMENTATION NOTES:** Restructure layout and CSS; do not rewrite graph engine.

## K. Bezier Path editing

- **CURRENT LAYOUT:** Direct canvas handles with Inspector/numeric alternatives.
- **NEW LAYOUT:** Strong selected-handle contrast and calm canvas chrome; numeric alternatives remain discoverable.
- **HIERARCHY:** Selected path/handle → geometry → keyboard/numeric alternatives.
- **CONTROL GROUPING:** Direct manipulation stays on canvas; support stays in Inspector.
- **SPACING:** No glow; handle hit areas remain usable.
- **TYPOGRAPHY:** Coordinates tabular mono.
- **STATE COLORS:** Selected, hover, and focus distinct without color-only state.
- **ICON LOGIC:** Existing path actions.
- **RESPONSIVE:** No geometry clipping at required viewports.
- **ACCESSIBILITY:** Keyboard movement and focus alternatives preserved.
- **FUNCTIONAL INVARIANTS:** Topology, handles, coordinate space, keyboard operations unchanged.
- **IMPLEMENTATION NOTES:** Visual contrast only.

## L. Popovers / dialogs

- **CURRENT LAYOUT:** Functional modal/popover surfaces with occasional generic card treatment.
- **NEW LAYOUT:** One editor-native surface with context header, content, and clear action footer.
- **HIERARCHY:** Context → content → primary/secondary action.
- **CONTROL GROUPING:** Avoid nested decorative cards; destructive actions remain confirmed or undoable.
- **SPACING:** 8px rhythm.
- **TYPOGRAPHY:** Concise action-oriented copy.
- **STATE COLORS:** Error adjacent to field; disabled states explicit.
- **ICON LOGIC:** Existing semantic icons.
- **RESPONSIVE:** No clipping; viewport containment.
- **ACCESSIBILITY:** Focus trap/return, escape behavior, accessible labels.
- **FUNCTIONAL INVARIANTS:** Existing dialog flows and confirmation semantics unchanged.
- **IMPLEMENTATION NOTES:** Shared surface tokens only.

## M. Empty states

- **CURRENT LAYOUT:** Centered passive text or dashed dropzones.
- **NEW LAYOUT:** Left-aligned concise explanation with existing next action.
- **HIERARCHY:** What is empty → why → next action.
- **CONTROL GROUPING:** One instruction region and one existing actionable control.
- **SPACING:** Compact editor rhythm; no giant whitespace.
- **TYPOGRAPHY:** Muted explanation; readable action.
- **STATE COLORS:** Empty, sparse, error, and recovery remain distinct.
- **ICON LOGIC:** Existing action icon if available; no decorative illustration.
- **RESPONSIVE:** Readable at 1366×768.
- **ACCESSIBILITY:** Action named and keyboard reachable.
- **FUNCTIONAL INVARIANTS:** Existing import/create/select behavior unchanged.
- **IMPLEMENTATION NOTES:** Copy/layout treatment only.
