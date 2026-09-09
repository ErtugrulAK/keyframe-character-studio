# KCS V3.2 Source Adaptation Matrix

## Reference 1 — Toolbars With Sliding Selection

### SOURCE MECHANISM
- Separate absolute highlight layer.
- `pointer-events: none` on the highlight.
- Fixed button geometry.
- `aria-pressed` state.
- Roving `tabIndex` with Arrow/Home/End navigation.
- Hover/focus tooltip.
- Stretch toward target, slide, then settle with approximately 300ms cubic easing.

### KCS TARGET
Canvas viewport toolbar: Select, Pan, Grid, Zoom, Reset View.

### ADAPTED
- Keep the existing absolute viewport overlay and button dimensions.
- Replace the static active rail with a separate highlight layer whose width/scale and transform visibly animate toward the active Select/Pan target.
- Add roving keyboard navigation only to the mutually exclusive Select/Pan tool group; Grid remains an independent toggle.
- Retain native buttons, labels, and existing tool callbacks.

### REJECTED
- Source icons, `mix-blend-mode`, copied markup, and copied styles.
- Replacing the existing zoom/reset semantics with a new toolbar model.
- Moving the overlay into document flow.

### IMPLEMENTATION MECHANISM
Plain React state for active tool, roving `tabIndex`, keyboard handler, absolute highlight span, transform/scale transitions, CSS keyframes for stretch/settle, and reduced-motion overrides. No new dependency.

### ACCESSIBILITY
Native buttons, `aria-pressed`, visible focus, tooltip titles/labels, one roving tab stop for Select/Pan, Home/End and Arrow navigation.

### PERFORMANCE
One small DOM highlight and transform/scale animation; no layout animation and no per-frame React state updates.

### FUNCTIONAL INVARIANT
`activeTool`, `showGrid`, zoom, pan offset, and all existing callbacks remain authoritative and unchanged.

### TEST PLAN
Component tests for pressed state, roving tab index, Arrow/Home/End navigation, and callback preservation. Browser screenshots verify visible stretch/slide/settle.

## Reference 2 — Collapsable Icon Toolbar

### SOURCE MECHANISM
- Narrow icon rail near 54px.
- Adjacent drawer reveal.
- Labels/content revealed in expanded state.
- Separate edge toggle.
- Restrained overshoot easing `cubic-bezier(0,1.15,1,0.93)`.
- Grouping separators.

### KCS TARGET
The existing 56px left rail and its existing drawer relationship.

### ADAPTED
- Preserve the 56px rail as a fixed load-bearing column.
- Animate only drawer reveal opacity/transform and label reveal; do not animate the rail width or stage origin.
- Add semantic family separators and selected-state motion.
- Keep the existing edge collapse toggle and active category/drawer ownership.

### REJECTED
- Fixed 240px architecture, jQuery, Atom palette, Octicons, and copied source markup.
- Any width animation that shifts the canvas stage origin.

### IMPLEMENTATION MECHANISM
Existing React `activeCategory` and `isCollapsed` state, CSS grid/flex separation, opacity/transform reveal, restrained overshoot easing, and reduced-motion handling.

### ACCESSIBILITY
Existing native buttons retained with `aria-pressed`, titles, focus styles, and an explicit collapse/expand label.

### PERFORMANCE
CSS-only transform/opacity transitions; drawer contents remain owned by existing components.

### FUNCTIONAL INVARIANT
The rail remains 56px and the active drawer semantics remain unchanged.

### TEST PLAN
Browser checks for collapsed/expanded stage origin, category selection, drawer content, and reduced-motion CSS inspection.

## Reference 3 — Squishy Toggle Switch

### SOURCE MECHANISM
- One semantic state transition.
- Moving handle.
- Travel with subtle stretch/morph and spring settle.
- Reduced-motion support.
- Active press scale.

### KCS TARGET
Header Edit Mode / Broadcast Mode segmented control.

### ADAPTED
- Preserve `appMode` as the single authority.
- Use one moving indicator layer under two native buttons.
- Add restrained indicator scale/stretch and active press scale.
- Keep the control compact and editorial rather than a giant SaaS pill.

### REJECTED
- Sass-only keyframe generation, copied switch markup, duplicate mode state, and source styling.

### IMPLEMENTATION MECHANISM
Plain CSS keyframes and transforms, class-derived from `appMode`, explicit transitions, `aria-pressed`, focus styles, and reduced-motion overrides.

### ACCESSIBILITY
Native buttons, `aria-pressed`, visible focus, keyboard activation, and no pointer-only state.

### PERFORMANCE
Transform/background/border animation only; no layout transition and no additional mode store.

### FUNCTIONAL INVARIANT
Every mode change still calls the existing `setAppMode` authority and preserves Edit/Broadcast behavior.

### TEST PLAN
Browser checks for indicator travel, press state, keyboard activation, and reduced-motion behavior. Existing mode behavior remains covered by the full application suite.

## Cross-Surface Decisions

- No new dependencies, Sass, jQuery, or duplicate evaluator/playback/history engines.
- V3.1 pointer capture, backdrop suppression, paused preview, bounded stage, graph semantics, Inspector grouping, and absolute overlay positioning are protected.
- All animation is cosmetic and must not mutate scene, timeline, serialization, evaluator, history, or broadcast state beyond existing callbacks.
## Source-Level Mechanism Audit

### Toolbars With Sliding Selection — observed source

The reference keeps `tool` and `toolPrev` in React state, stores toolbar and highlight DOM refs, and calls `reAnimate(toolName)` from both button activation and keyboard navigation. `reAnimate` calculates previous/next indexes, movement keyframes, and a temporary stretched width:

```ts
const move = indexIsLower ? [moveA, moveB, moveB] : [moveA, moveA, moveB];
const width = [widthA, widthB, widthA];
animRef.current?.animate(
  { [moveKey]: move, [widthKey]: width },
  { duration: 300, easing: "cubic-bezier(0.65,0,0.35,1)", fill: "forwards" }
);
```

It also derives `tabIndex` from the pressed tool, uses Arrow/Home/End to move focus and state, and places the highlight after the buttons with pointer interaction disabled. KCS will reproduce this as React-owned state plus a Web Animations API call on the existing highlight element; no source icons or `mix-blend-mode` are carried over.

### Collapsable Icon Toolbar — observed source

The reference JavaScript toggles one `.expanded` class on both the toolbar and the edge toggle. The CSS defines a 54px narrow rail, a 240px expanded width, title reveal from `display:none` to `inline-block`, a separate absolute toggle, and synchronized `left` transitions using `cubic-bezier(0,1.15,1,0.93)`. A spacer creates family separation. KCS will preserve its existing 56px rail and avoid width animation; only the adjacent drawer content and labels reveal, so stage origin remains fixed.

### Squishy Toggle Switch — observed source

The reference uses a semantic checkbox state and a modifier class (`switch__input--animated`) to trigger plain CSS transitions/keyframes. The state transition animates the handle travel, track/handle dimensions and border-radius, with a short `0.3s` duration; the press interaction applies a temporary scale change. KCS will use the existing `appMode` state, a single indicator element, and plain CSS/WAAPI transform and scale effects. Sass-generated output is not copied.

### Source-to-KCS Contract

The implementation is accepted only when the interaction grammar is visible in before/after evidence: Canvas highlight width changes during travel, mode indicator visibly squashes and settles, and left drawer reveal does not move the 56px rail or stage origin. Opacity-only or color-only changes do not satisfy this matrix.
