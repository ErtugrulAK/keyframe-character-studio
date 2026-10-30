# Sprint Blueprint and Audit Pack — Performance, UI, Migration, Release (2026-10-19)

Companion document for the reliability sprint (PRs #41–#44). Everything measured here was
produced against the production build on isolated ports; canonical services were never touched.

## 1. Production-like performance baseline (P1) and what it overturns

Method: production `vite build` served by the repo's isolated QA server; seeded scenes; a
self-written rAF sampler plus `longtask`/`long-animation-frame` observers; `--enable-precise-memory-info`
for heap samples; 3 rounds per scene; Chromium stable (Playwright-managed).

| Scene | Layers × keys | rAF gap p50/p95 (ms) | Long tasks (max, ms) | Worst LoAF (ms) | DOM nodes | Heap (MB) |
| --- | --- | --- | --- | --- | --- | --- |
| small 6×4 | 6 | 16.7 / 16.7–16.8 | 1 (79–89) | 84–95 | 1,124 | 40.6 |
| 40×30 | 40 | 16.7 / 16.7–16.8 | 2 (196–209) | 236–237 | 6,692 | 51.8–51.9 |
| 80×30 | 80 | 16.7 / 16.7–16.8 | 3 (258–264) | 309–314 | 12,692 | 72.0–72.3 |

Findings (production, repeated):
- **Steady-state playback holds a locked 60 fps** (~481 rAF callbacks in 4 s) at all three sizes; no
  dropped-frame signature appeared in any round (`rafGapMax` never exceeded 16.8 ms).
- All long tasks cluster at **scene mount / first evaluation** (1–3 tasks), scaling ~linearly with
  layer count (≈+3 ms/layer of one-time cost). There is no per-frame long-task band in production.
- Heap scales with DOM size (≈0.4 KB/node incl. React fiber overhead — a sample, not a model). The
  previously circulated "~2.5 MB per frame" dev-server number is **not reproducible in production**
  and must not be quoted; the earlier "28–36 long tasks with 267–288 ms tops" belonged to the React
  DEV runtime (`jsxDEVImpl`, `validatePropertiesInDevelopment`), confirmed by this prod run.
- Uncertainty: single machine (Windows), 3 rounds, spread ≤10% on every metric; LoAF script attribution
  not broken down per component in this pass.

**P2 decision:** there is no reproducible production hotspot in playback worth optimizing; the only
measurable cost is one-time scene mount. Per program rules (measured benefit > noise, small change),
**no optimization PR is opened**. If scene-mount cost ever needs attacking, the measurement above is
the baseline and the mount path (`StagePartLayers` first commit + initial evaluation) is the target.

**P3 conclusion:** the E2-era suspicion on the AnimatorContext provider fan-out is a dev-runtime
artifact. Production playback keeps the frame budget with the current single-provider design, so a
context split / external store is **not justified by measurement** and stays a blueprint only (see
progress_196 §3 E2). Any future split must reproduce the P1 table on both sides of the change.

**P4 conclusion:** history stays whole-document snapshots. Production UI probe: undo/redo click→settled
≈50–65 ms (dominated by the 50 ms settle constant — real cost below it), 30 consecutive edits
≈130 ms and 10 rapid undos ≈45 ms **flat from 6 to 120 layers**; heap flat ≈50 MB. Consistent with the
E1 unit measurements; no history change. Caveat: the probe drives the UI with synthetic keyboard
events; where a nudge did not bind (120-layer row reported dispatch 0), the edit cost numbers are
lower bounds for the click paths — treat them as scale-flatness evidence, not absolute edit cost.

## 2. U1 — shipped keyboard slice and the composite-widget call

The timeline's keyframe diamonds already implement a within-lane arrow walk; the ruler was pointer-only,
leaving *time* without a keyboard affordance. U1 adds a single WAI slider (the ruler) —
arrows ±1, shift ±10, Home/End — routed through the exact same clamped seek the pointer scrub uses.
No roving-tabindex rewrite: the lane is a list of independent widgets, not one composite; the playhead
is one value, one widget. Evidence: PR #44 (4 unit + 3 permanent e2e tests).

## 3. U2 — chrome quality audit (no PR, by design)

Production measurements at 1600/1280/1100/1024/900:
- Document horizontal overflow: **0 at every width**; header children stay inside the header box; header
  (79 px) and toolbar (40 px) boxes are pixel-stable. The "intermittent header glitch" did not reproduce
  in this instrumented pass either (third attempt); the report stays open with no actionable lead.
- Toolbar inner overflow at ≤1100 px is the **documented scroll strip** (`overflow-x: auto` with an
  explicit design comment in `AuthoringToolbar.css`) — scrollable content, not clipping. Not a defect.
- Minimum hit target measured: 26 px (satisfies WCAG 2.5.8 minimum); dock handles 20×40.
- Collapse coherence: `aria-expanded`/label/`aria-controls` flip correctly; the handle remains visible
  when collapsed by design (pinned contract in the appInspectorToggle suite).

## 4. U3 — design-system finding (token duality, no blind migration)

Focus rings draw from two parallel token stacks:
`--kcs-border-focus: #52e2c7` + `--kcs-focus: var(--kcs-border-focus)` (`kcsEditorTheme.css`) versus
`--accent-cyan: #38bdf8` with `--kcs-border-focus: var(--accent-cyan)` redefined in `index.css` —
the same token names resolve to **different colors depending on which layer wins**, and two focus
rings (`keyframe-diamond`, ruler) use `--accent-cyan`/`--kcs-focus` directly. This is real drift, but
unifying it changes rendered colors; it needs a visual-diff harness and a design decision, so it is
**proposed as a dedicated styling task, not smuggled into this sprint**. Inline-style count (~277)
remains a token-first-for-new-code rule, not a migration quota.

## 5. U4 — Graph Editor V2 blueprint (progressive, four increments)

Ground truth: the panel already renders both **value and speed** curves (`mode: 'value' | 'speed'`,
speed derived by finite difference); `cubic_bezier` keyframes already carry `bezierControlPoints`
and the editor↔runtime algebra is pinned by the A1 fuzz guard.

1. **Increment 1 (presentation polish, low risk):** unify value/speed axes (independent y-domains,
   visible unit labels), show HOLD/linear/bezier segment badges on the curve, keep everything else frozen.
2. **Increment 2 (editing, medium risk):** drag handles for `cubic_bezier` keyframes writing the
   existing storage format; must keep the A1 fuzz guard green (runtime parity is contractual) and the
   write path must go through the existing keyframe mutation pipeline (one undo per gesture).
3. **Increment 3 (interaction):** keyframe selection sync between timeline and graph (click curve point
   ↔ select diamond); no new gestures beyond mouse.
4. **Increment 4 (defaults):** curve default presets in the existing preset authority.

Explicitly **not** planned: new schema, new evaluator, multi-keyframe marquee in the graph, or speed-graph
editing (speed is derived data; editing it would need an inverse-authority that does not exist — a product
decision, not an implementation detail).

## 6. U5 — migration/restore architecture (research only)

Current entry points are **deliberate trust boundaries**, not duplication:
`importValidation` (external file: caps + rejection), `coordinateMigration` (versioned scene rewrite),
`v6Migration` (layer normalization), `migrateLegacyKeyframesToCanonical` (lazy, per-track, on edit),
and the OGraf import path. The autosave restore path normalizes but must stay lenient (it is the user's
own last state, not foreign input) — collapsing validation into one entry would either weaken import
rejection or harden restore against its contract.
**Proposal (for a later approved round):** a shared `restoreDocument` pipeline stage
(`validate → migrate → normalize`) that import and load paths compose **differently** — strict validation
before migration for imports, migrate+normalize without import caps for restore — instead of today's
implicit ordering knowledge in each caller. No behavior or stored versions change in this sprint.

## 7. U6 — product UX backlog (verified against current app)

| Idea | Already? | Benefit / effort / testability | Call |
| --- | --- | --- | --- |
| Command palette | no | discoverability; M; focus-trap + fuzzy unit + keyboard e2e | DEFER (needs IA decision) |
| Property search in inspector | no | large scenes; S-M; list-filter unit | DEFER (depends on U3 tokens for highlight) |
| Timeline bookmarks/markers | no | review workflows; M; channel-additive schema — **needs product approval** | DEFER |
| Snap feedback flash | partial (guides) | polish; S; screenshot-diff e2e | ADOPT (small, next UI round) |
| Layer filtering by type | no | large scenes; S; pure list predicate | ADOPT candidate |
| Shortcut discovery | yes (`?` dialog) | — | REJECT (done) |
| Project health panel | no (validation exists) | imports diagnostics surfacing; M | DEFER until U5 lands |
| Export/recovery feedback | yes (stages, Not-saved badge) | — | REJECT (done) |
| UI density toggle | no | laptop users; M; token-level — depends on U3 unification | DEFER |
| Responsive workspaces | scroll strips + collapse exist | at 900 px the toolbar scrolls; usable | DEFER |

## 8. R1 — release readiness audit (facts, no actions taken)

- `package.json`: `1.1.0-rc.1`; tags `v1.1.0-rc.1`(46d2a3e), `v1.1.0-rc.2`(6c27ef3), `v1.1.0-public-controls`(6351d1a).
  The rc.2 tag still has no package bump — the release-prep PR must reconcile one way (bump to rc.2 or
  cut rc.3) and write CHANGELOG `## [1.1.0-rc.N]` at tag time.
- CI: `ci.yml` (every push/PR), `chromium-smoke.yml` (workflow_dispatch + weekly, **nonblocking**, proven
  with real runs), `release-smoke.yml` (manual exact-SHA full gate). Branch protection untouched.
- Pending before any release: merge #41–#44 (independent; order irrelevant, #41 and #43 touch disjoint files),
  then one full green Chromium gate on the exact candidate SHA (the sprint's combined run is on the U1
  head and reported in the handoff — until merges land, main itself is not "one green run" newer than
  progress_197's 453/4-defect ledger).
- Windows/Linux: CI ubuntu, QA Windows share npm-script entry points; no platform-specific scripts found.
- The full-suite failure ledger from progress_197 is now: `gif-export:384` fixed by #41, `m26:73` fixed by
  #42, R5-02 fixed by #43, R5-07 remains the single chronic load-surface (green isolated everywhere, red
  only inside combined runs).
