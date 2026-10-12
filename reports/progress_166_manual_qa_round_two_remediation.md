# Progress 166 — Manual QA round 2 remediation

Date: 2026-10-12
Repository (canonical, untouched): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
Worktree (this work): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
Branch: `fix/manual-qa-round1-remediation` (base `origin/main` at `8e2df61`)

## Scope

Round 2 of the manual QA pass on the live editor produced twelve findings (R2-01…R2-12) on top
of the round-1 set (A–J). This record carries the round-2 remediation to a green gate on the current
head and refreshes the handoff. No merge, no release, no tag, no npm publication, no force push, no
rebase, no history rewrite, no package/dependency/workflow change.

## Commits (round 2)

| Commit | Finding(s) | Change |
|---|---|---|
| `a941dc8` | R2-05, R2-04 | One world pivot captured at pointer-down for a rotation gesture; `src/utils/selectionFrame.ts` is the one authority for the box a selection frame draws (no synthetic fallback geometry). |
| `016f0b5` | R2-01, R2-03, R2-02 | Timeline workspace controls (collapse/expand, top-edge height resize, layer/time column divider) through one sizing authority; the timeline commits its size and re-measures the stage in the SAME task, so no frame paints a stale box/transform pairing. |
| `47ae65c` | R2-10, R2-12 | Canonical `selectedKeyframeIds` in `useSelection` plus the marquee box-select gesture; multi-key MOVE deliberately not implemented (recorded as a follow-up). |
| `80afc17` | R2-11, R2-09 | 18px hit target / 8px hollow-or-filled diamond; compact animation-channel tree with one rail and shared row constants. |
| `9b845c1` | R2-07 | App-root capture-phase `contextmenu` preventDefault across the whole editor; propagation is never stopped, so KCS custom menus still work. |
| `39e34a5` | R2-08, R2-06 | Fill/Stroke removed from the top toolbar (paint stays in the Inspector APPEARANCE card); visual polish; Group/Ungroup removed from Details (toolbar + context menu only). |
| `03f4e26` | (R2-09 alignment) | The opacity lane is rendered where the tree lists it, restoring row-for-row tree/lane alignment. |
| `9207b22` | (R2-08 follow-up) | Three authoring-ux specs author colour through the Inspector instead of the removed toolbar popover; same behaviour proven, no assertion weakened. |

## Findings, root cause, fix, evidence

- **R2-05 rotation pivot.** Pre-fix a rotation gesture turned a layer about its own transform origin,
  so the drawn frame orbited that origin instead of turning in place — worst frame-centre drift
  **40.559px**. The gesture now captures ONE world pivot at pointer-down (the centre of the box the
  frame draws at that moment, children-derived for a container) and holds it for the whole drag;
  `rotateAboutWorldPivot` writes the rotation plus the translation that keeps that world point fixed.
  Worst frame-centre drift is now **0.000px**. Files: `src/utils/rotationGesture.ts`,
  `src/utils/selectionFrame.ts`.
- **R2-04 ghost square.** Root cause: `fallbackBounds()` (±32 → 64×64) in `src/utils/bounds.ts`
  reached the multi-selection path and `layerGrouping`. `src/utils/selectionFrame.ts` is now the
  single frame-geometry authority; a geometryless `isGroup` container with no measured box draws
  nothing.
- **R2-02 timeline-resize camera drift.** The frame where the DOM height changed was painted with a
  stale (box, transform) pairing. The panel now commits its size and re-measures the stage in the SAME
  task. Real-input proof: 151–155 frames of drag, height 320→441, **worstDrift 0.000px**,
  magnificationSpread 0.00000.
- **R2-01 / R2-03** collapse/expand, height resize and channel-width resize all go through ONE sizing
  authority, `src/components/Timeline/timelineConstants.ts`.
- **R2-10 / R2-12** the single keyframe-selection authority `src/hooks/useSelection.ts` was extended
  with a canonical `selectedKeyframeIds: string[]` (with `selectedKeyframeId` as its primary member,
  so curve-editor/delete/copy behaviour is unchanged); the marquee hit-tests the RENDERED diamonds'
  centres so hidden channels are unselectable; Shift/Ctrl union; Escape restores the pre-gesture
  selection. **Multi-key MOVE was deliberately NOT implemented and not faked** — it needs its own
  collision-aware mutation authority and is a follow-up.
- **R2-11** 18px hit target with an 8px hollow (unselected) / filled (selected) diamond.
- **R2-09** compact channel tree with a single thin rail, 30px layer / 24px property rows from the
  shared constants so outliner and lane rows stay pixel-aligned; a real misalignment bug (missing
  opacity lane) was also found and fixed (`03f4e26`).
- **R2-06** `Ungroup` (and `Group`) removed from Details; Group/Ungroup live only in the top toolbar
  and the KCS context menu; a lightweight read-only member list remains.
- **R2-07** app-root capture-phase `contextmenu` preventDefault in `src/App.tsx`; propagation is never
  stopped, so KCS custom menus still work; covers toolbar, sequence tabs, timeline empty area, Details
  and text inputs.
- **R2-08** Fill/Stroke removed from the top toolbar (paint stays in the Inspector APPEARANCE card);
  visual polish pass; Boolean always visible with state-aware enable/disable.

## Load-sensitive flake — `e2e/camera-transition-stability.spec.ts:238`

The full-suite run on `03f4e26` reported this spec ("repeated chrome toggles never drift the world on
any frame") failing once under full-suite load and passing twice in isolation. The assertion, its
tolerance and its sampling density were **not** weakened, skipped, retried or tolerance-hacked. See
the validation table and the analysis in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` for the resolution
or the precise evidence.

## Live surfaces (unchanged by this task)

- 5173 QA preview: vite listener pid **33512** serving THIS worktree on branch
  `fix/manual-qa-round1-remediation`; **never stopped or restarted**.
- API 5000: pid **8872** — **never stopped or restarted**; `/api/health` 200.
