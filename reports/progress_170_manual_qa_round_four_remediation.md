# Manual QA Round 4 — remediation, part 4 of 4 (final record, gate, PR and handoff)

Branch: `fix/manual-qa-round1-remediation` (existing; PR #9 stays open, not merged).
Base: `origin/main` @ `8e2df61`. Worktree: `keyframe-character-studio-omp-manual-qa-r1`.

Already on this branch, not redone here:

- Part 1: R4-03 + R4-04 (`c9357c3`), R4-07 (`babf9b3`), R4-14 (`bc49601`), docs mirror (`6c3717f`).
- Part 2: R4-15 (`bd73761`), R4-16 (`6bf71c6`), R4-13 (`e5432a5`), R4-06 (`af67021`), R4-09 (`c5ce029`),
  R4-05 (`20307eb`), R4-01/R4-02/R4-08 (`22cbdca`), docs (`78743a8`, `c206a4e`).
- Part 3: R4-10 (`1311557`), R4-11 (`3d8d4b6`), R4-12 (`fec0c03`).

Part 4 scope: resolve the one spec that contradicted a shipped round-four contract, run the FULL Chromium
gate on the frozen revision, self-review the whole round-four diff, record the round, push to PR #9 and
refresh the handoff. No merge, no release, no tag, no npm publication, no force push, no rebase.

## Result summary

| Item | Result |
| --- | --- |
| R4-09 e2e contradiction (`e2e/authoring-layer-group.spec.ts`) | migrated to the shipped rule — 6/6 PASS |
| Second contradiction found by the gate (`e2e/workflow.spec.ts` play/pause) | migrated — 12/12 across 3 repeats |
| FORMAL SELF-REVIEW of the whole round-four diff (`14035e3`..HEAD) | **no product defect**; one observation, recorded below |
| FULL Chromium suite on the frozen revision, `--retries=0` | run 1: 378 passed / 1 failed (the documented flake); run 2: **379 passed, 0 failed, 0 flaky** |
| The documented flake, isolated | 9/9 PASS, `worstDelta=0.000px` — not reproducible |
| `workflow.spec.ts` failure, isolated before the migration | 3/3 FAIL — deterministic, not a flake |
| PR #9 | OPEN, not merged (see the PR section) |

---

## 1. The contradicting spec: `e2e/authoring-layer-group.spec.ts:113`

**The contradiction.** The spec `the frame never intercepts the pointer: a click inside it still selects
the layer` grouped two layers, then clicked the child's canvas geometry and asserted the **child** became
primary (`Beta`). The round-four contract shipped in `c5ce029` says the opposite: a first canvas click on a
child of a group **targets the outermost group container**; the child becomes primary only through an
EXPLICIT drill-in (a canvas double-click or a click on the child's row in the timeline Outliner).

**Why the spec was wrong, not the product.** The spec and the entire selection path were unchanged since
`c206a4e`, i.e. the assertion had been written against the pre-`c5ce029` behaviour and simply went stale
when the new rule shipped. The new rule is the correct one: it is what makes a group grabbable with one
click without ungrouping, and it is pinned independently by `e2e/group-interaction.spec.ts` (the same
`c5ce029` commit). This is the same class as the round-3 spec migrations in `91f9fde`: the product
requirement was reversed deliberately, and the spec had to follow it.

**The migration (coverage moved, not dropped).**

- The plain click now asserts the shipped rule: the child's canvas geometry is clicked and the
  `.actor-node.primary-selected` row must read `Group`, with the container's frame still drawn
  (`group-aggregate-box` = 1, `transform-gizmo` = 1) — i.e. the first click never draws a child selection.
- The drill-in is asserted as the way the child becomes primary: a canvas double-click on the same element
  must make `.actor-node.primary-selected` read `Beta` **and** the container frame must be gone
  (`group-aggregate-box` = 0, `transform-gizmo` = 1) — evidence the selection left the container and
  entered the child.
- The spec's ORIGINAL intent — "the decorative frame must never intercept the pointer" — is preserved and
  made explicit: before any click, `document.elementFromPoint` at the child's own centre must resolve to a
  node inside `[data-part-id="b"]`. That is a direct assertion that the aggregate overlay is not on the
  pointer path, which the old form only implied.

The test name was updated to say what it now pins (`… a click targets the group and a double-click drills
in`). No assertion was deleted, weakened, skipped or retried.

**Evidence.** `CI=1 PORT=5012 npx playwright test e2e/authoring-layer-group.spec.ts --retries=0` → **6
passed**, including the migrated case.

## 2. The second contradiction, found by the gate: `e2e/workflow.spec.ts`

The full-suite gate caught a second spec of the same class, which is recorded here because it is a
round-four change (R4-15) that a spec contradicted.

**Symptom.** `Phase 6.4 E2E Workflows › Create a new project, add parts, edit, and play` timed out waiting
for `getByTitle('Pause')`.

**Diagnosis (measured, not assumed).** The spec played the sequence, slept a fixed `1000 ms` and then
clicked Pause:

```ts
await page.getByTitle('Play', { exact: true }).click();
await page.waitForTimeout(1000);
await page.getByTitle('Pause', { exact: true }).click();
```

A fresh editor document is **60 frames at 60 FPS = exactly 1.000 s**. R4-15 replaced the cadence-driven
loop (one authored frame per `requestAnimationFrame` callback, which at 60 Hz took *slightly more* than
1 s because an occasional tick was skipped) with **elapsed wall-clock integration**, so the sequence now
finishes at exactly 1.000 s. The spec's fixed 1 s wait therefore lands on the FINISHED state: `isPlaying`
is already `false`, the transport has flipped back to `Play`, and `Pause` is never observed. The product
is right — a 1-second animation taking 1 second is the whole point of R4-15 — and the spec encoded the old
slower cadence.

**Reproduction.** `CI=1 PORT=5012 npx playwright test e2e/workflow.spec.ts --repeat-each=3` → **3/3 FAILED**
before the fix. Deterministic, not load-sensitive.

**Migration.** The duration-dependent sleep is gone; the spec now asserts the transport through both
states, which is strictly stronger than "click the thing that should be there":

```ts
await page.getByTitle('Play', { exact: true }).click();
await expect(page.getByTitle('Pause', { exact: true })).toBeVisible();
await page.getByTitle('Pause', { exact: true }).click();
await expect(page.getByTitle('Play', { exact: true })).toBeVisible();
```

**Evidence.** Same command after the fix → **12 passed** (3 repeats × 4 tests).

Not touched: the six `e2e/track-matte.spec.ts` play/pause samples. They sleep 1500–1800 ms inside a seeded
`fps: 30, totalFrames: 90` document (3.0 s), so their waits are sampling points well inside playback and
their assertions are unchanged; they passed on every run.

---

## 3. Formal self-review of the whole round-four diff (`14035e3`..HEAD)

Audited as one body of change, with the evidence cited. **Verdict: no product defect found.** One
observation is recorded below and deliberately NOT changed.

| # | Audit item | Verdict and evidence |
| --- | --- | --- |
| 1 | `pointerup` always terminates a key move | **OK.** `SequencerTimeline` registers `pointerup`, `pointercancel` and `lostpointercapture` on `window` **once for the component's lifetime** (never gated on a render-time flag) and reads the live gesture from refs, so the release cannot be missed; `pointermove` with `buttons === 0` is a third net for a release delivered outside the window. `endTimelineGesture` is idempotent, and `endBatchInteraction` is a no-op when no transaction is open. The ruler scrub owns its own pointer id and refuses a second pointer. |
| 2 | timeline `Delete` cannot delete layers accidentally | **OK.** `useKeyboardShortcuts` branches on `ownsShortcutScope('timeline')`: while the focused element lives inside the element carrying `data-shortcut-scope="timeline"` (the timeline footer holding the focusable diamonds and outliner rows), the command resolves keyframes only and returns; the layer path is unreachable. A selection the document no longer honours writes the same array back, so no history entry is recorded and the key is still consumed. |
| 3 | sparse ungroup maintains pose AND avoids key explosion | **OK.** Pose parity is asserted against the evaluator (`expectSamePoses` / `expectSameEvaluatedPose`, tolerance 1e-9) and key counts are asserted too: a travelling container yields `x = [0, 10, 20]` and `[0]` for `y`/`rotation`/`scaleX`/`scaleY` (**7** keys per child where the replaced rule wrote 21 per channel = **105**); a position-only container yields `[0, 12, 30]` for `x`/`y` and `[0]` elsewhere (**9**); a rotation-mixing container keeps `x`/`y` dense (genuinely required) while `rotation`/`scaleX`/`scaleY` carry `[0, 8, 20]`, with the total asserted `< 60`. Any channel still needing the dense fallback records a `bakeNotes` reason instead of passing silently. |
| 4 | group hit target uses the child-geometry union, not the aggregate AABB; child drill-in remains possible | **OK.** No aggregate hit rectangle is rendered: parts are hit-tested per child, so a point on no child's geometry never reaches the resolver (the empty gap clears the selection, pinned by e2e). `getSelectionFrameBounds` is unchanged and for a group is the children's live aggregate. Both drill-in paths exist and are asserted (`onDrillIn` via canvas double-click; the Outliner row). |
| 5 | Bind UI removal does not corrupt legacy documents | **OK.** `utils/partBinding` is untouched and remains the one bond authority; a document carrying `boundPartIds` still loads, moves its bonded layers together and round-trips on export; `e2e/layer-binding.spec.ts` authors the bond into the seeded document and still proves movement, the preserved bond and the parented world-delta. **Observation:** after the strip removal, `usePartBindingAuthoring` has no production consumer; it stays exercised by `src/tests/authoringAuthorities.test.tsx`. Deleting it would change the hook surface and is a separate decision outside this round — reported, not changed. |
| 6 | shortcut collisions and input-focus safety | **OK.** `src/utils/shortcuts.ts` is the single keymap; gestures match modifiers EXACTLY (so `g` never fires for `mod+g`), no gesture is shared by two commands in the same scope, and the global resolver filters to `global`/`canvas` so the `timeline`-scoped bindings cannot be double-dispatched. The handler tests `isBlockingModalOpen()` first and `isEditableElement(document.activeElement)` second, so a blocking dialog or a text field owns the keyboard. |
| 7 | history batching preserves separate discrete actions | **OK.** Every continuous gesture (colour, slider, value graph, cubic-bezier handles, mask-path vertices, canvas drag) opens ONE transaction on the press and closes it on release / cancel / lost capture through the existing `startBatchInteraction` / `endBatchInteraction` authority; a discrete action (a keyboard step, a separate press) stays its own entry; a panel or timeline resize never enters document history. `endBatchInteraction` outside a transaction does nothing, which makes the unconditional global `pointerup`/`mouseup` ends safe. |
| 8 | GIF timing explicit and matching the timebase | **OK.** `resolveGifFramePlan` converts through `timebase`'s `frameToSeconds`/`secondsToFrame`; every delay is a whole centisecond `>= 1`; the plan exposes both `durationSeconds` and `authoredDurationSeconds`; the e2e decodes the produced bytes (`GIF89a`, 12 frames, delays summing to 50 cs for a 0.5 s document at 24 FPS). |
| 9 | ZIP portable paths and central directory | **OK.** A reader written for the test decodes the end-of-central-directory record and every central-directory entry; names are relative forward-slash paths with no drive letter, traversal or backslash; methods are stored/deflate; each local header agrees with its central record; CRCs are non-zero; the declared count matches; no entry sets the UTF-8 name flag. Cross-checked by fflate, Info-ZIP `unzip`, bsdtar/libarchive, Python `zipfile` and PowerShell's .NET `ZipFile`. |
| 10 | OGraf duration independent of monitor refresh | **OK.** The GIF/timebase hook integrates elapsed wall-clock time, resets `lastTimeRef` at the start of playback, carries the sub-frame remainder across callbacks, and clamps the end pose; the monitor refresh rate cannot change the authored duration, and a dropped callback recovers the time it lost. |
| 11 | cache fix separates code freshness from saved-project persistence, no production caching degradation | **OK.** The `kcs-dev-document-freshness` plugin is `apply: 'serve'` (dev only) and narrows to the document (`/` and `*.html`), re-pinning `Cache-Control: no-store` at the write because Vite sets its own header afterwards; production assets keep their immutable hashed caching and the plugin never runs in a build. `retireStaleDevServiceWorker` runs only under `import.meta.env.DEV` and is a no-op where the API is absent. The distinction from persistence is stated in `src/utils/devFreshness.ts`: the restored autosaved document is persistence, a separate axis from code freshness. |
| 12 | toolbar duplicates no command implementation | **OK.** The strip owns no state and no command copy: grouping runs `createLayerGroupingActions` (the very factory the provider builds the keyboard commands from), order goes through the shared z-index write path, view commands through the shared `canvas-viewport-command` channel, tools/grid through the animator context. The six command bands are `role="group"` and the uniform hitbox/glyph size is pinned by the toolbar e2e. |

Result: **no fix was required by the review**; the only self-review action item was the two spec
migrations in §1 and §2, both of which are spec-vs-contract alignments that the gates forced.

---

## 4. Full validation on the frozen revision

Isolated ports only (`PORT=5012` → API 5012, UI 5188/5189/5187 per gate); `npm run dev` was never used;
5173/5000 were never bound, stopped or restarted.

| Command | Result |
| --- | --- |
| `npx tsc -b --pretty false` | clean |
| `npm run lint` | clean |
| `npm test` | **163 files / 2438 tests** passed, 0 failed, 0 skipped |
| `npm run build` | built |
| `npm run validate:ograf` | valid OGraf v1 manifest |
| `PORT=5012 npm run qa:release` | 2 passed (candidate SHA `fec0c03`) |
| `PORT=5012 npm run qa:v6` | 3 passed |
| `npm run check` | green (lint + tsc + 2438 tests + build) |
| `node scripts/check-state-consistency.mjs` | PASS (46 checks) |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | clean |
| `CI=1 PORT=5012 npx playwright test e2e/authoring-layer-group.spec.ts --retries=0` | 6 passed (migrated case included) |
| `CI=1 PORT=5012 npx playwright test e2e/workflow.spec.ts --retries=0 --repeat-each=3` | 12 passed |
| **FULL Chromium** `CI=1 PORT=5012 npx playwright test --retries=0` (run 1) | 378 passed / **1 failed** — `camera-transition-stability.spec.ts:238` |
| **FULL Chromium** `CI=1 PORT=5012 npx playwright test --retries=0` (run 2) | **379 passed, 0 failed, 0 flaky** |
| `CI=1 PORT=5012 npx playwright test e2e/camera-transition-stability.spec.ts --retries=0 --repeat-each=3` (isolated) | **9 passed**, `worstDelta=0.000px` |

### The single caveat (reported, NOT suppressed)

Run 1 failed one test: `e2e/camera-transition-stability.spec.ts:238 › repeated chrome toggles never drift
the world on any frame`.

- The assertion that failed: `repeat Show Inspector: frame 13 t=264.9ms alpha x drifted -14.859px (stage
  996.2px)`, against the spec's per-frame stability bound of `<= 1 px`.
- It is the SAME load-sensitive flake a previous round recorded and could not reproduce. It appears only
  under the load of the 379-test full suite (during the tail of a 240 ms layout transition, a sampled
  frame measures the still-animating geometry).
- In isolation it is **green 9/9** with `worstDelta=0.000px`, and the immediately repeated full-suite run
  was **379 passed / 0 failed / 0 flaky**.
- Per instruction, the spec was **not** touched: no tolerance was raised, no retry added, no sleep
  inserted, no assertion weakened. It is reported here as the run-1 caveat and is the only failure seen on
  the frozen revision.

---

## 5. Round-four record: root cause → fix → evidence per finding

| Finding | Root cause | Fix | Evidence |
| --- | --- | --- | --- |
| R4-01 side-panel handles could be pushed over the timeline | 26×48 px handles anchored at the viewport's vertical centre | compact 20×46 px edge-handle family, children of the workspace row, pinned to one shared inset below its top edge | `e2e/timeline-workspace.spec.ts` geometry at min/default/max timeline heights + window resize |
| R4-02 outliner divider visual | filled bar + glow, off-language | compact centred pill, neutral at rest, accent on hover/drag, transparent hit strip | `e2e/timeline-workspace.spec.ts` rest/hover paint assertions |
| R4-03 a release could be missed and leave the drag armed | mouse-only gesture, listeners in a passive state-gated effect, no pointer capture/cancel | pointer gesture in refs, listeners registered once for the lifetime, capture on the pressed element, `pointerup`/`pointercancel`/`lostpointercapture`/buttons-0 move all end it | `e2e/timeline-keyframe-gesture.spec.ts` |
| R4-04 delete was single-key and could reach the layer path | single-id mutator | whole-selection set delete in one document write; timeline scope makes it keyframe-only | `src/tests/trackMutations.test.ts`, `src/tests/useTimeline.test.ts`, the timeline-scope e2e |
| R4-05 keyframe arrow semantics + missing property-level controls | per-layer arrows only; policy implicit | `resolveChannelKeyframeFrames` + the stated 0/1/2+ never-wrapping policy at both levels; per-property `[◀][+][▶]` | `src/tests/timelineMetrics.test.ts`, `e2e/timeline-property-navigation.spec.ts` |
| R4-06 redundant `Transform` wrapper row | an extra tree level | layer row is the owner; row-for-row lane alignment kept | `e2e/timeline-workspace.spec.ts` (R2-09 selector), tree-ownership tests |
| R4-07 ungroup flooded the timeline | unconditional dense per-frame bake | sparsest representation that still evaluates exactly; dense fallback recorded as a `bakeNote` | `src/tests/layerGrouping.test.ts`, `src/tests/ungroupBake.test.tsx` (counts above, 1e-9 parity) |
| R4-08 connector ran through a hollow glyph | one continuous line | one segment per gap, cleared by `KEYFRAME_GLYPH_GAP_PX = 9`; glyph and hit target unchanged | `src/tests/timelineMetrics.test.ts`, `e2e/timeline-keyframe-glyph.spec.ts` |
| R4-09 a click selected the child, so a group was not grabbable | canvas selected the layer under the pointer | `resolveStageSelectionTarget`: outermost group ancestor on both entry points; explicit drill-in (double-click / Outliner) | `src/tests/layerGrouping.test.ts`, `e2e/group-interaction.spec.ts`, and the migrated `e2e/authoring-layer-group.spec.ts` (§1) |
| R4-10 toolbar structure + Bind entry | unannounced bands, a partition command in the strip | six announced `role="group"` bands, one hitbox/glyph token; Bind/Unbind removed from the strip with the bond model untouched | `e2e/authoring-toolbar.spec.ts`, `e2e/layer-binding.spec.ts` |
| R4-11 shortcut collisions + a Delete scope bug | ad-hoc key handling; Delete could reach the layer path from the timeline | one keymap authority, exact-modifier matching, the three guards, the timeline scope | `src/tests/shortcuts.test.ts`, `src/tests/useKeyboardShortcuts.test.ts`, `e2e/keyboard-shortcuts.spec.ts` |
| R4-12 GIF export | no export path existed | hand-written GIF89a encoder over the existing SVG render stack, no new dependency, timing through the timebase | `src/tests/gifEncoder.test.ts`, `src/tests/gifPlan.test.ts`, `e2e/gif-export.spec.ts` |
| R4-13 exported ZIP portability | unverified; a stray separator on an accented title | structural reader + four extractors; `foldDiacritics` removes the combining mark | `src/tests/ografZipPortability.test.ts` |
| R4-14 one history entry per pointer sample | unbatched continuous gestures | one transaction per gesture on the existing batch authority | `src/tests/continuousGestureHistory.test.tsx` |
| R4-15 playback was cadence-driven | one authored frame per `requestAnimationFrame`, so a 120 FPS authoring played at half speed on a 60 Hz display and a stalled callback lost its interval | elapsed-time integration in `src/utils/timebase.ts`; fractional rates documented as unsupported | `src/tests/projectTimebase.test.ts`, and the spec migration in §2 |
| R4-16 stale dev preview | misdiagnosis risk | dev-only `no-store` on the entry document + a dev-only service-worker retirement guard | `src/tests/devFreshness.test.ts` |

---

## 6. Push, PR #9 and CI

- Pushed normally with an explicit refspec (`git push origin HEAD:refs/heads/fix/manual-qa-round1-remediation`).
  **No force push, no rebase, no history rewrite.**
- PR **#9** — OPEN, **not merged** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`,
  base `main`.
- Exact head SHA, mergeability and CI run id/conclusion: recorded in
  `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` (refreshed after the push).

## 7. Live surfaces (never touched)

- UI `http://localhost:5173/` — HTTP **200**, served from THIS worktree: the listener is
  `node ... keyframe-character-studio-omp-manual-qa-r1\node_modules\.bin\..\vite\bin\vite.js --host --port 5173`
  (pid **50876**), `/src/utils/timebase.ts` (a module that does not exist on `main`) answers 200,
  `src/utils/shortcuts.ts` and `src/export/gifEncoder.ts` carry the round-four markers, and the dev document
  answers `Cache-Control: no-store` (the R4-16 plugin live).
- API `http://127.0.0.1:5000` — pid **18280** (`server/index.js`), unchanged, `/api/health` **200**.
- No test run bound, stopped or restarted either one.

## 8. Guardrails respected

No merge of PR #9, no tag, no release, no npm publication, no force push, no rebase, no `reset --hard`, no
`git clean`, no branch deletion; no package/dependency/lockfile change (R4-12 added no dependency —
`package.json` and `package-lock.json` are byte-identical to `14035e3`); no OMP global config change; the
canonical repo and every other worktree untouched; `.hermes/desktop-attachments/` untouched.

## 9. Not done (explicit)

- PR #9 was not merged (user-retest-gated), and nothing was released, tagged or published.
- No production source change was made in part 4: this part is the round's gate, record, PR update and
  handoff. The only files it changed are the two migrated specs and the documentation/handoff.
