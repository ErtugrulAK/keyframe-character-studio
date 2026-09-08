# KCS UI V2 Current Audit

## Audit method

Audited the real KCS app in isolated Chromium with `e2e/fixtures/v6-motion-core.scene.json`. Viewports: 1920×1080, 1440×900, and 1366×768. The 1366×768 screenshot was visually inspected; all three viewports were measured for shell bounds and overflow. Selected-layer inspection used Luminance Target. No implementation was performed during this audit.

## Baseline evidence

| Viewport | Header | Left nav | Timeline | Page scroll width/height | Console errors |
| --- | ---: | ---: | ---: | --- | --- |
| 1920×1080 | 79px | 56px | 320px | 1920×1080 | None observed |
| 1440×900 | 79px | 56px | 320px | 1440×900 | None observed |
| 1366×768 | 79px | 56px | 320px | 1366×768 | None observed |

At 1366×768, the right panel measured approximately 359px wide. The central stage remained visible and the timeline occupied the lower 320px. The screenshot showed a coherent dark shell, but the timeline and Inspector still compete with the canvas through repeated borders and accent emphasis.

## Prioritized findings

| ID | Severity | Surface | Observed issue | Why it feels weak | Reference principle | Direction |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | P1 | Global accent | Teal is used for primary actions, active toggles, selection, grid state, and passive status | State meaning is ambiguous and visual noise increases | Functional color; redundant status cues | Reserve solid teal for the primary action and meaningful selection; use muted fills for secondary active states |
| A-02 | P1 | Timeline | Play button is visually larger than surrounding controls; zoom/duration controls read as unrelated fragments | The transport row lacks a professional control rhythm | OGraf compact property/control rows | Normalize transport height and group adjacent controls without changing behavior |
| A-03 | P1 | Inspector | Details header, action row, and disclosure sections have competing borders/backgrounds | Selected-object identity is weaker than panel chrome | Typography before decorative boundaries | Make object identity primary; use one disclosure rhythm and fewer nested boxes |
| A-04 | P1 | Timeline | Empty lanes have weak separation and large unused visual field | Long timelines become difficult to scan | Timeline/ruler alignment and density | Strengthen ruler/lane relationship and selected-key contrast; preserve scroll ownership |
| A-05 | P2 | Outliner | Header all-caps treatment competes with layer names; inactive eye/lock icons are dim | Data hierarchy is inverted | Information hierarchy and accessible contrast | Reduce header emphasis; improve icon contrast and row selection fill |
| A-06 | P2 | Toolbar/drawers | Active Media state depends on teal border; dropzone is centered and generic | Feels like a SaaS card rather than a production tool | Calm technical surfaces; inline help | Use muted active fill and left-aligned instructional hierarchy |
| A-07 | P2 | Canvas chrome | Floating toolbar active grid state competes with authored canvas selection | Tool chrome pulls attention away from composition | Canvas dominance | Use subdued active treatment and keep the stage visual anchor |
| A-08 | P2 | Curve Editor | Modal hierarchy needs stronger distinction between graph, controls, presets, and output | Supporting controls compete with the graph | Graph dominance; progressive disclosure | Give graph surface primary area and use consistent supporting bands |
| A-09 | P2 | Masks/Track Matte | Concepts are present but dense disclosures can appear as one undifferentiated stack | Source/mode/strength/path responsibilities are harder to scan | Separate concepts clearly | Preserve separate authorities and add stronger group rhythm, not new state |
| A-10 | P3 | Empty/error states | Empty states are often passive text or dashed dropzones | They do not always provide a clear next action | No dead ends; inline help first | Add concise next-step copy/actions where existing interaction permits |
| A-11 | P3 | Focus | Labels and icon controls are generally named, but dense state review needs explicit focus checks | Keyboard users need consistent unobscured feedback | Clear focus and accessible names | Keep visible focus rings and test grouped controls with keyboard |
| A-12 | P3 | Responsive desktop | Required desktop sizes fit without page overflow, but 1366px has little vertical breathing room | Dense surfaces can clip when disclosures expand | Responsive coverage; useful scrollbars | Keep fixed shell frame, contain panel scroll, and test expanded states |

## Screen audit

### Shell and Header

Current structure is a 79px fixed header with template tab, mode controls, save status, FPS, import/export, and reset. It is coordinate-sensitive and must remain 79px. Internal grouping is serviceable but mode and export both attract similar teal attention. Direction: one primary CTA, compact segmented mode treatment, passive save status.

### Toolbar and drawers

The 56px left navigation is coordinate-sensitive. Labels and icons are discoverable and titled. Active drawer states use a visible teal treatment and the Media empty state uses a centered dashed dropzone. Direction: keep hit targets and labels, reduce border noise, use a calm solid surface and left-aligned next-step text.

### Outliner

The Outliner has a clear template title, tree rows, selection, visibility, and lock actions. Layer rows are compact and aligned. Direction: reduce title dominance, make inactive controls readable, preserve tree semantics and reorder behavior.

### Canvas chrome

The stage remains the dominant center surface with a floating viewport toolbar, grid, zoom, and selection gizmo. Direction: reduce toolbar accent competition; never change stage origin, SVG coordinate frame, or selection geometry.

### Inspector

Selected-object identity is visible and Edit/Duplicate is now a single action treatment. Disclosures provide a strong progressive structure, but header and section chrome can still read as repeated cards. Direction: align name, mode, and low-frequency actions; preserve Corner Radius in Appearance, Text Fill/Stroke in Text, canonical color picker, and existing disclosure behavior.

### Appearance and Text

Appearance and Text contain the correct semantic controls. Numeric rows are compact, but label/value and unit spacing should be consistent. Direction: use tabular numerics, explicit units, and one row rhythm; no standalone Geometry return.

### Mask / Track Matte

The product correctly separates mask stack/path controls from Track Matte V2 relationship controls. Direction: increase scanability with labels and spacing only; preserve mode, inversion, source visibility, feather, opacity, expansion, and animated path semantics.

### Timeline

The timeline includes sequence tabs, timecode/duration controls, transport, crop, Motion Curves, undo/redo, zoom, ruler, layer outliner, property rows, keyframes, and selected-keyframe details. It is functionally rich but the transport row and empty lane field need a more deliberate visual rhythm. Preserve independent scroll ownership and channel/keyframe semantics.

### Curve / Graph Editor

The modal includes a graph surface, handle controls, Value/Speed toggle, preview, presets, CSS representation, copy, Apply, and Cancel. The graph is the primary authoring surface and should receive the strongest area and contrast. Speed Graph remains derived/read-only under the current contract.

### Bezier Path Editor

Existing path editing provides direct handles and keyboard-accessible controls. Direction: improve focus and selected-handle contrast only; do not change path topology or geometry math.

### Color picker

The existing canonical picker and numeric channels are the authority. Preserve the non-native picker workflow and ensure focus, labels, and numeric alignment remain clear.

### Dialogs, empty, error, and toast states

Existing dialogs and toasts are functional. Audit direction is concise, action-oriented recovery copy, visible focus, and no decorative loading or generic card treatment.

## Accessibility audit lens

- Preserve native buttons, labels, inputs, disclosures, tree items, and dialog semantics.
- Keep icon-only controls named with `aria-label` or title.
- Keep visible `:focus-visible` rings.
- Maintain 24px+ compact hit targets where visual controls are small.
- Do not rely on color alone for selected, active, warning, or error state.
- Keep keyboard alternatives for drag/path interactions.
- Respect reduced motion.
- Keep useful panel scrollbars contained and prevent document overflow.

## Scope decision

V2 implementation should be CSS-first and component-markup-light: refine the existing semantic theme authority and add only narrowly scoped class hooks where state identity is not currently expressible. No Tailwind migration, UI-library installation, domain state rewrite, or layout-coordinate change is justified by this audit.
