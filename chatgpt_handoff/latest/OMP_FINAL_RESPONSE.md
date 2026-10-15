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
