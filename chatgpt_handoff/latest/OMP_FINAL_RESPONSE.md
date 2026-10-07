# KCS Post-Astra Focused Remediation — 2026-10-07

## Latest approved correction

The Astra review of the uncommitted authoring work found 16 concrete defects (3 HIGH, 12 MEDIUM, 1 LOW; no BLOCKER). All 16 are fixed, published as six commits on `main`, and covered by focused regressions: text Boolean geometry `a3f5b09`, bonded layer movement `78450f5`, timeline curve targeting `0a20dd6`, Playfair OGraf portability `aa392a9`, the pre-existing visual-only editor refresh `fb8ed96`, and the documentation reconciliation.

The HIGH defects: a quoted or fallback-list font family traced no Boolean geometry; a parented bonded layer dragged by a local-space delta instead of the world delta (buddy 300 → 210 instead of 310); and the Motion Curves modal wrote a curve into a different layer when the selected layer carried legacy keyframes rather than canonical channel data.

The Playfair Display correction and the visual-only editor refresh from the previous working tree are now committed unchanged in substance, together with the three owned Playfair files (normal TTF, italic TTF, OFL.txt).

## Evidence

Real Chromium proof covers the font family matrix (bare, quoted, fallback-list, JetBrains Mono), the SVG whitespace parity of the trace, the font load → settled retrace, an untraceable operand refusing the Boolean, a parented bonded drag calibrated against a parentless group, and the legacy single-file export refusing an asset-dependent graphic while an asset-free graphic still exports. Unit coverage adds the closed freeform ring closure, mask curve dispatch, zero-duration segment refusal, multi-selection and moving-ancestor bond dispatch, the untouched-axis guarantee, the pinned font integrity, and the exact wrong-layer repro rendered through the real SequencerTimeline.

Final local gate: `npx tsc -b --pretty false`, `npm run lint`, `npm test` (135 files / 2,055 tests), `npm run build`, `npm run validate:ograf`, `npm run qa:release` (2 Chromium), `npm run qa:v6` (3 Chromium), the full Chromium suite (268 tests with `--retries=0`), and `node scripts/check-state-consistency.mjs` (35 checks) all pass. Retries, assertions and thresholds are unchanged.

## Scope boundaries

No dependency, workflow, package, version, tag, release or npm change is part of this publication. Only Playfair Display is covered by the owned-font path; general font upload, other built-in font portability, and package asset relinking are not added. The audit now reports `concurrently`/`shell-quote`, `proxy-addr`, `source-map-js` and the previously recorded moderate `fast-uri` advisory; remediation needs a separately approved dependency change and no `npm audit fix` was run.

## Release state

H7 remains HOLD. Annotated tag `v1.1.0-rc.1` and the GitHub draft prerelease stay at `46d2a3e`. Publishing, finalizing, or re-tagging requires a new explicit user instruction.

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` to ChatGPT.
