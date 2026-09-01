# Right Inspector Structure Audit

## Executive Summary

This is a read-only audit of the current working tree at HEAD `494d65957ab2cc5eaeb691429c794751ba12d88a`. The working tree also contains intentional, uncommitted Appearance editor changes from the preceding task; this audit includes those changes and does not modify them.

The right side is not one single property hierarchy. In Edit mode it is a fixed-width `PropertyInspector` containing two vertically resizable dock panes:

1. `OutlinerPanel` — Template Elements / layer tree.
2. `DetailsPanel` — selected-object actions, two navigation tabs, and property controls.

`DetailsPanel` is empty when no primary selection exists. With a selection, its default `Edit` tab renders Transform first and Style second. `Duplicate` replaces the Edit body rather than appearing below it. Boolean creation/editor controls are injected at the top of Transform. Most visual sections are `StyleCard` panel cards, but there is no general collapse control inside the Details property stack.

## Current Sidebar High-Level Map

```text
RIGHT SIDEBAR (Edit mode only)
│
├── LEFT WIDTH RESIZER
│
├── OUTLINER DOCK — fixed initial height 240px, vertically resizable
│   ├── TEMPLATE ELEMENTS header
│   ├── Scene title + "Elements" root tree row
│   │   └── Expand / collapse root
│   ├── Layer tree
│   │   ├── Expand / collapse rows with children
│   │   ├── Visibility eye
│   │   ├── Layer icon + name
│   │   ├── Boolean operation badge when applicable
│   │   ├── Matte source / missing-source indicator when applicable
│   │   ├── Boolean Operand badge when applicable
│   │   ├── Bring Forward
│   │   └── Send Backward
│   └── Footer: element count and selected count
│
├── OUTLINER / DETAILS HORIZONTAL RESIZER
│
└── DETAILS DOCK — remaining sidebar height
    ├── DETAILS header
    ├── Selected actor header OR empty selection message
    │   ├── Selected object name
    │   ├── Duplicate icon action
    │   └── Delete icon action, or Dissolve Boolean for Boolean selection
    ├── Tabs, only with a selected object
    │   ├── EDIT
    │   └── DUPLICATE
    │
    └── Selected object body
        ├── EDIT tab
        │   ├── Boolean workflow / Boolean creation block when applicable
        │   ├── TRANSFORM
        │   │   ├── Position X / Y
        │   │   ├── Rotation + Reset 0°
        │   │   ├── Scale % + Locked / Free
        │   │   ├── Layer Order / Z-index
        │   │   ├── 4 Control Points (regular shapes)
        │   │   ├── Vertex editor (freeform, except Boolean result)
        │   │   └── Animation Data: Copy / Paste / Clear Animation
        │   └── STYLE
        │       ├── GEOMETRY (rectangle/box/card/banner)
        │       ├── TRIM PATH (eligible types)
        │       ├── APPEARANCE (modern shape types)
        │       ├── COLOR (legacy/non-modern color types)
        │       ├── TEXT (card/text/banner)
        │       ├── EFFECTS (all selected types)
        │       ├── MASK / TRACK MATTE (all selected types)
        │       ├── CLONER (when clonerConfig exists)
        │       └── PARTICLES (when particleConfig exists)
        └── DUPLICATE tab
            ├── Duplicate
            ├── Mirror Y
            ├── Mirror X
            └── Mirror Origin
```

## Exact Vertical Order

### Right sidebar shell

| # | Block | Presence | Notes |
|---:|---|---|---|
| 01 | Left width resizer | ALWAYS in Edit mode | Drag handle; changes sidebar width. |
| 02 | Outliner dock | ALWAYS in Edit mode | Initial height 240px; constrained by viewport. |
| 03 | Template Elements header/tree/footer | ALWAYS in Edit mode | Tree can be collapsed; empty tree shows an empty-state message. |
| 04 | Outliner/details divider | ALWAYS in Edit mode | Drag handle changes Outliner height. |
| 05 | Details dock | ALWAYS in Edit mode | Remaining height; overflow hidden at dock level. |

### Selected normal vector shape — default Edit tab

| # | Block | Presence | Notes |
|---:|---|---|---|
| 01 | Details header | ALWAYS | Title and sliders icon. |
| 02 | Selected actor header | SELECTED OBJECT | Name, Duplicate, Delete. |
| 03 | Edit / Duplicate tabs | SELECTED OBJECT | Edit is initially active. |
| 04 | Boolean workflow block | CONDITIONAL | Boolean creation/editor/unavailable hint; appears before Transform. |
| 05 | Transform card | SELECTED OBJECT / EDIT TAB | Position/rotation/scale are grouped in one card. |
| 06 | Layer Order / Z-index | SELECTED OBJECT / EDIT TAB | Separate card. |
| 07 | 4 Control Points | NON-FREEFORM SHAPE | Regular shape geometry control; edge/corner submode. |
| 08 | Vertex editor | FREEFORM, NON-BOOLEAN | Replaces control points; one row per point. |
| 09 | Animation Data | EDIT TAB | Copy/Paste/Clear animation actions are passed by DetailsPanel. |
| 10 | Geometry | RECTANGLE / BOX / CARD / BANNER | Corner Radius range. |
| 11 | Trim Path | TRIM-PATH-ELIGIBLE TYPE | Enable, start, end, offset controls. |
| 12 | Appearance | MODERN SHAPE TYPE | Fill, Stroke, RGBA, hue, alpha, width, alignment. |
| 13 | Color | NON-MODERN COLOR TYPE | Legacy fill/stroke color editor; mutually exclusive with Appearance. |
| 14 | Text | CARD / TEXT / BANNER | Content and typography; card-specific fields where applicable. |
| 15 | Effects | ALL SELECTED OBJECTS | Shadow/glow color and optional blur/offsets. |
| 16 | Mask / Track Matte | ALL SELECTED OBJECTS | Source and active matte settings. |
| 17 | Cloner | `clonerConfig` exists | Configuration-dependent controls. |
| 18 | Particles | `particleConfig` exists | Count/speed/shape controls. |

The actual #10–#18 list is filtered by the selected type/configuration. `StyleTab` itself preserves this order.

### Selected object — Duplicate tab

The Details header, selected actor header, and tabs remain. The Edit body is replaced by one `DuplicateTab` card in this order:

1. Duplicate.
2. Mirror Y.
3. Mirror X.
4. Mirror Origin.

## Section-by-Section Breakdown

### Outliner / Template Elements

`OutlinerPanel` renders the active scene/template tree. The root row is `${sceneTitle} Elements`, with a root expand/collapse button. Empty scenes show `No elements in active template yet. Add shapes or text from left toolbar.`

Each part row can include:

- Expand/collapse button when it has `parentId` or Boolean children.
- Drag grip and HTML drag/drop reorder behavior.
- Visibility eye; toggles the associated track's edit visibility.
- Type-specific icon.
- Part name.
- Boolean operation badge for Boolean parents.
- Matte source indicator, or missing-source warning.
- `Operand` marker for Boolean operands.
- Up/down layer reorder buttons.

The footer reports total `characterParts.length` and currently only distinguishes `1 selected` vs `0 selected` using `selectedPartId`, even though row highlighting also reads `selectedPartIds`.

### Details header and selected actor actions

With no primary selection, the body shows `Select an element on Canvas or Outliner to view details`; tabs and property body are absent. With a primary selection, the header shows the selected name, Duplicate icon, and either Delete Actor Instance or Dissolve Boolean. The actor action is object-level, not a property section.

### Transform

`TransformTab` is a composition fragment, not a visible tab by itself. It renders:

- `editWorkflowContent` first (Boolean block when supplied).
- Unified Transform card:
  - Position: POS X, POS Y.
  - Rotation: ROT (°), Reset 0°.
  - Scale: SIZE (%), Locked/Free aspect toggle.
- Layer Order card: Z-index.
- `4 CONTROL POINTS (X/Y)` for every non-`custom_freeform` part. It has Edge / Corner mode and four editable point groups.
- Vertex editor for `custom_freeform` without `booleanOperandIds`; one row per authored point with X/Y fields.
- Animation Data card: Copy Animation, Paste Animation, Clear Animation.

`TransformInOutPresetCard`, `SelectedKeyframeSection`, and `KeyframesTab` exist in the repository but are not imported/rendered by the current `DetailsPanel` → `TransformTab` path. They are therefore not current visible right-sidebar sections.

### Boolean workflow

The Boolean block is positioned before Transform because `DetailsPanel` passes it to `TransformTab` as `editWorkflowContent`.

There are three mutually exclusive states:

1. **Selected Boolean group** — section `Boolean operation`:
   - Operation select: Union, Subtract, Intersect, Exclude.
   - Edit Operands / Lock Operands toggle.
   - Active operand-editing status text when unlocked.
   - Operand buttons; selecting one changes primary selection to that operand.
   - Empty result message when contours are empty.
   - Dissolve Boolean button; preserves operands.
2. **At least two eligible selected parts, no selected Boolean group** — `BOOLEAN` creation section:
   - Explanation text.
   - Union, Subtract, Intersect, Exclude buttons.
3. **Selected part is Boolean-eligible but insufficient selection** — `BOOLEAN` hint:
   - `Boolean: select 2 closed vector shapes.`

The selected actor header also changes its destructive icon action to Dissolve Boolean when `selectedBooleanGroup` is present. Boolean creation is performed in `DetailsPanel` and mutates character parts/tracks through the Animator context. Boolean result appearance is still supplied by the normal StyleTab based on its `custom_freeform` type and fields.

### Style / geometry

`StyleTab` always evaluates its children in this order, then each child decides whether to return content:

1. `StyleGeometrySection`: only `custom_rect`, `custom_box`, `custom_card`, `custom_banner`; one CORNER RADIUS range.
2. `TrimPathSection`: if `isTrimPathEligible(selectedPart.type)`; enable checkbox, START, END, OFFSET ranges and values.
3. `StyleAppearanceSection`: if `isShapeAppearanceEligible`; APPEARANCE card with Fill and Stroke.
4. `StyleColorSection`: returns null for modern appearance types; otherwise COLOR card with legacy fill/stroke color controls.
5. `StyleTextFields`: only card/text/banner; card category/title/button or text content, font family, font size, stagger mode, optional stagger delay.
6. `StyleEffectsSection`: always; shadow/glow color, Clear Shadow, and optional blur radius/offset X/offset Y.
7. `StyleMatteSection`: always; mask source and, when assigned, mode/inverted/feather/strength/gradient/type/angle/stops/enabled/remove.
8. `StyleClonerSection`: only when `selectedPart.clonerConfig` exists; mode-specific grid/circle controls, source/child parameters, and wave effector controls.
9. `StyleParticleSection`: only when `selectedPart.particleConfig` exists; count, speed, shape.

### Modern Appearance — current uncommitted editor included

Each modern Fill/Stroke group contains:

- One explicit enable checkbox.
- One primary checkerboard-backed color swatch.
- R/G/B number inputs, each 0–255.
- A number input, 0–255 UI representation mapped to authored opacity 0–1.
- Inline custom Hue ARIA slider.
- Inline custom Alpha ARIA slider with checkerboard transparency background.
- HEX text input.

Stroke adds WIDTH and ALIGN. Alignment options are only INSIDE and OUTSIDE; the internal CENTER value maps to OUTSIDE for display and OUTSIDE authors the compatibility CENTER value. No normal Fill/Stroke popup or native color input is present.

The unrelated `Effects` and `Mask / Track Matte` sections still contain native color inputs where their own controls require them.

### Legacy Color

For non-modern appearance types, `StyleColorSection` supplies a COLOR card with two compact color-picker cards, Fill and Stroke, using the shared inline editor and quick swatches. It is not rendered alongside APPEARANCE.

### Effects

The EFFECTS card is unconditional. It begins with SHADOW / GLOW COLOR using a native color input, HEX input, and Clear Shadow. If `shadowColor` is truthy, it adds BLUR RADIUS, OFFSET X, and OFFSET Y.

### Mask / Track Matte

The MASK / TRACK MATTE card is unconditional. It begins with descriptive text and MASK SOURCE. Assigned mattes conditionally add MODE, INVERTED, FEATHER, STRENGTH, GRADIENT, optional gradient TYPE, linear ANGLE, multi-stop editor (Add/remove/color/offset/opacity), Enabled, and Remove. Missing sources show a warning. Text/image sources disable Clip with explanatory text. The source list is filtered through `isMatteEligible` and excludes the selected part.

### Cloner and Particles

These are configuration-presence sections, not type-name checks at render time. A cloner card appears when `clonerConfig` exists and exposes mode-specific layout and effector controls. A particles card appears when `particleConfig` exists and exposes count, speed, and particle shape.

## Selection Conditional Matrix

| Selection | Current Details result |
|---|---|
| Nothing selected | Details header + empty message only; no tabs/body. Outliner remains visible. |
| Rectangle (`custom_rect`) | Edit/duplicate tabs; Boolean state; Transform; Z-index; 4 control points; animation data; Geometry; Trim Path if eligible; Appearance; Effects; Matte; no Text/Cloner/Particles unless config exists. |
| Square (`custom_box` or Square tool result) | Same modern shape path as rectangle; Geometry if actual type is `custom_box`; Appearance; other common sections. |
| Triangle (`custom_triangle`) | Transform; Z-index; 4 control points; Appearance; Effects; Matte; no Geometry card. |
| Star (`custom_star`) | Transform; Z-index; 4 control points; Appearance; Effects; Matte; no Geometry card. |
| Rhombus (`custom_diamond`) | Transform; Z-index; 4 control points; Appearance; Effects; Matte. |
| Parallelogram (`custom_parallelogram`) | Transform; Z-index; 4 control points; Appearance; Effects; Matte. |
| Freeform (`custom_freeform`) | Transform; Z-index; Vertex editor unless Boolean result; Appearance is eligible for modern freeform; Effects; Matte; no Geometry card. |
| Boolean result | Boolean editor block before Transform; result is `custom_freeform`; Transform; no vertex editor because `booleanOperandIds` exists; Appearance/Effects/Matte and common sections. Header action is Dissolve Boolean. |
| Boolean operand | Normal selected-part Details; Outliner marks Operand. If group context is selected, Boolean block may be available through `selectedBooleanGroup`; operand selection itself does not make a separate operand inspector. |
| Two or more eligible closed shapes selected | Primary selected object Details plus Boolean creation block before Transform; `selectedPartIds` drives eligibility. |
| Multiple objects selected, no Boolean eligibility | Details remains for `selectedPartId` only; no dedicated multi-selection property editor. Outliner highlights all selected IDs. |
| `custom_card` | Geometry, Trim Path if eligible, Appearance only if appearance-eligible, Text card fields, Effects, Matte, plus common Transform. |
| `custom_text` | Transform, Text, Effects, Matte, legacy Color unless modern eligibility says otherwise; no corner Geometry. |
| `custom_banner` | Geometry, Trim Path if eligible, Text, legacy Color/Appearance according to eligibility, Effects, Matte. |
| Image/video | Common Transform, legacy Color if not modern, Effects, Matte; no shape Geometry/control points; matte source eligibility is separately constrained. |
| Cloner / particle system | Common Transform plus CLONER and/or PARTICLES when corresponding config exists; common style sections remain conditional as above. |

`selectedPartId` is the single property-edit target. There is no separate multi-selection inspector UI in the current Details implementation.

## Boolean Inspector Structure

```text
SELECTED BOOLEAN RESULT
│
├── Details actor header
│   ├── Boolean result name
│   ├── Duplicate
│   └── Dissolve Boolean
├── EDIT / DUPLICATE tabs
└── EDIT body
    ├── BOOLEAN operation section
    │   ├── Operation: Union / Subtract / Intersect / Exclude
    │   ├── Edit Operands OR Lock Operands
    │   ├── Operand editing status (when active)
    │   ├── Operand selection buttons
    │   ├── Empty result message (if applicable)
    │   └── Dissolve Boolean
    ├── TRANSFORM
    │   ├── Position / Rotation / Scale
    │   ├── Z-index
    │   ├── No freeform vertex editor for Boolean result
    │   └── Animation Data
    └── STYLE
        ├── Appearance (result is custom_freeform and modern-eligible)
        ├── Effects
        └── Mask / Track Matte
```

For a normal multi-selection of two eligible shapes, the Boolean creation block replaces the Boolean editor block at the same pre-Transform position. For an eligible single selection, the hint is shown instead.

## Edit Mode Structure

### Normal application mode

`App.tsx` renders `PropertyInspector` only when `appMode === 'edit'`. In Broadcast mode the right Inspector is absent; `LiveDirectorPanel` is rendered instead and the bottom area changes to broadcast controls.

### Details Edit tab

The current Details `Edit` tab is a navigation state, not a separate application mode. It shows Transform and Style together in one vertically scrolling body. Boolean operand editing is transient state controlled by `booleanOperandEditingGroupId`; when active, the Boolean section displays Lock Operands and canvas child dragging is enabled by the existing canvas authority.

### Duplicate tab

The Duplicate tab removes Transform and Style from the visible body and shows only four duplicate/mirror actions.

### Path/vector editing

- Regular shapes: `4 CONTROL POINTS (X/Y)` with Edge/Corner submode.
- Freeform non-Boolean: `TransformVertexEditor` with per-point X/Y values.
- Boolean result: no vertex editor in this path because `booleanOperandIds` suppresses it; operand editing occurs through the Boolean workflow and canvas.

### Existing but inactive Inspector components

`KeyframesTab.tsx`, `TransformInOutPresetCard.tsx`, and `SelectedKeyframeSection.tsx` are present in the repository but are not in the current rendered Details import path. Their existence should not be mistaken for visible current sidebar structure.

## Outliner vs Inspector

```text
A. OUTLINER / TEMPLATE ELEMENTS
   PropertyInspector → OutlinerPanel
   Scene tree, selection, visibility, hierarchy, reorder, Boolean/matte badges.

B. INSPECTOR / DETAILS
   PropertyInspector → DetailsPanel
   Selected object summary and property body.

C. OBJECT ACTIONS
   DetailsPanel selected actor header
   Duplicate, Delete, or Dissolve Boolean.
   DuplicateTab also contains copy/mirror object actions.

D. PROPERTY CONTROLS
   TransformTab + StyleTab and their child cards.
   Numeric fields, ranges, selects, color controls, effect/matte settings.

E. EDITING CONTROLS
   Boolean workflow, control-point editor, freeform vertex editor,
   Animation Data actions, and Duplicate tab.
```

These are several systems stacked in one `aside`, separated only by dock panes, a divider, tabs, cards, and spacing. The Outliner is structurally independent from Details but shares the Animator context and selection authority.

## Vertical Space Audit

| Block | Size | Observation |
|---|---|---|
| Width/height resizers | COMPACT | Thin interaction bars. |
| Outliner | MEDIUM | Height is user-adjustable; tree rows remain compact. |
| Details header + actor header + tabs | MEDIUM | Three separate horizontal bands before properties. |
| Transform card | MEDIUM | Position, rotation, and scale nested in one card. |
| 4 Control Points | VERY LARGE | Four point groups plus Edge/Corner mode; can dominate regular-shape Inspector height. |
| Freeform vertex editor | LARGE | One X/Y row per authored point; grows with point count. |
| Animation Data | MEDIUM | Three action buttons and card framing. |
| Appearance | LARGE | Fill and Stroke each contain header, swatch, four numeric channels, hue, alpha, HEX; Stroke adds width/alignment. |
| Legacy Color | MEDIUM | Two color cards and shared inline editors; only non-modern types. |
| Text | MEDIUM to LARGE | Card has several fields; optional stagger delay adds height. |
| Effects | MEDIUM | Shadow controls plus three nested mini-fields when enabled. |
| Mask / Track Matte | VERY LARGE | Source, mode, sliders, gradient controls, and up to four stop rows. |
| Cloner | LARGE | Mode-dependent fields and wave effector controls. |
| Particles | COMPACT to MEDIUM | Three primary controls. |
| Duplicate tab | LARGE | Four tall action buttons with generous padding. |

Observed repeated/nested visual patterns:

- `StyleCard` wraps nearly every Style section as a panel card.
- Transform uses a panel card plus nested field-group cards for rows.
- Effects creates three nested mini-cards inline when shadow is active.
- Appearance has a card, Fill/Stroke groups, and an inner RGBA editor card per property.
- Matte uses a card plus grid fields and inline stop rows.
- Labels repeat section title, field label, and control value in several areas.
- No current StyleCard collapse affordance is rendered; only Outliner root/part tree nodes collapse.

## Hierarchy Audit

Current visual levels are approximately:

```text
LEVEL 1  Right sidebar / dock
LEVEL 2  Outliner or Details
LEVEL 3  Details header, actor header, Edit/Duplicate tab
LEVEL 4  Transform / Style conceptual fragments
LEVEL 5  Panel-card sections (GEOMETRY, APPEARANCE, EFFECTS, etc.)
LEVEL 6  Property groups (FILL, STROKE, POSITION, SCALE, etc.)
LEVEL 7  Field labels and controls
LEVEL 8  Nested control surfaces (RGBA editor, matte stop rows, mini effect cards)
```

The hierarchy is clear in code but visually mixed in several places because Transform and Style are not separate navigation tabs: both render consecutively under Edit. `StyleCard` gives consistent section framing, while Transform uses partly inline-styled cards with different internal density. The Appearance editor intentionally adds another inner control surface for each color property. The Boolean block is conceptually an Edit workflow but is injected before Transform, not grouped under a visible Transform/Boolean parent tab.

## Component Architecture

```text
App.tsx
└── appMode === 'edit'
    └── PropertyInspector.tsx
        ├── sidebar-left-resizer
        ├── OutlinerPanel.tsx
        │   └── tree rows / hierarchy / selection / visibility / reorder
        ├── sidebar-pane-divider
        └── DetailsPanel.tsx
            ├── selected actor header and object actions
            ├── Edit / Duplicate navigation
            ├── TransformTab.tsx
            │   ├── Boolean workflow content (injected ReactNode)
            │   ├── TransformPositionRotationCard.tsx
            │   ├── TransformScaleCard.tsx
            │   ├── TransformZIndexCard.tsx
            │   ├── TransformControlPoints.tsx
            │   ├── TransformVertexEditor.tsx
            │   └── Animation Data buttons
            ├── StyleTab.tsx
            │   ├── StyleGeometrySection.tsx
            │   ├── TrimPathSection.tsx
            │   ├── StyleAppearanceSection.tsx
            │   │   ├── ColorPickerPopover.tsx (current inline shared editor)
            │   │   └── SmartNumberInput.tsx / SmartHexInput.tsx
            │   ├── StyleColorSection.tsx
            │   │   └── ColorPickerPopover.tsx
            │   ├── StyleTextFields.tsx
            │   ├── StyleEffectsSection.tsx
            │   │   └── native input[type=color] remains here
            │   ├── StyleMatteSection.tsx
            │   │   └── native gradient-stop color inputs remain here
            │   ├── StyleClonerSection.tsx
            │   └── StyleParticleSection.tsx
            └── DuplicateTab.tsx
```

Inactive repository components related to prior/alternate Inspector surfaces: `KeyframesTab.tsx`, `TransformInOutPresetCard.tsx`, and `SelectedKeyframeSection.tsx` are not connected to this current tree.

## State / Mutation Flow

```text
Canvas / Outliner selection
  → AnimatorContext selection authority
  → DetailsPanel selectedPartId / selectedPartIds
  → presentational section receives selectedPart + callbacks
  → DetailsPanel callback
  → AnimatorContext setters / domain hooks
  → authored characterParts / tracks state
  → evaluator / renderer / history / serialization
```

`DetailsPanel` is the mutation orchestration boundary for generic part properties. `handlePartPropChange` maps modern appearance keys to `updateShapeAppearance`, trim-path keys to `updateTrimPath`, and otherwise updates the selected part. Transform child components call `updateCurrentTransform` or `updateCurrentPropertyChannel`. Style components are largely presentational and emit callbacks; configuration sections merge their local patch into the selected part config before emitting it.

`StyleAppearanceSection` and `ColorPickerPopover` do not own authoritative color state. The current inline editor derives RGB/HSV and emits color/opacity callbacks. `OutlinerPanel` directly calls context actions for selection, visibility, and reorder. Boolean creation, operation changes, dissolve, and operand selection are orchestrated in `DetailsPanel` and context setters.

## Current Sidebar Wireframe

```text
┌────────────────────────────────────────────┐
│ [drag]  TEMPLATE ELEMENTS                  │
├────────────────────────────────────────────┤
│ ▾  [layers] Scene Elements                 │
│    ⋮ ◉ [icon] Rectangle       ↑ ↓          │
│    ⋮ ◉ [icon] Triangle        ↑ ↓          │
│    ⋮ ◉ [icon] Boolean [Union] ↑ ↓         │
│       └─ Operand                         │
├────────────────────────────────────────────┤
│ N elements (1 selected)                    │
├────────────────────────────────────────────┤
│ [vertical drag divider]                    │
├────────────────────────────────────────────┤
│ [sliders] DETAILS                          │
├────────────────────────────────────────────┤
│ Selected Rectangle                 ⧉  🗑   │
├────────────────────────────────────────────┤
│ [ Activity EDIT ] [ CopyPlus DUPLICATE ]   │
├────────────────────────────────────────────┤
│ [optional BOOLEAN workflow]                │
│   Operation [Union ▼]                      │
│   [Edit Operands] [operand buttons]        │
├────────────────────────────────────────────┤
│ TRANSFORM                                 │
│   POSITION  POS X [....]  POS Y [....]     │
│   ROTATION  ROT [........] [Reset 0°]      │
│   SCALE     SIZE (%) [....] [Locked/Free]  │
├────────────────────────────────────────────┤
│ LAYER ORDER                                │
│   Z-INDEX [....]                           │
├────────────────────────────────────────────┤
│ 4 CONTROL POINTS (X/Y) [Edge] [Corner]     │
│   #1 [X....] [Y....]  #2 [X....] [Y....]   │
│   #3 [X....] [Y....]  #4 [X....] [Y....]   │
├────────────────────────────────────────────┤
│ ANIMATION DATA                             │
│   [Copy Animation] [Paste Animation]       │
│   [Clear Animation]                        │
├────────────────────────────────────────────┤
│ GEOMETRY                                  │
│   CORNER RADIUS [────────] 0px            │
├────────────────────────────────────────────┤
│ APPEARANCE                                │
│   FILL                              [✓]    │
│   [swatch] [R] [G] [B] [A]                 │
│   [hue spectrum----------------------]     │
│   [checkerboard alpha----------------]     │
│   HEX [#......]                            │
│   STROKE                            [✓]    │
│   [swatch] [R] [G] [B] [A]                 │
│   [hue spectrum----------------------]     │
│   [checkerboard alpha----------------]     │
│   HEX [#......]                            │
│   WIDTH [....]   ALIGN [INSIDE/OUTSIDE]    │
├────────────────────────────────────────────┤
│ EFFECTS                                   │
│   SHADOW / GLOW COLOR [native] [HEX]       │
│   [when active] BLUR / OFFSET X / OFFSET Y │
├────────────────────────────────────────────┤
│ MASK / TRACK MATTE                        │
│   MASK SOURCE [None ▼]                    │
│   [when assigned] MODE / INVERTED          │
│   FEATHER / STRENGTH / GRADIENT / STOPS   │
├────────────────────────────────────────────┤
│ [conditional TEXT / CLONER / PARTICLES]   │
└────────────────────────────────────────────┘
```

The wireframe is type-dependent: Geometry, Appearance/Color, Text, Cloner, Particles, Trim Path, and Vertex/Control Point blocks appear or disappear according to the matrix above.

## Potential Information Architecture — Proposal Only

This is grouping only. No implementation was performed and no visual styling is proposed.

```text
RIGHT INSPECTOR
├── OUTLINER
│   └── Template Elements / hierarchy / visibility / reorder
└── DETAILS
    ├── OBJECT
    │   ├── Selected name
    │   ├── Duplicate
    │   ├── Delete / Dissolve
    │   └── Edit / Duplicate navigation
    ├── BOOLEAN / RELATIONSHIPS
    │   ├── Create Boolean
    │   ├── Operation
    │   ├── Operand editing
    │   └── Dissolve
    ├── TRANSFORM
    │   ├── Position / Rotation / Scale
    │   ├── Layer order
    │   └── Control points / vertices
    ├── APPEARANCE
    │   ├── Modern Fill / Stroke
    │   └── Legacy Color
    ├── GEOMETRY / PATH
    │   ├── Corner radius
    │   └── Trim Path
    ├── TEXT
    ├── EFFECTS
    ├── MASK / TRACK MATTE
    ├── CLONER
    ├── PARTICLES
    ├── ANIMATION DATA
    └── DUPLICATION
        ├── Duplicate
        └── Mirror operations
```

This proposal preserves the existing controls and conditions but groups them by information domain. It is not a requested or implemented redesign.

## Observations

1. The current right sidebar is a dock composition, not a single collapsible Inspector tree.
2. Outliner and Details share a container but have separate component ownership and a user-resizable boundary.
3. Details Edit combines Transform and Style in one long body; there is no Style navigation tab.
4. Duplicate is the only explicit Details navigation alternative and replaces the Edit body.
5. Boolean workflow is injected before Transform, so Boolean appears above the main transform card.
6. Modern Appearance is mutually exclusive with legacy Color at the `StyleTab` level.
7. Effects and Matte remain unconditional, which makes the lower Inspector stack present for every selected type.
8. Appearance currently has two matching inline editors, one for Fill and one for Stroke; each editor has one swatch, four numeric channels, hue, alpha, and HEX.
9. Native color inputs remain in Effects and Matte gradient-stop controls; the current Appearance path has none.
10. Regular-shape control points and freeform vertex editing are large vertical consumers; Matte with gradient stops can be larger.
11. `StyleCard` is shared, but many Transform controls use inline style objects rather than the same component abstraction.
12. The outliner footer reports only one selected state despite multi-selection row highlighting.
13. Several Inspector-related files exist but are currently disconnected from rendered Details, especially `KeyframesTab`, `TransformInOutPresetCard`, and `SelectedKeyframeSection`.
14. The current implementation has no dedicated multi-selection property editor; property mutations target `selectedPartId`.

## Questions / Decisions for User

1. Should the next UI decision treat Outliner and Details as two separate products within one dock, or as one unified right-sidebar hierarchy?
2. Should Transform and Style remain one Edit body, or become separate navigation/grouping surfaces?
3. Should Boolean workflow remain above Transform, or be considered an Object/Relationships group?
4. Which large blocks should be candidates for future collapsibility: Control Points/Vertices, Matte, Appearance, Effects, or all Style cards?
5. Should the inactive keyframe/preset Inspector components remain parked, or should their future visibility be explicitly decided before any sidebar restructuring?
6. Is the current one-primary-property mutation behavior acceptable for multi-selection, or should multi-selection property editing become a separately approved scope?
7. Should native color inputs remain in Effects and Matte while only Fill/Stroke stay custom inline?
8. Which information architecture proposal, if any, should be approved before visual redesign work?
