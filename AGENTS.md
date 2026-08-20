# Keyframe Character Studio — Agent Guide

## 1. Project Purpose

Keyframe Character Studio is a browser-based 2D keyframe and motion-design editor prototype developed from scratch during an internship.

The project explores whether simple and medium-complexity 2D animation work can be prepared in a lightweight browser workflow before using heavier real-time graphics workflows.

Treat its history as:

Initial prototype → new requirements → architectural pressure → architecture refinement.

It is not a refactor of an inherited company application.

## 2. Product Boundary

This repository is a prototype and technical exploration, a browser-based 2D editor, and an independent project developed from scratch.

Do not describe it as Zero Density production source code, a Reality replacement, an Unreal Engine plug-in, a completed commercial integration, or a completed Unreal export pipeline. Do not claim a production integration unless current source and tests prove it.

## 3. Source of Truth

Use this priority when sources disagree:

1. Current working source code
2. Current tests and E2E tests
3. Current types and domain models
4. Current package, TypeScript, Vitest, Vite, and Playwright configuration
5. Current README and repository documentation
6. Git history and historical wiki/log entries

Historical milestone test counts and “pending commit” notes are not current-state authority. Mark claims as `UNVERIFIED` when the current repository cannot prove them.

## 4. Required Project Skills

Before project work, read the relevant skills under `skills/keyframe-studio/`, especially:

- `kcs-constitution`
- `kcs-project-context`
- `kcs-git-workflow`
- `kcs-workflows`
- `kcs-coding-style`
- `kcs-track-matte` when animation, rendering, matte, presets, timeline, clipboard, or serialization may be affected

Follow the constitution: Analyze → plan → approval → implement → validate.

Never modify files, create or switch branches, commit, merge, or push without explicit user approval.

Conversation is in Turkish. Repository files, code, comments, and commit messages are in English.

## 5. Current Architecture

The intended architecture is a pure domain core with a React shell:

- `src/utils`: evaluation, interpolation, geometry, validation, migration, procedural animation, and clone/transfer helpers
- `src/hooks`: domain orchestration such as playback, history, clipboard, presets, broadcast, and serialization
- `AnimatorContext`: composition and UI-facing wiring
- React components: interaction and rendering
- SVG: primary rendering and matte composition system

For new behavior, prefer: Pure helper → domain hook → thin context wiring → minimal UI.

Do not create a parallel engine, state store, serializer, clipboard, or timing loop when an existing domain path can be extended.

## 6. Canonical Animation Model

`Track.channels` is the canonical timeline animation representation. `TrackChannel` covers transform and mask-transform channels.

Legacy `Track.keyframes` remains for backward compatibility and migration. It is not the authority for new timeline behavior.

M8 invariants:

- New timeline animation data belongs in channels.
- Legacy keyframes may be read, migrated, exported, or cloned for compatibility.
- Do not create a second canonical keyframe representation.
- Do not silently remove legacy compatibility fields because they look old.
- Import/export may normalize legacy composite keyframes into channels.

`CharacterPart` contains base/runtime-relevant part properties. `Track` contains timeline animation data. Keep those roles distinct.

## 7. Evaluation Pipeline

The core evaluation flow is:

CharacterPart base transform + Track channels
→ evaluateTransform
→ evaluateFrame (composes procedural IN/OUT delta when applicable)
→ final EvaluatedLayer
→ renderer

Rules:

- `evaluateTransform` and `evaluateFrame` are the central animation evaluation authority.
- Canonical channels take precedence over legacy fallback data.
- Interpolation and easing remain pure domain logic.
- Procedural presets compose with evaluated animation; they do not write timeline keyframes.
- Renderers must not introduce independent timeline interpolation.
- A feature must not introduce a second animation or evaluation engine.

## 8. Rendering Contract

The main rendering path includes `StageCanvas`, `StagePartLayers`, `PartRenderer`, `shapeGeometry`, and `buildMattePath`.

The renderer consumes evaluated results and handles SVG-specific composition. It may contain necessary SVG decisions such as element type, coordinate space, `<clipPath>`, `<mask>`, filters, gradients, and image composition. It must not become a second animation evaluator or playback authority.

SVG rendering and the current matte architecture are deliberate choices. Do not replace them with Canvas, foreignObject, or a parallel compositor without discovery, evidence, regression planning, and explicit approval.

## 9. Playback Contract

`usePlayback` is the edit playback and playhead authority. Broadcast animation uses the existing `useBroadcast` and `broadcastEngine` state path.

Rules:

- Do not add a feature-specific `requestAnimationFrame` loop.
- Do not create an independent preset or matte clock.
- Edit preview must use the existing frame/playback path.
- Broadcast changes must preserve edit-mode state and existing broadcast sequencing behavior.

## 10. Procedural Animation Contract

Builtin, combination, and custom presets use the existing procedural animation engine.

- Builtin and M24 combination presets produce runtime deltas.
- M25 custom presets store sampled, independent keyframe data in the reusable preset library.
- Edit preview and broadcast resolve custom presets through the same preset sampling authority.
- Applying a procedural preset does not create TrackChannels or timeline keyframes.
- Missing preset IDs use a safe no-motion fallback.
- Custom preset sampler behavior must remain consistent across edit and broadcast paths.

Do not implement presets by generating timeline keyframes unless a future approved design explicitly changes the product contract.

## 11. Matte / Relationship Contract

The canonical matte relationship lives on the target part: `targetPart.matte.sourcePartId → source CharacterPart`.

Rules:

- Resolve source parts from `characterParts`; do not create a cached relationship mirror.
- Preserve source/target identity and reference safety.
- Validate self-reference and cycles through `validateScene`.
- Keep missing-source errors distinct from cycles.
- Disabled relationships are excluded from active cycle evaluation.
- `buildMattePath` and `shapeGeometry` are geometry authorities.
- Shape, freeform, text, and image matte behavior must preserve current SVG coordinate-space contracts.
- Video matte and nested/multiple matte are not implemented.
- Runtime image descriptors are not scene-persisted data.
- Changes to geometry, gradients, inversion, feather, strength, or image masks require DOM and pixel regression coverage.

## 12. Preset Contract

Scene data stores preset references and durations. The reusable custom preset library is separate.

The custom library:

- uses localStorage key `keyframe_custom_motion_presets`;
- is not part of scene/project JSON;
- supports duplicate display names;
- uses IDs as identity;
- deep-clones saved keyframe data;
- keeps default and user presets distinct through the existing default-ID authority.

Save and delete are library operations and do not enter scene undo history. Selecting/applying a preset to a part is a normal scene edit and is undoable. Deleted or missing preset references must remain safe and must not crash evaluation.

Default presets are hidden from user-delete UI. Do not weaken that protection. Note that the current hook relies on the caller/UI classification; inspect both layers before changing deletion behavior.

## 13. Preset Export / Import Contract

M30 preset transfer uses `{ version: 1, presets: [...] }`.

Rules:

- Export user presets only; never export default presets as user presets.
- Validate the whole file before mutation; do not partially import malformed files.
- Merge with the existing library; do not replace it.
- Preserve safe imported IDs and remap collisions with existing or default IDs.
- Allow duplicate names and preserve imported order after existing presets.
- Deep-clone nested keyframe data.
- Import/export does not enter scene history or modify `AnimationProject` serialization.
- Safe ID preservation may reconnect an existing scene reference.
- Collision remapping does not automatically reconnect old scene references.

Version changes require an explicit compatibility and migration design.

## 14. Timeline / Clipboard / Transfer Contract

Treat these as separate user intents.

### Duplicate Keyframes

- Duplicates the entire frame-group on the same track to source frame + 1.
- Generates fresh IDs and preserves values, easing, template, and bezier metadata.
- Any destination collision causes a safe no-op.
- One successful duplicate is one undoable operation.

### Copy / Paste Keyframes

- Uses a transient, non-persisted timeline-local clipboard separate from the part and system clipboards.
- Copy has no history entry.
- Paste targets the explicit right-clicked frame and supports same-track and cross-track use.
- Paste generates fresh IDs; any destination collision causes a safe no-op.
- It does not copy part properties, presets, durations, matte, hierarchy, geometry, or media.
- One successful paste is one undoable operation.

### Animation Transfer

- Copies channels, legacy keyframes, IN/OUT preset IDs, and durations to another existing part.
- Generates fresh keyframe IDs and replaces target animation rather than merging it.
- Preserves target identity, base transform, matte, hierarchy, geometry, media, and z-order.
- Does not duplicate the custom preset library.
- Self-paste is invalid; current UI targets only the primary selected part.
- One paste or clear action is one undoable operation.

Do not unify these operations behind ambiguous UI or payload semantics.

## 15. Selected Keyframe Editing

`SelectedKeyframeSection` is a derived Inspector surface.

- Resolve the selected keyframe ID against the active track.
- Show only when selection is valid and the playhead is on the selected frame.
- Show raw stored values only for channels actually keyframed at that frame.
- Do not display computed non-keyframed values as keyframe data.
- Use the existing transform/keyframe mutation pipeline.
- Preserve easing, bezier points, template IDs, and unrelated channels.
- Keep base-transform editing unchanged when no keyframe is selected.
- Stale, deleted, wrong-track, and legacy-only selections must fail safely.
- Numeric editing must preserve one logical history action.

## 16. History Contract

History snapshots include tracks and character parts.

- One logical UI action should produce one undo entry.
- Batch interactions group continuous or multi-state edits.
- Identical consecutive snapshots are deduplicated.
- Undo/redo restores tracks and character parts together.
- Copy-only operations do not create history.
- Preset library save/delete/import/export does not use scene history.
- Applying presets, animation transfer, clear animation, duplicate, paste, and selected-keyframe edits are scene operations and must preserve their established undo semantics.

Changes involving React batching, state refs, or batch boundaries require explicit undo/redo regression tests.

## 17. Persistence / Serialization Contract

Keep these domains separate:

- Scene/project persistence includes scene parts, tracks, canonical channels, required legacy compatibility, preset references/durations, matte relationships, and scene geometry.
- The reusable preset library is stored separately in localStorage and moved between machines through M30 export/import.
- Selection, timeline clipboard, part clipboard, history, playhead UI state, and broadcast runtime state are editor-only/transient and are not scene data.

Rules:

- Do not add the preset library to `AnimationProject`.
- Do not persist transient clipboard or selection state.
- Do not add parallel serializers.
- Use `useSerialization` and existing validation/migration paths.
- Preserve exact compatibility behavior for matte gradients and legacy mask fields.
- Validate imported scene data through the established scene validation path.

## 18. Backward Compatibility

Live compatibility areas include legacy composite keyframes, legacy-to-channel migration, mask data and mask transform fields, legacy gradient forms, optional matte fields with legacy defaults, existing preset IDs and `custom_timeline`, and scene import normalization.

Do not delete or rewrite these areas without proving they are unused by current import/export/tests and obtaining explicit approval.

The current `CharacterPart` preset ID typing is narrower than the runtime behavior that accepts combination and custom IDs. Treat this as known type debt, not permission for an incidental protected-model change.

## 19. High-Risk Areas

Live, central, high-risk areas include `evaluateFrame`, `evaluateTransform`, interpolation/easing, `useMath`, `usePlayback`, `useBroadcast`, `broadcastEngine`, `useSerialization`, procedural animation, `AnimatorContext`, `useHistory`, `PartRenderer`, `StageCanvas`, `StagePartLayers`, `Track`, `TrackChannel`, `shapeGeometry`, `buildMattePath`, matte validation/source resolution, container/viewport math, freeform geometry, clipboard/animation transfer, motion transitions, and legacy keyframe conversion.

Before changing one:

1. Explain the current contract.
2. Prove why the change is necessary.
3. List affected edit, playback, broadcast, rendering, matte, history, and serialization behavior.
4. Propose focused regression coverage.
5. Obtain explicit user approval.

High-risk does not mean untouchable. It means evidence and approval are required.

## 20. Testing Rules

The repository uses Vitest unit/hook/component/integration tests, Testing Library and jsdom, Playwright Chromium E2E, milestone-specific workflow specs, and DOM/pixel matte regression tests.

Always recalculate test collection from the current HEAD. Do not copy historical counts from README, wiki, or milestone logs.

After each approved implementation step, run in proportion to scope:

1. Focused unit/component tests
2. Relevant E2E or integration tests
3. TypeScript no-emit validation (`npx tsc --noEmit` or the repository's equivalent local runner)
4. `npm run build`
5. `npm run lint` / oxlint, using the repository-local executable when necessary
6. Broader regression suites when risk requires them

Report commands, results, and environment limitations. Never make tests pass by weakening assertions, skipping tests, adding feature-specific retries, widening pixel thresholds without evidence, adding arbitrary sleeps, or hiding failures behind fallback behavior. Investigate root cause first.

## 21. Known Environment Issues

Historical documentation records full-suite timing flakes around track-matte import/reload and pixel parity, especially V-T15, V-T17, and V-H12. They were reported under machine load, passed in isolation, and predate M25-M30.

Treat them as historical environment evidence, not as a guaranteed current failure or a new regression without reproduction. If they fail, reproduce in isolation, compare with documented pre-existing behavior, and inspect import/reload readiness and pixel capture timing. Do not add skip, retry, threshold, or sleep hacks.

The Playwright configuration already uses CI retries. Do not increase them to conceal a regression.

## 22. Development Workflow

### New Feature or Milestone

DISCOVERY → CURRENT BEHAVIOR → USER PROBLEM → GAP → REUSE OPPORTUNITIES → ALTERNATIVES → RISKS → PROPOSED SCOPE → APPROVAL → IMPLEMENTATION STEPS → TESTS → FINAL QA → COMMIT/PUSH APPROVAL

During discovery:

- do not modify source or tests;
- inspect current code, types, tests, configuration, documentation, and history;
- classify alternatives by risk;
- identify M8, history, serialization, geometry, matte, playback, and broadcast impact;
- recommend the smallest useful solution;
- do not automatically start the next milestone.

### Implementation

- Split large work into small, independently verifiable steps.
- Obtain approval before implementation and implement only the explicitly approved scope.
- After each step, run the relevant validation and report it.
- Do not continue to the next step without approval when the user requires step approval.
- Preserve runtime behavior, public APIs, backward compatibility, and unrelated user changes unless an approved task explicitly requires otherwise.

### Unexpected Changes

If unexpected modified or untracked files appear, stop, report exact files, do not overwrite or revert them, and wait for user direction.

## 23. Git Safety Rules

Unless explicitly approved, do not create or switch branches, commit, merge, push, force-push, pull, rebase, amend, reset, delete branches, change Git remotes/configuration, or revert unrelated files.

Before implementation and final handoff, report the current branch, HEAD, upstream, ahead/behind, working-tree status, and modified/untracked files.

Use normal fast-forward synchronization only when explicitly approved. Never push directly to `main` unless explicitly approved.

## 24. Documentation Sources

Use `README.md`, `skills/keyframe-studio/`, `skills/keyframe-studio/kcs-track-matte/SKILL.md`, `wiki/entities/keyframe-character-studio.md`, `wiki/log.md`, current tests/E2E specs, and git history for orientation and history.

The wiki and skill contain valuable milestone contracts, but some historical entries may still say “commit/push pending” after the commits were later created. Current git history is authoritative for repository state.

## 25. Current Roadmap Status

Completed through M30:

- custom/user presets;
- edit and broadcast custom preset parity;
- part-level animation transfer and clear;
- frame-group duplicate;
- timeline-local keyframe copy/paste;
- selected-keyframe value editing;
- versioned preset export/import.

The previous A roadmap group is complete.

Deferred B group:

- repeat/pattern offset;
- easing quick controls;
- mirror/reverse improvements.

Parked items include multi-select apply, delay/stagger, preset rename/categories/search/preview, combination editing/chaining, Wipe/Matte Reveal, multi/nested/video matte, animated gradients/strength, text stagger, matte/timeline relationship drag-and-drop, matte/radial gizmos, spring, 3D, motion blur, and advanced compositing.

There is no automatically authorized M31. Start with product discovery.
