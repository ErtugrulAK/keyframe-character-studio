# C2 — slices D (performance), E (layer tree), F (keyboard / toolbar / right-click), G (mode transition)

Session: 2026-10-22, same worktree and branch, no commits. Evidence paths are relative to
`reports/kcs-master-implementation/`.

## D — Performance (§10): measured, then only measured bottlenecks fixed

Method (`qa/evidence/c2-perf-probe.evidence.ts`, `qa/playwright.perf.config.ts`):
Playwright Chromium headless, 1440×900, same machine; synthetic scenes only — simple (3 layers),
medium (40 layers, masks), heavy (150 layers, masks every 5th, Track Mattes every 7th, every layer
animated). Production build served by `vite preview` (the dev build's React validation dominated
the first profile, so dev numbers are not reported as performance). Per interaction: rendered-frame
interval p50/p95/max (requestAnimationFrame deltas) and long tasks (> 50 ms). This is UI cadence
only; monitor Hz (60 here), scene FPS (30) and UI cadence are separate quantities.
Attribution (`qa/evidence/c2-perf-attribution.evidence.ts`) is a CDP CPU profile on the dev
server with inclusive time per `src/` function, compared base vs worktree.

Findings (production build, heavy scene, two runs each; full tables in `evidence/c2-perf/*/perf.json`;
cells are p50 / p95 ms, long tasks in brackets):

| Interaction | base 39f6414 (2 runs) | worktree before fix | worktree after fix (2 runs) |
|---|---|---|---|
| Inspector toggle | 16.7/66.6 [0], 16.7/66.6 [6] | 16.7/83.3 [6] | 16.7/50 [0], 16.7/50 [0] |
| Playback (2 s) | 16.7/33.3, 33.4/50.1 | 33.3/50 | 33.3/50, 16.7/33.4 |
| Scrub (59 frames) | 16.7/33.4 ×2 | 16.7/33.3 | 16.7/33.4 ×2 |
| Layer drag, hover, draw stroke, outliner scroll | ≤ 16.8 p95 | ≤ 16.8 | ≤ 16.8 |

Playback p95 varies between 33 and 50 ms run to run on BOTH trees (same machine, same build):
it is noise at this sample size, not a regression, and is not claimed as an improvement either.
Simple and medium scenes stay at 16.7 ms p50 everywhere (medium Inspector toggle p95 33.4 → 16.7).

CPU attribution (dev server, inclusive ms, heavy scene; `evidence/c2-perf/attr-*`):

| Work | base | worktree before | worktree after |
|---|---|---|---|
| `OutlinerPanel` during 2 s playback | 181 | 197 | 22 |
| `OutlinerPanel` during a 40-frame scrub | 227 | 224 | 29 |
| Main-thread busy during 4 Inspector toggles | 3 377 | 3 415 | 2 024 |
| `commitWorkspaceLayout` (dock frames) | 2 418 | 2 416 | 925 |

Root causes (pre-existing in base, not introduced by WP-01–07):
1. The layer tree rebuilt every row on every playhead frame (it reads the whole editor context,
   which changes each frame).
2. Each of the ~15 eased dock frames (`commitWorkspaceLayout`, flushSync) re-rendered the whole
   shell: header, toolbar, stage, timeline and both Inspector panes.

Fixes (render work only; no new clock, no change to `commitWorkspaceLayout` timing or the camera):
- Layer tree split into memoized `OutlinerRow`s fed by a stable action bag (latest values read
  through a ref at call time), so a playhead change re-renders no row.
- `App` memoizes its prop-less, context-driven surfaces; `PropertyInspector` memoizes its two
  panes. A dock frame re-renders only the panel shell whose width it writes; real state changes
  still reach them through the context.
- Remaining heavy-scene cost is stage rendering itself (`PartRenderer`, ~100 ms per 2 s playback,
  unchanged); not touched (high-risk renderer, no measured regression).

## E — Layer tree, rename, parenting, delete dependents

User problems: no rename in the layer tree (groups had none anywhere but the timeline row); no way
to parent a layer except creating a group; drag-and-drop only reordered by index (no Before/After
/Nest feedback); a Track Matte source could be deleted without any hint that other layers use it.

Changes and authorities:
- `utils/layerParenting.ts` (pure): `reparentBlockReason`, `planReparent` (keeps the WORLD pose:
  `newLocal = inverse(newParentWorld) ∘ world`, written as TRS only when shear-free and verified by
  re-composition), `planLayerDrop` (Before/After = sibling of the target, Nest = child),
  `moveLayerInOrder` (the `reorderParts` order/zIndex/track-order contract).
  Refused with a reason, writing nothing: self-parenting, cycles, Boolean operands/groups,
  anchored layers, bonds across the new chain, a skew-requiring pose, and ANY transform animation
  on the layer or its old/new parent chain (no baking — the user is told to remove the keys).
- `hooks/useLayerParenting.ts`: the one write path (batch → one undo step), used by the tree's
  drag and drop, the tree keys, the context menu and the Inspector Parent field.
- Layer tree (`OutlinerPanel` + `OutlinerRow`): WAI-ARIA tree keys (↑/↓, Home/End, →/← expand,
  collapse, parent), Enter select, F2 / double-click rename (Enter saves through
  `renamePartAndTrack`, Esc cancels — `InlineRename` no longer commits on the blur that follows an
  Escape), Alt+↑/↓ move among siblings, Alt+→ nest into the row above, Alt+← unparent. Drop zones:
  outer quarters = before/after line, middle = nest box, red when refused; a live status line says
  what the drop will do or why it cannot; a refused release repeats the reason as an alert toast.
- Inspector Parent field (`LayerParentField`): the keyboard/screen-reader way to set any valid
  parent; lists no impossible parent; shows a refusal's reason inline.
- Context menu: Rename (F2), Nest into Layer Above, Unparent.
- Delete with dependents: `matteDependentsOfDeletion` + `DeleteDependentsDialog`. Only when a
  deletion removes a layer that a SURVIVING layer uses as its (Track or legacy) matte source, the
  dialog names those layers and says what happens (kept relationship, missing source, Undo
  restores). Delete without dependents runs at once, as before. The confirmed delete is the
  unchanged `deletePart` (one undo step); dependents are never rewritten or rebound.
- Toasts now carry `role="alert"` (errors) / `role="status"`, so refusals are announced.

Known limits (reported, not changed): deleting a NON-group parent still leaves its children with a
dangling `parentId` (existing delete contract; they fall back to their local pose). This was
possible before through Lottie imports; C2 makes such parents easier to create, so it is listed
as a follow-up candidate.

## F — Keyboard, shortcut reference, toolbar, right-click

- Shortcut registry: new scopes `layers`, `drawing`, `mask-edit` (dispatched by their owners, never
  by the global handler); new rows for the tree keys, the drawing keys (Enter / Undo-Redo of a
  draft / Escape) and the mask point keys. The conflict audit test now covers every scope and pins
  the only documented local-over-global overrides (drawing owns Esc, Ctrl/⌘+Z, Ctrl/⌘+Shift+Z).
- Reference dialog: scope badges for every non-global row ("layer list focus", "while drawing",
  "mask editing", "stage", "timeline focus"), a Layer list band. Search, grouping, keycaps,
  platform keys and focus trap/return already existed and are kept.
- Mask point keyboard navigation: `]` / `[` select the next / previous point (wrapping), arrows
  nudge it (existing WP-06 nudge). Same guards as the nudge (text fields, dialogs, timeline focus).
- Layer keyboard reorder: Alt+↑/↓ in the tree (siblings), plus the existing stack buttons.
- Toolbar: already grouped by task (canvas tools, create, Boolean, group, align, centre, distribute,
  rotate/flip, arrange, crop, view). Added registry-derived `aria-keyshortcuts` to create and zoom
  buttons and corrected the Pen tooltip to the C2 drawing contract.
- Right-click: a right press is either a pan (moved > 4 px) or a menu request (did not move). Before,
  every right-drag pan opened the context menu on release, and a press-time `contextmenu`
  (macOS) let the pan run under the open menu.
- Small stages (narrow window / 200 % zoom): drawing banners pass the pointer through except their
  buttons, and a stage container query keeps every stage banner to one line (see `03_…` §H).
- UI libraries: evaluated in `02_UI_LIBRARY_EVALUATION.md`; nothing installed.

## G — Edit ⇄ Broadcast

The transition was already chrome-only (stage mounted, 180 ms opacity/3 px fade, reduced-motion
CSS). Verified and fixed:
- Reduced motion: the CSS runs no animation, so `animationend` never lowered the `kcs-mode-swap`
  flag; it stayed on for the session. The mode authority no longer raises it under reduced motion.
- Working state: the Inspector and timeline unmount in Broadcast, so the layer tree's collapsed
  rows and the Outliner/Details split height were lost on return. They now use
  `useRetainedUiState` (session-only UI memory; not scene data, not persisted, not history).
  Inspector card disclosure is NOT retained (changing `StyleCard` to session memory broke nine
  existing per-mount tests; left as is and reported).
- Selection, playhead, scene, dock visibility and the stage element itself survive (E2E
  `e2e/c2-mode-transition.spec.ts`, 4 tests: round trip, rapid double switch, reduced motion,
  no second playback loop). Playback
  is stopped by the mode change (existing contract) and stays stopped — no second loop.
