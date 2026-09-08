# KCS UI Design V2 Research

## Scope

This document records the research completed before V2 implementation. The target is a professional desktop motion-design editor: dense, calm, precise, dark, technical, and creative-tool oriented. No source branding, proprietary code, or unverified implementation was copied.

## Research sources

### Zero Density OGraf Studio

Repository: https://github.com/zerodensity/ograf-studio

Observed repository facts:

- TypeScript editor organized into explicit layout, canvas, component, panel, and state areas.
- `AppShell` composes a menubar, dock workspace, stage, review surface, and numeric scrub controller.
- `DockWorkspace` treats panes, tabs, groups, floating panes, resize handles, and persistence as first-class workspace concepts.
- `PropertyRow.css` uses a shared property-column contract, truncation, and a keyboard-visible resize affordance rather than arbitrary per-row alignment.
- Canvas modules include rulers, pasteboard/background framing, stage zoom, path editing, and layout geometry helpers.
- The README describes a dockable broadcast-authoring workspace, compact property editing, reusable designs, animation/effects, and deterministic OGraf output.
- The repository is TypeScript and licensed AGPL-3.0-only. It is a reference for concepts, not a source for copied code or assets.

Design findings applied to KCS:

- Keep the canvas as the dominant central work surface.
- Treat Outliner, Inspector, and Timeline as explicit regions with clear ownership.
- Use compact property rows with predictable label/value alignment.
- Use restrained dark surfaces and semantic selection instead of decorative glow.
- Make dock/panel boundaries legible through rhythm and separators, not nested cards.
- Keep resize, focus, drag, and empty states intentional.

### plugin87 UX/UI Agent Skills

Repository: https://github.com/plugin87/ux-ui-agent-skills

Relevant material:

- `redesign` requires Scan → Diagnose → Direct → Apply → Verify and explicitly guards working behavior.
- `design-review` recommends a six-dimension review: visual hierarchy, consistency, accessibility, usability, responsiveness, and performance, with prioritized findings.
- The kit emphasizes a single semantic token authority, DTCG-style primitive/semantic/component thinking, WCAG 2.2, reduced motion, and anti-slop review.
- The anti-generic guidance rejects card-everywhere layouts, arbitrary gradients, glassmorphism, excessive radii, decorative color noise, and inconsistent icon systems.
- The project is an MIT-licensed instruction/knowledge layer. It was not installed or copied into KCS; principles were selectively integrated into this document and the V2 specification.

### Vercel Web Interface Guidelines

Official guidance: https://vercel.com/design/guidelines
Source repository: https://github.com/vercel-labs/web-interface-guidelines (MIT)

Relevant gates for a dense editor:

- Keyboard operation and visible, unobscured `:focus-visible` states.
- Hit targets of at least 24px where visual controls are smaller.
- Explicit, intentional overflow and contained scrolling.
- CSS/flex/grid sizing before JavaScript measurement.
- Reduced motion and explicit transition properties; never `transition: all`.
- Tabular numeric values and a space between values and units.
- Semantic labels for icon-only controls and redundant non-color state cues.
- Resilient empty, sparse, dense, and error states.
- Accessible native elements before ARIA-only substitutes.

These guidelines are adapted for a fixed desktop editor. URL state and mobile-specific input sizing are not forced onto KCS where the existing product contract is local project authoring and desktop-first operation.

### Professional creative-tool references

Conceptual references: Adobe After Effects, Blender, DaVinci Resolve/Fusion, Motion Canvas, Theatre.js, Rive, and Paper.js.

Common useful patterns:

- persistent spatial regions;
- compact, repeatable property rows;
- clear selected-layer and selected-keyframe identity;
- timeline/ruler alignment;
- disclosure hierarchy for advanced properties;
- direct manipulation paired with numeric/keyboard alternatives;
- restrained accent colors reserved for meaningful active state;
- modal/editor surfaces where the graph dominates supporting controls.

These are conceptual references only; no code or assets were imported.

## Tool and MCP audit matrix

| Resource | Installed? | Configured? | Available? | Used? | License | Useful? | Decision | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shadcn MCP | No evidence | No `components.json`, Tailwind, or Radix authority found | Unavailable | No | N/A | Low for this pass | Rejected | Existing CSS token authority is sufficient; migration would create churn and generic primitives |
| 21st / former Magic MCP | No evidence | No API/configuration found | Unavailable | No | Unknown | Research-only at most | Rejected | No verified endpoint or key; no necessary value for the existing UI |
| Chrome DevTools MCP | No | Not mounted | Unavailable | No | N/A | Would be useful | Unavailable | Isolated Chromium provided layout, console, accessibility, and screenshot inspection |
| Vercel Web Interface Guidelines | No install required | Public official guidance | Available via web | Yes | MIT source repository | High as review gate | Used partially | Adapted keyboard, focus, overflow, motion, typography, and anti-noise guidance to desktop editor constraints |
| plugin87 UX/UI Agent Skills | Not installed | Repository studied directly | Available via web | Yes | MIT | High as process guidance | Selectively integrated | Used audit-first, design-review, token, a11y, and anti-slop principles without copying the kit |
| KCS-native design/a11y skills | Yes | Repository-local | Available | Yes | Repository | High | Used | Existing KCS skills and design documents remain the project-specific authority |
| Isolated Chromium browser tooling | Harness-provided | Session configured | Available | Yes | Harness/tooling | High | Used | Real app inspection at 1920×1080, 1440×900, and 1366×768 without personal-browser access |

## Dependency decision

No dependencies will be added before or during V2 implementation unless a later evidence-backed blocker requires explicit approval. Existing React, TypeScript, Vite, `lucide-react`, CSS, Vitest, and Playwright cover the target.

## Design principles for V2

1. Canvas dominance: the stage is the visual anchor; panels support authoring.
2. Density through rhythm: use compact rows, alignment, and hierarchy rather than more cards.
3. Functional color: teal communicates active/primary state, not decoration.
4. One token vocabulary: refine the existing KCS visual authority; do not add Tailwind or a parallel theme.
5. Explicit state: selected, focused, hovered, disabled, warning, and error states use both contrast and semantics.
6. Coordinate safety: preserve the 79px header and 56px left navigation dimensions.
7. Direct manipulation parity: every important drag/path operation keeps numeric or keyboard alternatives.
8. Calm technical tone: restrained borders, few radii, tabular numerics, and no glassmorphism.
9. Progressive disclosure: show frequent controls first and advanced controls behind coherent disclosures.
10. Evidence over taste: every implementation slice must be browser-reviewed and regression-tested.

## Research conclusion

The highest-leverage V2 work is a visual hierarchy correction across the existing shell, Inspector, Outliner, Timeline, and Curve Editor. The product architecture already supports professional behavior; the redesign should sharpen region hierarchy, semantic accents, density, alignment, and state clarity without changing domain authorities or serialized semantics.
