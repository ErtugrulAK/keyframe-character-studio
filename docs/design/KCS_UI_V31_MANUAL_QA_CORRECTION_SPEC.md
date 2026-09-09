# KCS UI V3.1 Manual-QA Correction Specification

## Current contract

Preserve the existing KCS authorities and behavior: `appMode`, viewport/tool state, `AnimatorContext`, evaluator/easing math, `Track.channels`, history, serialization, masks, Track Matte, playback, OGraf, selection, and stage coordinate frame. Preserve the 79px header and 56px navigation rail. No Geometry section; Corner Radius remains under Appearance; Value Graph remains editable; Speed Graph remains derived/read-only.

## A. Right Inspector grouping restoration

- **Current failure:** V3 flattened `.panel-card` and section surfaces too aggressively. Dense labels and values visually collide; Transform, Control Points, Animation Data, Trim Path, Appearance, Text, Masks, and Track Matte are hard to parse.
- **User expectation:** Clear groups without returning to bulky card-everywhere styling.
- **Reference pattern:** OGraf/Blender technical property groups: quiet surface bands, section headers, thin separators, stable rows.
- **Proposed design:** Restore subtle group backgrounds and inset separators; use readable line-height, 8–12px section rhythm, consistent label/value columns, controlled label truncation, and distinct section header rows. Keep groups visually related to one panel rather than independent cards.
- **Functional invariant:** Inspector ownership, disclosure state, field mutations, keyframe actions, Corner Radius placement, Text Fill/Stroke, canonical color picker, Mask/Track Matte semantics unchanged.
- **Tests required:** Existing Inspector tests; render required groups and assert no Geometry; browser checks for 1920/1440/1366 no overflow and no text collision.

## B. Value vs Speed Graph visual semantics

- **Current failure:** Value Graph and Speed Graph share too much visual weight and affordance.
- **User expectation:** Value is obviously editable; Speed is obviously derived/read-only but still useful.
- **Reference pattern:** Technical editor active/editable state versus muted derived output.
- **Proposed design:** Value mode gets an EDITABLE badge, active teal graph, draggable point affordances, and editable helper text. Speed mode gets DERIVED / READ ONLY badge, muted amber/steel path, dashed/filled derived treatment, read-only helper text, and no point/handle inputs.
- **Functional invariant:** `TemporalGraphPanel` remains the evaluator-backed authority; Value mutation and Speed derivation are unchanged.
- **Tests required:** Value mode renders editable points and handle inputs; Speed mode renders zero editable points/inputs and correct derived label.

## C. Curve pointer-drag modal lifecycle

- **Current failure:** Window mouse listeners and backdrop click handling allow an external release/click to dismiss the modal during P1/P2 drag.
- **User expectation:** P1/P2 pointer drag remains active outside graph/modal and closes only through intended close/cancel actions.
- **Reference pattern:** Pointer capture for a bounded interaction; explicit dismissal ownership.
- **Proposed design:** Use pointer events on P1/P2 handles, call `setPointerCapture(pointerId)`, update from captured `pointermove`, finish on `pointerup`/`lostpointercapture`, and suppress backdrop dismissal while dragging. Keep backdrop dismissal for non-drag clicks.
- **Functional invariant:** P1/P2 values remain clamped to supported domains; easing math and Apply behavior unchanged.
- **Tests required:** P1 and P2 drag/release outside modal; modal remains open; pointerup/lostpointercapture cleans drag state; Close/Escape still dismiss intentionally.

## D. Paused preview default

- **Current failure:** `isPreviewPlaying` initializes `true`; opening Curve Editor starts animation.
- **User expectation:** Preview opens paused; user explicitly presses Play.
- **Reference pattern:** Preview controls require explicit activation.
- **Proposed design:** Initialize `isPreviewPlaying` to `false`; reset it to false when modal instance opens/reopens; Play/Pause button exposes current state.
- **Functional invariant:** Preview is visualization only; it does not alter easing/evaluator semantics.
- **Tests required:** Initial button is Play; click starts; click again pauses; reopen returns paused.

## E. Bounded preview mini-stage

- **Current failure:** Long strip and fixed 230px animation can move the ball outside the visible region for overshoot/anticipate curves.
- **User expectation:** Ball remains entirely visible inside a compact professional preview rectangle.
- **Reference pattern:** Bounded mini-stage with safe inner rectangle.
- **Proposed design:** Add `.bezier-mini-stage` with explicit width/height, baseline/track, and inner safe region. Map normalized preview progress through `clamp(0, 1, progress)` into inner width; represent overshoot through a restrained endpoint/overshoot indicator without moving the ball outside safe bounds. Ball radius plus padding is included in the safe inset.
- **Functional invariant:** Actual control points and easing calculations remain untouched; only visualization mapping is clamped.
- **Tests required:** Ball bounding box remains within mini-stage under Linear, Overshoot, Anticipate, Elastic; preview uses pause/play state.

## F. Edit/Broadcast state control

- **Current failure:** Two independent-looking buttons do not feel like one state control; current inline `transition: all` is too broad.
- **User expectation:** One responsive, premium, restrained state control with clear active selection.
- **Reference pattern:** Squishy Toggle Switch: one semantic state transition with animated active treatment.
- **Proposed design:** Keep two native buttons for existing semantics but add one animated indicator/active rail tied to `appMode`. Use explicit transform/background/border/color transitions and aria-pressed/focus-visible.
- **Functional invariant:** `setAppMode` and all mode-specific behavior unchanged.
- **Tests required:** Edit/Broadcast click and keyboard semantics, active state, aria-pressed, reduced motion.

## G. Canvas view toolbar

- **Current failure:** View controls are functional but selected state lacks a coherent sliding selection treatment.
- **User expectation:** Compact professional toolbar with clear active state, tooltips, and unchanged zoom/reset behavior.
- **Reference pattern:** Toolbars With Sliding Selection: absolute pointer-free highlight, aria-pressed, hover/focus tooltips.
- **Proposed design:** Add a lightweight active highlight to the existing viewport toolbar; explicit transform/background/opacity transitions; static fallback when measurement unavailable.
- **Functional invariant:** Select, Pan, Grid, Zoom Out, Zoom In, percentage, Reset View Position remain unchanged.
- **Tests required:** Existing viewport toolbar tests plus active state and reset/zoom semantics.

## H. Left toolbar

- **Current failure:** Existing selected/drawer transitions are abrupt and do not clearly relate rail selection to drawer reveal.
- **User expectation:** Selected tool transition and drawer reveal are deliberate but restrained.
- **Reference pattern:** Collapsable Icon Toolbar: fixed icon rail, controlled reveal, separators, title reveal.
- **Proposed design:** Keep 56px rail and existing `isCollapsed`/`activeCategory`; animate explicit drawer width/opacity/transform and selected fill. Do not animate stage geometry at settled state.
- **Functional invariant:** Drawer selection, tool handlers, keyboard titles, and collapse behavior unchanged.
- **Tests required:** Existing toolbar interaction tests, collapse/expand, active category, reduced motion.

## I. Right contextual action surfaces

- **Current failure:** Inspector flattening removes visual cues for active/disclosure/action ownership.
- **User expectation:** Small contextual transitions, not whole-panel animation.
- **Reference pattern:** Reference 3 selective action/disclosure cues.
- **Proposed design:** Animate section header accent/indicator, action-row background, and disclosure icon transform only. Keep Inspector content stable and avoid layout-property animation.
- **Functional invariant:** Disclosure and action handlers unchanged.
- **Tests required:** Existing Inspector disclosure/action tests and browser focus checks.

## Risk decisions

- Do not add a duplicate animation/evaluation engine.
- Do not disable backdrop dismissal globally.
- Do not change serialized data, evaluator output, or stage coordinates.
- Use CSS transitions only for explicit properties; preserve reduced motion.
- Keep all new behavior within existing component and CSS authorities.
