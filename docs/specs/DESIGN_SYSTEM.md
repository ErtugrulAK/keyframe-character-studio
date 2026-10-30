# KCS Professional Editor Design System

## Direction

KCS is a dense desktop motion editor: professional, calm, precise, dark, tool-oriented, and recognizably KCS. The canvas remains the visual focal point. Surface depth comes from restrained tonal steps and separators, not cards, gradients, or glass effects.

## Semantic tokens

The source of truth is `src/index.css`. Tokens use the existing `--kcs-*` semantic namespace and preserve legacy aliases for compatibility.

| Role | Token |
|---|---|
| App / canvas | `--kcs-bg-app`, `--kcs-bg-canvas` |
| Panel / raised | `--kcs-bg-panel`, `--kcs-bg-surface`, `--kcs-bg-elevated` |
| Input / hover / active | `--kcs-bg-input`, `--kcs-bg-hover`, `--kcs-bg-active` |
| Text | `--kcs-text-primary`, `--kcs-text-secondary`, `--kcs-text-muted`, `--kcs-text-disabled` |
| Borders | `--kcs-border-subtle`, `--kcs-border-default`, `--kcs-border-focus` |
| Accents | `--kcs-accent`, `--kcs-accent-hover`, `--kcs-accent-keyframe`, `--kcs-warning`, `--kcs-danger` |
| Controls | `--kcs-control-xs`, `--kcs-control-sm`, `--kcs-control-md` |

## Compact scale

Spacing uses 2/4/6/8/12/16px editor increments. Controls use 24px icon/compact height, 28px standard field height, and 32px primary button height. Corner radius is restrained: 3px controls, 5px panel affordances, 7px dialogs.

## Typography

Inter is the UI face; JetBrains Mono is used for timecodes, frames, and numeric comparisons. Numeric values use `font-variant-numeric: tabular-nums`. Headings are compact and medium-weight; uppercase labels are reserved for section metadata.

## Component language

- **Primary:** teal accent, reserved for the main action or active edit mode.
- **Secondary:** raised neutral surface with a crisp border.
- **Ghost:** transparent until hover.
- **Icon:** minimum 28px visible hit target with an accessible name.
- **Danger:** red only for destructive actions.
- **Sections:** subtle top/bottom separators and compact headers, not nested cards.
- **Focus:** 2px cyan ring with 2px offset; never remove focus for density.
- **Motion:** 120ms hover, 180ms state transition, 240ms panel transition. Reduced-motion mode removes transform transitions.

## Intentional exceptions

KCS is desktop-first and deliberately denser than a general web application. Minimum pointer targets remain 28px for editor controls; larger mobile targets are not applied because the product is not a mobile card layout. Drag-only editing retains keyboard alternatives where the domain supports them.

## Review gates

Every substantial UI change is reviewed for shell hierarchy, canvas dominance, state contrast, semantic color, focus visibility, reduced motion, text overflow, and 1366×768 degradation. Existing domain authorities remain unchanged.
