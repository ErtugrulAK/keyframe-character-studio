# Progress 175 — PR #11 Final Micro-Polish (V3.7) — 2026-10-15

Branch `qa/pr9-pr10-combined` (worktree `keyframe-character-studio-omp-combined-qa`), on top of the V3.6 head `d972a24`. No merge, no tag, no release, no API 5000 restart. This round is the user-approved final polish before the separate MAIN INTEGRATION + VERSION CHECKPOINT task; six surfaces, presentation and structure only, no command or state changes.

## What changed

| # | Surface | Change | Proof |
|---|---|---|---|
| 1 | Toolbar grouping | Align (4 edges) / Center (3) / Distribute (2) / Rotate-Flip (4) are four announced `role="group"` bands behind the compact separators; the both-axes `Center` glyph is the four-arrow centred target (`Move`), no circle, visibly distinct from both one-axis centre icons. Same commands, same order, same authorities. | `e2e/micro-polish-v37.spec.ts` band-separation + glyph-distinctness tests; band lists updated in `authoringToolbar.test.tsx` and `e2e/authoring-toolbar.spec.ts` (11→12 bands) |
| 2 | Left rail + handles | Rail items 42px tall with 18px icons and one 10px/500 label voice; active state is the light teal surface + 2px accent bar with the half-pixel nudge removed. Collapse handles are quiet boundary-flush tabs (panel surface + hairline border, radius unified with the timeline member) instead of an elevated floating block. Widths untouched (56/304/372 token contract). | v37 rail-compaction + handle-family tests; `e2e/panel-edge-handles.spec.ts` geometry contract still green |
| 3 | Focus visual | ONE inset focus-visible authority: the teal ring rides inside the control (`outline-offset: -2px`), no large outer frame, no white browser ring, pointer focus clean, keyboard navigation intact. Seven stray positive-offset rings (left toolbar, inspector, import report, inline rename, timeline handle) were folded into the same treatment. | v37 keyboard/pointer tests (split sessions — Chromium keeps a clicked button focus-visible after a synthetic keyboard focus); v36 select ring now asserted inset |
| 4 | Mode transition | Edit ↔ Broadcast chrome (toolbar, docks, timeline/director swap) fades in through one `kcs-mode-enter` keyframe (180ms ease-out, opacity + 3px paint-only translate), reduced-motion honoured. No React timers, no layout/width/camera animation; rapid switching restarts the same CSS animation. | v37 crossfade + reduced-motion test + rapid-switch camera-identity poll; `camera-transition-stability`/`camera-invariance` unchanged and green |
| 5 | Shortcut Reference | Card grid became a single-column reference sheet: search in the slim header, hairline category bands (no border/background boxes), command left / keycaps right on one line, longer explanations in the row tooltip, Windows/macOS display from the one `utils/shortcuts.ts` authority, short-window scroll preserved. | v37 sheet-layout test (stacked same-column bands, zero card chrome); v36 density pins (≤34px rows, nowrap names, tooltip everywhere) still green |
| 6 | GIF sampling | Verified, not guessed: 120 sampling is the grid; the encoder keeps the authored wall-clock duration at the format's 2 cs delay floor — 0.50s → 25 frames / 50 cs, 1.00s → 50 / 100 cs, 2.00s → 100 / 200 cs. The user's "100 frames at 120" was the correct 2s row. Control renamed `Frame rate` → `Sampling rate`; the misleading presentation-rate reading stays answered by the existing tooltip. | `src/tests/gifPlan.test.ts` + `src/tests/gifEncoder.test.ts` floor tests (real bytes, independent reader); three parameterised browser rows in `e2e/gif-export.spec.ts` |

Autosave restore chip: regression only — the V3.6 provenance test (chip appears on restore, disappears on reset) passed unchanged.

## Validation ledger

* tsc `-b`, oxlint, production build, `validate:ograf`, `npm run check`, `npm audit --audit-level=low` (0), `git diff --check`: clean.
* Unit: 173 files / **2601** tests passed (includes the two new GIF floor tests and the updated band list).
* Full Chromium (isolated QA config, UI 5188 / API 5017, workers 8, retries 0): **436 passed / 0 failed / 0 flaky** in 3.7m — the V3.6 426 plus the 8 new v37 pins and the 2 extra GIF rows. No sleeps, retries, skips or tolerance changes; the camera specs keep their exactness contracts.
* State consistency: the bundle-sync guard is the single check that gates the live-doc re-copy (see delivery below); 54/54 once mirrored.
* Live surfaces: 5173 (this worktree, dev server reads from disk) visually verified in a real browser at 1440×900 — grouped toolbar with the new Center glyph, compact rail, boundary-flush handles, dense shortcut sheet, restored chip. API 5000 health 200, never restarted.

## Verdict

PR #11 final micro-polish complete and gated. The next input is the user's 6-item retest on 5173; merge decisions for PR #9/#10/#11 stay with the user.
