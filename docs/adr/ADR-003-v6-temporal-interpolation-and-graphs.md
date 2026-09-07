# ADR-003: V6 Temporal Interpolation and Graph Editing

- Status: Accepted
- Date: 2026-04-24
- Scope: easing evaluation, temporal handles, Value Graph, Speed Graph roadmap

## Context

KCS currently evaluates numeric channels with a single easing type and an optional legacy `[x1, y1, x2, y2]` cubic-Bezier tuple. The timeline can edit that tuple, but there is no explicit hold policy, temporal in/out metadata, auto-handle policy, or graph model shared by the editor and evaluator.

## Decision

Extend the existing easing authority instead of creating another evaluator:

- `hold` returns the previous value for the entire interval;
- `linear` preserves direct normalized progress;
- `bezier` uses explicit normalized temporal handles with deterministic clamping and cubic solving;
- `autoBezier` derives handles from neighboring keyframes in the pure utility layer;
- existing easing names and legacy control-point tuples remain supported;
- all numeric channels use the same resolver, including future mask properties;
- Value Graph renders and edits scalar value curves through existing timeline mutation and history APIs;
- temporal handle changes are stored on the existing keyframe/channel records;
- Speed Graph shares the same sampled evaluator and data contract, but is released only when derivative/velocity semantics and interaction coverage are complete.

The graph UI is a projection of keyframe data. It must never calculate a competing frame value or write directly to React state outside the timeline/history authority.

## Consequences

Positive:

- one source of truth for playback and authoring previews;
- old easing names and files remain valid;
- graph interactions are undoable and serializable.

Trade-offs:

- temporal handles require migration defaults;
- auto handles must remain deterministic across neighboring-keyframe edits;
- Speed Graph cannot be declared complete until derivative behavior is verified.

## Alternatives rejected

- A second graph-specific interpolation algorithm: would cause preview/playback drift.
- Silent conversion of all legacy curves to new handles: changes old serialized data unnecessarily.
- Shipping Speed Graph with unverified derivative semantics: would make a visual editor appear correct while producing incorrect motion.
