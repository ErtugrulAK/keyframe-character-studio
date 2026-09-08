# KCS Professional Motion Editor UI/UX Redesign

## Metadata

- Branch: `feat/v6-ui-redesign`
- Base: `939d6de3ca7eab7484c7104008a70b4e3a3e2918`
- Scope: research-led visual redesign only; no domain-authority redesign
- Main modified: No

## Current Contract

KCS remains a React desktop motion editor with canonical authorities in `AnimatorContext`, domain hooks, evaluator utilities, OGraf renderers, timeline mutations, serialization, and existing browser tests. UI components remain responsible for presentation and interaction wiring; animation, mask, matte, history, and serialization behavior were not replaced.

## User Goal and Gap

Goal: make KCS feel like a cohesive professional motion-design editor rather than a collection of adjacent panels. The audited gap was inconsistent visual weight, excessive card/border emphasis, weak shell hierarchy, and inconsistent compact-control language.

## Research

- Zero Density OGraf Studio was inspected directly. Findings: dockable editor regions, explicit layer/inspector/timeline ownership, compact property rows, canvas pasteboard framing, restrained dark surfaces, semantic selection, and task-oriented empty states.
- After Effects informed disclosure hierarchy, layer density, keyframe readability, and explicit mask/track-matte separation.
- Blender informed region discipline, collapsible properties, and direct-manipulation consistency.
- DaVinci Resolve/Fusion informed dark surface hierarchy and semantic state contrast.
- No proprietary code, branding, or assets were copied.

## Tool and License Decisions

- shadcn MCP: rejected for installation. KCS has no Tailwind/Radix/components.json authority; installation would add configuration and styling churn without solving a current problem.
- 21st MCP: rejected for installation. Current project requires an external API key; its value here is inspiration, not a runtime dependency.
- Vercel Web Interface Guidelines: used as a review gate for focus, semantics, target size, reduced motion, numeric typography, and overflow.
- Chrome DevTools MCP: researched, Apache-2.0, but not installed. Isolated Chromium browser tooling in the harness provided the required observation and screenshot capability without exposing a personal browser.
- UX/UI Agent Skills: selectively integrated as concepts through KCS-specific documents; the full MIT repository ecosystem was not copied.
- No dependencies installed. Existing `lucide-react` remains the icon family.

## Design System

`src/kcsEditorTheme.css` is the visual layer authority and `src/index.css` remains the existing token compatibility authority. The redesign adds semantic KCS surface, text, border, accent, control, radius, motion, and reduced-motion tokens. It uses Inter for UI text, JetBrains Mono/tabular numerics for editor values, compact 24/28/32px controls, restrained 3–7px radii, and explicit focus rings.

## Component Changes

- `src/App.tsx`: imports the shared editor theme without changing app state or domain ownership.
- `src/kcsEditorTheme.css`: establishes professional shell, header, toolbar, canvas, inspector, outliner, timeline, graph, control, responsive, and reduced-motion styling.
- `src/components/Canvas/StageCanvas.css`: reduces pasteboard visual noise while preserving canvas behavior.
- Existing Header, Toolbar, Inspector, Outliner, Timeline, Graph, Masks, Track Matte, dialogs, and canvas components retain their public behavior and receive shared visual treatment through existing class names.

## Browser Audit

Isolated Chromium observations and screenshots were captured at 1440×900, 1920×1080, and 1366×768. Checked default project, hierarchy, canvas, toolbar, inspector empty state, selected inspector disclosures, graph editor modal, focusable controls, page overflow, and console errors. Results:

- No horizontal or vertical page overflow at tested desktop sizes.
- No browser console errors observed in the audit session.
- Icon-only buttons had accessible labels or titles in the audited tree.
- Canvas remained the dominant central surface.
- Graph editor remained readable and keyboard-oriented controls remained present.

## Accessibility and Motion

Visible `:focus-visible` rings remain enabled. Existing semantic buttons, labels, tree items, disclosures, and keyboard graph/Bezier controls remain intact. Reduced-motion media rules disable new transitions. Dense editor controls retain at least 28px hit targets; desktop-first behavior is intentional.

## Verification

- Focused UI Vitest: PASS — 9 files, 175 tests.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with documented existing Fast Refresh warning at `src/context/AnimatorContext.tsx:655`.
- `npm test`: PASS — 100 files, 1,421 tests.
- `npm run build`: PASS; existing main-chunk size warning remains.
- `git diff --check`: PASS.
- `npm run qa:v6`: PASS — 3/3.
- `CI=true npm run test:e2e`: PARTIAL — 250/252 passed; 2 existing pixel-threshold failures remained in `e2e/m21-image-matte.spec.ts` V-M1 and `e2e/track-matte.spec.ts` V-H2 after isolated retries. Assertions were not weakened.

## Scope Audit

Only intentional UI redesign files and the required research/design documents are changed. No `.hermes/desktop-attachments/` files were touched. No main branch change, merge, reset, stash, or unrelated domain refactor occurred.

## Phase Commits

- `858809b feat: establish professional KCS editor visual language`

## Known Limitations

Full Playwright is not green because two deterministic pixel assertions remain at or one unit beyond their existing thresholds. The failures are in pre-existing pixel-sensitive matte scenarios, not UI interaction assertions. They require a separate rendering/test-seam investigation; thresholds were not altered.

## Future Polish

A future UI phase may add dockable panel persistence, richer contextual menus, and deeper visual QA coverage for dense projects, but those are outside this checkpoint.

## DO NOT CHANGE CASUALLY

- Do not replace evaluator, playback, broadcast, mask, matte, history, serialization, or timeline authorities with UI-local state.
- Do not install Tailwind/shadcn/21st dependencies without a documented KCS problem and dependency gate.
- Do not weaken pixel assertions or hide Playwright failures with retries or tolerance changes.
- Do not convert the desktop editor into a mobile card layout.
- Do not merge main or begin unrelated roadmap work from this branch.

## Verdict

BLOCKED: full Playwright is not green (250/252); V-M1 and V-H2 pixel assertions require resolution before consolidated UI user acceptance QA.
