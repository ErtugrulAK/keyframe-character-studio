# Progress 188 - F Browser QA: Mask/Matte Workflow

Date: 2026-10-18T17:55Z (UTC) · Branch: `feat/k5-matte-visibility-safety` (rides PR #27)

## Scope

The sprint's browser-QA phase: one real-Chromium journey that walks what the
K-series built for masks and matte — NOT a re-assertion of the render
contract (track-matte.spec.ts owns that) but the authoring surface: outliner
Mask group (K3), stopwatch authoring on a mask scalar (K1 semantics over K3
rows), and the honest matte badge for a switched-off source (K5). Each step
drops a screenshot artifact under `test-results/f-*.png` (gitignored,
uploaded per-run convention established by M13/M20).

## Evidence

- `e2e/f-mask-matte-workflow.spec.ts`: **1 passed** (isolated, release-gate
  lane) with 4 artifacts written:
  - `f-01-mask-group-collapsed.png` — tree with the collapsed group
  - `f-02-mask-rows-keyed.png` — expanded rows, seeded opacity channel keyed
  - `f-03-two-mask-channels.png` — feather armed at the playhead
  - `f-04-matte-badge.png` — Beta's badge naming the hidden, still-clipping source
- Assertions inside the spec (aria-expanded, data-animation-state transitions,
  exact badge title) — the screenshots are evidence, not the oracle.

## Notes

The spec seeds `maskChannels` directly on the track (a mid-authoring state no
UI click could reach in one step); the seeded key at frame 0 is what makes the
stopwatch `keyed` on first render — the journey then continues through real
clicks only.
