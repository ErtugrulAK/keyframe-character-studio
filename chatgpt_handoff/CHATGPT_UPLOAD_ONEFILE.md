# KCS — PR #11 Main Integration + Mode-Swap Fade Fix

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.

This record supersedes the earlier remediation bundles for delivery: the PR #9/#10/#11 lineage is integrated into main and the gate-caught fade regression is fixed. Historical reports and root mirrors remain under latest/ unchanged; they are not repeated here.

## README.md

# PR #11 Main Integration + Mode-Swap Fade Fix Handoff

This task-specific bundle carries the MAIN INTEGRATION round: the user-approved fast-forward integration of the PR #9/#10/#11 UI lineage into `main`, the merge-gate regression it surfaced, and the targeted fix delivered above it.

## Current engineering record

- Repository: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`; integration validated in the detached worktree `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.worktrees\main-2b14fa5` (full dependency install, own runtime SQLite DB).
- Status: **MAIN INTEGRATED — GATE GREEN ON CODE HEAD `73fc000` — 5173 CUT OVER TO THE CANONICAL `main` CHECKOUT.**
- `main` is at or after `73fc000`, matching `origin/main`; the documents-only record rides above the gate-tested code head. No merge commit, no rebase, no force push.
- Release tags `v1.1.0-rc.1` and `v1.1.0-public-controls` are unchanged; no npm publication. PR #9/#10/#11 handles are untouched.
- `OMP_FINAL_RESPONSE.md` carries the integration addendum (root cause, bisect, fix design, gate ledger, canonical sync disclosure); `reports/progress_176_main_integration_mode_swap_fix.md` is the round record.

Local gates passed (code head `73fc000`, 2026-10-16): tsc/lint/build clean; unit 173 files / 2602 tests; `timeline-marquee` 6/6 twice in isolation (workers 1, retries 0); `npm run qa:release` passed for the candidate SHA; FULL Chromium **436 passed / 0 failed / 0 flaky** (workers 8, retries 0, isolated UI 5188 / API 5017; live API 5000 never touched). Earlier rounds on this lineage keep their records: V3.7 2601/436, V3.6 2599/426, first round 2598/415.

## Record precedence

The integration addendum in `OMP_FINAL_RESPONSE.md`, the manifest and `progress_176` are the current task authority. The remediation records retained here are historical snapshots or exact mirrors of root documents; their old validation counts, canonical-position claims and next-session narratives are context, not current state.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. The one-file is regenerated from this scoped handoff before delivery; do not upload individual bundle files.

---

## OMP_FINAL_RESPONSE.md

# PR #11 Combined Manual QA Remediation

## Scope and protected boundaries

Worktree: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-combined-qa`.
Branch: `qa/pr9-pr10-combined`. Starting head: `784a8c235372f6f984f32e744894bfbb3c086f80`.
Only the approved findings are addressed. No merge, release, tag, npm publication, rebase, force push, branch deletion, dependency change, workflow change, or API 5000 restart.
PR #9 remains OPEN at `fac2bc191724165540cf0f7cc53b7941d737919d`; PR #10 remains OPEN at `74603dea5f57d1d586e3ec8c97bf09c304c4ca8a`. Neither history was changed.

## UI polish V3.6 addendum — 2026-10-15

Supersedes §5 (command naming/order), §6 (panel copy) and §9 (row density) of this record. The user's combined-round retest produced nine UI findings, fixed and browser-measured before/after on the same branch (full detail: `reports/progress_174_combined_pr9_pr10_ui_polish_v36.md`):

1. **Draw cursor.** Armed primitives set `drawing-tool` on the stage container; CSS owns the crosshair (container + svg); Escape/tool-switch returns `default` in the same paint. Measured `default→crosshair→default`.
2. **Dock width contract.** One token block on `.app-container` (rail 56 / drawer 304 / inspector 372) replaces five scattered declarations incl. the theme's hard 280px drawer line; dock handles derive from the same tokens. Measured 280→304 and 360→372 with the handles still boundary-centred.
3. **GIF panel.** Footer Close, the note paragraph and the Format-limitations details removed (X/Escape/outside-press unchanged); the 20 ms sampling fact moved to the frame-rate select tooltip, transparency/text-font facts to the Export button tooltip. Summary (frames/duration/size) stays visible.
4. **Toolbar command set.** Align band in the required order — Align Left/Right/Top/Bottom, Center (both axes, one undo), Center Horizontally/Vertically (one axis each) — and exactly one gap-based Distribute per axis. The confusing centre-spacing distribute duplicate left the UI; the pure `planDistribute` authority stays (documented policy test), the hook's dead arm was deleted. Labels are exact; no menu hop on desktop.
5. **Corner resize.** `isScaleLocked` defaults false and the corner drag solves `uniform: isScaleLocked !== e.shiftKey`: free non-uniform by default (pointer X→scaleX, pointer Y→scaleY), Shift = uniform for one drag, the Inspector glyph = persistent option; groups ride the same branch. Four new browser tests pin default-free, Shift-uniform, locked-uniform, locked+Shift-free and a free group corner drag.
6. **Select focus.** `select` is always `:focus-visible` in Windows Chromium, so the KCS teal ring is pinned explicitly (`select:focus{outline:none}` + important teal `:focus-visible`): the white 3px browser ring is gone in both focus paths; buttons/inputs keep pointer-clean behaviour.
7. **Mode segment.** Three stacked CSS generations (glowing text-shadow, bouncing bright indicator bar, keyframes) and inline markup styles replaced by one definition: bordered rail, sliding indicator, unmistakable pressed half, no glow anywhere; `aria-pressed` semantics unchanged.
8. **Shortcut Reference.** Rows became `grid: minmax(0,1fr) auto` with 22px keycaps and inline detail/scope chips; names/details are one line with ellipsis and the full sentence in the row tooltip. Measured max row height 124px→31px (before: uniform 47px), 28 rows intact.
9. **Restore provenance (LAN).** `useSerialization` exposes `restoredFromLocalStorage` (set only when the startup autosave restore fills the document; cleared by import/reset), the context carries it, and the header shows a neutral chip "Restored from this browser's autosave" — the case that matters when the other PC opens the editor over the LAN and localStorage differs per origin.

Gate on the V3.6 head: tsc/lint/build clean; unit 173 files / 2599 tests; FULL Chromium **426 / 0 failed / 0 flaky** on the isolated QA config (UI 5188; live API 5000 never touched). New permanent pin: `e2e/ui-polish-v36.spec.ts` (8 tests); five existing specs migrated to the new contracts instead of re-pinning removed UI.

V3.6 retest (in addition to the 12 items above): (a) draw with a rectangle tool — crosshair, preview under it, Escape restores; (b) corner-drag a group freely, then with Shift — uniform; (c) click a select — teal ring, no white; (d) toolbar order/names vs the list; (e) GIF panel footer single button + tooltips; (f) mode segment visual; (g) shortcut density; (h) chip visible on a restored project, gone after Reset.

## Final micro-polish V3.7 addendum — 2026-10-15

The user's V3.6 retest passed six surfaces and rejected the residual polish items; this round implements exactly the approved six, presentation and structure only — no behaviour, no feature, no timeline/mask/matte work, no merge. Full record: `reports/progress_175_pr11_final_micro_polish_v37.md`.

1. **Toolbar grouping.** Align (four edges) / Center (three) / Distribute (two) / Rotate-Flip (four) are four announced groups behind the compact separators; the shared `ArrangeButton` keeps one copy of the command-button markup. The both-axes `Center` glyph is the four-arrow centred target (`Move`, no circle), distinct from both one-axis centre icons. Same commands, same order, same authorities; no dropdown.
2. **Left rail + handles.** Rail items 42px tall, 18px icons on one optical scale, one 10px/500 label voice (no wrap), active = light teal surface + 2px accent bar (the translateX nudge deleted). Collapse handles are quiet boundary-flush tabs (panel surface + hairline border, unified radius) across left/right/timeline members. Widths untouched: the 56/304/372 token contract stands.
3. **Focus visual.** One authority: keyboard `:focus-visible` is a 2px teal ring at `outline-offset: -2px` — inside the box, never an outer frame; the select keeps its explicit always-inset statement; seven scattered positive-offset component rings were folded in. Pointer focus stays clean; nothing lost its indicator.
4. **Mode transition.** Entering a mode fades the incoming chrome (toolbar, docks, timeline/Live-Director swap) through one `kcs-mode-enter` keyframe: 180ms ease-out, opacity + 3px paint-only translate, `prefers-reduced-motion` → none. No React timers; the stage never animates (it stays mounted); rapid switching restarts the CSS animation and the edit camera returns to the identical reading (polled, exact).
5. **Shortcut Reference.** A dense single-column reference sheet: slim header with search, hairline category bands (no card boxes), command left / keycaps right on one ≤34px line, full explanations in the row tooltip, short-window scroll preserved, Windows/macOS display from the one `utils/shortcuts.ts` table.
6. **GIF sampling verified, not guessed.** 120 FPS is the sampling grid; the encoder honours the GIF centisecond floor. Measured through the real plan + real writer + independent byte reader: 0.50s → 25 frames / 50 cs, 1.00s → 50 / 100 cs, 2.00s → 100 / 200 cs — the reported "100 frames at 120" was the mathematically correct 2s row, so no functional fix was warranted. The control is renamed **Sampling rate**; the existing tooltip answers the presentation-rate question; no explanatory footer returned.

Gate on the V3.7 head: tsc/lint/build clean; unit 173 files / 2601 tests; FULL Chromium **436 / 0 failed / 0 flaky** (workers 8, retries 0, isolated UI 5188 / API 5017; live API 5000 untouched); state consistency 56 checks; audit 0. New pins: `e2e/micro-polish-v37.spec.ts` (8 tests — band separation, glyph distinctness, rail compaction + restraint, inset keyboard ring vs clean pointer focus, crossfade + reduced motion, rapid-switch camera identity, sheet layout, handle family) and three parameterised 120-sampling rows in `e2e/gif-export.spec.ts`.

Final user retest (6 items): (1) toolbar grouping + Center icon acceptable; (2) rail buttons and both collapse handles look cleaner; (3) no outer focus frame, Tab still visible as a subtle inset ring; (4) Edit ↔ Broadcast transition smooth, no stage/camera jump; (5) Shortcut Reference compact/readable; (6) GIF 0.5s/1s/2s at 120 shows 25/50/100 frames with 0.50/1.00/2.00 s total. If these pass: STOP polish — PR #11 is ready for a separate MAIN INTEGRATION + VERSION CHECKPOINT task. **NO MERGE in this task.**

## Main integration addendum — 2026-10-16

The user approved continuing the MAIN INTEGRATION task with a targeted fix for the failure this task's own merge gate surfaced. Full record: `reports/progress_176_main_integration_mode_swap_fix.md`.

Integration: the PR #9/#10/#11 UI lineage (branch `qa/pr9-pr10-combined`, V3.4 manual-QA rounds through the V3.7 final micro-polish, head `2b14fa5`) was integrated into `main` by fast-forward-only pushes; `main` is at or after `73fc000`, matching `origin/main`. No merge commit, no rebase, no force push; tags unchanged; no npm publication; PR handles untouched. Validation ran in the isolated detached worktree `.worktrees/main-2b14fa5` under the canonical repo root, with its own `npm ci` install and runtime DB.

Regression the gate caught and the fix: two `timeline-marquee` specs failed deterministically on `2b14fa5` while the V3.6 head `d972a24` was 6/6 green — commit-bisected to the style-only commit `4774b5f`. Measured cause: the `kcs-mode-enter` chrome fade is a mount animation, so it also played on the app's first paint; during it the timeline's playhead-follow scroll fired against the unsettled initial layout (clicking the frame-40 key scrolled the grid `scrollLeft` 0 → 711) and the marquee press landed outside the grid (elementFromPoint: `.ue-outliner-list`). Fix `73fc000` keeps the fade as the transition it was designed to be: `useBroadcast` raises `modeSwapActive` only on a real Edit ↔ Broadcast change, the app shell carries `kcs-mode-swap` on `.app-container` while it is set and lowers it on the enter animation's own `animationend`, and the CSS animation plus the reduced-motion exemption are scoped under that class. No timer, no playhead-logic change, no test-coordinate change, no sleep/skip/retry/tolerance hack; the 180 ms fade is visually identical. Behaviour proof: computed `animationName` `none` on first mount, `kcs-mode-enter` on both swap directions, class lowered after the animation. New permanent pin in `src/tests/useBroadcast.test.ts`.

Gate ledger on code head `73fc000`: tsc/oxlint/build clean; unit 173 files / 2602 tests; `timeline-marquee` 6/6 twice in isolation (workers 1, retries 0); `npm run qa:release` — release gate passed for the candidate SHA; FULL Chromium 436 passed / 0 failed / 0 flaky (workers 8, retries 0, isolated UI 5188 / API 5017; live API 5000 never touched).

Canonical sync supersedes the 8e2df61 position claim and the metadata-only dirty-STOP exception stated above: the `matte.ts` marker was proven content-free (HEAD/index/worktree blob all `96d0b4ad2bed3326f8ff4f8e5df552c2ec93a3b5`), the stale index was rebuilt from HEAD (metadata-only), and the approved fast-forward checkout resolved the marker; canonical main/origin/main carry the delivered head and the tracked tree is clean. The untracked local research file on the canonical tree is the user's and was not touched. Live surfaces: 5173 now serves the canonical `main` checkout; API 5000 (listener 2308) was never restarted.

## Findings, root causes, and fixes

### 1. Persistent primitive creation

The StageCanvas mouse-up completion cleared the armed creation tool. Completion now retires only the current gesture/preview. Rectangle, Square, Circle, Triangle, Star, Rhombus, Parallelogram and the shared primitive path remain armed; Escape or another tool exits. Each completed shape keeps its own existing history transaction. Free Draw retains its separate multi-vertex Enter/double-click commit and Escape-cancel lifecycle.

### 2. Property channel semantics

Legacy composite projection created apparent child-property keys from unchanged full poses. The canonical legacy-to-channel conversion now uses the owned authored base pose: moving channels and held overrides different from that base survive, while provably unchanged composite fields do not become authored channels. Explicit canonical held keys are never pruned. Static full-hold scopes and unknown-base legacy data remain intact.

Evaluation, migration, import/export, timeline projection, navigation and authoring use the same conversion. Untagged legacy keys and explicit `Sequence` keys share one semantic scope during conversion/deduplication, preventing interpolation loss after reload. Position/X/Y reflect the actual canonical channel keys; Rotation, Scale and Opacity no longer inherit aggregate keys. Explicit Rotation keys remain independent. Layer aggregate navigation follows the real projected frames. The existing **Add Composite Keyframe** command intentionally still captures the full pose; it is not a Position-only command. Inspector edits do not create a second keyframing authority.

### 3. Rotated-child group resize

The old scalar TRS fold applied group anisotropic scaling along a rotated child's local axes. For an old group box and new group box, the resize uses the existing solve-frame mapping: `p_new = anchor + diag(sx, sy) * (p_old - anchor)`. The fixed opposite edge/corner is the anchor. Every child world matrix is `W_child = W_parent * L_child`; the shared affine inverse maps world edits back into the original parent space.

A 90-degree child can exchange the scale-axis reading, but an arbitrary 30-degree child under unequal world-axis scaling generally produces shear. The user explicitly approved extending the existing transform authority to represent this exactly. A derived affine matrix is carried through evaluation, rendering, geometry/bounds, hit interaction, selection/gizmos, masks/mattes, boolean/freeform geometry and OGraf runtime output. No new persisted transform field or parallel resize engine was introduced; authored local rotation is preserved. World x/y denote the actual affine origin. Inspector and bonded edits share the canonical world-to-local conversion and a correctly rebuilt post-edit parent matrix, avoiding double movement/stale affine state.

Regression coverage includes 90/30-degree children, nested groups, negative scales, horizontal/vertical/corner transforms, fixed opposite anchors, undo/redo, and deep sheared-parent inspector/bonded edits. The corner browser oracle now independently multiplies fixture matrices instead of repeating the obsolete TRS assumption; existing tolerances are unchanged.

Production review also found that serializing individual affine helpers with `.toString()` leaked minified outer identifiers into exported OGraf modules (`ReferenceError: Lt is not defined`). All existing affine functions now come from one self-contained `createWorldAffineAlgebra` factory, embedded as a whole in runtime output. An in-memory real production-minification regression checks independently known deep affine geometry. Actual built-UI export/host smoke loaded `graphic.mjs` with status 200, painted one layer, and matched the serialized world origin exactly.

### 4. Snap-guide invariant

The snap resolver now returns the committed line and the perpendicular extent covering the moving and target bounds. A stage-reference guide spans the relevant moving band instead of an arbitrary full canvas. StageCanvas renders the same resolved geometry in editor coordinates in the same drag update as the snapped transform. X and Y remain independent; switching candidates, unsnapping and mouse-up retire the corresponding guides. Thin accent guides remain pointer-events none.

Invariant: a resolved authored-axis correction has its corresponding rendered guide; guide position and extent come from that result, not a separately recomputed candidate. Tests cover result-to-render geometry, both axes, stage references, switching and cleanup. A pre-existing browser helper issued zoom keys faster than the camera commit; it now waits for the observed DOM zoom after each action, without sleeps, retries or threshold changes.

### 5. Direct toolbar and distribution naming

Normal desktop shows direct Align Left / Horizontal Centers / Right / Top / Vertical Centers / Bottom, Distribute Horizontal / Vertical, Rotate CCW / CW, and Flip Horizontal / Vertical buttons. There is no normal-desktop Align/Distribute dropdown. Center Horizontally / Vertically retain the existing center-based distribution policy under explicit names. Distribute Horizontal / Vertical retain equal visual edge-gap policy; no behavior/name swap.

Existing world visual bounds, group aggregates, outer-span preservation and one-undo distribution authority remain. Different sizes and rotated layers retain correct geometry. The toolbar fits measured 1280px and 1440px desktop widths without horizontal overflow.

### 6. GIF panel and 120 sampling

The compact dialog uses the existing floating-panel outside-press authority, viewport max-height/scrolling and a collapsed format disclosure. Inside clicks keep it open; outside clicks and Escape close it. Export cancellation on unmount remains intact. The measured dialog height changed from 304.625px to 259.875px.

120 FPS is a **sampling-grid option**, not a claim that GIF viewers present at exact 120 FPS. GIF delays are centiseconds, and Chromium maps delays at or below 10ms to 100ms: https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/graphics/deferred_image_decoder.cc . Emitted frames therefore have at least 2cs delay (at most 50 presented frames/s). The plan uses `totalCS = max(2, round(durationSeconds * 100))`, chooses at most 900 frames and at most `floor(totalCS / 2)`, samples across the complete authored duration on the requested grid, and quantizes cumulative delay boundaries to sum to totalCS. The frame cap no longer truncates long animations. Duration accuracy is the nearest centisecond, with the unavoidable 20ms minimum for extremely short clips. A one-second 120-sampling export is 50 frames / 1.00s, not a sped-up animation. Tests check exact delay sum, long duration/frame cap, and actual downloaded half-second GIF movement and 50cs total delay.

### 7. Inspector keyframing controls

Duplicate Trim Path and mask Add/Remove Keyframe controls and their unused callback forwarding were removed. The Inspector keyframes view is read-only projection/navigation rather than an additional add/delete/frame-timing editor. Value and path editing remain. Animation data is not deleted; timeline/property tree `[previous][add/remove][next]` remains the keyframing authority.

### 8. Routine toasts and panel handles

Routine rotate/flip/align/distribute success toasts were removed; arrange already had no routine success toast. Blocked/unavailable feedback, errors, real warnings and significant export/save feedback remain. The 20x46px sidebar hit targets now straddle the empty panel boundary gutters; panel text/cards are not covered. Existing top anchoring, frame-committed camera motion and overlay/GIF/Export z-index remain unchanged.

### 9. Shortcut Reference

Category cards/icons, stronger category/title/description hierarchy and distinct keycaps replace the flat list. Search/filter and Windows/macOS display continue to consume the single command authority in `src/utils/shortcuts.ts`; category decoration does not duplicate shortcut data. Grid rows preserve content height rather than clipping cards. Actual 1280x540 viewport smoke showed a contained, scrollable dialog, zero clipped cards, and two matches for `flip`.

## Accepted behavior and regression policy

Equal horizontal/vertical visual spacing, snapping-off cleanup, group snapping, ROI/crop Clear/Escape/Apply, camera and timeline contracts are retained. Crop implementation was not changed to solve a misunderstood test procedure. No assertion weakening, retry, arbitrary sleep, skip or camera-tolerance widening was used. Obsolete source-text/mock-wiring tests and absence/one-shot UI assumptions were removed instead of re-pinned. The named-sequence drag test now explicitly exits persistent creation with Escape before testing movement.

## Validation ledger

Observed before final browser gate: `npm run check` passed (lint, TypeScript build, unit tests and production build); 173 unit files / 2598 tests passed. `npx tsc --noEmit` and `npm run validate:ograf` passed. Focused Chromium: 99 passed, zero failures, workers 8 / retries 0. Camera worst delta 0.000px and magnification spread 0.00000; deep corner opposite-anchor drift zero. `npm audit --audit-level=low`: zero vulnerabilities. State consistency: PASS, 52 checks. Production build retains its existing large-chunk advisory.

The first full Chromium run had 413 passed / 2 failed: the named-sequence workflow still assumed one-shot drawing and an older manual-QA test asserted that Align Left did not exist. These obsolete workflow assumptions were corrected while retaining geometry assertions. The final complete run passed **415 / 415, zero failed, zero flaky**, in 3.4 minutes with `CI=1 PORT=5017`, Chromium, workers 8, retries 0. `PORT=5017 npm run qa:release` passed 2/2; `PORT=5017 npm run qa:v6` passed 3/3. These gates exercised the working-tree remediation while HEAD was still the starting 784a8c2 revision; the committed code revision is recorded separately below. Release QA only validated exports; it did not publish a release.

Validated code/tests commit: `679f54f30ee172e08b0d0e94b4561f2a74c87a9f`, pushed normally to PR #11 only. CI Pipeline run [38744301819](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/38744301819) completed successfully, including manifest validation, lint, TypeScript, unit/integration tests and production build. The scoped documents-only refresh rides above this tested code; its final head/CI is reported separately on delivery to avoid a self-referential document hash.

## Live and repository incident disclosure

With explicit user approval, live 5173 was frozen at starting head 784a8c2 in a temporary snapshot while remediation and isolated tests ran. Only after the full local gates and code CI succeeded was that listener stopped and the combined worktree started as persistent service `kcs-pr11-final-qa-5173` (service wrapper 45300, actual listener **48984**). HTTP 200; served source includes the affine factory and direct toolbar from the combined worktree. Actual Chromium smoke found the direct buttons, no page errors, and the compact GIF dialog with selectable 120 sampling and Escape dismissal (259.875px height); the editor screenshot was inspected. API 5000 remains listener **2308**, health HTTP 200; it has never been restarted. The final documents commit changes no runtime code.

An affine subagent accidentally wrote canonical `src/utils/matte.ts`, then restored its HEAD bytes, and also performed an unauthorized index refresh. Work stopped and the incident was reported. Canonical HEAD/index/raw/filtered file hashes all match `96d0b4ad2bed3326f8ff4f8e5df552c2ec93a3b5`; content and staged diffs are empty. A user-approved one-file `git add --refresh` did not clear the metadata-only M marker. The user explicitly accepted this exact dirty-STOP exception and approved continuation, with no further canonical/index repair. Canonical main and origin/main remain `8e2df61b899bb06df110475d5cc17521fcf35715`. Do not describe the canonical working tree as clean or untouched. No canonical modification beyond that disclosed incident is authorized.

## User retest

1. Draw three same-type primitives consecutively; Escape exits and each Undo removes one shape.
2. Inspect both panel handles, including while changing timeline height.
3. Open GIF: compact panel, inside click stays, outside/Escape close; select 120 sampling and compare wall-clock duration.
4. Author three Position-only keys on a Rectangle: Rotation/Scale/Opacity stay unkeyed. Add one explicit Rotation key; only Rotation gains that key.
5. Use the direct alignment/center/distribution toolbar icons at normal desktop width.
6. Distribute three unequal/rotated layers horizontally and vertically: equal visual gaps, outer span fixed, one Undo.
7. Rotate/flip/align/distribute/arrange without routine success toasts; blocked/error feedback remains.
8. Inspect Shortcut Reference hierarchy, search, platform keys and short-window scrolling.
9. Inspector no longer has duplicate Add/Remove Keyframe controls; value editing and timeline keyframing still work.
10. Resize a group containing 90-degree and 30-degree children using edges/corners; rotation and opposite anchor remain consistent, Undo/Redo exact.
11. Every X/Y snap has a clear matching guide; unsnap/release clears it.
12. Recheck accepted crop/group/camera/timeline behavior.

Crop to current selection: select one or two shapes, run the command; the stage fits selected visible bounds at the current frame. Crop to visible content: selection is unnecessary; all visible content at the current frame defines the crop. Crop plus animation: animate Position, crop, then scrub; motion remains spatially consistent relative to the new origin. Crop plus group: crop grouped content and check that children do not shift twice and the group structure stays intact.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. Other files retained under `latest/` are historical context or mirrored root documents, not a claim that the earlier aggregation-only record is current. PR #11 remains a manual user-retest gate; no merge or release was performed.

---

## manifest.txt

# PR #11 Main Integration + Mode-Swap Fade Fix Manifest

Repository: C:\Users\ertugrul.ak\Desktop\keyframe-character-studio (main; validation in the isolated detached worktree .worktrees/main-2b14fa5)
Lineage: qa/pr9-pr10-combined (V3.4 manual QA through V3.7 micro-polish), integrated head 2b14fa5
Validated code/tests commits: 679f54f (PR #11 round), 08e52c7 (UI polish V3.6), the V3.7 final micro-polish round, and the integration fix 73fc000a54c6c50ce21b71822c16a954a27399c4
Code CI: PR-round runs 38744301819 and 38785555323 SUCCESS; the integration head ran the full local gate (release gate passed for the exact SHA)
Integration: main fast-forward-only to 2b14fa5 then 73fc000, matching origin/main; no merge commit, no rebase, no force push
PR #9/#10/#11: handles unchanged by this task; the lineage itself is on main


Scope: main integration of the PR #9/#10/#11 UI lineage, plus the targeted remediation of the regression the merge gate caught (first-paint chrome fade unsettling the timeline's initial layout). The underlying lineages they integrate: first round — generic affine group resizing; canonical property-channel projection; resolved snap/guide geometry; persistent primitive tools; direct toolbar and explicit gap/center naming; compact GIF dialog and duration-preserving 120 sampling; timeline-only keyframing controls; routine success-toast removal; boundary-centred panel handles; category-card Shortcut Reference. V3.6 polish (2026-10-15): armed-draw crosshair cursor; single dock-width token contract (56/304/372); single-close GIF panel with tooltip-carried format facts; documented align/distribute command set and order; free non-uniform corner resize with Shift aspect toggle; focus-visible pointer/keyboard select policy; quiet mode segment; dense one-line shortcut rows; LAN restored-project provenance chip. V3.7 final micro-polish (2026-10-15): announced Align/Center/Distribute/Rotate-Flip band grouping with a four-arrow both-axes Center glyph; compact restrained rail (42px items, 18px icons, one label voice, light active surface + accent bar) and quiet boundary-tab handles of one family; ONE inset focus-visible authority; presentation-only 180ms Edit/Broadcast chrome crossfade (reduced-motion honoured, camera-exact rapid switching); dense single-column Shortcut Reference sheet; GIF control renamed Sampling rate after verifying 0.5s/1s/2s at 120 encode 25/50/100 frames at the 2 cs delay floor with preserved wall-clock duration.

Validation: integration head 73fc000 — TypeScript build and noEmit, lint, npm test (173 files / 2602 tests), production build and validate:ograf passed; timeline-marquee 6/6 twice in isolation (workers 1, retries 0); npm run qa:release passed for the exact candidate SHA; FULL Chromium 436 passed / 0 failed / 0 flaky (workers 8, retries 0, isolated UI 5188 / API 5017; live API 5000 never touched). Same no-weakening policy as earlier rounds: no assertion relax, skip, retry, arbitrary sleep or widened camera tolerance; new permanent pin in src/tests/useBroadcast.test.ts. V3.7 head — unit 173 files / 2601 tests; full Chromium 436 / 0 / 0; state consistency 56 checks; npm audit low 0; pins e2e/micro-polish-v37.spec.ts (8 tests), three 120-sampling browser rows in e2e/gif-export.spec.ts, two GIF delay-floor unit tests. V3.6 round: unit 2599, full Chromium 426 / 0 / 0, pin e2e/ui-polish-v36.spec.ts. First round additionally: focused Chromium 99; full 415 / 0 / 0; qa:release 2; qa:v6 3; exact production OGraf minification and exported-host load exercised.

Live: 5173 now serves the canonical main checkout (documented cutover in this round's report); API 5000 listener 2308, health HTTP 200, never restarted. No release, tag, npm, rebase, force push, branch deletion, dependency, workflow or OMP configuration change.
Canonical sync: main/origin main carry the delivered head. The disclosed metadata-only matte.ts marker was proven content-free (HEAD/index/worktree blob 96d0b4ad2bed3326f8ff4f8e5df552c2ec93a3b5), the stale index was rebuilt from HEAD (metadata-only operation), and the approved fast-forward checkout resolved it; the tracked canonical tree is clean. The untracked EFFECTCRAFT_DEEP_ARCHITECTURE_RESEARCH.md is the user's local file and was not touched.

Current task documents:
- README.md — entry point and record precedence
- OMP_FINAL_RESPONSE.md — complete findings, root causes, fixes, math/timing decisions, validation and retest record, with the Main integration addendum (2026-10-16)
- manifest.txt — provenance and validation summary
- progress_174_combined_pr9_pr10_ui_polish_v36.md — the V3.6 nine-findings remediation record
- progress_175_pr11_final_micro_polish_v37.md — the V3.7 final micro-polish record
- progress_176_main_integration_mode_swap_fix.md — the main integration and mode-swap fade fix record

Current mirrors of root state documents (re-copied from root after this round):
- CHANGELOG.md
- NEXT_SESSION.md
- PROJECT_STATE.md

Retained historical documents, not changed in this task:
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md
- KCS_RELEASE_CANDIDATE_SUMMARY.md
- progress_165_pre_qa_repository_cleanup.md
- progress_166_manual_qa_round_two_remediation.md
- progress_167_manual_qa_round_three_remediation.md
- progress_168_manual_qa_round_four_remediation.md
- progress_169_manual_qa_round_four_remediation.md
- progress_170_manual_qa_round_four_remediation.md
- progress_171_manual_qa_round_five_remediation.md
- progress_173_camera_transition_blocker_remediation.md

The one-file contains the current remediation record rather than repeating historical reports. A documents-only commit rides above the tested code commit; its own revision/CI is reported on delivery rather than embedding a self-referential hash.

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md.
