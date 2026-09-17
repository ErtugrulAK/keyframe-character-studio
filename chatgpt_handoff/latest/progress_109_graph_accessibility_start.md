# Progress 109 — Milestone B Start Note (Graph + Keyboard Accessibility)

## Status

Documentation only. **Milestone B has not been implemented**; this note fixes the start state, the scope boundary, and the gate for the implementation session. No source, test, package, or workflow file was touched.

## Preflight state (verified)

| Item | Value |
|---|---|
| Repo | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` |
| `main` / `origin/main` | `07d8f8dddf3fbe9820e6dccd728676b51c6d397f` (synchronized, working tree clean) |
| Milestone A integration commit | `077911b469bf7026364c0335e748114bf8df05c0` — verified as an ancestor of `main` |
| `v1.1.0-rc.1` tag target | `46d2a3e59e065816d972dcd56951803951b577f6` (unchanged) |
| Milestone A CI | runs `35206117254` (merge), `35207913453` (state reconciliation), `35208109947` (final wording) — all success |
| Branches | `feat/canvas-tangent-authoring` (review artefact), `feat/canvas-tangent-authoring-replay` (identical to `main`) |

## Milestone A — merged (precedent for B)

Milestone A (direct canvas tangent handle authoring) is merged into `main`:

- Selecting a single freeform layer in edit mode shows its vertices on the stage; clicking a vertex reveals its Bezier tangent handles; dragging a handle reshapes the rendered path live; double-clicking a vertex toggles corner ↔ smooth with neighbour-derived symmetric handles.
- One history entry per completed drag; `Escape` cancels an in-flight drag and records nothing.
- Six independent review rounds, final verdict READY; validation 108 files / 1,641 tests plus `validate:ograf`, `qa:release`, build, TypeScript, lint, and the real-browser spec `e2e/canvas-tangent-authoring.spec.ts`.
- Integration was an approved replay onto current `main` followed by a fast-forward merge: no rebase, no merge commit, no force push, no history rewrite.

Reusable lessons for B: extract the pure predicate/guard list so the tests and the runtime condition cannot drift; state the exact scope of every claim in the contract; keep the review loop bounded and fix only what the reviewer can reproduce.

## Milestone B — scope

Goal: make the graph and path editing surfaces usable without a mouse, and correctly labelled for screen readers.

In scope:

- Keyboard reachability for `TemporalGraphPanel`: focusable panel and graph area, arrow-key navigation across keyframes/values where a focus model already exists, `Enter`/`Space` activation of the focused control, and focus that survives re-renders.
- Screen-reader labelling for the keyframe rows, the selected-keyframe sections, and the graph surface: accessible names, roles, `aria-selected`/`aria-expanded`-style state where the UI already has that state, and no decorative element leaking into the accessibility tree.
- Focus visibility that matches the existing design system (see `docs/design/KCS_DESIGN_SYSTEM.md` focus requirements), including reduced-motion behaviour.

Out of scope (hard boundary):

- No graph engine, evaluator, channel, or timeline-mutation rewrite; no new state store or event bus.
- No broad visual/style churn, no design-system rewrite, no new dependency or UI framework.
- No package/lockfile/workflow/release change, no tag or draft-release edit, no npm publish.
- No new keyboard shortcut registry: reuse `useKeyboardShortcuts` and the existing tool shortcuts, and do not remap or remove existing keys.

## Authorities to reuse

| Concern | Authority |
|---|---|
| Graph + keyframe surfaces | `src/components/Timeline/TemporalGraphPanel.tsx`, keyframe rows and selected-keyframe sections in the timeline |
| Graph/value/channel data | the existing keyframe/channel model in `src/types/animator.ts` and the timeline mutation utilities |
| Shortcuts | `src/hooks/useKeyboardShortcuts.ts` |
| Design constraints | `docs/design/KCS_DESIGN_SYSTEM.md` (focus visibility, semantic colour, reduced motion) |

## Validation and gate for the implementation session

1. Focused a11y tests (keyboard traversal, activation, labelling) plus one Playwright smoke that drives the panel with the keyboard only.
2. Full set: `npm test`, `npm run validate:ograf`, `npm run qa:release`, `npm run build`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`.
3. One focused independent review before any merge; integrate by fast-forward, or by an approved replay if the branch and `main` have diverged.
4. Stop and report if the work grows beyond narrow UI/accessibility.

## Recommended next prompt

"KCS MILESTONE B — GRAPH + KEYBOARD ACCESSIBILITY. On a new `feat/graph-accessibility` branch, make the existing graph/path editing surfaces keyboard reachable and screen-reader labelled (TemporalGraphPanel, keyframe rows, selected-keyframe sections), reusing the existing graph/value/channel authorities: no graph engine rewrite, no broad style churn, no package/workflow/release change. Add focused a11y tests, run one Playwright smoke, run the full validation set, then one focused independent review before any merge."
