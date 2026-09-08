# KCS V6 UI Audit

## Method

Audited the running KCS application in isolated Chromium at 1440×900, including the default project, layer hierarchy, canvas, toolbar, inspector empty state, timeline, and graph entry point. The current interface was visually inspected with a full-page screenshot and accessibility-tree observation. Existing component tests and V6 browser flows define the protected interaction contract.

## Findings

| Priority | Surface | Finding | Direction |
|---|---|---|---|
| P1 | App shell | Header, work area, and timeline read as adjacent bordered blocks rather than one editor workspace. | Use three clear layers: app chrome, workspace, temporal editor. Reduce border contrast. |
| P1 | Header | Project tabs, mode toggle, save state, FPS, import/export, and reset have similar visual weight. | Group global identity, mode, status, and project actions with explicit primary/secondary/icon hierarchy. |
| P1 | Canvas | The canvas is visually strong but the pasteboard and canvas controls compete with the stage at smaller desktop sizes. | Keep stage dominant; use quieter pasteboard and compact contextual controls. |
| P1 | Inspector | Empty inspector state has weak context and property sections use inconsistent card/row density. | Establish a fixed narrow inspector rhythm with section headers and aligned rows. |
| P1 | Timeline | Timeline header controls and the ruler compete with the layer/track body. | Separate transport, sequence identity, and view controls; strengthen ruler/playhead contrast only. |
| P2 | Toolbar | Tool rail and workspace drawer navigation mix two concepts and use uneven visual emphasis. | Use a consistent icon rail with grouped separators and visible active state. |
| P2 | Outliner | Layer rows have useful semantics but selected, hover, visibility, and hierarchy cues need a more restrained state palette. | Use indentation, quiet row hover, and a single accent selection edge. |
| P2 | Controls | Numeric fields, tabs, buttons, and inputs do not share one compact control language. | Adopt 24/28/32px control heights, tabular numerics, restrained radius, and shared focus. |
| P2 | Graph Editor | Motion Curves entry is discoverable, but the graph surface needs stronger selected-channel and grid hierarchy. | Preserve graph semantics; use semantic keyframe accent and quieter grid. |
| P2 | Masks / Track Matte | Domain separation exists, but dense controls need stronger section and relationship cues. | Keep Masks and Track Matte separate; use semantic accent, labels, and compact disclosures. |
| P2 | Scrollbars | Scroll ownership is not visually obvious across inspector and timeline. | Keep native scrolling behavior, make scrollbar thumb subtle but visible, prevent page-level overflow. |
| P3 | Empty states | Empty media/project states are functional but could provide clearer next actions. | Use concise action-oriented copy without adding dashboard cards. |
| P3 | Motion | Some global transitions use broad `transition: all`. | Limit new motion to opacity/transform and honor reduced motion. |
| P3 | Responsive | The desktop model is correct, but 1366×768 needs explicit density validation. | Preserve desktop regions; allow controlled panel compression rather than mobile stacking. |

## Protected behavior

The audit does not authorize changes to animation evaluation, playback, broadcast mode, OGraf rendering, mask algebra, track mattes, serialization, history, timeline coordinate authority, or existing public callbacks. UI work must remain presentational and route edits through existing domain hooks/context authorities.

## Priority interpretation

- **P0:** none observed in the audited default state.
- **P1:** shell hierarchy and density issues that materially reduce professional editor readability.
- **P2:** consistency and discoverability issues.
- **P3:** polish and future refinement.
