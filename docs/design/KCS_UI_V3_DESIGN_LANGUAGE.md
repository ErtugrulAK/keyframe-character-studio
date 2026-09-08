# KCS UI V3 Design Language

## Product character

KCS V3 is a professional, dense, precise, calm, dark, technical, creative-tool-oriented motion editor. The visual system must communicate authoring confidence before decoration. Every accent, separator, and empty state must explain editor state or action priority.

## What KCS borrows

### OGraf Studio

- Docked broadcast-editor discipline.
- Compact pane headers and low-contrast separators.
- Technical property-row alignment.
- Clear distinction between authoring surfaces and passive status.

### After Effects

- Dense disclosure hierarchy.
- Temporal parent/child tree relationships.
- Stable layer/property alignment across timeline rows.
- Semantic selected-key and playhead emphasis.

### Blender

- Compact property editor rhythm.
- Explicit labels and technical controls.
- Strong tree indentation and object identity.

### DaVinci Resolve / Fusion

- Calm dark hierarchy.
- Region ownership through subtle dividers instead of cards.
- Graph and node-adjacent controls presented as production tooling.

### plugin87 anti-slop guidance

- Token-led decisions.
- No generic SaaS dashboard patterns.
- No decorative glow, oversized whitespace, gradient surfaces, or indiscriminate rounding.
- Review every visual element for functional purpose.

### Web accessibility guidance

- Native semantic controls.
- `:focus-visible` rings that remain visible inside clipped panels.
- Tabular numerics for rapidly changing values.
- State communicated through text/icon/contrast, never color alone.

## What KCS rejects

- Generic SaaS dashboard composition.
- Card-everywhere panel nesting.
- Giant whitespace and oversized mobile controls.
- Glassmorphism, backdrop blur, decorative gradients, neon glow, and giant shadows.
- Rounded-everything or pill-shaped controls without semantic reason.
- Generic AI-generated onboarding empty states.
- Multi-window docking complexity that weakens the single editor frame.
- Teal used simultaneously for every active, primary, selected, and passive status state.

## What KCS invents

- A React/DOM-native compositing shell that maps directly to KCS scene, timeline, and OGraf concepts.
- A single editor frame where shell geometry, stage coordinate parity, Inspector ownership, and timeline authority remain explicit.
- A motion-design hierarchy that makes Value Graph authoring primary while honestly presenting Speed Graph as derived/read-only.
- Semantic visual density that preserves accessibility and keyboard interaction instead of treating compactness as decoration.

## Token and component principles

- `src/kcsEditorTheme.css` is the primary semantic authority.
- Existing `src/index.css` variables remain compatibility aliases; do not create a second theme.
- Header height stays 79px; left rail stays 56px.
- Controls use a 24/28/32px rhythm and maintain at least 24px hit targets.
- Panel and control radii remain restrained, generally 3–5px.
- Values use tabular/monospaced numerics where rapid changes occur.
- Borders are thin and quiet; hierarchy comes first from spacing, typography, and grouping.
- Solid teal is reserved for primary actions and meaningful selection; secondary active states use muted fills.
- Danger and warning use semantic color plus text/icon cues.
- Motion is limited to opacity, transform, and background transitions; reduced motion disables nonessential transitions.

## Surface language

- Shell: one continuous technical frame, not a row of cards.
- Toolbar: tool-family rail with clear selected tool and quiet separators.
- Outliner: layer tree first, panel chrome second.
- Inspector: selected object first, property rows second, advanced controls disclosed.
- Timeline: ruler/lane alignment first, transport controls compact and subordinate.
- Graph Editor: graph first, support controls second, output/actions last.
- Canvas: authored composition dominates; viewport chrome is secondary.
- Dialogs/popovers: one clear context surface, concise content, one action hierarchy.
- Empty states: state what is empty, why it matters, and the existing next action; never market the product.

## Non-negotiable behavior language

Visual restructuring must not create new state authorities or alter:

- evaluator semantics;
- `Track.channels` authority;
- easing math;
- mask and Track Matte semantics;
- history model;
- saved-scene compatibility;
- serialization/import/export;
- OGraf output;
- keyboard accessibility.
