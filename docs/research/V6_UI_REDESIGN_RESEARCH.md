# KCS V6 Professional UI Redesign Research

## Reference: Zero Density OGraf Studio

**Source:** `zerodensity/ograf-studio`, inspected directly on GitHub. Repository license: AGPL-3.0-only. No source code or branding is copied into KCS.

### What works

- A dockable editor shell separates global chrome, workspace panes, canvas, and timeline.
- The layer list, inspector, timeline, and canvas are treated as editor surfaces rather than dashboard cards.
- A compact tabbed pane model supports dense workflows without multiplying permanent controls.
- Canvas support includes rulers, pasteboard framing, zoom, path editing, and outside-canvas treatment.
- Property rows use consistent labels, numeric controls, and scrub-friendly interaction.
- The dark theme uses restrained surfaces and thin separators so selection and active state carry emphasis.
- Empty states are task-oriented and explain the next action.
- The repository uses explicit tests for docking, layout geometry, zoom, path editing, and numeric scrub behavior.

### Why it works

The interface establishes a spatial model that matches motion-authoring work: persistent layer context on one side, direct manipulation in the center, property detail on the other side, and temporal editing below. Density is created with row rhythm and hierarchy, not with unrelated borders or oversized cards. The shell is extensible because pane ownership is explicit.

### What KCS should adopt

- A clear app bar / tool rail / canvas / inspector / timeline hierarchy.
- Compact tabs and disclosure groups for high-density property surfaces.
- Consistent property-row alignment and tabular numeric values.
- A canvas pasteboard that visually dominates surrounding UI.
- Thin, low-contrast separators plus stronger selected/active states.
- Task-specific empty states and visible keyboard focus.
- Conceptual separation of layer list, inspector, and timeline responsibilities.

### What KCS should not adopt

- AGPL source code, proprietary branding, logos, or copied visual assets.
- A full docking framework or multi-window system before KCS needs it.
- OGraf-specific panels that do not map to KCS workflows.
- AI chat or data panels as permanent chrome merely because the reference includes them.

## Reference: Adobe After Effects

### What works

- Layer rows and property disclosures establish a strong parent/child temporal hierarchy.
- Keyframes remain visually legible at high density.
- Mask controls are conceptually separate from track-matte controls.
- Contextual properties appear when a layer or property is selected.

### KCS adoption

Use the disclosure hierarchy, track density, temporal row alignment, and mask/matte terminology. Do not clone the exact palette, typography, or panel chrome.

## Reference: Blender

### What works

- Editor regions have distinct jobs and consistent headers.
- Collapsible properties and direct manipulation support expert workflows.
- Timeline and editor controls share a coherent compact language.

### KCS adoption

Use region discipline, compact disclosure headers, and direct-manipulation affordances. Avoid Blender's full workspace and editor-switching complexity.

## Reference: DaVinci Resolve / Fusion

### What works

- Dark surfaces create clear depth without decorative gradients.
- Panels distinguish editing context from global actions.
- Dense timelines remain readable through alignment and restrained color semantics.

### KCS adoption

Use restrained surface contrast, semantic accents, and clear state differentiation. Avoid copying Fusion's node-editor-specific structure.

## Agent tooling decisions

### shadcn MCP

**Decision: REJECTED for installation.** The official shadcn MCP browses registries and can install components, but KCS has no Tailwind, Radix, or `components.json` authority. Installing it would add configuration and styling churn without solving a current KCS problem. KCS can reproduce the useful interaction patterns with existing React and CSS.

### 21st MCP

**Decision: REJECTED for installation.** The current project is the 21st MCP, formerly Magic MCP, and requires an external API key. Its value here is inspiration and component catalog research, not production dependency. No generated component was copied into KCS.

### Vercel Web Interface Guidelines

**Decision: USED as a review gate.** The MIT-licensed, framework-agnostic guidelines were read and applied selectively: visible focus, semantic controls, keyboard alternatives, reduced motion, tabular numerics, explicit labels, target sizes, and intentional overflow. Dense desktop-editor exceptions are documented in the design system.

### Chrome DevTools MCP

**Decision: NOT AVAILABLE as an installed project tool.** The Apache-2.0 project was researched. The current harness browser tool provides isolated Chromium observation and screenshots, so no MCP server or secret-bearing browser configuration was added. Browser QA uses the isolated KCS browser surface instead.

### UX/UI Agent Skills

**Decision: SELECTIVE CONCEPT INTEGRATION.** The MIT repository was read. Its useful concepts—design tokens, design review, accessibility audit, motion review, and anti-slop review—are represented in KCS-specific design documents. The full Claude-specific ecosystem was not copied and no competing skill tree was created.

## License and dependency gate

No UI dependency was installed. Existing `lucide-react` is the coherent icon family already used by KCS. Native CSS, React, and existing controls solve the redesign scope with zero bundle or migration cost. Reference repositories are used conceptually only under their stated licenses.

## Implementation cost

- Token and surface language: low; existing `src/index.css` is the token authority.
- Shell and panel hierarchy: low-to-medium; existing components already own the correct domains.
- Inspector/timeline density: medium; CSS overrides preserve state and mutation paths.
- Visual QA and accessibility: medium; requires browser checks at desktop sizes.
- Full docking framework or new component dependency: high and rejected for this milestone.
