# KCS Visual QA (V1 harness)

Opt-in screenshot regression for the editor, built on Playwright
`toHaveScreenshot`. Lives in `e2e/visual-regression.spec.ts`, tagged
`@visual`, excluded from every default run via `grepInvert` in
`playwright.config.ts`.

## Commands

```
npm run qa:visual                    # assert against committed baselines
npm run qa:visual -- --update-snapshots   # regenerate intentionally
```

## Determinism contract (every region must satisfy all of it)

1. **One seeded document** — the spec's own localStorage seed; never the
   developer's live project, never the canonical UI port.
2. **No dynamic surfaces in the crop** — no autosave/time-ago text, no
   playback clock (Home is pressed before capture), no hover/focus state,
   no transitions (captured with `animations: disabled`).
3. **Web fonts awaited** — `document.fonts.ready` before any capture;
   glyph pixels are part of the contract.
4. **Fixed viewport and scale** — 1440×900, Desktop Chrome, DSF 1.
5. **Strict budget** — `maxDiffPixelRatio: 0.001`; a region that needs a
   looser budget is not deterministic and does not belong here.

## Platform policy

Baselines are stored per platform
(`snapshotPathTemplate: e2e/visual/{snapshotName}-{platform}{ext}`).
A Windows-captured baseline is never asserted against Linux rendering and
vice versa. CI (Linux) starts with **no** Linux baselines: the first
`qa:visual` run there updates them in a dedicated, reviewed commit. This is
deliberate — do not force cross-platform pixel parity without evidence of
font/render equivalence.

## Current regions (V1 slice)

- `.time-ruler` — the strip: ticks, labels, frame window.
- `.left-sidebar-nav` — the 56px icon rail (no drawer, no hover).

Adding a region: satisfy the checklist above, crop to one semantic element,
and keep the baseline diff reviewable in the PR.

## What this is not

Not a layout-assertion replacement (Playwright geometry assertions stay in
the behavior specs), not a design-review tool, and not enabled by default
anywhere.
