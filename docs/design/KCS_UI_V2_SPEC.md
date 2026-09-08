# KCS UI Design V2 Specification

## Product direction

Professional creative-tool desktop UI: dense, precise, calm, dark, technical, motion-design focused. Avoid generic SaaS patterns, card-everywhere composition, excessive gradients, decorative glow, oversized controls, and inconsistent iconography.

## Shared visual authority

- Primary authority: `src/kcsEditorTheme.css` for semantic editor surfaces, text, borders, accents, spacing, controls, radii, focus, motion, and reduced motion.
- Compatibility authority: existing `src/index.css` variables; do not create a competing theme.
- Existing icon family: `lucide-react`.
- Controls: compact 24/28/32px rhythm; minimum 24px interactive hit area.
- Values: JetBrains Mono/tabular numerics; units separated with a space or non-breaking space where appropriate.
- Radii: restrained 3–5px panel/control radii; no decorative pills except status/segmented controls where semantically useful.
- Focus: visible `:focus-visible`, unobscured by shell or overlay.
- Motion: explicit opacity/transform/background transitions only; reduced-motion disables nonessential transitions.
- Color: teal for primary action and meaningful active/selection state; muted neutral fills for secondary states; danger and warning remain semantic.

## Invariants

- Header height: 79px.
- Left navigation width: 56px.
- Center canvas, right Outliner/Inspector, bottom Timeline arrangement remains.
- AnimatorContext, evaluator, timeline mutation, serialization, history, mask, Track Matte, OGraf, and keyframe authorities remain unchanged.
- Existing public props, keyboard behavior, and serialized fields remain compatible.

## Screen specifications

### A. Application Shell / Header

- Current problem: mode toggles, save status, and Export compete for teal attention.
- Target hierarchy: template identity → mode segmented control → passive save/FPS status → Import/Export actions.
- Grouping: one compact header row; preserve internal flex behavior and 79px frame.
- Spacing: 6–8px gaps; 28–30px controls; no new vertical expansion.
- Typography: 10–12px UI labels, medium/semibold; tabular FPS/status values.
- States: active mode uses muted fill plus text; Export remains the primary solid action; save is passive.
- Reference principles: functional color, deliberate alignment, no excessive chrome.
- Behavior unchanged: mode switching, FPS selection, Import, Export, Reset, template tabs.

### B. Toolbar

- Current problem: active drawer border and centered dropzone feel generic.
- Target hierarchy: tool identity and active drawer first; supporting empty-state action second.
- Grouping: icon/label pairs in the existing 56px rail; drawer content on a calm surface.
- Spacing: existing hit targets preserved; 4–8px internal rhythm.
- Typography: muted 10px labels, readable active labels.
- States: active uses background and contrast, not a bright outline; icon-only controls retain labels/tooltips.
- Reference principles: compact dock regions, no dead zones, functional color.
- Behavior unchanged: Project, Media, Elements, Texts, Select, Hand, Grid, Zoom, Reset, drawer selection.

### C. Outliner

- Current problem: title treatment competes with layer data and inactive icons are too quiet.
- Target hierarchy: panel title → tree hierarchy → row actions → footer count.
- Grouping: tree indentation and action cluster stay aligned per row.
- Spacing: compact 24–28px rows; clear indentation increments.
- Typography: 10px muted panel label; 11–12px layer names; truncation for long names.
- States: selected row gets a muted fill and text contrast; hover is lighter than rest; eye/lock remain readable.
- Reference principles: layer density, semantic selection, accessible icon names.
- Behavior unchanged: selection, visibility, lock, reorder, hierarchy, footer count.

### D. Canvas chrome

- Current problem: floating viewport toolbar can compete with authored canvas selection.
- Target hierarchy: authored composition first; viewport tools secondary.
- Grouping: viewport controls in one compact floating strip.
- Spacing: 4–6px control gaps; preserve stage bounds.
- Typography: minimal labels; tooltips for icon-only controls.
- States: grid/zoom active states use subdued fills; selected object remains visually distinct.
- Reference principles: canvas dominance, restrained surfaces.
- Behavior unchanged: pan, select, grid, zoom, reset, gizmo, stage coordinate frame.

### E. Inspector

- Current problem: repeated card/border treatment competes with selected-object identity.
- Target hierarchy: Details → selected object and primary actions → coherent disclosures → property rows.
- Grouping: one object header, one Edit/Duplicate mode action row, frequent properties first, advanced properties disclosed.
- Spacing: 8px section rhythm; 28px controls; labels/values share a baseline.
- Typography: object name 11–12px semibold; section labels 10px; values tabular mono.
- States: selected object and active mode use contrast/fill; low-frequency duplicate/delete remain icon actions with labels/tooltips.
- Reference principles: progressive disclosure, compact property rows, no card-everywhere.
- Behavior unchanged: Edit/Duplicate, delete/dissolve, disclosures, numeric edits, keyframe affordances.

### F. Appearance

- Current problem: unit/value presentation and property grouping need a single rhythm.
- Target hierarchy: Corner Radius and fill/stroke controls read as one Appearance domain.
- Grouping: radius-capable controls, Fill, Stroke, and supporting fields; no Geometry section.
- Spacing: label/value baseline, 4px unit gap, 8px group gap.
- Typography: uppercase section labels only at panel level; values tabular mono.
- States: slider focus and numeric inputs visibly focused; disabled controls explain state.
- Reference principles: labels everywhere, tabular numbers, explicit units.
- Behavior unchanged: shape eligibility, fill/stroke mutation, Corner Radius mutation, canonical color picker.

### G. Text

- Current problem: text-specific controls can be visually dense.
- Target hierarchy: content and typography first; text Fill/Stroke remain inside Text.
- Grouping: text value → font/family/size → alignment/spacing → Fill/Stroke.
- Spacing: same property-row baseline as Appearance.
- Typography: text preview/value readable; numeric values mono.
- States: text focus, disabled inherited fields, and color states are explicit.
- Reference principles: domain grouping and consistent property rows.
- Behavior unchanged: text content, fonts, alignment, fill/stroke, animation.

### H. Mask / Track Matte

- Current problem: dense disclosures can blur distinct concepts.
- Target hierarchy: Masks and Track Matte V2 remain visibly separate domains.
- Grouping: Masks = stack/mode/invert/path/feather/opacity/expansion; Track Matte = source/type/invert/source visibility.
- Spacing: 8px between domains, 4–6px between rows.
- Typography: source IDs/names readable; values mono.
- States: invalid relationships and disabled source states are text + color, not color alone.
- Reference principles: explicit relationships, guided errors.
- Behavior unchanged: mask composition, animated paths, matte source/type/inversion/visibility.

### I. Timeline

- Current problem: transport emphasis, zoom controls, empty lanes, and ruler contrast need stronger rhythm.
- Target hierarchy: sequence tabs → time/range controls → transport → ruler/layers → keyframe lanes.
- Grouping: transport and timing controls in compact bands; outliner and grid share ruler alignment.
- Spacing: 4–8px controls, consistent row heights, no oversized play control.
- Typography: timecode, frame numbers, and property values use tabular mono; layer names remain readable.
- States: selected keys and playhead have semantic contrast; lane hover is subtle; disclosures are clear.
- Reference principles: timeline density, ruler alignment, selected-key contrast, contained scrolling.
- Behavior unchanged: sequence tabs, frame navigation, playback, crop, Motion Curves, zoom, keyframes, disclosures, mask/scalar/path rows, context menus.

### J. Curve / Graph Editor

- Current problem: supporting controls compete with graph identity in a dense modal.
- Target hierarchy: selected property/channel identity → graph → handles/value fields → preview/presets → CSS representation → Apply/Cancel.
- Grouping: graph dominates one column; controls are consistent supporting bands; Apply is primary, Cancel secondary.
- Spacing: 8–12px modal rhythm; handle fields align in a two-column numeric grid.
- Typography: channel name and numeric handles are explicit; values mono.
- States: selected key/handle contrast, keyboard focus, Value/Speed state, derived/read-only Speed state.
- Reference principles: graph dominance, progressive disclosure, accessible controls.
- Behavior unchanged: Bézier math, presets, preview, Value/Speed semantics, CSS copy, Apply/Cancel.

### K. Bezier Path editing

- Current problem: direct handles can be visually lost against canvas chrome.
- Target hierarchy: selected path/handle → geometry → keyboard/numeric alternatives.
- Grouping: direct manipulation remains on canvas; supporting controls stay in Inspector/modal.
- Spacing: handles are visually distinct without decorative glow.
- Typography: coordinates tabular mono.
- States: selected handle, hover, focus, and keyboard movement are distinct.
- Reference principles: gestures have alternatives; correct focus and transform origin.
- Behavior unchanged: topology, handles, path coordinate space, keyboard operations.

### L. Popovers / dialogs

- Current problem: supporting surfaces can inherit generic card styling.
- Target hierarchy: title/context → content → primary/secondary action.
- Grouping: one surface, one action footer; destructive actions use confirmation or existing Undo.
- Spacing: 8px rhythm; no nested decorative cards.
- Typography: concise action-oriented copy.
- States: focus trap/return, error adjacent to field, loading retains label.
- Reference principles: manage focus, no dead ends, guided errors.
- Behavior unchanged: existing modal flows, confirmation semantics, copy actions.

### M. Empty states

- Current problem: centered dashed empty states can be passive and generic.
- Target hierarchy: what is empty → why it matters → next action.
- Grouping: concise instruction and existing actionable control.
- Spacing: left-aligned content with clear reading order.
- Typography: muted explanation, readable action label.
- States: empty, sparse, error, and recovery remain distinguishable.
- Reference principles: inline help first, no dead ends, resilient content.
- Behavior unchanged: existing import/create/select actions.

## Implementation plan

1. Refine semantic theme tokens and state treatments without changing load-bearing dimensions.
2. Polish Header, Toolbar, Outliner, and Inspector hierarchy through existing classes and minimal class hooks.
3. Polish Timeline density/ruler/transport and Curve Editor grouping through existing markup and scoped CSS.
4. Review in isolated Chromium at all required viewports and run an independent designer critique.
5. Apply one focused polish pass only for evidence-backed visual issues.
6. Run accessibility/focus/overflow checks and complete the full regression gate.

## Acceptance criteria

- No Geometry section returns; Corner Radius remains in Appearance.
- Canvas coordinate frame remains stable: header 79px, left nav 56px.
- No new UI/state authority or dependency.
- No generic card/glow/gradient expansion.
- No console errors, unintended overflow, or clipped critical controls at required viewports.
- Existing V6 and full Playwright contracts remain green.
