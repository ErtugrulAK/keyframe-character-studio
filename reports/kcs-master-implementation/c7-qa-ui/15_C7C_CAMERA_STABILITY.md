# C7c — canvas jumps on dock / timeline toggles: reproduction, root cause, fix

Branch `feature/motion/kcs-master-implementation`. Fix `514fd13`. QA candidate
`qa-20261024-1227-514fd13` (not switched; 5310 still serves `qa-20261024-0209-74bd0c5`).

## 1. Reproduction (measured, not inferred)

Scene: a rectangle at the world origin and a circle off-centre; coordinate overlay on; a layer
selected. Each of right dock, left dock and timeline hidden and shown separately, then rapid
repeats and reversals mid-slide. Conditions: 1440×900, 1024×720, 200 % device scale (720×450 CSS
at 2 device px — what a 200 % browser zoom gives a 1440×900 window), reduced motion, after a zoom
and a pan, zoomed out.

Two instruments:

- **Frame audit** (`frame-audit.cjs`, paused page clock, every animation frame stepped): screen
  position of two fixed world points through the SVG CTM, DOM boxes of both shapes, the artboard
  and both axis lines, pointer hit-test at the circle's centre, pixels of the stage area no panel
  ever covers, scene / selection / undo before vs after.
- **Real time** (`realtime-video.cjs`, no paused clock): every composited frame (trace
  `screenshot` category) plus, each rAF, the world origin's screen position.

| Build | Condition | Result |
|---|---|---|
| QA `74bd0c5` | normal motion, every size, zoom/pan, zoomed out | 0.000 px on every frame; pixels unchanged; hit-test OK |
| QA `74bd0c5` | **reduced motion** | **left dock: the world jumps by the dock width for 1–2 frames and comes back** — 360 px (1440×900), 280 px (1024×720), 252 px (200 %; the pointer also missed the circle on that frame). Real time: rAF 3 −360 px on hide, rAF 3–4 +360 px on show. Older builds also jumped on the right dock (186 px) and the timeline (34–128 px). |
| fix `514fd13` | all of the above | 0.000 px on every frame, pixels unchanged, hit-test OK, scene / selection / history unchanged |

Answers to the four questions: (1) objects, artboard, axes and grid move **together** — it is the
whole camera translation, not one overlay; (2) no overlay moves on its own; (3) the jump is on the
first 1–2 painted frames after the click (the start of the hide, the end of the show — when the
stage box changes), not at the end; (4) the pointer hit-test followed the stale picture (it
missed at 200 %).

## 2. Root cause

`src/index.css` had a global reduced-motion rule: `* { transition-duration: 0.01ms !important }`.
Every element's default is `transition: all 0s`; the rule turned "no transition" into a real,
tiny transition of **every** property. The camera code writes the stage SVG's translation in the
same commit as the layout change (verified: inline `transform` is new synchronously), but the
computed transform stayed at the old value for 2–3 frames (`getComputedStyle(svg).transform`
old at sync / rAF 1 / rAF 2, new at rAF 3; `transition: all 1e-05s`). Under normal motion the rule
is inactive, which is why no normal-motion measurement ever showed it. The same stale frames also
produced a permanent 8 px camera offset in the development build.

Remote-desktop link: Windows remote sessions usually turn animations off, which Chrome reports as
`prefers-reduced-motion: reduce`. This is consistent with the video but **not verified** on the
remote machine; check there with DevTools console:
`matchMedia('(prefers-reduced-motion: reduce)').matches`.

## 3. Fix

The reduced-motion rule sets `transition: none !important` (animations unchanged). No second
camera, timer, delay, recentre, hidden overlay or wider tolerance. Nothing waits for
`transitionend` under reduced motion; the mode-swap animation is not started then.

## 4. Tests and validation

New E2E `e2e/c7c-camera-stability.spec.ts` (19 tests): every frame of hide/show of each dock and
the timeline, rapid repeats and reversals, after zoom + pan; normal and narrow window, 200 % device
scale, reduced motion. Asserts ≤ 1 CSS px for fixed world points, shapes, artboard and axes on
every frame; pointer hit-test; real drags land where the pointer went (snapping off); scene and
selection unchanged; two Undos take back exactly the two drags (no history entry from toggles);
zoom unchanged (no auto fit). It fails without the fix (reduced motion: 8–360 px frames).

| Gate | Result |
|---|---|
| `npx tsc -b` | exit 0 |
| `npm run lint` | exit 0 (1 pre-existing warning) |
| `npm run build` | exit 0 |
| `npx vitest run` | 228 files, 3 192 tests passed |
| full E2E (isolated) | **604 passed, 0 failed** |

## 5. Evidence (local, not committed)

`reports/kcs-master-implementation/c7-qa-ui/c7c-evidence/`:
`before-after-reduced-motion.webm`, `before-after-normal-motion.webm` (side by side, real time,
every composited frame, slowed to 5 fps, yellow crosshair = world origin before the click),
`raf-drift-*.csv`, `frame-audit-before-after.txt`, stills of the jump, and the two scripts.

Not covered: a real 200 % *browser* zoom (Ctrl +) was approximated by device scale 2 at the same
CSS viewport; the remote-desktop session itself was not measured.
