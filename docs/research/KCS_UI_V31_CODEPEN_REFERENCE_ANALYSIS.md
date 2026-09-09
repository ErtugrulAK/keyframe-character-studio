# KCS UI V3.1 CodePen Reference Analysis

## Research method

All three URLs were opened in a real Chromium browser. The embedded preview iframe was inspected where available, including rendered DOM, state changes, and stylesheet rules. No CodePen source was copied into KCS. The references are used as interaction and visual pattern research only.

## Reference 1 — Squishy Toggle Switch

- **URL:** `https://codepen.io/editor/jkantner/pen/01a06462-c18c-72fa-9f73-453f964471a5`
- **Title/author:** `Squishy Toggle Switch`, Jon Kantner.
- **Observed interaction:** One native checkbox with `role="switch"`. Toggling adds an animated modifier class (`switch__input--animated`) and changes the checked state. The control is a single semantic state transition rather than two unrelated buttons.
- **DOM/CSS/JS mechanism:** React component renders a labeled checkbox. CSS transitions background/color and uses a modifier class to trigger the one-time squishy transition. The preview exposes the input as the keyboard/focus authority.
- **Timing/easing:** Observed source defines a shared `--trans-dur: 0.3s`; state transitions animate color and transform-like visual treatment. Exact transition details remain source-specific and are not copied.
- **Accessibility:** Native checkbox semantics plus `role="switch"`; hidden accessible label text; keyboard-compatible input.
- **External dependencies:** React preview and CodePen editor dependencies; no KCS dependency should be added.
- **License/usage caveat:** No explicit reusable source license was exposed in the inspected preview. Treat source as reference-only; do not copy code or assets. Adapt the interaction concept.
- **KCS adaptation:** Header Edit/Broadcast becomes one segmented state control with a moving/active indicator and a restrained 180–260ms transform/background transition. Existing `appMode` and button semantics remain the authority.
- **KCS rejection:** No giant SaaS pill, no hidden replacement control, no duplicate mode state, no global switch abstraction.
- **Target components:** `HeaderBar.tsx`, `HeaderBar.css`, existing `.header-mode-button` rules.
- **Implementation approach:** Keep two native buttons inside the existing mode group, add a single visual indicator layer or pseudo-element whose position follows `appMode`, use `aria-pressed`, focus-visible, and reduced-motion.
- **Risk:** Inline `transition: all` in existing buttons must be replaced with explicit properties without changing mode behavior.

## Reference 2 — Toolbars With Sliding Selection

- **URL:** `https://codepen.io/jkantner/pen/OJKZxpv`
- **Title/author:** `Toolbars With Sliding Selection`, Jon Kantner.
- **Observed interaction:** Horizontal and vertical compact toolbars expose buttons with `aria-pressed`. The active selection changes without moving button geometry. A separate `.toolbar__highlight` element slides under the selected button.
- **DOM/CSS/JS mechanism:** Toolbar is `position: relative`; active highlight is absolutely positioned, `pointer-events: none`, sized to the button, and moved by JS based on selected button geometry. Buttons carry tooltip elements that become visible on hover/focus.
- **Timing/easing:** `--trans-dur: 0.3s`; highlight uses a transform/background transition. The concept can be adapted to KCS with a shorter technical duration and explicit `transform`, `background-color`, and `opacity` transitions.
- **Accessibility:** `aria-pressed` on every button; tooltip appears for hover and `:focus-visible`; orientation supports both horizontal and vertical layouts.
- **External dependencies:** DM Sans only; no runtime library required.
- **License/usage caveat:** No explicit reusable source license was exposed. No source code copied; only the pattern is adapted.
- **KCS adaptation:** Add a restrained sliding active indicator to the Canvas viewport toolbar. Keep icon buttons and existing click handlers; use `aria-pressed`, focus-visible tooltip, and `pointer-events: none` highlight.
- **KCS rejection:** No duplicate tool state, no geometry-changing layout animation, no bright white/difference blend, no new zoom/reset authority.
- **Target components:** `CanvasViewportToolbar.tsx` and its existing CSS authority.
- **Implementation approach:** Measure selected button offset through a ref or use a CSS state rail when stable; update transform only when active tool changes. Explicitly support reduced motion.
- **Risk:** Measuring a portal/overlay or a hidden toolbar could create stale highlight geometry; fallback to a static active fill is required when measurement is unavailable.

## Reference 3 — Collapsable Icon Toolbar

- **URL:** `https://codepen.io/adamcjoiner/pen/rgvBxN`
- **Title/author:** `Collapsable Icon Toolbar (a la Atom Text Editor)`, Adam C. Joiner.
- **Observed interaction:** Narrow vertical toolbar is 54px wide; expanding transitions to 240px. Buttons retain icon identity and reveal `.title` labels in expanded mode. The toggle moves with the toolbar and uses a cubic-bezier easing. Separators establish tool groups.
- **DOM/CSS/JS mechanism:** `.atom-toolbar` transitions `width`; `.expanded` controls width and title visibility. A separate toggle button transitions its `left` position. Buttons remain fixed-size and are aligned vertically.
- **Timing/easing:** `0.3s cubic-bezier(0, 1.15, 1, 0.93)` for width/toggle movement; `0.2s ease-out` for toggle inner transform.
- **Accessibility:** The inspected preview contains a visual toolbar pattern but no robust semantic button metadata. KCS must improve this: preserve native buttons, titles/aria labels, keyboard order, and focus-visible states.
- **External dependencies:** Atom/octicon visual vocabulary in source; KCS must continue using existing Lucide icons.
- **License/usage caveat:** No explicit reusable source license was exposed. Concepts only; no Atom assets or source copied.
- **KCS adaptation:** Use the restrained reveal/selection relationship for the existing LeftToolbar drawer and selected nav tool. Keep the 56px rail contract and animate drawer width/opacity only where the existing layout already supports it. On the right, apply only to action/disclosure cues, not the entire Inspector.
- **KCS rejection:** No 240px replacement rail, no floating widgets, no aggressive Inspector slide, no layout-property animation on frequently changing property rows.
- **Target components:** `LeftToolbar.tsx`, `LeftToolbar.css`, `PropertyInspector.css`, existing Inspector section/disclosure classes.
- **Implementation approach:** Keep `isCollapsed` and `activeCategory` as existing UI-only authorities; animate explicit `width`, `transform`, `opacity`, and background/border cues with reduced-motion overrides.
- **Risk:** The 56px rail is coordinate-sensitive. Any animation must not change the stage origin unexpectedly at settled state, and drawer motion must not duplicate state.

## Cross-reference decisions

- Use Reference 1 for one semantic Edit/Broadcast state transition.
- Use Reference 2 for Canvas toolbar active selection and tooltip treatment.
- Use Reference 3 for restrained LeftToolbar drawer/reveal and right-side action cues.
- Reject source copying, new dependencies, giant pills, blend-mode effects, duplicate state stores, and uncontrolled layout animation.
- Preserve KCS theme authority, `appMode`, viewport state, toolbar state, Inspector disclosure state, and reduced-motion behavior.
