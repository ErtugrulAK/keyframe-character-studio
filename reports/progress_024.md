# KCS Development Report — V5.1 Post-Checkpoint QA Fixes

Metadata:
- Date: 2026-09-07
- Milestone: KCS V5.1 post-checkpoint QA fixes
- Branch: `main`
- Starting HEAD: `4dc6c43 chore: checkpoint KCS V5.1 consolidated recovery before QA`
- Ending HEAD: `4dc6c43 chore: checkpoint KCS V5.1 consolidated recovery before QA`
- Origin: `origin/main`, starting and ending ahead/behind `0/0`
- Commit status: `Commit: NO — explicitly prohibited by task scope.`
- Push status: `Push: NO — explicitly prohibited by task scope.`
- Report number: `progress_024`

# 1. Executive Summary

Implemented the approved post-checkpoint polish pass without changing Matte behavior or running a new Matte redesign. Selection gizmo visuals now scale from the selected object and viewport zoom while retaining bounded, usable invisible hit targets. Text-bearing parts now keep Fill and Stroke inside the consolidated TEXT disclosure instead of exposing a duplicate standalone Appearance card. The right Inspector dock now animates hide/show layout changes with a restrained 240 ms transition and preserves the mounted architecture and reduced-motion override. Legacy OGraf export diagnostics now collapse duplicate root-cause errors, especially repeated missing-font messages, while the previously implemented safe embedded-image and portable-font compatibility policy remains active.

User impact: very small objects no longer receive visually oversized gizmo controls; medium and large objects receive proportionate but bounded handles; direct manipulation hit areas remain usable. Text editing presents content, typography, animation, Fill, and Stroke in one TEXT section with the existing inline RGBA picker. Inspector hide/show no longer snaps its width and toggle position. Repeated missing-font failures produce one actionable `assetCatalog["font:<family>"]` remediation message per font root cause.

Completion state: implementation, focused unit tests, full Vitest, TypeScript, lint, build, focused V51 Playwright checks, and live browser checks are PASS. No user acceptance was performed in this session. Matte behavior was intentionally left unchanged; no dedicated Matte E2E regression was run for this polish pass.

# 2. Original Objectives

## Phase A — Proportional selection gizmo

- Make visible corner, edge, center, and rotation controls respond to visible object size and viewport zoom.
- Keep controls within sensible minimum and maximum screen-size bounds.
- Preserve existing selection, rotate, scale, mirrored-orientation, matte hit-area, and transform semantics.
- Use invisible hit targets only as needed to preserve direct-manipulation usability.

## Phase B — Text Inspector relocation

- Move Fill and Stroke controls into the TEXT section for text-bearing parts.
- Reuse the canonical inline `ColorPickerPopover`.
- Preserve text content, font, font-size, staggered animation, callbacks, history, and serialization behavior.
- Avoid duplicate Appearance cards, quick palettes, or native color inputs.

## Phase C — Inspector motion

- Add a restrained hide/show transition to the already mounted right Inspector dock.
- Animate width, flex-basis, transform, opacity, border/shadow, and toggle position without introducing a gutter.
- Preserve the existing toggle placement and reduced-motion behavior.

## Phase D — Legacy OGraf export diagnostics

- Reproduce the legacy browser-export failure path through the actual Header export flow.
- Keep safe embedded image normalization and portable font policy intact.
- Aggregate duplicate missing-font diagnostics by root cause.
- Keep errors actionable without fabricating, downloading, substituting, or weakening asset checks.

## Phase E — Verification and reporting

- Run focused regression tests and the existing full project test suite.
- Run TypeScript, lint, and production build validation.
- Verify changed UI surfaces in Chromium.
- Create the next sequential permanent report without Git history changes.

Out of scope: Matte redesign or new Matte QA matrix, new animation/evaluation/playback engines, public domain API changes, arbitrary remote asset fetching, font fabrication/download/substitution, branch operations, commits, pushes, and unrelated refactors.

# 3. Problems Discovered

## Fixed gizmo visual-size mismatch — PASS

- Symptom: `zScale` inversely compensated viewport zoom, which kept current handle dimensions approximately screen-fixed regardless of the selected object’s visible size. Tiny objects therefore received visually dominant handles while large objects received proportionally weak handles.
- Root cause: `TransformGizmo` used fixed corner, edge, center, and rotation constants multiplied only by `zScale`.
- Affected subsystem: `TransformGizmo` visual overlay; existing selection and interaction callbacks were not changed.
- Severity: MEDIUM for editor clarity and small-object precision.
- Status: fixed with a pure proportional metrics helper, minimum/maximum visual bounds, and separate invisible interaction targets. Existing mirrored, bounds, matte, and transform tests remain PASS.

## Fixed Text control composition duplication — PASS

- Symptom: Text-bearing parts rendered their text fields in TEXT while Fill and Stroke were rendered in a separate APPEARANCE card.
- Root cause: `StyleColorSection` owned the color UI as a standalone card and `StyleTextFields` had no composition point for the same canonical controls.
- Affected subsystem: Inspector Style tab for `custom_text`, `custom_banner`, and `custom_card`.
- Severity: MEDIUM for information architecture and editing density.
- Status: fixed by adding an explicit embedded mode to the existing color section and mounting it inside TEXT. Shape-eligible parts retain their existing shape Appearance section.

## Fixed Inspector dock snap — PASS

- Symptom: Inspector width, flex basis, transform, opacity, border/shadow, and dock toggle position changed immediately on hide/show.
- Root cause: the mounted dock had no layout transition; only hover-state properties on the toggle transitioned.
- Affected subsystem: `PropertyInspector.css` and existing App dock visibility state.
- Severity: LOW/MEDIUM for layout continuity.
- Status: fixed with a restrained 240 ms ease transition and the existing `prefers-reduced-motion: reduce` override. The dock remains mounted and the hidden state still reaches zero width.

## Fixed duplicate legacy OGraf missing-font notifications — PASS

- Symptom: multiple text layers using the same unavailable font generated repeated identical error toasts during one Header OGraf export.
- Root cause: validation correctly emitted one diagnostic per layer, but HeaderBar displayed every error independently.
- Affected subsystem: Header OGraf export feedback; validator semantics remain unchanged.
- Severity: MEDIUM for actionable export failure UX.
- Status: fixed by filtering only export-blocking diagnostics and de-duplicating by diagnostic code plus message. Distinct fonts remain distinct actionable errors.

## Legacy embedded image and font portability policy — RETAINED/PASS

- The prior checkpoint already supplied safe allowlisted Data URL/same-document Blob image normalization and browser-byte packaging, plus explicit catalogued font-byte/source validation. This pass did not weaken or duplicate that compatibility engine.
- Focused legacy compatibility tests and browser Header integration tests remain PASS.
- No approved local legacy font binaries exist in the repository; unavailable fonts remain correctly blocked rather than fabricated or substituted.

# 4. Files Created

- `src/utils/transformGizmoMetrics.ts` — pure proportional gizmo visual and hit-target sizing helper.
- `src/ograf/diagnostics.ts` — pure export-error root-cause de-duplication helper.
- `src/tests/transformGizmo.test.tsx` — minimum, maximum, object-size, and zoom metric coverage.
- `reports/progress_024.md` — this permanent milestone report.

# 5. Files Modified

- `src/components/Canvas/overlays/TransformGizmo.tsx` — consumes proportional metrics, renders bounded visible controls, and adds transparent larger hit targets without changing callbacks or transform ownership.
- `src/components/Header/HeaderBar.tsx` — displays unique export-blocking diagnostics instead of every duplicate layer-level diagnostic.
- `src/components/Inspector/PropertyInspector.css` — adds restrained dock and toggle position transitions while retaining reduced-motion handling.
- `src/components/Inspector/sections/StyleTab.tsx` — routes text-bearing parts to embedded TEXT color controls and keeps standalone colors for non-text-bearing parts.
- `src/components/Inspector/sections/style/StyleColorSection.tsx` — adds explicit embedded composition mode while preserving the standalone APPEARANCE default.
- `src/components/Inspector/sections/style/StyleTextFields.tsx` — accepts the existing color callback and embeds Fill/Stroke after the existing text controls.
- `src/ograf/index.ts` — exports the diagnostic helper from the OGraf module barrel.
- `src/tests/ografBrowserZip.test.tsx` — covers one toast for duplicate same-font missing diagnostics.
- `src/tests/styleAppearanceSection.test.tsx` — covers embedded TEXT Fill/Stroke controls, callback mapping, and absence of duplicate/native color UI.
- `e2e/v51-recovery.spec.ts` — updates the text Inspector expectation to TEXT and adds hide/show transition and no-gutter coverage.

No Matte source or Matte test file was modified in this pass.

# 6. Architecture Overview

```text
SceneData / AnimatorContext
        │
        ├── StageCanvas ── SelectionGizmo ── TransformGizmo
        │                                  └── transformGizmoMetrics (pure sizing)
        │
        ├── PropertyInspector
        │      ├── StyleTab
        │      │      ├── StyleTextFields ── embedded StyleColorSection
        │      │      └── standalone StyleColorSection for non-text parts
        │      └── mounted right dock + CSS visibility/layout transition
        │
        └── HeaderBar OGraf export
               ├── legacyCompatibility (existing clone-based safe asset preparation)
               ├── packageCompiler / validation
               └── diagnostics ── unique export-blocking feedback
```

State ownership remains unchanged. `AnimatorContext` owns authored state, callbacks, history, and serialization. `SelectionGizmo` and `TransformGizmo` retain transform interaction ownership. The new gizmo helper computes presentation metrics only. `StyleColorSection` remains the color-control authority. Legacy preparation remains export-only and clone-based; diagnostic filtering changes presentation, not validation policy.

# 7. Data Model Changes

## Authored/serialized state

- No `SceneData`, `CharacterPart`, transform, animation track, text, font, color, Matte, or OGraf authored-state fields were added or removed.
- Existing Fill/Stroke callbacks and property keys remain unchanged.
- Existing embedded-image and portable-font catalog fields from the previous checkpoint remain unchanged.

## Derived state

- Gizmo visual metrics derive from local selected bounds, `zScale`, and clamped visible object size.
- Header export derives a unique error list from the existing compiler diagnostic list.
- Text-bearing Inspector composition derives whether a part receives embedded or standalone color presentation from its existing type.

## Transient state

- Gizmo metrics and transparent hit-target geometry are render-time only.
- Inspector transition progress is CSS presentation state; React visibility state and mounted component architecture are unchanged.
- Diagnostic de-duplication uses a per-export local `Set`; no diagnostics are persisted.

# 8. Coordinate Space Model

- Object-local: gizmo bounds remain the existing local geometry rectangle from `getPartLocalBounds`, including authored scale magnitude and asymmetric geometry behavior.
- Transform/world: `TransformGizmo` continues to apply the existing translation, rotation, and mirrored orientation transforms. No transform coordinate boundary moved.
- Viewport/screen: `zScale` continues to compensate the existing SVG/CSS zoom. The helper calculates visible object size in screen-equivalent units, chooses a clamped visual size, then converts it back to SVG units.
- Hit targets: transparent targets are placed at the existing corner, edge, and rotation centers in the same gizmo coordinate space; they do not alter the matte editor hit area.
- Inspector layout: the dock and toggle remain in the existing flex/absolute layout. CSS transitions interpolate the same width and right properties; no second layout owner or gutter element was introduced.
- OGraf diagnostics: no geometry or package coordinate changes.

Invariant: renderer geometry, selection bounds, drag/scale/rotate callbacks, mirrored orientation, Matte interaction area, evaluation, history, and serialization continue to consume their existing authorities.

# 9. Component / Module Walkthrough

- `transformGizmoMetrics.ts`: clamps invalid positive zoom input to a safe range, derives the smaller visible object dimension, clamps visible handle size to 3–9 screen pixels, converts visual dimensions into gizmo units, and keeps hit radius at 8 screen pixels.
- `TransformGizmo.tsx`: keeps the selection bounds as the first direct rectangle child for existing geometry queries, renders proportional visible corners/edges/rotation/center controls, and adds larger transparent targets after visible controls. Group selections remain bounds-only as before.
- `StyleColorSection.tsx`: preserves standalone `APPEARANCE` behavior by default; `embedded` renders the same Fill/Stroke controls without a second card wrapper.
- `StyleTextFields.tsx`: keeps existing card text fields, text content, font family, font size, stagger mode, and delay controls, then mounts embedded Fill/Stroke controls in the same TEXT card.
- `StyleTab.tsx`: identifies existing text-bearing types and prevents their standalone StyleColorSection from rendering.
- `PropertyInspector.css`: transitions dock dimensions and visual properties; reduced-motion media query still disables transitions.
- `diagnostics.ts`: returns only ERROR diagnostics and retains the first occurrence for each code/message root cause.
- `HeaderBar.tsx`: uses unique diagnostics for error toasts; successful ZIP creation and existing export lock remain unchanged.
- `v51-recovery.spec.ts`: checks text controls, dock transition CSS/layout, and the existing text bounds/timeline recovery paths.

# 10. Important Code Changes

Gizmo metric contract:

```ts
const visibleObjectSize = Math.max(0, Math.min(Math.abs(boundsWidth), Math.abs(boundsHeight))) / safeZScale;
const visualScreenSize = clampGizmoValue(visibleObjectSize * 0.12, 3, 9);
const visualUnit = visualScreenSize * safeZScale;
```

Visible controls use `visualUnit`/derived radii. Transparent targets use `hitRadius: 8 * safeZScale`, so the SVG geometry remains zoom-compensated while the screen hit area remains usable. Existing `onScaleMouseDown` and `onRotateMouseDown` callbacks receive the same modes/events.

Text composition contract:

```tsx
{!isTextBearing && <StyleColorSection ... />}
<StyleTextFields ... onPartColorChange={handlePartColorChange} />
```

`StyleTextFields` mounts the same `StyleColorSection` with `embedded`, avoiding a second color implementation and preserving the existing callback keys.

Inspector transition contract:

```css
transition: width 240ms ease, min-width 240ms ease, flex-basis 240ms ease,
  transform 240ms ease, opacity 200ms ease, border-color 240ms ease,
  box-shadow 240ms ease;
```

OGraf diagnostic contract:

```ts
const key = `${diagnostic.code}:${diagnostic.message}`;
```

This is applied only to `ERROR` diagnostics before Header toast presentation. Validator output, warning behavior, and asset remediation messages remain unchanged.

# 11. Public Interfaces

- `getTransformGizmoMetrics(boundsWidth, boundsHeight, zScale): TransformGizmoMetrics` is a pure utility used by the gizmo and focused unit tests.
- `TransformGizmoMetrics` exposes `cornerSize`, `centerRadius`, `edgeRadius`, `rotationRadius`, `rotationOffset`, and `hitRadius` as render-time numeric metrics.
- `getUniqueOGrafExportErrors(diagnostics)` is exported through `src/ograf/index.ts` and returns unique blocking diagnostics without mutating its input.
- `StyleColorSection` gains optional `embedded?: boolean`; omitted behavior remains the standalone APPEARANCE card.
- `StyleTextFields` now accepts the existing `onPartColorChange` callback so embedded controls preserve the established color API.
- No domain hook, serialized schema, renderer, history, or public export signature was removed.

# 12. Algorithms and Geometry

## Proportional gizmo sizing

Input: local selected bounds width/height and `zScale`. Steps: sanitize and clamp zoom to `[0.25, 4]`; derive the smaller visible object dimension after zoom compensation; multiply by `0.12`; clamp the visible screen size to `[3, 9]` pixels; convert the chosen size to gizmo units; derive center/edge/rotation radii and rotation offset with their own bounds; use an 8-pixel screen-equivalent hit radius. Complexity is O(1), with no allocation in the hot geometry path beyond the returned small metrics object.

## Transparent hit targets

Input: existing corner, edge, and rotation centers. Output: four transparent corner rectangles, four transparent edge circles, and one transparent rotation circle. They share existing callbacks and modes. The visible layer remains visually proportional; the transparent layer preserves direct manipulation affordance without changing transform math.

## Inspector layout transition

The existing React state toggles `.is-hidden` on the mounted dock. CSS interpolates existing flex dimensions and the absolute toggle’s right position. Hidden state still resolves to width/min-width/flex-basis zero and pointer-events none. `prefers-reduced-motion: reduce` continues to set transitions to none.

## Diagnostic de-duplication

Input: compiler diagnostics. Filter to `ERROR`, preserve order, and retain the first diagnostic for each `${code}:${message}` key. This aggregates repeated layer-level instances of one missing font while preserving different fonts, codes, or remediation messages.

# 13. Interaction / UX Behavior

- Gizmo — BEFORE: all visible handle constants were effectively fixed in screen space. AFTER: handles grow with the selected object’s visible size up to a 9px screen visual limit and shrink to a 3px minimum; transparent hit targets remain 8px radius. EXPECTED WORKFLOW: select a tiny, medium, or large shape/text object, then use the existing corner, edge, center, or rotation interaction.
- Text Inspector — BEFORE: text fields and Fill/Stroke were separated between TEXT and APPEARANCE. AFTER: expand TEXT to see text content, font controls, stagger controls, Fill, and Stroke together. EXPECTED WORKFLOW: use the same inline RGBA/Hue/Alpha/HEX picker; callbacks and history behavior remain the same.
- Inspector dock — BEFORE: hide/show snapped. AFTER: dock and toggle move over 240 ms with a restrained ease curve; hidden state reclaims the full dock width and visible state restores it. Reduced-motion users receive no transition.
- OGraf export — BEFORE: duplicate same-font layer errors produced repeated toasts. AFTER: one clear diagnostic remains, including `assetCatalog["font:Inter"]` remediation. Safe embedded image handling and explicit portable font requirements remain active.

# 14. Design Decisions

1. Derive gizmo size from the smaller visible object dimension. Reason: width or height alone would over-size handles for thin objects. Alternative: use a fixed screen size. Rejected because the user finding was specifically proportionality. Trade-off: extremely thin objects remain governed by the minimum clamp.
2. Keep a larger invisible hit target separate from visible controls. Reason: small proportional visuals can become difficult to grab. Alternative: enlarge visible handles. Rejected because it recreates visual domination on tiny objects.
3. Put the metrics helper in `src/utils` rather than exporting a non-component from the React overlay file. Reason: it is pure, independently testable, and avoids a new Fast Refresh warning.
4. Add `embedded` to the existing StyleColorSection. Reason: one canonical color-control implementation supports both standalone shape/legacy presentation and text composition. Alternative: duplicate picker markup in StyleTextFields. Rejected because it would split color behavior and future fixes.
5. Animate the existing mounted Inspector dock rather than conditionally mounting it. Reason: preserves state, focus architecture, and the existing toggle contract. Alternative: unmount on hide. Rejected because it causes layout/state discontinuity.
6. De-duplicate by diagnostic code and message at Header presentation. Reason: validator still needs layer-level diagnostics for programmatic callers, while one export attempt should show one root-cause toast. Alternative: change validator emission. Rejected because it would weaken diagnostic detail for non-UI consumers.

# 15. Invariants That Must Be Preserved

- `getPartLocalBounds` remains the shared selection and hit-test geometry authority.
- `TransformGizmo` keeps authored transform origin, translation, rotation, scale sign orientation, and callback modes.
- Matte rendering and the existing `matte-editor-hit-area` remain untouched.
- Text property names, color callbacks, alpha callbacks, undo/redo/history paths, and serialization remain unchanged.
- `ColorPickerPopover` remains the only modern Fill/Stroke editor for these controls; no native color input or quick palette is reintroduced.
- Inspector state remains mounted; hidden width is zero, pointer events are disabled, and the toggle remains the single dock-edge control.
- OGraf rejects unverified/external/unsafe resources and never downloads, fabricates, or substitutes missing fonts.
- OGraf legacy preparation remains clone-based and does not mutate authored SceneData.
- No branch, commit, push, reset, stash, rebase, or other Git history operation occurs.

# 16. Testing and Verification

## Focused Vitest/unit

- `npx vitest run src/tests/transformGizmo.test.tsx src/tests/selectionGizmo.test.tsx src/tests/styleAppearanceSection.test.tsx src/tests/ografBrowserZip.test.tsx src/tests/ografLegacyCompatibility.test.ts src/tests/appInspectorToggle.test.tsx` — PASS, 6 files, 37 tests.
- Coverage includes gizmo minimum/maximum/object-size/zoom metrics, existing selection bounds/orientation/matte interactions, embedded TEXT color controls, existing standalone Appearance behavior, duplicate missing-font toast aggregation, legacy embedded image/font compatibility, and stable Inspector toggle state.
- Vitest emitted existing jsdom notices for canvas context and navigation; no test failed.

## Full Vitest

- `npm test` — PASS, 91 test files, 1,375 tests.
- No dedicated Matte E2E regression was run in this pass, per scope. The required full unit command necessarily included the repository’s existing Matte unit coverage.

## TypeScript

- `npx tsc --noEmit` — PASS.

## Lint

- `npm run lint` — PASS with one pre-existing warning at `src/context/AnimatorContext.tsx:630:14` (`react(only-export-components)`). No warning remains from the new pure gizmo helper.

## Production build

- `npm run build` — PASS; 1,902 modules transformed.
- Existing Vite warning remains for the main minified chunk exceeding 500 kB; it did not fail the build.

## Playwright/E2E

- `CI="" npx playwright test e2e/v51-recovery.spec.ts --retries=0` — PASS, 3 tests.
- Covered actual text selection/Inspector composition, timeline scroll recovery, and Inspector hide/show transition/no-gutter behavior.

## Git validation

- `git diff --check` — PASS with no whitespace errors. Git emitted normal LF-to-CRLF working-copy warnings for `e2e/v51-recovery.spec.ts` and `src/components/Inspector/sections/StyleTab.tsx`.
- Final working tree is intentionally modified and unstaged. No commit or push was performed.

# 17. Manual QA Results

- Chromium Text Inspector — PASS. Selected `NEW TEXT`, expanded TEXT, observed text content/font/font-size/stagger controls plus Fill and Stroke inline controls. No Appearance disclosure, quick palette, native color input, or duplicate color section was present.
- Chromium gizmo surface — PASS. Measured the selected gizmo: 9 transparent hit targets were present, the visible cyan handle measured approximately 9.83 device pixels in the current browser viewport, and the existing selection overlay remained interactive.
- Chromium Inspector motion — PASS. Computed transition included width, min-width, flex-basis, transform, opacity, border-color, and box-shadow at 240/200 ms. After hide settled, the dock width was 0 and `.main-layout` had `inspector-hidden`; after show settled, the dock restored to 360px.
- Gizmo small/medium/large and zoom boundaries — PASS through the focused pure metrics test, covering tiny, medium, large, zoomed-out, and zoomed-in inputs. No dedicated Matte manual QA was performed.
- Legacy OGraf export UX — PASS through Header integration and focused compatibility tests. Duplicate same-font missing errors produce one actionable toast; safe embedded image paths still package bytes; missing fonts remain blocked with explicit catalog remediation.
- User acceptance — NOT PERFORMED. This report records engineering verification only.

# 18. Regression Risk Assessment

- Gizmo visual metrics: LOW/MEDIUM. Geometry and callback semantics are unchanged; risk is limited to visual sizing perception across unusual aspect ratios and zoom levels. Focused metrics, existing selection tests, and Chromium inspection pass.
- Text Inspector composition: LOW. The same picker and callback keys are reused; direct standalone StyleColorSection tests and live Text E2E pass. Risk is limited to future type-specific Inspector composition additions.
- Inspector transition: LOW. Existing state and mounted architecture remain; CSS is isolated. Reduced-motion handling is preserved and live layout assertions pass.
- OGraf diagnostic presentation: LOW. Validator and package policy are unchanged; only Header error presentation filters duplicate ERRORs. Distinct root causes remain visible and focused export tests pass.
- Matte: NO NEW CHANGE. Existing behavior was intentionally not redesigned or revalidated by a new Matte E2E matrix in this milestone.

# 19. Performance Considerations

- Gizmo sizing is O(1) and adds only a small metrics object plus up to nine transparent hit targets for an individual selection. Group selections do not receive individual handles.
- The Inspector transition uses CSS interpolation and no React animation loop, timer, or layout polling.
- Diagnostic de-duplication uses one local `Set` per export attempt and does not retain state.
- No new dependency, network request, asset fetch, or render/evaluation loop was introduced.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- React/TypeScript: strict TypeScript check passes. Existing component and callback behavior remains compatible.
- Vite: production build passes with the existing large-chunk warning.
- Browser support: transparent SVG hit targets and CSS transitions use existing browser primitives. Reduced-motion behavior remains explicit.
- OGraf: safe embedded image normalization, explicit local font provenance, browser binary content, and rejection of unsafe/external sources remain compatible with the previous checkpoint contract.
- Git: branch remains `main`; no history operation was performed.

# 22. Known Limitations

- Gizmo visual-size behavior is bounded by a smaller-dimension heuristic; extremely thin or highly asymmetric objects can still appear governed by the 3px minimum.
- Inter, Bebas Neue, and Montserrat remain non-portable for OGraf until caller-provided local bytes or an explicit local `sourcePath` is catalogued under `assetCatalog["font:<family>"]`.
- Existing ordinary local image paths still require an explicit asset catalog; automatic compatibility preparation is limited to safe embedded Data URL and same-document Blob content.
- Font measurement/availability remains environment-dependent for existing text geometry behavior.
- No user acceptance or manual Matte QA was performed in this pass.

# 23. Technical Debt

- Add a browser-level gizmo matrix for deliberately tiny, medium, large, thin, and zoomed objects if future user QA finds a perceptual clamp issue.
- Consider a measured-font/gizmo metrics cache only after profiling demonstrates pointer-drag pressure; no speculative cache was added.
- If OGraf consumers later need distinct diagnostics with identical messages, extend the de-duplication key with an explicit root-cause field rather than reintroducing toast spam.
- Existing Fast Refresh warning in `AnimatorContext.tsx:630:14` remains outside this scope.

# 24. Git Summary

- Branch: `main`.
- Starting HEAD: `4dc6c43 chore: checkpoint KCS V5.1 consolidated recovery before QA`.
- Ending HEAD: `4dc6c43 chore: checkpoint KCS V5.1 consolidated recovery before QA`.
- Initial working tree: clean and synchronized with `origin/main`.
- Ending working tree: intentionally modified and unstaged for user review.
- Commit: NO COMMIT.
- Push: NO PUSH.
- No branch, staging, reset, stash, rebase, merge, or history rewrite was performed.

# 25. Updated Project Tree

```text
reports/
  progress_024.md
src/
  components/
    Canvas/overlays/TransformGizmo.tsx
    Header/HeaderBar.tsx
    Inspector/
      PropertyInspector.css
      sections/StyleTab.tsx
      sections/style/StyleColorSection.tsx
      sections/style/StyleTextFields.tsx
  ograf/
    diagnostics.ts
    index.ts
  tests/
    ografBrowserZip.test.tsx
    styleAppearanceSection.test.tsx
    transformGizmo.test.tsx
  utils/
    transformGizmoMetrics.ts
e2e/
  v51-recovery.spec.ts
```

All other project files, including Matte implementation and coverage, remain outside this pass.

# 26. Self Review

What is good: the gizmo change is pure-metric and preserves existing interaction ownership; visible controls and hit targets are intentionally separated. Text color controls reuse the canonical picker instead of adding another implementation. Inspector motion uses CSS on the existing mounted dock and honors reduced motion. OGraf validation remains strict while Header feedback becomes root-cause-oriented. Focused, full unit, TypeScript, lint, build, E2E, and live browser checks provide evidence.

What could be improved: browser QA did not include a dedicated authored tiny/medium/large object matrix; metric tests cover those boundaries but not every renderer aspect ratio. No approved local legacy font binary exists, so successful portable export of named legacy fonts cannot be demonstrated without caller-supplied catalog data. The existing Fast Refresh warning and Vite chunk warning remain.

Why these are acceptable now: user scope explicitly called for a focused post-checkpoint polish pass, prohibited broad Matte continuation, and required no fabricated/downloaded fonts. The remaining limitations are explicit and do not justify speculative refactoring.

# 27. Next Recommended Task

Perform user QA on the four changed surfaces: tiny/large gizmo direct manipulation at multiple zoom levels, consolidated Text Fill/Stroke editing, Inspector hide/show motion, and legacy OGraf export with caller-supplied portable font/image catalog entries.

# 28. Project Status

- Current milestone: implementation complete in the intentionally uncommitted working tree.
- Completed: proportional gizmo visuals and hit targets, Text Fill/Stroke relocation, restrained Inspector transition, duplicate OGraf error aggregation, focused regression tests, full Vitest, TypeScript, lint, build, focused V51 E2E, and live Chromium verification.
- Intentionally not changed: Matte behavior, Matte architecture, Matte serialization/history, and new dedicated Matte QA.
- OGraf status: embedded image compatibility PASS; missing-font diagnostics PASS; named fonts without approved portable source remain correctly blocked.
- User QA status: READY FOR USER QA; not accepted by user in this session.

# 29. AI Development Notes

- The repository started from the user-specified clean checkpoint `4dc6c43`; no unexpected working-tree changes were found.
- Existing canonical authorities were reused: `getPartLocalBounds`, `TransformGizmo` interaction callbacks, `ColorPickerPopover`, mounted Inspector state, `prepareLegacyOGrafExport`, OGraf validator/compiler, and existing test fixtures.
- The previous safe embedded-image and portable-font compatibility work was preserved; this pass added only focused Header diagnostic aggregation around that policy.
- The requested Matte stop condition was respected. No new Matte implementation, redesign, broad test matrix, or fallback behavior was added.
- No files under `.hermes/desktop-attachments/` were touched.
- No commit or push was performed.

## DO NOT CHANGE CASUALLY

- `getPartLocalBounds` as the shared selection/hit-test geometry authority.
- `TransformGizmo` translation, rotation, mirrored orientation, callback modes, and matte interaction separation.
- The proportional gizmo clamp contract and separate transparent hit-target affordance without user QA evidence.
- `ColorPickerPopover` as the canonical Fill/Stroke editor and the embedded/standalone StyleColorSection composition boundary.
- Inspector mounted hide/show state, zero-width hidden layout, single dock toggle, and reduced-motion override.
- OGraf safe embedded-image allowlist, clone-based preparation, local asset catalog provenance, and missing-font blocking policy.
- OGraf diagnostic aggregation semantics unless the root-cause contract changes.
- Matte coordinate spaces, explicit project coverage, inversion/even-odd geometry, and source transform ownership.
- No fabricated, downloaded, substituted, or silently fallback font assets.

# 30. Lessons Learned

- A fixed zoom-compensated handle can still be visually wrong when object size varies; screen-space usability needs an explicit object-size policy and a separate hit-target policy.
- Composition boundaries are safer than duplicate controls: an explicit embedded mode allowed Text to consolidate Fill/Stroke without changing the existing picker or callbacks.
- CSS transitions are sufficient for dock layout continuity when the component remains mounted; no animation state machine was necessary.
- Layer-level validator diagnostics and user-facing export toasts have different granularity needs; filtering at the Header presentation boundary preserves both.
- Focused pure tests can cover tiny/medium/large/zoom edge cases without adding a parallel renderer or broad visual test harness.
