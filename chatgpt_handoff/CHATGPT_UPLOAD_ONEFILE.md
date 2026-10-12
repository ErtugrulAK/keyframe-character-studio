# KCS — Manual QA Rounds 1 and 2 remediation (A–J and R2-01…R2-12)

**Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.** No other file needs uploading.

Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
Worktree used for this work (isolated): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
Branch: `fix/manual-qa-round1-remediation` — base `origin/main` at `8e2df61`
Pull request: **#9** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9` (base `main`, **OPEN**, not merged)

**No merge. No release. No tag. Nothing published to npm.** The user's retest on the 5173 preview is the merge gate.

## 1. Why this round happened

The user ran MANUAL QA against the live editor. **Round 1** produced ten findings (A–J) and **round 2**
produced twelve further findings (R2-01…R2-12). Both rounds are implemented on this branch. Every fix
keeps the current data model and reuses the existing authorities — no second state authority, no second
animation/evaluation engine, no new command bus.

## 2. Round 1 result (context, do not redo)

Round 1 findings **A–J all passed their authored checks** and are already committed on this branch:
A–F in PART 1 (`9f916f6`, `69bbad5`, `1e21fa5`) and G–J in PART 2 (`9774729`, `05f3130`, `aba0b05`,
`18b4aca`). The round-1 head `18b4aca` already passed CI run `38246227512` (CI Pipeline,
`pull_request`, success) and the full local gate (full Chromium 344 passed / 0 failed / 0 flaky). The
round-1 detail is unchanged from the previous handoff; round 2 is the delta recorded below.

## 3. Round 2 — findings, root cause, fix, evidence

| # | Finding | Root cause | Fix (commit) |
|---|---|---|---|
| R2-05 | A rotation gesture turned the frame about the layer's own transform origin, so a group's drawn frame orbited that origin instead of turning in place (worst frame-centre drift **40.559px**) | the pivot was the layer's transform origin, not the centre of the box the frame draws | ONE world pivot captured at **pointerdown** (the centre of the box the frame draws at that moment, children-derived for a container) and held for the whole drag; `rotateAboutWorldPivot` writes the rotation plus the translation that keeps that world point fixed. Worst frame-centre drift is now **0.000px**. Files: `src/utils/rotationGesture.ts`, `src/utils/selectionFrame.ts` (`a941dc8`) |
| R2-04 | A stray cyan square appeared inside a geometryless group frame | `fallbackBounds()` (±32 → 64×64) in `src/utils/bounds.ts` reached the multi-selection path and `layerGrouping` | `src/utils/selectionFrame.ts` is now the single frame-geometry authority; a geometryless `isGroup` container with no measured box draws nothing; every selected layer (single and multi) draws through the measured box (`a941dc8`) |
| R2-02 | Resizing the timeline jolted the canvas | the frame where the DOM height changed was painted with a stale (box, transform) pairing, then snapped back | the panel commits its size and re-measures the stage in the **SAME task** (`canvas-viewport-command` → `remeasure-stage-box`, applied with `flushSync`). Real-input proof: 151–155 frames of drag, height 320→441, **worstDrift 0.000px**, magnificationSpread 0.00000 (`016f0b5`) |
| R2-01 | The timeline could not be collapsed/restored or height-resized | no workspace controls | a header-band Collapse/Expand control (keeps a minimal restore strip and restores the authored height) and a top-edge height resizer, clamped, committing at most one size per animation frame (`016f0b5`) |
| R2-03 | The layer/time column could not be resized | no divider | a resizable divider between the layer list and the time region (col-resize, clamped), and the frame still maps pointer x to the same frame after the column changes (`016f0b5`) |
| R2-10 | The timeline could select exactly one keyframe | the selection model held a single id | canonical `selectedKeyframeIds: string[]` in `src/hooks/useSelection.ts`, with `selectedKeyframeId` kept as its PRIMARY member so curve-editor/delete/copy behaviour is unchanged (`47ae65c`) |
| R2-12 | No box-select gesture over the timeline lanes | none existed | a marquee that hit-tests the **rendered** diamonds' centres (hidden channels are unselectable); Shift/Ctrl folds into the selection; Escape cancels and restores the pre-gesture selection. **Multi-key MOVE was deliberately NOT implemented and not faked** — it needs its own collision-aware mutation authority; recorded as a follow-up (`47ae65c`) |
| R2-11 | Keyframe diamonds were hard to click | the hit target was the glyph | an 18px hit target with an 8px diamond, hollow when unselected and filled when selected; the centre stays on the keyframe's exact frame coordinate (`80afc17`) |
| R2-09 | The expanded property stack read as a heavy card stack | per-row cards with no shared sizing | a compact animation-channel tree — one thin rail, disclosure arrows, 30px layer / 24px property rows from `src/components/Timeline/timelineConstants.ts` so outliner and lane rows stay pixel-aligned; a real misalignment bug (missing **opacity** lane, `03f4e26`) was also found and fixed (`80afc17`, `03f4e26`) |
| R2-06 | Group/Ungroup appeared in Details as well as the toolbar | the command existed twice in the UI | `Ungroup` (and `Group`) removed from Details; they live only in the top toolbar and the KCS context menu; a lightweight read-only member list remains (`39e34a5`) |
| R2-07 | The browser's native right-click menu still appeared in places | per-surface handling was incomplete | one app-root **capture-phase** `contextmenu` listener in `src/App.tsx` calls `preventDefault()` across the editor (toolbar, sequence tabs, timeline and empty area, Details, text inputs) and **never stops propagation**, so every KCS custom menu still works (`9b845c1`) |
| R2-08 | Fill/Stroke sat in the top toolbar next to the Inspector's paint controls | paint had two homes | Fill/Stroke removed from the toolbar (paint stays in the Inspector APPEARANCE card), visual polish pass, Boolean always visible with state-aware enable/disable. Three authoring-ux specs that authored colour through the removed toolbar popover now author through the Inspector (`39e34a5`, `9207b22`) |

## 4. The reported load-sensitive flake

`e2e/camera-transition-stability.spec.ts` — "repeated chrome toggles never drift the world on any frame"
— failed **once** under full-suite load on an earlier head (`03f4e26`) and passed twice in isolation.
**The assertion, its DRIFT_TOLERANCE_PX (1px) and MAGNIFICATION_TOLERANCE (0.002), its sampling density
and its `animating >= 4` observation check were NOT weakened, skipped, retried or tolerance-hacked.**

Evidence on the round-2 head:

- The FULL Chromium suite `--retries=0` on `9207b22` (isolated ports `CI=1 PORT=5010`, one worker for
  determinism) reports `worstDelta=0.000px` and `magnificationSpread=0.00000` for all ten sampled
  transitions, including the `repeat …` sequence of the flaky test. **359 passed, 0 failed, 0 flaky.**
- The spec was then re-run `--retries=0 --repeat-each=8` (24 runs) with four concurrent busy CPU loops
  created specifically to manufacture the reported load: **24 passed ("24 passed (1.5m)")**, again with
  `0.000px`/`0.00000`.
- The failure could **not be reproduced** on the current head, under serial or loaded conditions.

Root-cause analysis of why it is designed not to flake, and why it cannot be tightened further without
manufacturing a circular test: the sampler takes a baseline a few frames **before** the click (the click
fires at t=80ms, after the first samples), samples **every painted frame** (`requestAnimationFrame` →
`setTimeout 0`, the only place that reads the values the user saw), and the spec `settle()`s the stage
before every subsequent toggle. Under load the sampler observes **fewer** frames, never a false frame:
`worstDelta` is measured against the pre-click baseline, so a slower cadence cannot invent drift — it can
only reduce the count, which the separate `animating >= 4` check already guards. Because no run on the
current head (serial, or under manufactured load) produces any drift, any code change to the spec would
be an unverifiable change to a spec that is already behaving correctly; per the task instruction it is
therefore **left unchanged and reported here precisely** rather than edited blindly.

## 5. Validation on the round-2 head (isolated ports only; 5173/5000 never touched)

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | PASS |
| `npm run lint` | PASS (oxlint clean) |
| `npm test` | PASS |
| `npm run build` | PASS |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS |
| `npm run qa:v6` | PASS |
| `npm run check` | PASS (lint + tsc + test + build, exit 0) |
| `node scripts/check-state-consistency.mjs` | PASS — 38 checks |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |
| **FULL Chromium** `CI=1 PORT=5010 npx playwright test --retries=0 --workers=1` | **359 passed, 0 failed, 0 flaky** (10.6m) |
| Focused flake re-run | `camera-transition-stability --repeat-each=8` under 4 concurrent CPU-load loops → **24 passed** |

No assertion was weakened, no spec was skipped to make it pass, no retry was added, and no arbitrary
sleep or tolerance hack was introduced.

## 6. PR #9 and CI

- **PR #9 — OPEN, not merged**: `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`,
  base `main`, head `fix/manual-qa-round1-remediation`.
- Round-2 head `0078dcd68f2fc01ee8c2504149381593ed03c976` (`0078dcd`), mergeable MERGEABLE, merge state CLEAN. CI **CI Pipeline** run `38267691521` (`pull_request`) — **success** (2026-10-12T15:05:35Z → 15:07:35Z).
- CI runs lint, `tsc -b`, the Vitest suite and the production build; the browser e2e suite is not part of `ci.yml`, so the FULL Chromium run in §5 is the browser gate for this head.

## 7. Live surfaces (this task never bound, stopped or restarted them)

| Surface | State |
|---|---|
| Repository | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` (canonical checkout, `main`) — untouched |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1` |
| UI 5173 | vite listener pid **33512** serving THIS worktree; HTTP 200; **never stopped or restarted** |
| API 5000 | pid **8872** — **never stopped or restarted**; `/api/health` 200 |
| Isolated test ports | UI 5188 / API 5010 (`CI=1 PORT=5010`) — the only ports the tests used |
| Release | No tag created/moved, no GitHub release published/finalized, npm never published, PR #9 not merged |

## 8. User retest list (the merge gate)

On `http://localhost:5173` (branch `fix/manual-qa-round1-remediation`):

**Round 2**

1. **R2-05** — rotate a group by its rotation handle: the frame turns in place, the visible centre does not orbit.
2. **R2-04** — select a group / multi-selection with a geometryless container: no stray square appears.
3. **R2-02** — drag the timeline's top edge and use the height presets while watching the canvas: the authored world must not jolt.
4. **R2-01** — collapse and restore the timeline from its header control; the authored height returns.
5. **R2-03** — drag the divider between the layer list and the time region; the frame a pointer x maps to stays correct.
6. **R2-10 / R2-12** — drag a box over several keyframe diamonds: they select together; Shift/Ctrl adds; Escape restores the previous selection; a plain click on empty space clears it. (Moving multiple keys at once is not implemented — a recorded follow-up.)
7. **R2-11** — click keyframe diamonds: the click target is comfortable while the diamond stays small; selected keys are filled, unselected hollow.
8. **R2-09** — expand a layer: the property stack is compact and each row lines up with its lane; the opacity lane is present.
9. **R2-06** — Details no longer offers Group/Ungroup; they remain in the top toolbar and the right-click menu.
10. **R2-07** — right-click anywhere in the editor (canvas, layer list, sequence tab, toolbar, timeline, Details, text field): no browser menu; KCS custom menus still open.
11. **R2-08** — the toolbar no longer has Fill/Stroke (paint is in the Inspector); Boolean and Group/Ungroup stay visible and grey out when the selection cannot use them.

**Round 1 (re-check)**

12. **A** — toggle the left toolbar and the right inspector: the authored world must not slide or rescale.
13. **B / C / E** — drag inside a selected group (whole group moves, a plain click still picks the child); no pivot square; an edge drag keeps the opposite edge fixed.
14. **D** — rotate a group: no border jitter.
15. **F** — press the timeline `+` twice on a grouped/parented layer: the layer must not move.
16. **G** — expand a layer: the `Transform` row names its owning layer and is nested under it.
17. **H** — right-click a sequence tab: no browser menu.
18. **I** — select a layer over light and dark artwork: the frame is readable, no black halo.
19. **J** — the floating pill is gone; the top strip is the authoring toolbar; `V`/`H`/`+`/`-` shortcuts still work.

## 9. Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in the latest bundle needs to be uploaded.
