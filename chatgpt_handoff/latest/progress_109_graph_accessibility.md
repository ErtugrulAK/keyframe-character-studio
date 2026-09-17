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

1. **Timeline keyframe diamonds became real keyboard controls.** Both diamond renderers in `TrackLane` (canonical frame-group `keyframe-diamond`, legacy composite diamond, and the expanded-lane `ue-prop-diamond`) now get a shared `diamondKeyboardProps` contract: `role="button"`, `tabIndex={0}`, an accessible name carrying frame + track + channel/property + easing/value, `aria-pressed` for the selected keyframe, `Enter`/`Space` activation that runs the existing selection side effects (select keyframe + move playhead, and for the parent lane also select the part; the channel-lane diamond previously had no `click` handler at all, so its keyboard path mirrors what its own `mousedown` does), and a local `ArrowLeft`/`ArrowRight` focus walk across the diamonds of the same lane. The legacy lane now renders from `sortedKfs` (already computed) so DOM order — and therefore the arrow walk and tab order — matches frame order; the diamonds are absolutely positioned, so this changes no pixel.
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
| `src/tests/timelineKeyframeA11y.test.tsx` | **new** — 8 tests for the diamond contract |
| `src/tests/TemporalGraphPanel.test.tsx` | updated to the group semantics + 3 new keyboard/decorative tests |
| `src/tests/selectedKeyframeSection.test.tsx` | added the group-label test (existing label assertions kept) |
| `e2e/graph-accessibility.spec.ts` | **new** — real-browser keyboard smoke (2 tests) |
| `reports/progress_109_graph_accessibility.md` | this report |

## User-facing behavior

- **Graph keyboard behavior:** the value graph's keyframe points are reachable with `Tab`, announce frame + value + "use the Up and Down arrow keys to change it", and `ArrowUp`/`ArrowDown` change the value through the existing callback (unchanged math, unchanged drag behavior). The speed graph stays read-only and exposes no points.
- **Keyframe row behavior:** each keyframe diamond is a `button` in the tab order, announced as e.g. "Keyframe at frame 12, Track a, channels x, easeInOut" (canonical) or "Keyframe at frame 12, Location X, value 140.00" (expanded channel lanes). `Enter` or `Space` selects that keyframe and moves the playhead to its frame; on the parent lane it also selects the part, exactly like the existing click. The channel-lane diamond had no click handler before, so its keyboard path mirrors its own mousedown selection without starting a drag. `ArrowLeft`/`ArrowRight` walk focus along the lane in frame order, stop at the ends, and consume the key there so the timeline never scrolls. Mouse click and drag behave as before (the channel diamond gained a click handler that repeats the same selection/frame result as its mousedown).
- **Selected-keyframe section behavior:** the panel is announced as a group scoped to the selected frame; its numeric inputs keep their existing labels and pipeline.
- **Screen-reader semantics:** the graph is a labelled group instead of an image (its controls are no longer hidden); decorative SVG geometry is `aria-hidden`; the selected keyframe is exposed via `aria-pressed`; no control is left unnamed.
- **Focus visibility:** timeline diamonds show a cyan `outline` plus a soft glow on `:focus-visible`; graph keyframe points show a cyan `outline` on `:focus-visible`. Both are keyboard-only states; mouse focus is unchanged. The real-browser smoke asserts the painted `outline-style`/`outline-width`, not just the pseudo-class.
- **Unsupported/out-of-scope:** no roving-tabindex manager (every diamond is normally tabbable), no keyframe add/delete/nudge shortcuts, no arrow-key scrubbing of the playhead, no timeline restructure, no new shortcut registry, no change to Escape semantics.

## Tests added/updated

| File | Tests | Focus |
|---|---|---|
| `src/tests/timelineKeyframeA11y.test.tsx` | 8 | labelled focusable diamonds, `aria-pressed`, Enter/Space activation (keyframe + frame on both keys, part selection asserted on Enter), arrow walk in both directions with end stops and a lone diamond (key cancellation asserted for the right end and the lone case), mouse click regression, channel-lane labels with values and local activation, legacy composite labels with frame jump |
| `src/tests/TemporalGraphPanel.test.tsx` | 6 (2 added, 1 rewritten from the old `role="img"` assertions) | group semantics + hidden decoration + focusable labelled points + `aria-describedby` keyboard contract + ArrowUp/ArrowDown editing + speed-graph read-only + handle inputs |
| `src/tests/selectedKeyframeSection.test.tsx` | 19 (1 added) | existing value/pipeline coverage plus the frame-scoped group label |
| `e2e/graph-accessibility.spec.ts` | 2 | real Chromium: Tab traversal reaches a diamond, the painted focus ring (`outline-style`/`outline-width`) is asserted, the arrow walk moves focus in frame order, `Enter` selects and opens the selected-keyframe panel, mouse click still selects, no console errors; and — through the Curve Studio control, with no early-exit path — the graph group, its Tab-reachable keyframe point, its painted ring, its ArrowUp edit and its three `aria-hidden` decorations |

## Validation matrix

| Command | Result |
|---|---|
| Focused Vitest (`timelineKeyframeA11y`, `TemporalGraphPanel`, `selectedKeyframeSection`) | PASS — 3 files / 35 tests |
| `npx playwright test e2e/graph-accessibility.spec.ts` | PASS — 2 tests |
| Full Vitest (`npm test`) | PASS — 109 files / 1,652 tests |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests (candidate resolved from HEAD) |
| `npm run build` | PASS |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (pre-existing `AnimatorContext` Fast Refresh warning only) |
| `git diff --check` | clean |

## Known warnings

- Pre-existing: `react(only-export-components)` in `AnimatorContext.tsx`, Vite chunk-size advisory, the `e2e` folder is outside the Vitest `include` glob.

## Protected invariants

- No change to the evaluator, interpolation, keyframe/channel model, timeline mutation utilities, `useKeyboardShortcuts`, serialization, OGraf export/runtime, or any package/workflow file.
- No new dependency, state store, event bus, shortcut registry, or UI framework.
- Mouse interactions behave as before: parent-lane and legacy diamond click/drag/context-menu handlers are byte-identical, and the channel diamond keeps its mousedown drag plus gains a click that produces the same selection/frame result.
- Tag `v1.1.0-rc.1`, the draft GitHub release, npm metadata, `without-mask`, global OMP configuration, `C:\Users\ertugrul.ak\Desktop\KCS`, and `ograf-graphics` are untouched.

## Independent review result

Round 1 (`eece046`) returned **BLOCKED** with three findings and six documentation over-claims; all were addressed in the review-fix commit:

| Finding | Severity | Resolution |
|---|---|---|
| The graph Playwright test could pass without opening the graph (it returned early when the graph was not mounted) | medium | The test now opens the Curve Studio modal through its own control, asserts the labelled group, Tab-reaches the keyframe point, asserts the painted focus ring, edits with `ArrowUp`, and checks the three `aria-hidden` decorations — there is no early exit |
| `ArrowLeft`/`ArrowRight` at the lane ends returned before `preventDefault`/`stopPropagation`, leaving the key unconsumed (timeline scroll) | low | The lane now consumes the arrow before resolving the neighbour; two tests dispatch a cancelable event and assert `defaultPrevented` |
| The focus-ring assertion only checked `:focus-visible`, not the painted style | low | Both smoke tests now read the computed `outline-style` / `outline-width` from the focused element |
| Over-claims: universal click parity, "graph E2E PASS" wording, glow on the graph ring, incomplete test-coverage wording, "mouse entirely unchanged", changed-file list and test counts | documentation | The report now states the exact per-renderer activation effects, the graph outline (no glow), the strengthened assertions, the channel-diamond click addition, and the real test counts, and it lists itself in the changed-files table. Round 2 accepted every code finding as CLOSED and returned the documentation notes above, which this correction addresses (the counts now match the file: 8 tests in `timelineKeyframeA11y.test.tsx`, 6 in `TemporalGraphPanel.test.tsx`, 19+1 in `selectedKeyframeSection.test.tsx`, 2 in the Playwright spec). |

Round 2 (`e1b8400`) verdict: **READY WITH WARNINGS** — all three defects CLOSED (the graph smoke cannot pass without the graph semantics, the arrow keys are consumed at lane ends and on a lone diamond, the focus-ring assertions read the painted style). The only remaining findings were documentation notes about test counts and coverage wording, corrected in the follow-up docs commit; the reviewer also observed that deleting only the component-specific focus rules would not fail the smoke because the global `[role='button']:focus-visible` rule in `src/index.css` paints an equivalent 2 px ring — the visual contract holds either way, the assertion proves the computed result rather than a particular selector.

## Merge/push status

**MERGED into `main` by fast-forward** at `96e8f9d0313cb81752c04fe58d6e7d00d700a6f4` and pushed (`beb4b49..96e8f9d`). The branch `feat/graph-accessibility` carried three commits (`eece046` feature, `e1b8400` review fixes, `96e8f9d` documentation correction); `main` was a strict superset afterwards. No rebase, no merge commit, no force push, no history rewrite. Tag `v1.1.0-rc.1`, the draft release, and npm are untouched.

Known residual risks (accepted, no AT matrix was run): the derived speed graph changes from an `img` graphic to a named group with no focusable content, so its screen-reader announcement is reasoned rather than measured; `aria-pressed` carries toggle semantics while activation only selects; `Shift`+`Enter`/`Shift`+`Space` does not forward the shift-modifier part-selection behaviour that a shift-click performs.

## Next recommended task

Milestone C — first export / onboarding flow (roadmap item 5), reusing the Task 105 diagnostics and the existing export UI; no host/vendor contract invention and no package format change.
