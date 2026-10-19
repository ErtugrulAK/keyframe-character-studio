# Progress 196 — Master Development Program V2: Waves A–G execution ledger, audits and investigation findings

Date: 2026-10-19 · Machine: work PC (`KEYFRAME-PC` lineage) · Base main: `0eb4373`
Scope executed: A2, A1, D1, B1, B2, C2 (+ follow-up fix), C1 (investigation), D2, D3, E3, E1/E2 (investigations), F1–F4 (audit), G1 (audit), Backend (audit).
No PR was merged, no tag released, no version bumped. All browser validation ran in isolated worktrees.

## 1. PR ledger (heads independent; stack noted)

| PR | Task | Branch | Head | CI |
| --- | --- | --- | --- | --- |
| #31 | A2 mask/trim runtime parity | `fix/a2-mask-trim-runtime-parity` | `472e1cb` | pass |
| #32 | A1 interpolation drift guard + exact-key order fix | `test/a1-interpolation-drift-guard` | `7828680` | pass |
| #33 | D1 GIF lazy-chunk ErrorBoundary gate | `fix/d1-gif-lazy-error-boundary` | `7e23482` | pass |
| #34 | B1 boolean-text-operands first-attempt failure fix | `fix/b1-boolean-text-operands-flaky` | `cf6618f` | pass |
| #35 | B2 nonblocking Chromium smoke workflow | `ci/b2-chromium-smoke` | see branch | (docs/CI config — validates via ci.yml on PR) |
| #36 | C2 `?perf` instrumentation (+ observer-type fix) | `feat/c2-perf-instrumentation` | `7984c3c` | pass (both commits) |
| #37 | D2 autosave failure honesty | `fix/d2-autosave-failure-honesty` | `720862b` | pass |
| #38 | D3 OGraf staged export labels | `feat/d3-export-progress-stages` | see branch | pass |
| #39 | E3 OGraf export lazy chain — **stacked on #38** | `perf/e3-ograf-export-lazy` | see branch | pass |

Merge order: #31, #32, #33, #34, #35, #36, #37 are independent. **#38 before #39** (same `handleOGrafExport` await points; #39 targets the #38 branch and must be retargeted to `main` after #38 merges).

## 2. Correctness findings captured in tests

- **A2**: emitted OGraf runtime consumed mask opacity/feather/expansion and trim start/end/offset raw while the editor clamps/normalizes (`layerMasks`, `trimPath`). Runtime now mirrors the authorities; RED 6/6 → GREEN 6/6; mask/matte/trim browser lane 124/124; emitted bytes +681 once.
- **A1**: seeded cross-implementation fuzz guard (editor ↔ emitted runtime, tolerance 6) caught a REAL pre-existing drift on its first run: runtime evaluated the exact-key guard after the end-of-range edge checks, editor evaluates it first — duplicate frame on a track's last key picked different winners. Runtime reordered to editor order (exact → edges → bracket), emitted bytes +0.
- **B1**: `boolean-text-operands.spec.ts` failed 8/9 on EVERY first attempt (`{expected:1, flaky:8}` ×3 runs) — not randomness: Boolean application awaits the text trace; the spec saved/read before the commit landed while the SAFE-02 pending-save guard legitimately coalesced the badge click, so the `Just saved` label assertion passed against a pre-group document. Spec-side state/event synchronization added (outliner commit-row wait, refusal-toast wait, content-poll reads); no assertion deleted; after: `{expected:9, flaky:0}` ×2.
- **D2**: persistence failure (quota/unreadable) was console-only while the badge kept a stale success; now `autosaveError` drives a red `Not saved` badge, one toast per event, cleared by the first landing write; tokens and in-memory document untouched (5 deterministic tests; autosave browser lane 5/5).
- **C2 follow-up**: `observer.observe(options)` without `type` armed nothing — every collector silently reported unavailable in Chromium (found by using the tool for C1). Fixed + regression test; live: `long tasks 63 (LoAF+longtask)`, `worst interaction 128ms`.

## 3. Measurements (C1, E1, E2, E3, F4)

- **C1 playback stress (40 layers / 2400 keys, 3.2 s, ×3 + reruns)**: heap start/peak/end 9.5 / 9.5 / 9.5 MB — the previously reported ~90 MB/3 s growth did NOT reproduce; "2.5 MB/frame" is unsupported. Long tasks 28–36, top ≈267–288 ms — with CPU-profile attribution dominated by React DEV runtime (`jsxDEVImpl` ≈13%, `validatePropertiesInDevelopment` ≈7%): measurement was taken against the dev server; production attribution unknown. DOM ≈10,542 nodes at this scale. No measured, safely isolable optimization → no C1 PR (program rule).
- **E1 history**: whole-document snapshot model; per-commit cost linear: 40×60 (139 kB snapshot) → clone 1.4 ms, commit P50 2.6 ms, undo P50 2.2 ms; 120×120 (812 kB) → clone 8.6 ms, commit P50 13.7 ms. No hotspot worth structural sharing risk at authored scales; depth unchanged (not allowed, not needed). No E1 PR.
- **E2 provider**: idle 0 commits/s; playback 45 commits/3.2 s at avg 51 ms/commit, max 179.8 ms (dev runtime inflated). The inline context value is NOT the driver: during playback `currentFrame` lives in the provider, so any memoized value re-validates per frame anyway. A provider split is the real lever and is explicitly out of program scope → documented, no PR. Re-measure in production mode with `?perf` before deciding.
- **E3 bundle**: index chunk 539.2 → 481.2 kB raw, gzip 153.8 → 137.9 kB (**−15.9 kB first load**); OGraf compile/package/validation ship lazily (41.3 + 15.1 + 1.0 kB) and the browser module cache serves repeated exports. Output parity proven by the export + phase2d lanes.
- **F4 inventory**: 14 CSS files, 227 custom properties in `kcsEditorTheme.css`, ~277 inline `style={{` attributes across components; two global CSS entry layers plus per-component CSS. Proposal (no migration performed): token-first rule for new code, migrate popover/tooltip inline styles opportunistically, one audit of duplicated spacing scales at next styling touch — incremental only.

## 4. F1 — Graph Editor readiness (design only)

Assets: `TemporalGraphPanel` (202 ln, value graph over selected channel), `InteractiveCubicBezierEditor` (730 ln, easing curve editing), shared easing algebra in `utils/defaults.ts` mirrored in the emitted runtime (parity: #31/#32; drift tripwire: A1 fuzz guard). Preconditions: A-wave PRs merged; `?perf` available for re-benchmarks. Proposed increments (each a focused PR with parity + fuzz-guard updates):
1. Value/speed graph unification (single canvas, channel tabs) over the existing panel data path.
2. Bézier handle editing writing the existing `cubic_bezier` keyframe `bezierControlPoints` storage (no schema change) with editor/runtime parity asserted in the drift guard.
3. Keybar operations (marquee select, multi-key drag) on the timeline row.
4. Curve default presets + template-level defaults, reusing the preset authority.
No major rewrite attempted in this program.

## 5. F2/F3 — keyboard, a11y, chrome audit

- Reduced motion: global neutralizer exists (`index.css:568` — `*` animation/transition duration clamp) plus component blocks; the badge pulses fall under the global rule → compliant, no change.
- Dialog keyboard model: reset-confirm pins focus-on-open, Escape-to-cancel, role semantics (`headerBarResetConfirmation.test.tsx`); GIF panel keeps its own Escape/close contract; D1 added keyboard-reachable Retry/Close on the failure card.
- Timeline keyboard navigation and shortcut reference: existing contracts (`?` dialog, arrow-key handling in timeline specs) — no regression found in scope.
- **No invented defects**: the previously reported intermittent header glitch did not reproduce at 1280/1000/820 (screenshots + overflow probes); the toolbar's right-edge cut at 820 is an existing `overflow-x: auto` scroller, not a clip defect; collapse handles functional. Nothing fixable was found that is both small and clearly nonbreaking → no F PR.

## 6. G1 — versioning / release discipline (audit)

- `package.json`: `1.1.0-rc.1`; tags: `v1.1.0-public-controls`→`6351d1a`, `v1.1.0-rc.1`→`46d2a3e`, `v1.1.0-rc.2`→`6c27ef3`. **Drift: a `v1.1.0-rc.2` tag exists without a `package.json` bump.** CHANGELOG has `[Unreleased]` + `1.0.0`; the 1.1.0 rc line is undocumented.
- Proposal (apply at next release-prep, not here): bump `package.json` in the same commit that cuts a release-prep PR; tag only from `main` HEAD; CHANGELOG `## [1.1.0-rc.N]` sections written at tag time; `chromium-smoke` (weekly, nonblocking) as early regression signal, `release-smoke` remains the only browser gate; GitHub Releases created only from tagged main.
- Gates today: `ci.yml` (push/PR: validate+unit+build), `release-smoke.yml` (manual exact-SHA full gate), `chromium-smoke.yml` (new, #35). Windows/Linux: CI on ubuntu; local QA on Windows shares the same npm scripts (node-based, cross-platform); e2e ports isolated by env (`playwright.config.ts`).

## 7. Backend architecture (audit only)

Verified in code: no `fetch`/XHR from `src/**` to the Express/SQLite endpoints — the React editor does not consume `server/` (grep evidence); the server remains a documented local QA/REST service (README + apiBindHost/CORS tests around it). Options kept open: keep as documented local service; integrate deliberately in a later approved phase; removal only after an explicit product decision. No change made.

## 8. Honesty ledger

- All CI rows above are exact-head runs (`gh pr checks` watched), not local proxies.
- C1/E2 timings were captured against the DEV server; production-mode re-measurement is listed as follow-up, numbers not extrapolated.
- D3's commit message intentionally describes the compile stage as real-but-transient; the test contract covers the observable Packaging stage (documented in the PR body).
- Worktrees for all shipped tasks remain under `.worktrees/` (cleanup is a separately approved step); canonical `main` untouched at `0eb4373`.
