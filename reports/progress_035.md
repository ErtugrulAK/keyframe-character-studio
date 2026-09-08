# Progress Report 035 — KCS Research-Driven Professional UI/UX Redesign V2

## Executive Summary

Completed the research-first V2 UI redesign milestone on `feat/v6-ui-design-v2`. Research, current UI audit, reference extraction, design principles, screen-by-screen specification, implementation, independent designer review, real browser review, and full regression were completed in the required order.

The V2 pass preserves KCS’s existing desktop editor architecture and coordinate contracts while improving hierarchy and density. Header mode state is calmer, secondary active states no longer compete with Export, toolbar and Inspector empty states are flatter and more actionable in reading order, Outliner selection is quieter, Timeline transport and lanes are denser, and Curve Editor support surfaces are flattened into a graph-dominant professional tool layout. No dependency was added and no domain authority was replaced.

## Objectives

- Research Zero Density OGraf Studio, plugin87 UX/UI Agent Skills, Vercel Web Interface Guidelines, and professional creative-tool patterns.
- Complete factual MCP/UI tooling audit before implementation.
- Audit KCS at 1920×1080, 1440×900, and 1366×768.
- Produce V2 research, audit, and screen-by-screen specification documents.
- Improve Shell/Header, Toolbar, Outliner, Inspector, Timeline, Curve Editor, masks/mattes presentation, focus, and empty-state hierarchy.
- Preserve 79px header, 56px left navigation, canvas dominance, and all canonical state/evaluation/mutation authorities.
- Complete independent designer polish review and full automated regression.

## Branch strategy

- Protected baseline: `main` remained untouched at `8024d4f29e17623bdc0efda31e9e4332b92460b1`.
- Source product branch: `feat/v6-ui-polish` at `92713b4`.
- Dedicated V2 branch: `feat/v6-ui-design-v2`.
- Research/spec commit: `4896a70 docs: define V2 UI research and specification`.
- Safe pre-implementation checkpoint: `b0d3efc chore: checkpoint before V2 UI implementation`.
- Product implementation commit: `0367c83 fix: refine V2 editor visual hierarchy`.
- Documentation branch was not changed in this milestone.

## Research sources

- Zero Density OGraf Studio: https://github.com/zerodensity/ograf-studio
- plugin87 UX/UI Agent Skills: https://github.com/plugin87/ux-ui-agent-skills
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- Vercel guideline source: https://github.com/vercel-labs/web-interface-guidelines
- Creative-tool references: Adobe After Effects, Blender, DaVinci Resolve/Fusion, Motion Canvas, Theatre.js, Rive, and Paper.js.

Detailed evidence is recorded in `docs/research/KCS_UI_DESIGN_V2_RESEARCH.md`.

## Zero Density findings

Direct repository inspection showed a TypeScript editor with explicit AppShell, dock workspace, stage, panel, property-row, canvas-ruler, path-editor, and timeline boundaries. The useful KCS adaptations were:

- explicit persistent editor regions;
- dock/panel hierarchy instead of page-like cards;
- compact property rows with deliberate label/value alignment;
- canvas pasteboard dominance;
- semantic selected-layer/keyframe states;
- restrained dark surfaces;
- explicit resize, drag, focus, and empty-state behavior.

The repository is AGPL-3.0-only. No code, branding, or assets were copied.

## plugin87 findings

The redesign workflow requires Scan → Diagnose → Direct → Apply → Verify. The design-review workflow prioritizes visual hierarchy, consistency, accessibility, usability, responsiveness, and performance. Token guidance favors one semantic authority; anti-slop guidance rejects card-everywhere layouts, arbitrary glow, excessive gradients/radii, glassmorphism, and decorative color noise. Accessibility guidance emphasizes WCAG 2.2, focus, target size, reduced motion, keyboard alternatives, and complete empty/error states.

The repository is MIT-licensed and was studied selectively. It was not installed or copied into KCS.

## MCP and tooling audit

| Resource | Result | Decision |
| --- | --- | --- |
| shadcn MCP | Not installed/configured; no Tailwind, Radix, or `components.json` authority | Rejected |
| 21st / former Magic MCP | Not installed/configured; no verified API/key | Rejected |
| Chrome DevTools MCP | Not mounted | Unavailable; isolated Chromium used |
| Vercel Web Interface Guidelines | Direct official guidance and MIT source inspected | Used partially as review gate |
| plugin87 UX/UI Agent Skills | Direct repository and redesign/design-review skills inspected | Selectively integrated |
| KCS-native UI/design/a11y skills | Repository-local skills and design docs available | Used |
| Isolated Chromium browser | Available and configured | Used for real app review |

No dependencies were installed.

## Current UI audit

The real app was audited with `e2e/fixtures/v6-motion-core.scene.json` in isolated Chromium. At all required viewports, measured document dimensions matched the viewport and no console errors were observed during the clean fixture session.

Observed baseline issues:

- Header mode, active template, save status, and Export competed through teal emphasis.
- Toolbar active state and Media dropzone felt like generic web-card patterns.
- Outliner heading competed with layer data and inactive icons were quiet.
- Inspector header/disclosures repeated border/card weight and the empty state was passive/centered.
- Timeline Play control was oversized, transport controls fragmented, and empty lanes lacked enough separation.
- Curve Editor support areas were too card-heavy relative to the graph.
- Mask/Track Matte concepts needed stronger visual separation without changing their existing semantics.

Prioritized issues and per-screen findings are recorded in `docs/design/KCS_UI_V2_AUDIT.md`.

## Design principles

1. Canvas dominance.
2. Density through rhythm, not more cards.
3. Functional color with one clear primary emphasis.
4. One KCS semantic token vocabulary.
5. Explicit selection, focus, warning, error, and disabled states.
6. Coordinate safety for 79px header and 56px nav.
7. Direct-manipulation parity with numeric/keyboard alternatives.
8. Calm technical tone: restrained borders, radii, gradients, and glow.
9. Progressive disclosure for advanced properties.
10. Evidence-backed browser and regression review.

## Design spec summary

`docs/design/KCS_UI_V2_SPEC.md` specifies all required surfaces:

- Application Shell/Header
- Toolbar
- Outliner
- Canvas chrome
- Inspector
- Appearance
- Text
- Mask/Track Matte
- Timeline
- Curve/Graph Editor
- Bezier Path editing
- Popovers/dialogs
- Empty states

Each section records current problem, target hierarchy, grouping, spacing, typography, interaction states, reference principles, and behavior invariants.

## Files changed

- `docs/research/KCS_UI_DESIGN_V2_RESEARCH.md`
- `docs/design/KCS_UI_V2_AUDIT.md`
- `docs/design/KCS_UI_V2_SPEC.md`
- `src/components/Header/HeaderBar.tsx`
- `src/kcsEditorTheme.css`
- `reports/progress_035.md`

No `.hermes/desktop-attachments/` files were touched. The unrelated untracked `reports/model_routing_analysis.md` was preserved and not staged.

## Design system changes

`src/kcsEditorTheme.css` remains the semantic editor visual authority. V2 adds a small semantic state vocabulary for muted active fills, selected fills, stronger borders, and readable labels. It does not create a second styling system.

Changes are CSS-first and preserve existing DOM behavior:

- mode controls use explicit classes for correct active-state styling;
- solid teal emphasis is removed from passive/secondary states;
- compact controls use the existing 24/28/32px scale;
- tabular values and explicit unit spacing remain in place;
- `prefers-reduced-motion` keeps transitions disabled;
- panel scroll ownership uses contained overscroll behavior.

## Shell/Header

- Preserved 79px header height and 56px left navigation width.
- Mode toggle now has calm segmented hierarchy with distinct Edit/Broadcast active states.
- Passive autosave status is visually muted.
- Active template no longer competes with the primary Export action.
- No coordinate-sensitive layout dimensions changed.

## Inspector

- Preserved Geometry removal and Corner Radius in Appearance from the previous milestone.
- Preserved Edit/Duplicate behavior and existing low-frequency icon actions.
- Reduced repeated header/card emphasis.
- Left-aligned empty state for clearer reading order.
- Preserved compact numeric controls, canonical color picker, Text Fill/Stroke placement, and disclosure behavior.

## Outliner

- Muted panel title emphasis.
- Improved inactive icon contrast.
- Replaced bright selected-row border with a quieter selected fill.
- Preserved tree semantics, selection, visibility, lock, hierarchy, and reorder behavior.

## Timeline

- Reduced Play control from 40px to 32px.
- Replaced hover `transition: all` behavior with explicit visual transitions for the V2 control.
- Normalized transport/zoom control height to the existing compact scale.
- Increased lane/ruler separation while keeping the timeline height and scroll ownership intact.
- Preserved sequence tabs, playhead, keyframes, disclosures, scalar/mask/path rows, and context menus.

## Curve/Graph Editor

- Preserved graph math, Value/Speed semantics, presets, preview, CSS copy, and Apply/Cancel behavior.
- Flattened handle, preview, Value Graph, CSS output, and preset support surfaces.
- Kept data inputs as intentional controls with readable focus and numeric typography.
- Made the graph the dominant surface and preserved the existing 1366×768 internal scroll boundary.
- Speed Graph remains derived/read-only under the current product contract.

## Masks/Track Matte

No mask or Track Matte authority changed. Existing conceptual separation remains:

- Masks: stack, mode, invert, path, feather, opacity, expansion.
- Track Matte V2: source, alpha/luminance type, inversion, source visibility.

V2 changes are limited to shared panel hierarchy and state readability.

## Accessibility

- Native buttons, labels, inputs, disclosures, tree items, and dialog semantics preserved.
- Icon-only control audit found 0 unnamed buttons in the final browser state.
- Corner Radius range remained associated with its `CORNER RADIUS` label.
- Visible `:focus-visible` rules preserved.
- Keyboard and numeric alternatives were not removed.
- Reduced-motion rules preserved.
- Final browser surface reported no document overflow.

## Designer final review

A fresh `@designer` review was used for the independent audit and a second designer review was used for the final polish loop. Initial review identified remaining card-everywhere treatment, passive centered empty states, and active-state color noise. The focused polish pass flattened Curve Editor support surfaces, flattened preset controls, left-aligned empty states, muted template/sequence active states, and flattened the Media dropzone. The follow-up designer review returned `PASS` and confirmed the hierarchy matched the dense, flat professional-tool specification.

## Browser visual QA

Isolated Chromium final review:

- 1920×1080: header 79px, nav 56px, no overflow, no NaN transforms.
- 1440×900: header 79px, nav 56px, no overflow, no NaN transforms.
- 1366×768: header 79px, nav 56px, no overflow, no NaN transforms.
- Clean fixture import: no console errors.
- Luminance Target: Corner Radius rendered as `0 PX`; GEOMETRY absent; action row rendered.
- Curve Editor: 960×728 modal fit inside 1366×768 viewport; graph and Apply controls present; support surfaces computed transparent/flat.
- Broadcast mode: active state used muted warning fill rather than solid teal.
- Final accessibility check: 0 unnamed buttons, labeled range control, 90 focusable controls observed in the tested dense state.

## Regression tests

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with existing `react(only-export-components)` warning at `src/context/AnimatorContext.tsx:655:14`.
- `npm test`: PASS — 99 files, 1,421 tests.
- `npm run build`: PASS with existing Vite large-chunk warning.
- `git diff --check HEAD~1..HEAD`: PASS before report commit.
- `npm run qa:v6`: PASS — 3/3.
- V-M1: PASS through V6/full Playwright pixel gate; no threshold changes.
- V-H2: PASS through V6/full Playwright pixel gate; observed spike values `aLeft=199`, `bLeft=93`.
- `CI=true npm run test:e2e`: PASS — 252/252, 0 failed, 0 flaky.

## Designer/tool decisions

- shadcn MCP: REJECTED.
- 21st MCP: REJECTED.
- Chrome DevTools MCP: UNAVAILABLE.
- Web Interface Guidelines: USED PARTIALLY.
- UX/UI Agent Skills: SELECTIVELY INTEGRATED.
- Dependencies: NONE.
- Implementation route: direct main-session implementation after the required research/spec gate; no separate `@task` worker was dispatched because the scoped CSS/markup changes shared one coordinate-sensitive visual authority.
- Hard technical route: NOT NEEDED.

## Known limitations

- Browser review was Chromium-focused; Firefox and Safari were not exercised.
- Full state-by-state manual review of every dense project combination remains a user acceptance activity.
- Existing lint Fast Refresh warning and Vite chunk-size warning remain.
- The Curve Editor modal uses its existing internal scrolling at short desktop heights; critical controls remain reachable but may require modal scroll at 1366×768.
- Untracked `reports/model_routing_analysis.md` remains outside this milestone.

## Git summary

- Branch: `feat/v6-ui-design-v2`.
- Research/spec commit: `4896a70`.
- Pre-implementation checkpoint: `b0d3efc`.
- Implementation commit: `0367c83`.
- Report commit will follow this document.
- `main` and `origin/main` remain unchanged.
- UI branch and origin parity will be verified after the report commit and push.

## Self-review

Strong points: research and audit preceded implementation; the design direction is grounded in OGraf’s dock/panel discipline, plugin87’s anti-slop/a11y process, and Vercel’s focus/overflow/motion guidance. The independent designer review found a real remaining issue, and the focused polish pass addressed it. Browser inspection covered all required viewports and a clean imported fixture. Full tests remained green.

Tradeoff: the work is intentionally CSS-first and does not attempt a broad component rewrite. This limits visual risk and preserves the coordinate-sensitive shell and domain authorities, but some deep modal/timeline state-specific polish remains suitable for manual QA rather than speculative implementation.

## Manual QA handoff

1. **Selected shape / Appearance** — At 1920×1080 import `e2e/fixtures/v6-motion-core.scene.json`, select Luminance Target, open Appearance. Expect Corner Radius `0 PX`; send a screenshot if Geometry appears or the unit spacing is wrong.
2. **Corner Radius edit** — Set the slider to 12. Expect `12 PX` and updated rounded geometry; send before/after screenshots if either value or canvas is wrong.
3. **Inspector actions** — Capture the selected Inspector header. Expect Edit/Duplicate and existing duplicate/delete actions aligned in one row; send a screenshot if controls clip or compete visually.
4. **Duplicate mode** — Click Duplicate, then Edit. Expect Mirror Y/Mirror X/Mirror Origin followed by the normal Inspector; send a screenshot if the mode content or return path is wrong.
5. **Timeline density** — Expand a layer and property rows at 1440×900. Expect aligned ruler, lanes, playhead, and compact transport; send a screenshot if rows clip or scroll ownership breaks.
6. **Curve Editor** — Open Motion Curves at 1366×768. Expect graph-dominant modal, reachable handles, Value/Speed controls, presets, CSS output, and Apply; send a screenshot if any critical control is clipped or unreachable.
7. **Mask / Track Matte** — Open a configured mask and Track Matte state. Expect separate conceptual groups and unchanged source/type/invert/visibility semantics; send a screenshot if concepts merge or values disappear.
8. **Outliner and toolbar** — Exercise selection, visibility, lock, Media drawer, and empty state. Expect readable icons, muted selected fills, and left-aligned instructions; send a screenshot if hierarchy or actionability regresses.
9. **Accessibility/overflow** — Tab through the selected Inspector and Curve Editor at 1920×1080, 1440×900, and 1366×768. Expect visible focus, named icon controls, no page overflow, and no console errors; send a screenshot plus console output if wrong.

## DO NOT CHANGE CASUALLY

- Header height 79px and left nav width 56px are coordinate-sensitive.
- V-M1 and V-H2 screenshot probes and thresholds.
- `AnimatorContext`, evaluator utilities, timeline mutation authority, serialization/migration, history, clipboard, mask, Track Matte, broadcast, and OGraf pathways.
- `Track.channels` canonical animation representation.
- `src/kcsEditorTheme.css` semantic visual authority.
- Existing `lucide-react` icon family and native accessibility semantics.
- Do not install Tailwind/shadcn/21st dependencies without a documented blocker and explicit approval.

## Lessons learned

- Professional creative-tool density comes from alignment, rhythm, and state semantics more reliably than from adding components or decorative surfaces.
- A research gate prevented the first implementation pass from stopping at “looks polished” while card-everywhere treatment remained visible.
- Independent designer review is most useful when tied to a concrete screenshot and a short list of anti-generic checks.
- Shell dimensions are observable rendering contracts; visual polish must remain inside those boundaries.
