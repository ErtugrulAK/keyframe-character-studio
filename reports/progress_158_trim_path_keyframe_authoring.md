# Progress 158 — Trim Path keyframe authoring

Date: 2026-10-09. Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`.

Trim Path authoring behaved like a global property edit: a keyed Start/End/Offset read as one shared value, and editing a later frame appeared to rewrite the earlier keyframe. Root-caused, fixed, and covered by regressions.

## Candidate identity

| Field | Value |
|---|---|
| Fix commit | `b4e8e948675466135c3e56ae3d331cec0441ccb3` |
| Branch | `fix/trim-path-keyframe-authoring`, fast-forward merged into `main`, kept |
| Prior main | `231070c` |

## Reproduction and root cause

`TrimPathSection` was a purely static component:

```tsx
onChange={(value) => onPartPropChange('trimPathEnd', value)}   // writes CharacterPart.trimPathEnd
value={selectedPart.trimPathEnd ?? 1}                          // displays the static field
```

It had **no keyframe awareness at all** — no channel read, no channel write, no add/remove keyframe. So while a channel was keyed:

- the field displayed the static value at every frame, which is why the same number appeared on the earlier frame and the edit read as global;
- the write landed on the static field, which `evaluateTrimPath` ignores once the channel has keyframes.

The evaluator and the export were **not** at fault: `evaluateTrimPath` already prefers keyframes and interpolates, and `evaluateFrame` already routes trim through it.

## Fix

Both halves now use authorities that already existed for every other scalar channel:

| Concern | Authority |
|---|---|
| Display | `evaluateTrimPath(part, track, currentFrame, template)` — what the stage draws at this frame; static field only while unkeyed |
| Write | `updateCurrentPropertyChannel(channel, value)` — static field while unkeyed, the current frame's keyframe once keyed |
| Add/remove keyframe | `addPropertyKeyframe` / `deletePropertyKeyframe`, mirroring the opacity card |

Each of the three fields gained an Add/Remove keyframe control matching the opacity card's classes, `aria-pressed` and labels, capturing the evaluated value at the current frame. `TrimPathSection` keeps its previous behaviour when the new props are absent, so its standalone contract is unchanged.

## Authoring semantics now

- No keyframes → the edit changes the static field only.
- Channel keyed → the edit updates the keyframe at the current frame, inserting one if the frame is empty; no other frame is touched.
- The static field never overwrites a keyed value (the evaluator already preferred the channel; the display now agrees).
- A same-frame keyframe in another sequence is left alone.
- One edit is one history entry (the write goes through the existing channel mutator).

## Regression

`src/tests/trimPathAuthoring.test.tsx` — 11 cases: evaluated display, static fallback, channel write, keyframe toggle, `A=0 / B=100` (A stays 0), update-in-place, unkeyed static write, sequence isolation, midpoint interpolation, per-frame resolution, unkeyed fallback.

**Sensitivity:** reverting the evaluated display and the channel write turns 2 cases red.

## Validation

`npx tsc -b --pretty false`, `npm run lint`, `npm test` (137 files / 2,092 tests), `npm run build`, `npm run validate:ograf`, `npm run qa:release` (2 Chromium), `npm run qa:v6` (3 Chromium), `npx playwright test e2e/trim-path-v2.spec.ts --retries=0` (2 tests), `node scripts/check-state-consistency.mjs`, `npm audit --audit-level=low` (0 vulnerabilities) and `git diff --check` all pass.

## Exact-SHA smoke

**Not run, and not required for this change.** The fix changes the Inspector's authoring path only: `evaluateTrimPath`, `evaluateFrame`, the static SVG renderer, the generated runtime and the package format are untouched, so exported/runtime OGraf behaviour is identical. The previous smoke still describes the export behaviour. Any later commit that changes export or runtime code needs its own exact-SHA smoke.

## User retest

1. Create a freeform/path layer with a visible stroke.
2. Enable Trim Path.
3. At frame 0: add an End keyframe, set End = 0.
4. At frame 30: add an End keyframe, set End = 100.
5. Return to frame 0: End must read **0** again (it used to read 100).
6. Scrub 0 → 30: the stroke draws on progressively.
7. Play: the animation reveals the path.
8. Save and reload: both keyframes remain 0 and 100.
9. Export an OGraf package and play it in the host: the same reveal.

Optional second pass: Start 0 → 50, and Offset 0 → 180.

## Release state

Unchanged: `v1.1.0-rc.2` remains the published prerelease at `6c27ef35d48d61a5e1163d2c91734c864fcafa01`, npm still returns 404, and no tag, release or npm action was taken.
