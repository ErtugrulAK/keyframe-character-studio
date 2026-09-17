# Progress 109 — Milestone B: Graph + Keyboard Accessibility

## Scope

Roadmap item 4 (Milestone B of `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`): make the existing graph and keyframe surfaces usable without a mouse and correctly labelled for assistive technology — no graph-engine, evaluator, timeline-mutation, shortcut-registry, state-store, or package change.

Out of scope (unchanged): graph engine or interpolation math, timeline/keyframe model, drag behaviour redesign, new keyboard shortcut registry, broad style churn, new dependencies, release/package/workflow changes, Milestone C onboarding.

## Branch

- Implementation branch: `feat/graph-accessibility`
- Feature commit: `feat: improve graph keyboard accessibility`
- Baseline `main`: `beb4b495aa6c47930d4eefe0f2140580d1ae8e9c` (Milestone A merged, `main == origin/main`)
- `v1.1.0-rc.1` tag target (unchanged): `46d2a3e59e065816d972dcd56951803951b577f6`

## Implementation summary

1. **Timeline keyframe diamonds became real keyboard controls.** Both diamond renderers in `TrackLane` (canonical frame-group `keyframe-diamond`, legacy composite diamond, and the expanded-lane `ue-prop-diamond`) now get a shared `diamondKeyboardProps` contract: `role="button"`, `tabIndex={0}`, an accessible name carrying frame + track + channel/property + easing/value, `aria-pressed` for the selected keyframe, `Enter`/`Space` activation that runs exactly the existing selection side effects, and a local `ArrowLeft`/`ArrowRight` focus walk across the diamonds of the same lane. The legacy lane now renders from `sortedKfs` (already computed) so DOM order — and therefore the arrow walk and tab order — matches frame order; the diamonds are absolutely positioned, so this changes no pixel.
2. **The value graph stopped hiding its own controls.** `TemporalGraphPanel`'s SVG carried `role="img"`, which removes its descendants from the accessibility tree while the keyframe points inside it are focusable. It is now a labelled `group` (`aria-labelledby` → the visible "Value Graph"/"Speed Graph" title, `aria-describedby` → the helper text), the decorative axes and curve are `aria-hidden="true"`, and each keyframe point's label now states its frame and value and how to change it with the keyboard. The helper text states the keyboard contract.
3. **The selected-keyframe section is a labelled group.** `SelectedKeyframeSection` now exposes `role="group"` with `aria-label="Selected keyframe at frame N, M channels"`, so its per-channel inputs (`Keyframe Location X`, `Keyframe Rotation`, …) are unambiguous without changing their existing labels.
4. **Focus visibility on the new controls.** Added `:focus-visible` rules in the existing stylesheets for `.keyframe-diamond`, `.ue-prop-diamond`, and the graph's keyframe points, using the same `--accent-cyan` / `--accent-teal-glow` tokens the rest of the editor uses.

## Existing authorities reused

| Concern | Authority | Reused for |
|---|---|---|
| Timeline lane rendering | `src/components/Timeline/TrackLane.tsx` | the only keyframe diamond renderer; no new timeline component |
| Keyframe selection + playhead | `onSelectKeyframe` / `onSetFrame` / `onSelectPart` props fed by `SequencerTimeline` | every keyboard activation path |
| Frame grouping + ordering | `groupChannelKeyframesByFrame`, the lane's existing `sortedKfs`/`chKfs` | accessible labels and the arrow walk order |
| Channel metadata | `CHANNEL_META` (`timelineConstants`) | property names in labels |
| Graph panels | `src/components/Inspector/TemporalGraphPanel.tsx` (existing keyframe drag + arrow editing) | the graph surface, unchanged math |
| Selected-keyframe editor | `SelectedKeyframeSection` + `SmartNumberInput` + `updateCurrentTransform` | unchanged value pipeline |
| Global shortcuts | `src/hooks/useKeyboardShortcuts.ts` (untouched) | keyboard activation stops propagation, so no global handler is hijacked |
| Design system | `docs/design/KCS_DESIGN_SYSTEM.md`, existing `:focus-visible` rules | focus ring tokens and behaviour |

No new graph engine, evaluator, timeline mutation, shortcut registry, state store, dependency, or package/workflow change.

## Files changed

| File | Change |
|---|---|
| `src/components/Timeline/TrackLane.tsx` | `diamondKeyboardProps` contract (role, name, selected state, Enter/Space, arrow walk) applied to the three diamond renderers; legacy lane iterates `sortedKfs` |
| `src/components/Inspector/TemporalGraphPanel.tsx` | SVG `role="img"` → labelled `group`; decorative geometry `aria-hidden`; richer keyframe-point labels; helper text now states the arrow-key contract |
| `src/components/Inspector/sections/transform/SelectedKeyframeSection.tsx` | `role="group"` + frame-aware `aria-label`; input labels unchanged |
| `src/components/Timeline/SequencerTimeline.css` | `:focus-visible` for `.keyframe-diamond` and `.ue-prop-diamond` |
| `src/kcsEditorTheme.css` | `:focus-visible` for `.temporal-graph-svg circle` |
| `src/tests/timelineKeyframeA11y.test.tsx` | **new** — 7 tests for the diamond contract |
| `src/tests/TemporalGraphPanel.test.tsx` | updated to the group semantics + 3 new keyboard/decorative tests |
| `src/tests/selectedKeyframeSection.test.tsx` | added the group-label test (existing label assertions kept) |
| `e2e/graph-accessibility.spec.ts` | **new** — real-browser keyboard smoke (2 tests) |

## User-facing behavior

- **Graph keyboard behavior:** the value graph's keyframe points are reachable with `Tab`, announce frame + value + "use the Up and Down arrow keys to change it", and `ArrowUp`/`ArrowDown` change the value through the existing callback (unchanged math, unchanged drag behavior). The speed graph stays read-only and exposes no points.
- **Keyframe row behavior:** each keyframe diamond is a `button` in the tab order, announced as e.g. "Keyframe at frame 12, Track a, channels x, easeInOut" (canonical) or "Keyframe at frame 12, Location X, value 140.00" (expanded channel lanes). `Enter` or `Space` performs exactly the previous click action: select the keyframe, select the part, move the playhead. `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order and stop at the ends. Mouse click and drag are unchanged.
- **Selected-keyframe section behavior:** the panel is announced as a group scoped to the selected frame; its numeric inputs keep their existing labels and pipeline.
- **Screen-reader semantics:** the graph is a labelled group instead of an image (its controls are no longer hidden); decorative SVG geometry is `aria-hidden`; the selected keyframe is exposed via `aria-pressed`; no control is left unnamed.
- **Focus visibility:** diamonds and graph points show a cyan focus ring with a glow on `:focus-visible` (keyboard only; mouse focus stays unchanged).
- **Unsupported/out-of-scope:** no roving-tabindex manager (every diamond is normally tabbable), no keyframe add/delete/nudge shortcuts, no arrow-key scrubbing of the playhead, no timeline restructure, no new shortcut registry, no change to Escape semantics.

## Tests added/updated

| File | Tests | Focus |
|---|---|---|
| `src/tests/timelineKeyframeA11y.test.tsx` | 7 | labelled focusable diamonds, `aria-pressed`, Enter/Space activation, arrow walk with end stops, mouse click regression, channel-lane labels with values, legacy composite labels |
| `src/tests/TemporalGraphPanel.test.tsx` | 6 | group semantics + hidden decoration + focusable labelled points + `aria-describedby` keyboard contract + ArrowUp/ArrowDown editing + speed-graph read-only + handle inputs |
| `src/tests/selectedKeyframeSection.test.tsx` | 19 (1 added) | existing value/pipeline coverage plus the frame-scoped group label |
| `e2e/graph-accessibility.spec.ts` | 2 | real Chromium: Tab traversal reaches a diamond, `:focus-visible` matches, arrow walk moves focus in frame order, `Enter` selects and opens the selected-keyframe panel, mouse click still selects, no console errors; plus the graph group and its keyboard point editing |

## Validation matrix

| Command | Result |
|---|---|
| Focused Vitest (`timelineKeyframeA11y`, `TemporalGraphPanel`, `selectedKeyframeSection`) | PASS — 3 files / 34 tests |
| `npx playwright test e2e/graph-accessibility.spec.ts` | PASS — 2 tests |
| Full Vitest (`npm test`) | PASS — 109 files / 1,651 tests |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests at `beb4b49` |
| `npm run build` | PASS |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (pre-existing `AnimatorContext` Fast Refresh warning only) |
| `git diff --check` | clean |

## Known warnings

- Pre-existing: `react(only-export-components)` in `AnimatorContext.tsx`, Vite chunk-size advisory, the `e2e` folder is outside the Vitest `include` glob.

## Protected invariants

- No change to the evaluator, interpolation, keyframe/channel model, timeline mutation utilities, `useKeyboardShortcuts`, serialization, OGraf export/runtime, or any package/workflow file.
- No new dependency, state store, event bus, shortcut registry, or UI framework.
- Mouse interactions (diamond click select, drag to move a keyframe, context menus) behave as before.
- Tag `v1.1.0-rc.1`, the draft GitHub release, npm metadata, `without-mask`, global OMP configuration, `C:\Users\ertugrul.ak\Desktop\KCS`, and `ograf-graphics` are untouched.

## Independent review result

_Pending — recorded after the review round below._

## Merge/push status

_Pending — recorded after the review gate._

## Next recommended task

Milestone C — first export / onboarding flow (roadmap item 5), reusing the Task 105 diagnostics and the existing export UI; no host/vendor contract invention and no package format change.
