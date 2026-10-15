# Progress 174 — Combined PR #9 + #10 Manual QA: UI Polish V3.6 Remediation

Date: 2026-10-15
Branch: `qa/pr9-pr10-combined` (worktree `keyframe-character-studio-omp-combined-qa`)
Base heads at intake: `679f54f` (combined manual-QA remediation) / `7c83cb7` (its handoff record)

## Scope

The nine UI findings the user recorded against the combined PR #9 + PR #10 lineage were
remediated in this round (V3.6). Every fix was measured BEFORE the change in a real browser
(headless Chromium on the isolated QA vite) and re-measured after; the behaviour is pinned by
`e2e/ui-polish-v36.spec.ts` (8 tests) plus updated existing specs.

## Findings → fixes

| # | Finding | Fix | Key files |
|---|---------|-----|-----------|
| 1 | Draw tools keep the default arrow cursor | Armed `shape_create`/`freeform_draw` adds `drawing-tool` to the stage container; CSS owns `cursor: crosshair` for container and svg; Escape/tool-switch restores `default` in the same paint | `StageCanvas.tsx`, `StageCanvas.css` |
| 2 | Side panels cramped; widths painted from several copies | One width contract on `.app-container` (`--left-rail-width: 56px`, `--left-drawer-width: 304px`, `--right-inspector-width: 372px`); the local re-declarations in `LeftToolbar.css`, `PropertyInspector.css` and `kcsEditorTheme.css` (incl. the 320/286 responsive pair and the hard 280px drawer line) are gone; dock handles derive from the same tokens | `index.css`, `LeftToolbar.css`, `PropertyInspector.css`, `kcsEditorTheme.css` |
| 3 | GIF panel duplicates the close control and lectures the user | Footer Close, the note paragraph and the Format-limitations `<details>` removed; the 20 ms sampling fact moved to the frame-rate select's tooltip, the transparency/text-font facts to the Export button's tooltip; X / Escape / outside-click unchanged | `GifExportPanel.tsx/.css` |
| 4 | Align/Distribute bands carry confusing duplicate commands and an arbitrary order | Align band = Align Left/Right/Top/Bottom, Center (both axes, one command), Center Horizontally/Vertically (one axis each); Distribute band = one gap command per axis; the centre-spacing duplicate left the UI (the pure `planDistribute` authority stays for its documented policy test); the hook's dead `distribute` arm removed | `AuthoringToolbar.tsx`, `vectorArrange.ts`, `useVectorArrangeAuthoring.ts` |
| 5 | Corner drag always uniform; groups cannot scale freely | `isScaleLocked` defaults **false**; `uniform: isScaleLocked !== e.shiftKey` — Shift toggles the aspect constraint for one drag, the Inspector glyph keeps the persistent option; works for groups through the same solver branch | `AnimatorContext.tsx`, `StageCanvas.tsx`, `TransformScaleCard.tsx` |
| 6 | White browser focus ring survives pointer clicks on selects | Explicit select policy: `select:focus { outline: none }` + `select:focus-visible { outline: 2px solid var(--kcs-border-focus) !important }` (Chromium treats `select` as always focus-visible after a mouse click); buttons/inputs keep their pointer-clean behaviour | `index.css` |
| 7 | Mode switch glows and the halves render inconsistently | Three stacked CSS generations + inline styles replaced by one definition: quiet bordered rail, one sliding indicator (no bounce keyframes, no bright bar, no text-shadow), pressed/inactive halves unmistakable; inline paint removed from the markup | `HeaderBar.tsx/.css` |
| 8 | Shortcut Reference rows too tall (measured 47 px), detail stacked | Dense grid: `display: grid; minmax(0,1fr) auto` rows, 4px padding, 22px keycaps, inline detail/scope chips, one-line nowrap names with ellipsis + row tooltip carrying the full sentence (rows now ≤ 34 px; measured max 31 px) | `ShortcutReferenceDialog.tsx/.css` |
| 9 | LAN-opened editor silently shows a different (empty) project | `useSerialization` tracks whether the startup restore filled the document (`restoredFromLocalStorage`, cleared by import/reset), the context exposes it, and the header shows a neutral chip "Restored from this browser's autosave" with an explanatory tooltip | `useSerialization.ts`, `AnimatorContext.tsx`, `HeaderBar.tsx/.css` |

## Gate results (all on the isolated QA config, port 5188; API 5000 untouched)

- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- `npm run build` (`tsc -b && vite build`): PASS.
- `npx vitest run` (full unit): **173 files, 2599 tests, all passed**.
- FULL Chromium Playwright: **426 passed, 0 failed, 0 flaky** (`--retries=0` semantics via the
  local config; the only two earlier failures — an invalid precondition in the re-centred toolbar
  spec and the old `Distribute Horizontal` label in `ae-layout-snapping` — were corrected in this
  round and are included in the 426).
- Before/after browser evidence: crosshair `default→crosshair→default`, widths `280→304` and
  `360→372`, select ring `solid 3px rgb(237,243,248) → solid 2px rgb(82,226,199)` in both focus
  paths, shortcut row max `124px → 31px`, mode `textShadow none` both halves, GIF footer
  `["Close","Export GIF"] → ["Export GIF"]` with notes/details at 0, restore chip present on a
  seeded profile and removed by Reset.

## Contract migrations (deliberate, not incidental)

- `e2e/corner-anchor-resize.spec.ts`: aspect lock pinned as `aria-pressed="false"` by default;
  new Shift-uniform, locked-uniform, locked+Shift-free and group-corner tests added.
- `e2e/inspector-transform-details.spec.ts`: lock glyph rest state + both title variants pinned.
- `e2e/authoring-toolbar.spec.ts`: the duplicate centre-spacing arm replaced by the centre-
  alignment behaviour; `e2e/ae-layout-snapping.spec.ts`: gap command keeps its assertions under
  the documented label.
- `src/tests/vectorArrangeCommands.test.tsx` / `vectorArrange.test.ts`: the centre policy is now
  pinned for the `Center` align command; the remaining distribute arm pins the gap command.
- `e2e/gif-export.spec.ts`: the format-rule assertion moved from panel text to the Export button
  tooltip (the contract "stated before the export" is preserved).

## Protected state

No branch, tag, remote, config or memory operation was performed beyond the commits listed in the
final report. The release tags, `without-mask`, the `.omp` harness and the stable QA services
(5173 vite, 5000 API) were left as-is.
