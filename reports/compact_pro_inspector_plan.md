# Compact Pro Inspector Visual Redesign Plan

## Executive Summary

This plan covers a visual-only redesign of the current KCS right Inspector. It is based on `reports/right_inspector_structure_audit.md`, the current source tree, and the current intentional uncommitted Appearance changes. No implementation is performed by this document.

The safest direction is incremental: retain `PropertyInspector`'s dock split and `DetailsPanel` ownership, evolve the existing `StyleCard` into a shared disclosure-capable Inspector section primitive, introduce a narrowly scoped Inspector input token layer in `PropertyInspector.css`, and flatten visual nesting without moving state ownership. Existing callbacks, domain utilities, history, serialization, renderer, and selection behavior remain unchanged.

The only planned behavior correction is the identified hue endpoint thumb bug: preserve a transient UI-only endpoint display value so the thumb remains at the right edge when the pointer reaches 360°, while the authored color remains normalized exactly as today.

## Approved Design Direction

```text
DETAILS
Selected Object                                             actions

[ EDIT ] [ DUPLICATE ]

▼ TRANSFORM
────────────────────────────────────────
Position       X [value]       Y [value]
Rotation       [value°]        Reset
Scale          [value%]        Locked / Free
Layer          [value]

▼ GEOMETRY
────────────────────────────────────────
Control Points                         Edge | Corner
             X                  Y
Left         [value]            [value]
Right        [value]            [value]
Top          [value]            [value]
Bottom       [value]            [value]
Corner Radius [value]

▼ APPEARANCE
────────────────────────────────────────
Fill                                      ✓
[swatch] R[value] G[value] B[value] A[value]
         [ HUE ======================== ]
         [ ALPHA ====================== ]
         HEX [value]

Stroke                                    ✓
[swatch] R[value] G[value] B[value] A[value]
         [ HUE ======================== ]
         [ ALPHA ====================== ]
         HEX [value]
Width [value]
Alignment [ INSIDE | OUTSIDE ]

▶ TRIM PATH
▶ EFFECTS
▶ MASK / TRACK MATTE
▶ ANIMATION DATA
```

This is a grouping and visual hierarchy target, not a request to redesign product behavior or the Outliner.

## Current Problems

1. Most Style sections are `StyleCard` panel cards, while Transform uses partly inline-styled nested cards. The visual language is inconsistent.
2. Several controls use black/near-black panel backgrounds, so editable surfaces are not always distinguishable from containers.
3. Control Points use four large independent point groups and can dominate the Details height.
4. Transform, Style, Boolean workflow, and Animation Data are concatenated in one Edit body with no disclosure controls.
5. Appearance currently has the correct inline Fill/Stroke editor but still presents an inner editor-card treatment that can read as card-inside-card.
6. Effects uses three nested mini-cards when shadow is active; Matte can grow substantially with gradient stops.
7. Duplicate actions use tall buttons and consume disproportionate height.
8. The Inspector width is user-resizable from a minimum of 250px, so fixed multi-column assumptions must be tested at narrow width.
9. The hue slider currently derives its thumb from normalized HSV hue. At the right endpoint, 360° becomes 0° and the thumb jumps left even though the resulting color is equivalent.
10. Native color inputs remain intentionally present in Effects and Matte gradient-stop controls; only Fill/Stroke are in scope for the custom inline editor.

## Design Principles

- Visual-only by default: no authored-data, callback, history, serialization, renderer, or selection changes.
- One authority per behavior: reuse `StyleCard`, existing input components, `DetailsPanel`, and existing pure utilities.
- Editable surfaces are the darkest surfaces; containers use panel/surface backgrounds.
- Reduce rectangles before reducing information.
- Use separators, spacing, and disclosure state before adding nested cards.
- Keep KCS dark neutral surfaces and cyan/teal accents; no copied branding.
- Preserve the current one-swatch-per-Fill/Stroke rule.
- Preserve existing model units: color as hex and opacity as 0–1; A remains a display conversion only.
- Narrow width must wrap or stack deliberately, never clip or overflow.
- Collapse is UI state only and must never enter scene history or serialization.

## Visual Token Proposal

Reuse existing global tokens from `src/index.css`:

- Surfaces: `--bg-darkest`, `--bg-dark`, `--bg-panel`, `--bg-panel-hover`, `--bg-input`.
- Borders: `--border-color`, `--border-light`, `--border-accent`.
- Text: `--text-primary`, `--text-secondary`, `--text-muted`.
- Accents: `--accent-teal`, `--accent-cyan`, `--accent-green`, `--accent-red`, existing per-domain colors.
- Typography: `--font-main`, `--font-mono`, existing caption/body/micro sizes.
- Spacing: existing 2/4/8/12/16px grid (`--space-3xs` through `--space-md`).
- Radius: existing 4/6/10px scale; avoid introducing larger radii.

Add only Inspector-local aliases if repeated CSS makes intent clearer, for example in the `.motion-design-right-sidebar` scope:

```text
--inspector-section-gap: 8px
--inspector-section-padding: 8px
--inspector-row-gap: 6px
--inspector-control-height: 24px
--inspector-label-size: 10px
```

These should alias existing values where possible. Do not create a global second design system or modify generic application input rules.

## Input Language

### Editable surfaces

Standardize, within the Inspector scope only:

- Near-black `var(--bg-input)` background.
- `var(--border-color)` border; `var(--border-light)` on hover/focus where appropriate.
- 4px radius.
- 22–26px height depending on control type.
- `var(--text-primary)` value text.
- Right-aligned numeric values; monospace may be used only where existing conventions support it.
- Cyan/teal focus ring using existing accent token.
- Compact `°`, `%`, and `px` suffixes rendered beside or inside the row, not in extra cards.

Apply through scoped classes shared by `SmartNumberInput`, `SmartHexInput`, normal number/text/select fields, and appearance controls. Do not rewrite their event, commit, validation, or history behavior.

### Non-editable surfaces

- Section headers, group wrappers, point matrix rows, and explanatory text use `var(--bg-panel)` or transparent backgrounds.
- No black fill that visually imitates an input.
- Borders are separators or subtle outlines, not repeated input-like boxes.

### Labels and focus

Use four levels maximum:

1. Section header: 11px, 700–800, uppercase, 0.4–0.6px tracking.
2. Property group: 10–11px, 700, primary/secondary color.
3. Property label: 9–10px, 600–700, muted, uppercase where current UI is uppercase.
4. Value/input: 10–12px, 600–700, primary; numeric values right-aligned.

Retain visible `:focus-visible` states. Custom hue/alpha sliders keep keyboard focus and ARIA semantics.

## Section System

### Recommendation

Evolve `StyleCard` rather than introduce a parallel `InspectorSection` immediately. `StyleCard` already owns the shared Style section shell and is used by Geometry, Appearance, Text, Effects, Matte, Cloner, and Particles. Extend it with optional disclosure props while preserving the current default rendering contract.

Proposed conceptual interface:

```ts
interface StyleCardProps {
  title: string;
  icon?: React.ReactNode;
  color?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}
```

If Transform and Boolean need the same shell, extract a thin shared visual primitive only after confirming the StyleCard extension cannot serve both without awkward semantics. The primitive must remain presentational; disclosure state belongs in the section component, not AnimatorContext.

### Standard visual contract

Every collapsible section receives:

- Same 28–32px header height.
- Same horizontal padding.
- Same title typography.
- Same disclosure icon/button with `aria-expanded` and `aria-controls` where practical.
- Same separator below the header.
- Same 6–8px content gap.
- No authored data changes on toggle.

### Proposed initial states

| Section | Initial state | Reason |
|---|---|---|
| Transform | OPEN | Primary editing surface. |
| Geometry | OPEN when present | Frequent shape adjustment. |
| Appearance | OPEN | Approved primary color/stroke workflow. |
| Boolean | OPEN for selected Boolean result; open for active creation context | Relationship is central to selected result. |
| Text | OPEN for text/card/banner | Primary content editing. |
| Trim Path | CLOSED | Specialized, lower-frequency control. |
| Effects | CLOSED | Secondary styling. |
| Mask / Track Matte | CLOSED | Large advanced section. |
| Animation Data | CLOSED | Secondary transfer/clear actions. |
| Cloner | CLOSED | Specialized configuration. |
| Particles | CLOSED | Specialized configuration. |

### Collapse state scope

Use local component state for the first pass. State persists while the component remains mounted and resets on selection change/remount. Do not persist to localStorage, SceneData, or project JSON. Do not add a context-level collapse store. If later user testing requires session persistence, approve that separately.

## Collapse Behavior

- Disclosure button is the only collapse target; clicking labels/controls must not toggle the section.
- Header action must stop at the header boundary and never wrap property inputs.
- Collapsed sections retain their authored values and mounted mutation paths are untouched.
- A collapsed section must not unmount stateful editors in a way that commits or resets authored values; where a child has transient editing buffers, preserve existing component behavior or keep the child mounted but hidden only if required by evidence.
- `aria-expanded=false` and visible header affordance are required.
- No animation is needed initially; avoid height-transition timing complexity.

## Transform Plan

### Files

- `src/components/Inspector/sections/TransformTab.tsx`
- `src/components/Inspector/sections/transform/TransformPositionRotationCard.tsx`
- `src/components/Inspector/sections/transform/TransformScaleCard.tsx`
- `src/components/Inspector/sections/transform/TransformZIndexCard.tsx`
- `src/components/Inspector/PropertyInspector.css`
- Possibly `src/components/Inspector/sections/style/StyleCard.tsx` if the shared shell is extended.

### Visual objective

Flatten the unified Transform card into one section with compact property rows. Keep Position X/Y as a two-column row, Rotation with Reset, Scale with Locked/Free, and Layer/Z-index as a compact row. Replace repeated dark mini-cards with panel-background rows and only editable controls in `bg-input`.

### Frozen behavior

- `updateCurrentTransform`, coordinate conversion, rotation reset, scale locking, keyboard editing, and history: **NONE** changed.
- `TransformZIndexCard` callback: **NONE** changed.
- Animation channel updates: **NONE** changed.

### Tests/QA

Run existing transform, coordinate-unit, selection, keyboard, and history tests. Manually verify X/Y, rotation/reset, scale lock, Z-index, narrow/wide widths, and one undo per established action.

## Control Points Plan

### Exact component

Change only `src/components/Inspector/sections/transform/TransformControlPoints.tsx` plus scoped CSS if needed. Do not change `TransformVertexEditor.tsx` in the same pass except for shared input classes.

### Visual objective

Replace four independently framed point groups with a compact matrix:

```text
4 CONTROL POINTS (X/Y)                 [EDGE] [CORNER]
             X                         Y
Left         [input]                   [input]
Right        [input]                   [input]
Top          [input]                   [input]
Bottom       [input]                   [input]
```

Retain the current `pointMode`, exact point calculations, opposite-anchor semantics, coordinate scaling, and `onUpdate` callback. The matrix is a rendering/layout change only.

### Frozen behavior

- Edge/Corner mode and labels: **NONE** changed.
- Values, callbacks, geometry semantics, keyboard editing, selection, and undo/redo: **NONE** changed.

### Tests/QA

Run current control-point and canvas interaction coverage. Manually test Edge and Corner modes for rectangle, triangle, star, rhombus, and parallelogram; edit all four rows; undo/redo; narrow Inspector.

## Appearance Plan

### Files

- `src/components/Inspector/sections/style/StyleCard.tsx`
- `src/components/Inspector/sections/style/StyleAppearanceSection.tsx`
- `src/components/Inspector/inputs/ColorPickerPopover.tsx`
- `src/components/Inspector/PropertyInspector.css`
- `src/utils/colorUtils.ts` only if the endpoint fix requires a narrowly scoped helper; no authored model change.

### Visual objective

Keep the current inline editor and one swatch per property, but flatten the visual hierarchy:

```text
APPEARANCE
  FILL [toggle]
  swatch + R/G/B/A
  hue
  alpha
  HEX
  separator
  STROKE [toggle]
  swatch + R/G/B/A
  hue
  alpha
  HEX
  width
  alignment
```

The RGBA editor should visually read as a group, not a black card nested inside Fill and Appearance cards. Do not restore popup state or native Fill/Stroke color input.

### Frozen behavior

- Fill/Stroke model fields, callbacks, one-swatch rule, alpha units, HEX behavior, enable hit targets, CENTER compatibility, selection, history, serialization: **NONE** changed.
- Hue endpoint thumb display is the only separately identified behavior correction; see Hue Endpoint Bug Analysis.

### Tests/QA

Existing appearance unit/component tests plus utility tests. Manual Fill/Stroke RGB/A/HEX/hue/alpha, immediate canvas updates, one swatch, no native popup, independent toggles, CENTER/Outside mapping, undo/redo, save/reload, narrow/wide widths.

## Hue Endpoint Bug Analysis

### Current behavior

`ColorPickerPopover` derives HSV from the controlled RGB color. Hue pointer position maps normalized `[0,1]` to `0..360`; HSV normalization maps 360° back to 0°. The thumb position is then derived from the controlled color's normalized HSV hue, so a pointer at the right endpoint causes a visually discontinuous jump to the left endpoint.

### Safest fix

Keep authored color semantics unchanged and add only transient UI state in the color editor:

- On pointer interaction, retain a `displayHue` ref/state representing the latest pointer position in `0..360`.
- Emit the same normalized RGB color through `hsvToRgb`; do not serialize hue.
- While the current interaction/color corresponds to the just-emitted hue, render the thumb from `displayHue` rather than normalized HSV hue.
- When the pointer moves away from the endpoint, update display position normally.
- On external color changes, selection changes, HEX/RGB edits, or remount, derive the display hue from the controlled color again.
- Treat 360 as a visual endpoint alias for 0 only in transient UI state.

This avoids a second authored hue field and avoids changing serialization. The implementation must define a deterministic reset rule so an external color change cannot leave a stale endpoint thumb.

### Required tests

- Pointer at 0% and 100% produces equivalent endpoint colors but distinct visual indicator positions during the interaction.
- Pointer movement from right endpoint toward left moves continuously.
- External color prop update resets indicator to derived hue.
- No extra SceneData field or callback is introduced.

## Remaining Sections Plan

### Trim Path

- Files: `TrimPathSection.tsx`, shared section/input CSS.
- Visual: default closed disclosure, compact three-range property rows.
- Behavior change: **NONE**.
- Preserve eligibility and `updateTrimPath` callback.
- QA: enable/start/end/offset, save/reload, undo, narrow width.

### Effects

- Files: `StyleEffectsSection.tsx`, shared CSS.
- Visual: default closed; flatten nested blur/offset mini-cards into compact rows. Keep native color input only for Effects, explicitly outside Fill/Stroke.
- Behavior change: **NONE**.
- Preserve shadow clear and optional-field condition.
- QA: shadow color, clear, blur, offsets, no impact on appearance native-input count.

### Mask / Track Matte

- Files: `StyleMatteSection.tsx`, shared CSS.
- Visual: default closed; compact source/mode/toggle rows; stop rows remain readable without card duplication.
- Behavior change: **NONE**.
- Preserve all matte eligibility, gradient, feather, strength, enabled, remove, and compatibility behavior.
- QA: source, mode, inverted, feather, strength, gradient linear/radial/stops, missing source, save/reload, Boolean coexistence.

### Animation Data

- Files: `TransformTab.tsx` and the existing Animation Data block.
- Visual: move into a collapsible `ANIMATION DATA` section, default closed.
- Behavior change: **NONE**.
- Do not wire currently inactive `KeyframesTab` or `TransformInOutPresetCard` into the UI as part of this visual pass.

### Boolean

- Files: `DetailsPanel.tsx` only if a presentational wrapper is required; otherwise `TransformTab.tsx`/shared section CSS.
- Visual: use the same disclosure header and input styling; leave Boolean content and position before Transform.
- Behavior change: **NONE**.
- Preserve creation, operation, operand editing/locking, operand selection, dissolve, naming, lifecycle, and geometry.

### Text, Cloner, Particles

- Files: respective existing sections and shared CSS only.
- Visual: use the common section shell and input language; preserve conditional rendering and config patches.
- Behavior change: **NONE**.
- QA each relevant type/configuration and narrow width.

### Duplicate Tab

- Files: `DuplicateTab.tsx`, shared CSS only.
- Visual: compact consistent action rows/buttons; do not change ordering or action semantics.
- Behavior change: **NONE**.

## Responsive Inspector Behavior

`PropertyInspector` remains user-resizable, with current minimum width 250px and maximum viewport-constrained width. Do not alter the dock architecture or Outliner/Details divider.

Rules:

- At 250–300px, use `minmax(0, 1fr)` and allow RGBA channel rows to wrap only if measured controls cannot fit; never use fixed widths that overflow.
- Preferred appearance row: swatch plus four compact channels; fallback: swatch on first line and four channels on the next line.
- Position X/Y and point matrix use two columns where readable; stack only when actual client width requires it.
- Section content must satisfy `scrollWidth <= clientWidth` in normal and narrow supported viewports.
- Use CSS grid/flex with `min-width: 0`; no viewport-specific magic numbers beyond existing dock constraints.
- Test at minimum 250px/300px/400px/750px sidebar widths and normal 900px/1440px desktop viewports.

## Component Impact Map

| Component | Current responsibility | Proposed visual change | Behavior change? | Risk | Tests protecting it |
|---|---|---|---|---|---|
| `PropertyInspector.tsx` | Dock shell and resizers | None beyond shared CSS compatibility | NONE | Low | sidebar width/height E2E |
| `OutlinerPanel.tsx` | Tree, selection, visibility, reorder | Out of scope; ensure token compatibility only | NONE | Low | outliner, selection, reorder E2E |
| `DetailsPanel.tsx` | Selected header, Boolean orchestration, mutation callbacks | Optional presentational section wrapper only | NONE | High if touched; avoid unless required | Boolean, history, property E2E |
| `StyleCard.tsx` | Shared Style card shell | Add disclosure presentation and consistent header spacing | NONE | Medium | style component tests |
| `TransformTab.tsx` | Transform composition and Boolean injection | Group/disclose Animation Data; flatten visual wrappers | NONE | Medium | transform, animation, Boolean E2E |
| `TransformPositionRotationCard.tsx` | Position/rotation controls | Property-row layout/classes | NONE | Low | coordinate/transform tests |
| `TransformScaleCard.tsx` | Scale and aspect lock | Property-row layout/classes | NONE | Low | scale/selection tests |
| `TransformZIndexCard.tsx` | Layer order field | Compact row styling | NONE | Low | layer-index tests |
| `TransformControlPoints.tsx` | Edge/Corner control-point authoring | Compact matrix rendering | NONE | Medium | canvas/control-point E2E |
| `TransformVertexEditor.tsx` | Freeform vertex authoring | Shared row/input styling | NONE | Medium | freeform E2E |
| `StyleTab.tsx` | Ordered conditional Style composition | No condition/order changes | NONE | Low | appearance/style E2E |
| `StyleAppearanceSection.tsx` | Modern Fill/Stroke controls | Flatten group presentation | NONE | Medium | appearance component/E2E |
| `ColorPickerPopover.tsx` | Shared controlled inline RGBA editor | Flatten CSS; fix transient hue endpoint display | NONE except hue endpoint UI bug | Medium | color utility/component/E2E |
| `StyleColorSection.tsx` | Legacy color editor | Shared input styling only | NONE | Low | style component tests |
| `TrimPathSection.tsx` | Trim authoring | Disclosure/row styling | NONE | Low | trim E2E |
| `StyleEffectsSection.tsx` | Shadow/glow authoring | Flatten nested effect fields | NONE | Medium | effects/style tests |
| `StyleMatteSection.tsx` | Matte authoring | Disclosure/row styling | NONE | High; preserve SVG contracts | matte pixel/E2E |
| `StyleTextFields.tsx` | Text/card/banner content | Common row/input styling | NONE | Low | text E2E |
| `StyleClonerSection.tsx` | Cloner config | Common row/input styling | NONE | Medium | cloner tests |
| `StyleParticleSection.tsx` | Particle config | Common row/input styling | NONE | Medium | particle tests |
| `DuplicateTab.tsx` | Duplicate/mirror actions | Compact button styling only | NONE | Low | duplicate E2E |
| `SmartNumberInput.tsx` | Numeric input commit/validation | Consume scoped input class if needed | NONE | Medium | numeric/history tests |
| `SmartHexInput.tsx` | Hex editing buffer/commit | Consume scoped input class if needed | NONE | Medium | appearance tests |
| `PropertyInspector.css` | Inspector and section styles | Main visual token/layout implementation | NONE | Medium | visual E2E/layout assertions |
| `src/index.css` | Global tokens | Prefer no changes; aliases only if justified | NONE | Medium | build/full regression |
| `src/utils/colorUtils.ts` | Current pure color conversion | No authored model change; endpoint support only if needed | NONE except hue endpoint UI bug | Medium | color utility tests |

## Current Wireframe

```text
┌────────────────────────────────────────────┐
│ TEMPLATE ELEMENTS                          │
├────────────────────────────────────────────┤
│ ▾ Scene Elements                           │
│   ⋮ ◉ [icon] Selected Rectangle       ↑ ↓  │
│   ⋮ ◉ [icon] Triangle                  ↑ ↓│
├────────────────────────────────────────────┤
│ 2 elements (1 selected)                    │
├────────────────────────────────────────────┤
│ [horizontal resize divider]                │
├────────────────────────────────────────────┤
│ [sliders] DETAILS                          │
├────────────────────────────────────────────┤
│ Selected Rectangle                    ⧉ 🗑  │
├────────────────────────────────────────────┤
│ [EDIT]                         [DUPLICATE] │
├────────────────────────────────────────────┤
│ [optional BOOLEAN card]                    │
├────────────────────────────────────────────┤
│ [TRANSFORM panel card]                     │
│   POSITION                                 │
│   [POS X card/input] [POS Y card/input]    │
│   ROTATION [input] [Reset 0°]             │
│   SCALE [input] [Locked/Free]              │
├────────────────────────────────────────────┤
│ [LAYER ORDER panel card]                  │
│   Z-INDEX [input]                          │
├────────────────────────────────────────────┤
│ [4 CONTROL POINTS panel card]              │
│   [Left card] [Right card]                 │
│   [Top card]  [Bottom card]                │
├────────────────────────────────────────────┤
│ [ANIMATION DATA panel card]                │
│   [Copy] [Paste] [Clear]                   │
├────────────────────────────────────────────┤
│ [GEOMETRY card] CORNER RADIUS [range]     │
├────────────────────────────────────────────┤
│ [APPEARANCE card]                          │
│   FILL [swatch] [R][G][B]  [A]             │
│   [hue range] [alpha range] HEX            │
│   STROKE [swatch] [R][G][B] [A]            │
│   [hue range] [alpha range] HEX            │
│   WIDTH [input] ALIGN [select]             │
├────────────────────────────────────────────┤
│ [EFFECTS card]                             │
│   SHADOW/GLOW [native] [HEX] [Clear]       │
├────────────────────────────────────────────┤
│ [MASK / TRACK MATTE card]                  │
│   SOURCE [select] ...                      │
└────────────────────────────────────────────┘
```

## Proposed Wireframe

```text
┌────────────────────────────────────────────┐
│ TEMPLATE ELEMENTS                          │
├────────────────────────────────────────────┤
│ ▾ Scene Elements                           │
│   ⋮ ◉ [icon] Selected Rectangle       ↑ ↓  │
│   ⋮ ◉ [icon] Triangle                  ↑ ↓│
├────────────────────────────────────────────┤
│ 2 elements (1 selected)                    │
├────────────────────────────────────────────┤
│ DETAILS                              ⧉  🗑 │
│ Selected Rectangle                         │
├────────────────────────────────────────────┤
│ [ EDIT ] [ DUPLICATE ]                     │
├────────────────────────────────────────────┤
│ ▼ TRANSFORM                               │
│   Position  X [value]   Y [value]          │
│   Rotation [value°]       [Reset]          │
│   Scale    [value%]       [Locked]         │
│   Layer    [value]                         │
├────────────────────────────────────────────┤
│ ▼ GEOMETRY                                │
│   Control Points       [EDGE] [CORNER]     │
│             X             Y                │
│   Left   [value]       [value]             │
│   Right  [value]       [value]             │
│   Top    [value]       [value]             │
│   Bottom [value]       [value]             │
│   Radius [value]                         │
├────────────────────────────────────────────┤
│ ▼ APPEARANCE                              │
│   Fill                              [✓]    │
│   [■] R[value] G[value] B[value] A[value]  │
│       [ HUE ========================== ]   │
│       [ ALPHA ======================== ]   │
│       HEX [value]                          │
│   ───────────────────────────────────────  │
│   Stroke                            [✓]    │
│   [■] R[value] G[value] B[value] A[value]  │
│       [ HUE ========================== ]   │
│       [ ALPHA ======================== ]   │
│       HEX [value]                          │
│   Width [value]  Align [INSIDE/OUTSIDE]    │
├────────────────────────────────────────────┤
│ ▶ TRIM PATH                               │
├────────────────────────────────────────────┤
│ ▶ EFFECTS                                 │
├────────────────────────────────────────────┤
│ ▶ MASK / TRACK MATTE                      │
├────────────────────────────────────────────┤
│ ▶ ANIMATION DATA                          │
└────────────────────────────────────────────┘
```

## Implementation Passes

### PASS 1 — Inspector-local tokens and input language

- Files: `PropertyInspector.css`; possibly scoped class usage in `SmartNumberInput.tsx`, `SmartHexInput.tsx`, and relevant section files.
- Objective: distinguish editable `bg-input` surfaces from panel containers; standardize control height, border, radius, focus, label, unit, and row spacing.
- Untouched: all callbacks, values, state, history, serialization, renderer, Outliner.
- Tests: existing Inspector/component tests; TypeScript; focused layout E2E.
- Manual QA: numeric/text/select/HEX focus and commit; narrow/wide width; no overflow.
- Rollback: revert CSS/class-only changes.

### PASS 2 — Shared section/disclosure primitive

- Files: `StyleCard.tsx`, `PropertyInspector.css`; wrapper changes only where needed.
- Objective: standard header/disclosure affordance and local UI-only open state.
- Untouched: authored state and all section callbacks.
- Tests: section render/conditional tests; accessibility assertions.
- Manual QA: open/close each section; confirm controls do not toggle sections accidentally; selection-change reset behavior.
- Rollback: remove optional disclosure props and restore always-open shell.

### PASS 3 — Transform and Control Points flattening

- Files: `TransformTab.tsx`, transform card components, `TransformControlPoints.tsx`, shared CSS.
- Objective: compact property rows and point matrix.
- Untouched: transform math, control-point semantics, callbacks, channels, history, selection.
- Tests: coordinate, transform, control-point, canvas interaction, undo/redo E2E.
- Manual QA: all transform fields, Edge/Corner, four shape families, narrow/wide.
- Rollback: revert presentation-only component markup/CSS.

### PASS 4 — Appearance flattening and hue endpoint fix

- Files: `StyleAppearanceSection.tsx`, `ColorPickerPopover.tsx`, `PropertyInspector.css`, `colorUtils.ts` only if required, appearance tests.
- Objective: flatten Fill/Stroke hierarchy while retaining one swatch and all inline controls; make the hue thumb continuous at 360°.
- Untouched: color model, alpha units, mutation gateway, history/serialization, CENTER compatibility.
- Tests: color utility/component tests, appearance E2E, hue endpoint tests, save/reload and undo/redo.
- Manual QA: RGB/A/HEX, hue endpoints/drag, alpha, one swatch, Fill/Stroke independence, no native popup.
- Rollback: revert editor display state and CSS; preserve prior checkpoint editor behavior if endpoint fix must be isolated.

### PASS 5 — Remaining Style sections

- Files: `TrimPathSection.tsx`, `StyleEffectsSection.tsx`, `StyleMatteSection.tsx`, `StyleTextFields.tsx`, `StyleClonerSection.tsx`, `StyleParticleSection.tsx`, shared CSS.
- Objective: apply disclosure and compact rows without changing conditions or data flow.
- Untouched: matte SVG pipeline, text data, cloner/particle config semantics, native controls outside Appearance.
- Tests: trim, matte pixel/E2E, text, cloner, particle, serialization tests.
- Manual QA: each conditional type/config and collapsed/open persistence during selection.
- Rollback: section-by-section revert, not a broad source reset.

### PASS 6 — Duplicate visual consistency

- Files: `DuplicateTab.tsx`, shared CSS.
- Objective: reduce excessive button height and match input/section language.
- Untouched: Duplicate/Mirror action order and callbacks.
- Tests: duplicate/mirror E2E.
- Manual QA: all four actions and narrow width.
- Rollback: restore prior button CSS/markup.

### PASS 7 — Regression verification and user QA gate

- Files: no product files unless a separately approved defect is found; report update only.
- Objective: run focused tests, full Vitest, relevant/full E2E, typecheck, build, lint, diff check; complete browser QA.
- Untouched: all frozen systems.
- Tests: repository regression workflow in canonical order.
- Manual QA: complete matrix below.
- Rollback: no automatic rollback; stop and report any unexpected scope or failure.

## Regression Risk Analysis

Overall planned risk: MEDIUM due to broad visual surface area and custom disclosure state, despite behavior freeze.

- Low: scoped CSS/input styling; no state or data changes.
- Medium: `StyleCard` disclosure state and Transform/Control Points markup because accidental event boundaries or unmount behavior could affect editing.
- Medium: Appearance hue endpoint transient state because controlled color updates can race visual derivation if reset rules are vague.
- High: Matte section markup if SVG-related controls or conditional defaults are accidentally altered; keep changes presentational and run pixel regression.
- High: touching `DetailsPanel`, AnimatorContext, renderer, geometry, or history. Avoid unless a proven visual seam requires a minimal change and obtain fresh approval.

No implementation pass is complete if it changes the frozen behavior list or introduces a second state/mutation authority.

## Automated Test Plan

### Component/unit

- Existing `styleAppearanceSection.test.tsx`, `shapeAppearance.test.ts`, `colorUtils.test.ts`.
- Add disclosure tests: `aria-expanded`, default state, toggle isolation, no authored callback.
- Add Control Points matrix tests preserving Edge/Corner values and callbacks.
- Add input class/render tests only where behavior cannot be covered at the user seam.
- Add hue endpoint test: right endpoint indicator remains right while emitted color is normalized equivalent.

### E2E

- Existing `shape-appearance-bounds.spec.ts`, `stroke-alignment-v2.spec.ts`, `editor-interaction.spec.ts`, `interactive-shape-creation-v1.spec.ts`, `v51-manual-qa.spec.ts`, and relevant matte/trim/freeform specs.
- Add a dedicated Appearance Inspector E2E only if no existing stable seam can cover hue and Fill/Stroke interactions. It must seed/select a rectangle through the real UI or established test fixture and assert authored localStorage values, visible canvas/DOM effects, undo/redo, and no native popup.
- Assert no overflow at minimum supported sidebar width and no duplicate preview/editor surfaces.

### Required regression commands

1. Focused tests.
2. Relevant E2E.
3. `npm test`.
4. `npm run test:e2e`.
5. `npx tsc --noEmit`.
6. `npm run build`.
7. `npm run lint`.
8. `git diff --check`.

Record actual counts and failures; do not weaken assertions, add retries, sleeps, or tolerance hacks.

## Manual QA Plan

### Transform

- X/Y values and coordinate display.
- Rotation and Reset 0°.
- Scale value and Locked/Free.
- Z-index.
- Control Points Edge and Corner modes; Left/Right/Top/Bottom.
- Freeform vertex editor separately.

### Appearance

- Fill enable control and inert header empty space.
- Stroke enable control and inert header empty space.
- Exactly one primary swatch in each property.
- R/G/B numeric edits and immediate canvas update.
- A numeric edit at 0, mid, and 255; authored opacity remains 0–1.
- HEX edit and external controlled refresh.
- Hue click/drag, keyboard arrows/Home/End, and right endpoint thumb continuity.
- Alpha click/drag and keyboard control.
- Fill/Stroke independence.
- Stroke width and Inside/Outside; internal CENTER compatibility.
- No white native popup and no duplicate RGB editor.

### System and selection

- Undo/redo for Fill color, Stroke color, Fill alpha, Stroke alpha, width, alignment.
- Save/reload appearance values.
- Switch selected objects and verify no stale values.
- Narrow and wide Inspector; no clipping/overflow.
- Rectangle, Square/box, Triangle, Star, Rhombus, Parallelogram, Freeform.
- Boolean result and Boolean operand; Boolean creation and dissolve remain unchanged.
- Effects/Matte native controls remain outside Fill/Stroke scope.
- Outliner selection, visibility, reorder, and resizer behavior.

## Explicitly Frozen Behavior

The following MUST remain unchanged:

- Selection and multi-selection.
- Marquee selection.
- Boolean geometry, naming, lifecycle, operand hierarchy, editing, locking, and dissolve.
- Transform semantics and coordinate conversions.
- Control-point and freeform vertex semantics.
- Animation channels, playback, broadcast, and timeline behavior.
- Trim Path semantics.
- Appearance data model, Fill/Stroke independence, alpha units, and CENTER compatibility.
- Serialization, save/load, migration, and localStorage authorities.
- Undo/redo and history grouping.
- Keyboard editing and drag behavior.
- Renderer, matte SVG coordinate contracts, and Outliner behavior.
- Existing conditional rendering and inactive component status.

## Out of Scope

- Outliner redesign.
- Functional Boolean changes.
- Functional Duplicate changes.
- New multi-selection appearance editing.
- New object-level opacity.
- New animation/preset Inspector wiring.
- Native color input removal from Effects or Matte.
- Global design-system rewrite or new dependency.
- Renderer, geometry, evaluator, serialization, or state-store refactor.
- Commit, push, branch, merge, reset, stash, or unrelated cleanup.

## Questions Requiring User Approval

1. Approve evolving `StyleCard` into the disclosure-capable shared section shell, or require a separate `InspectorSection` name?
2. Approve local disclosure state that resets on selection/remount and is not persisted?
3. Approve initial open states: Transform, Geometry, Appearance; Boolean/Text contextually open; advanced sections closed?
4. Approve flattening Transform and Control Points markup in their owning components while preserving callbacks exactly?
5. Approve A as 0–255 display units mapped to existing 0–1 authored opacity?
6. Approve the transient hue endpoint display state as the only behavior correction in an otherwise visual pass?
7. Approve keeping native color controls in Effects and Matte while Fill/Stroke remain custom?
8. Approve the pass order and rollback boundaries above?
9. If full E2E remains affected by the known unrelated baseline failures, should validation report them without blocking user visual QA, or should the next work first isolate a deterministic baseline run?

## Final Recommendation

Approve the smallest staged implementation beginning with PASS 1 and PASS 2. Do not start with a broad component rewrite. The current architecture already provides the required seams: `StyleCard` for shared section presentation, component-local state for disclosure, scoped Inspector CSS for input language, and existing section callbacks for all authored behavior.

After PASS 2, obtain a visual checkpoint review before changing Transform/Control Points. After PASS 4, obtain a dedicated Appearance manual QA review before applying the same visual treatment to Matte and other large sections. Keep every pass independently revertible and run the frozen-behavior regression suite after each pass.
