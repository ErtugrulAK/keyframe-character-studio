# KCS QA aggregation — PR #9 + PR #10 combined into PR #11

QA aggregation only. `qa/pr9-pr10-combined` is built from the **current head of PR #9** and replays
**only PR #10's own commits** on top, so the two open pull requests can be exercised together on one
branch and one live preview. No new feature work, no fix for the user's pending findings, no merge, no
release.

Worktree: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-combined-qa`
Canonical repo (untouched, still on `main` @ `8e2df61`, clean):
`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in the latest bundle needs to be uploaded.

---

## 1. Integration graph

```
BASE        04eee5e8   merge-base(fac2bc1, 74603de)
P9 head     fac2bc1    origin/fix/manual-qa-round1-remediation   (PR #9, OPEN)
P10 head    74603de    origin/feat/ae-layout-crop-snapping       (PR #10, OPEN)
P11 head    ce04dd0    qa/pr9-pr10-combined  (validated code + tests head, pushed)
```

`P10` does **not** contain `P9` (verified: `git log --oneline fac2bc1..74603de` lists exactly the nine
`BASE..P10` commits). The branch was therefore created from `origin/fix/manual-qa-round1-remediation`
(`fac2bc1`) — not from `main`, not from `P10` — and only PR #10's *own* commits were replayed.

### Replayed commits (PR #10-only, `BASE..P10`, products + tests only)

| # | original | replayed on `qa/pr9-pr10-combined` | subject |
| - | -------- | --------------------------------- | ------- |
| 1 | `0bf21c3` | `2409e23` | feat: add shared layout geometry authority and equal-spacing distribution |
| 2 | `802cebc` | `b84e476` | feat: add smart snapping and guides |
| 3 | `913f3a3` | `bce84d1` | feat: add stage crop and region of interest |
| 4 | `3c62d85` | `30056e0` | test: migrate the authoring toolbar band contract to the crop bands |
| 5 | `decc14e` | `ee602c4` | fix: keep the layers a drag carries out of the snap targets |
| 6 | `9fd713a` | `226dade` | test: pin the snapping-driven drag contracts in the affected specs |
| 7 | `55ed8c7` | `ce04dd0` | test: measure the snap threshold against the stage edge alone |

**Deliberately NOT replayed:** `cd8fe7c` (docs: record the ae-inspired layout crop and snapping features)
and `74603de` (docs: refresh the ae-inspired layout crop and snapping handoff) — both are PR #10-era
documentation snapshots that would ship a stale state. The combined record is produced fresh here
instead.

Cherry-picks carried `-x`, so every replayed commit records its original SHA in its message.

## 2. Conflicts and resolutions

Exactly **one** conflict, and it is an additive one.

`git diff --name-only 04eee5e fac2bc1` ∩ `git diff --name-only 04eee5e 74603de` = `CHANGELOG.md`,
`chatgpt_handoff/**` (all of it skipped with the two docs-only commits) and **one source file**:
`src/components/Canvas/StageCanvas.tsx`. That is the only place where the two lineages touch code.

| step | file | conflict | resolution | reason |
| ---- | ---- | -------- | ---------- | ------ |
| `913f3a3` (crop) | `src/components/Canvas/StageCanvas.tsx`, import block | `HEAD` added `import { REMEASURE_STAGE_BOX_COMMAND, WORKSPACE_LAYOUT_COMMAND_EVENT } from '../../utils/workspaceLayout'`; the pick added `type CoordinatePoint` to the existing `projectCoordinates` import | **both kept** — one `projectCoordinates` line carrying `type CoordinatePoint`, plus the `workspaceLayout` line | purely additive: PR #10 needs `CoordinatePoint` for `clientToStage`, PR #9 needs the two shared command constants; neither replaces the other |

`802cebc` (snapping) and `decc14e` (snap targets) auto-merged — the snap context is inserted into the
translate-drag body and the camera guard lives on the `applyStageBox` measurement path, so the two hunks
never overlap. No other commit conflicted.

**Nothing was reverted to make anything apply.** The conflict rule ("never revert the current PR #9
camera fix back to the older PR #10 state; preserve the PR #10 feature") never had to be invoked,
because the only overlap was an import list.

## 3. Combined proof — both sides are present

### PR #9 side (manual-QA rounds 1–5 + the camera-transition blocker fix)

| Claim | Evidence on `qa/pr9-pr10-combined` |
| ----- | --------------------------------- |
| Frame-committed layout authority | `src/utils/workspaceLayout.ts` (`WORKSPACE_LAYOUT_COMMAND_EVENT`, `REMEASURE_STAGE_BOX_COMMAND`, `commitWorkspaceLayout`, `createFrameEase`, `panelEdgeStyle`, `PANEL_EDGE_TRANSITION_MS`) |
| `useDockedPanelEdge` | `src/hooks/useDockedPanelEdge.ts` present; both docked panels (`LeftToolbar`, `PropertyInspector`) take `edgeWidth` + `panelRef` and write `panelEdgeStyle(edgeWidth)` |
| The `StageCanvas` frame-commit guard | line 158: `// A frame-committed edge (see commitWorkspaceLayout) has already folded` … `if (previous && !reanchor && previous.left === box.left && previous.top === box.top && previous.width === box.width && previous.height === box.height) return;` |
| Shared event names actually wired | `if (type === REMEASURE_STAGE_BOX_COMMAND)` (line 954) and `window.addEventListener(WORKSPACE_LAYOUT_COMMAND_EVENT, …)` / matching `removeEventListener` (lines 970–971) |
| Right inspector off browser-side geometry transitions | `src/components/Inspector/PropertyInspector.css` rule `.motion-design-right-sidebar`: `transition: transform 240ms ease, opacity 240ms ease, visibility 240ms ease;` with the comment that width/min-width/flex-basis are deliberately absent; the only other mentions of `width` next to `transition` in that file are comments |
| Left dock off browser-side geometry transitions | `src/components/Toolbar/LeftToolbar.css` rule `.left-toolbar-container` (the element `panelRef` is attached to): the P9 fix replaced `transition: width 240ms ease, min-width 240ms ease, flex-basis 240ms ease, …` with `transition: transform 240ms ease, opacity 240ms ease, visibility 240ms ease, …`; and `.left-toolbar-container.hidden` lost its `!important` on width/min-width/flex-basis so the inline travelling width can win. (The file also keeps legacy `.left-drawer-panel` rules that still list a width transition — that class has **no** consumer in `src/**` outside the stylesheet, so it is not in the DOM and cannot animate the measured box; it is pre-existing in `04eee5e` and was left alone, deliberately, to keep the QA branch byte-identical to PR #9 outside the replay.) |
| Right inspector + left dock fix | `useDockedPanelEdge` consumed by both panels (above) |
| Key-drag playhead separation | `src/components/Timeline/SequencerTimeline.tsx`: `.playhead-line` in `MARQUEE_BLOCKERS`, the "how close to the playhead line a press still counts as on the playhead" band, and the geometric playhead-column exclusion for the marquee |
| Group marquee normalization | `src/utils/layerGrouping.ts`: `resolveMarqueeSelection` + `normalizeDegrees` and the rotated-child guard |
| Round-5 vector arrange | `src/utils/vectorArrange.ts`: `planDistribute` present alongside PR #10's `planDistributeByGap` |
| Compact Transform Details | inspector Transform Details work rides in the P9 lineage (`src/components/Inspector/PropertyInspector.tsx`) |
| Rounds 1–5 records | `reports/progress_165_pre_qa_repository_cleanup.md` … `reports/progress_171_manual_qa_round_five_remediation.md`, `reports/progress_173_camera_transition_blocker_remediation.md` — unchanged by this task |

### PR #10 side (AE layout / crop / snapping / distribution)

| Claim | Evidence on `qa/pr9-pr10-combined` |
| ----- | --------------------------------- |
| Equal-gap distribution | `src/utils/vectorArrange.ts` → `planDistributeByGap` (line 215), on top of the shared bounds maths |
| Snapping resolver + guides | `src/utils/layoutGeometry.ts` → `resolveSnap`, `collectLayerSnapCandidates`, `collectStageSnapCandidates`, `SNAP_THRESHOLD_SCREEN_PX`, `SnapGuide`/`SnapLine`; `StageCanvas` freezes the snap context at pointerdown (`dragSnapRef`) and renders `snap-guides` as `pointerEvents="none"` chrome |
| Toggle snapping | `AuthoringToolbar.tsx` `aria-label="Toggle snapping"`; `snapEnabled` from the animator context gating `resolveSnap` |
| Crop / ROI authoring | `src/utils/stageCrop.ts` (`STAGE_CROP_HANDLES`, `isStageCropHandle`, `stageCropRectFromDrag`, `resizeStageCropRect`, `translateStageCropRect`, `isStagePointInsideRect`, `stageSpaceToEditorRect`, `editorPointToStageSpace`) + `src/hooks/useStageCropAuthoring.ts`; overlay drawn in `StageCanvas` with `data-crop-active` / `data-crop-handle` |
| `Apply crop` | `AuthoringToolbar.tsx` line 503 `aria-label="Apply crop"`, disabled until a region exists; the region writes **nothing** until applied |
| Two crop-to-content modes | `AuthoringToolbar.tsx` group `aria-label="Crop to content"` with `crop-to-selection` ("Crop to current selection at current frame") and `crop-to-visible-content` ("Crop to visible content at current frame") |
| Export parity | `useStageCropAuthoring.applyCropRegion` commits through `setCharacterParts` + `setProjectResolution` as **one** batch interaction, i.e. the crop is a document edit on the same resolution/transform authority the export reads — not a viewport change. Asserted end to end by `e2e/ae-layout-crop.spec.ts`: after `Apply crop` the artboard becomes the region, the inter-layer geometry is preserved, and one `Control+z` restores both the stage size and the placement (redo exact) |

### The checks the brief called out specifically

- **The PR #10 replay did NOT overwrite the camera fix.** `git diff fac2bc1 HEAD -- src/components/Canvas/StageCanvas.tsx` contains **no deletion of any P9-introduced line**: every removed line is one PR #10 rewrote (`projectCoordinates` import line, the `dragMode`/`dragStart` type unions, the raw `initialTransform.x + deltaX` pair, the `useCallback` dependency list, the container `className`). The guards were re-verified by grep at lines 158–162, 954, 970–971 (table above).
- **The snapping `StageCanvas` changes did NOT break camera invariance.** The snap path only rewrites the *authored* transform delta (`snappedDx`/`snappedDy` feed `updateCurrentTransform`) and explicitly comments "Snapping changes only the authored transform delta — never the camera"; the camera path (`applyStageBox` + `commitWorkspaceLayout`) is untouched. Proven by measurement: `e2e/camera-invariance.spec.ts` and `e2e/camera-transition-stability.spec.ts` are green in the full suite with `worstDelta=0.000px` / `worstDrift=0.000px` on every sampled trace and world drift `dx=0.000 dy=0.000`.
- **Toolbar conflicts caused NO feature loss.** `AuthoringToolbar.tsx` is touched by PR #10 only (no P9 change to that file), so the crop band, the crop-to-content menu and the snapping toggle all landed whole; `git diff fac2bc1 HEAD -- src/components/Toolbar/AuthoringToolbar.tsx` is exactly PR #10's diff. `e2e/authoring-toolbar.spec.ts` was migrated, not weakened, by `30056e0`.
- **No duplicate geometry authority.** `layoutGeometry.ts` holds the one union/centre formula (`unionWorldBounds`, `worldBoundsCenter`) + the one snap formula (`resolveSnap`); `vectorArrange.ts` imports from it (`import { unionWorldBounds, worldBoundsCenter } from './layoutGeometry'`), `useStageCropAuthoring.ts` imports `unionWorldBounds` from it, and `SNAP_THRESHOLD_SCREEN_PX` is defined in `layoutGeometry.ts` alone — the only other files mentioning it are `StageCanvas.tsx` (consumer) and `src/tests/layoutGeometry.test.ts`. `src/utils/layerGrouping.ts` does keep a small **local, pre-existing** `unionWorldBounds` helper (present at `04eee5e`, untouched by PR #10) that PR #10 did not introduce and did not replace; PR #10 added exactly one shared authority and no second copy of it.
- **The Undo contracts still hold.** `e2e/camera-transition-stability.spec.ts` records `undoDisabled=false` on every drift sample and the full suite is green; crop is one undo step with exact redo (`ae-layout-crop.spec.ts`); distribution is "one history entry" (`ae-layout-snapping.spec.ts`).

## 4. Validation on `ce04dd0` (isolated ports only)

| Command | Result |
| ------- | ------ |
| `npx tsc -b --pretty false` | exit 0, no diagnostics |
| `npm run lint` (oxlint) | exit 0, clean |
| `npm test` (vitest) | **169 files / 2537 tests passed**, 0 failed |
| `npm run build` | built clean (chunk-size advisory only, pre-existing) |
| `npm run validate:ograf` | `fixtures/ograf/minimal.ograf.json: valid OGraf v1 manifest` |
| `PORT=5016 npm run qa:release` | **2 passed** (release gate, `KCS_RELEASE_GATE=1`, UI 5189 / API 5016) |
| `PORT=5016 npm run qa:v6` | **3 passed** (`KCS_V6_QA=1`, UI 5187 / API 5016) |
| `npm run check` | green (lint + tsc + 2537 tests + build) |
| `node scripts/check-state-consistency.mjs` | **PASS (52 checks)** |
| `npm audit --audit-level=low` | **0 vulnerabilities** |
| `git diff --check` | clean |

Focused Chromium (`CI=1 PORT=5016`, `--project=chromium --workers=4 --retries=0`) over
`camera-transition-stability`, `camera-invariance`, `timeline-keyframe-gesture`, `group-interaction`,
`authoring-toolbar`, `ae-layout-crop`, `ae-layout-snapping`, `ograf-editor-export`, `gif-export`:
**50 passed / 0 failed**.

**FULL Chromium suite** — `CI=1 PORT=5016 npx playwright test --project=chromium --workers=8
--retries=0`: **406 passed / 0 failed / 0 flaky** (3.8m). 398 of them are the PR #9-green set; the
round adds 8 from the replayed PR #10 specs.

Camera contract, measured on that run: `DRIFT_TOLERANCE_PX` unchanged at **1px**, no retry, no sleep, no
skip, no widened tolerance. Sampled numbers:

- dock transitions: `[transition] repeat Show Left Toolbar | frames=35 | animating=29 | worstDelta=0.000px | magnificationSpread=0.00000`; the same `0.000px` for repeat Hide, Hide/Show Inspector, the inspector reversals, the timeline collapse/expand and all three viewports.
- repeated toggles: `[camera-drift] inspector toggled 10x | alpha dx=0.00 dy=0.00 | beta dx=0.00 dy=0.00 | node dx=0.00 dy=0.00` (and the same for the left toolbar, the timeline resize and the panned-camera samples).
- timeline height drag: `frames=146 | timelineHeight 320.0->441.0 | worstDrift=0.000px | perFrameDrift=0.00,…` (every frame `0.00`).
- corner-anchor resize: `opposite drift world dx=0.000 dy=0.000 (px dx=0.00 dy=0.00)`.

5173 and 5000 were never bound by any test: the isolated run uses UI **5188** and API **5016**
(`CI=1` ⇒ `isIsolatedQaRun` ⇒ port 5188), and `npm run dev` was never used.

## 5. Pull request #11

- Number/URL: **#11** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/11`
- Base `main`, head `qa/pr9-pr10-combined`, title `qa: combine manual-qa remediation and AE layout features`
- Validated code + tests head: **`ce04dd0a4972b69b4635e2d20995c642f6a67d14`** (`ce04dd0`)
- Pushed with an explicit refspec — `git push -u origin HEAD:refs/heads/qa/pr9-pr10-combined` — no force, no rebase, no history rewrite
- Mergeability: **`mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`**, `state: OPEN`, not a draft
- CI: workflow **CI Pipeline**, run id **38583648143** (`https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/38583648143`), head `ce04dd0`, **conclusion `success`** (Build, Lint & Test Verification green: OGraf fixture, lint, tsc, vitest, production build). The docs-refresh commit for this record rides on top and its own run is recorded on the PR.
- **PR #9 and PR #10 are unchanged and not merged** — #9 is still `OPEN` at head `fac2bc1`, #10 is still `OPEN` at head `74603de`; neither was closed, edited or pushed to by this task.

## 6. Live surfaces

- 5173 now serves THIS worktree: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-combined-qa`.
  - vite listener PID **before: 50876** (the PR #9 worktree, `…-omp-manual-qa-r1`); **after: 17568** (bash wrapper 37868). Only the 5173 listener tree was stopped; 5173 answers **HTTP 200**.
  - Module-freshness proof over HTTP (both sides served by the same 5173): `GET /src/utils/workspaceLayout.ts` → 200, `GET /src/hooks/useDockedPanelEdge.ts` → 200 (**PR #9 side**); `GET /src/utils/layoutGeometry.ts` → 200, `GET /src/utils/stageCrop.ts` → 200 (**PR #10 side**). `GET /src/components/Canvas/StageCanvas.tsx` → 200 and its body contains `WORKSPACE_LAYOUT_COMMAND_EVENT`, `REMEASURE_STAGE_BOX_COMMAND` and `frame-committed` (PR #9) **and** `resolveSnap`, `stageCrop` (PR #10) — the one file both lineages touch serves both fixes.
- API 5000 is **unchanged**: pid **18280** before and after, `/api/health` → 200. Never stopped, restarted or rebound.
- No merge, no tag, no GitHub release, no npm publication, no dependency/lockfile/workflow/OMP-config change. The canonical checkout was never written to.

## 7. Combined manual QA list (5173 — the merge gate for PR #11)

PR #9 side:

1. Show/hide the right inspector repeatedly — the scene must not slide; toggle it again mid-animation both ways; it must reverse from where it is (no jump, no second animation).
2. Repeat with the left dock, and toggle a sidebar while the timeline edge is still moving.
3. Check the inspector at a narrow and a wide window — the resting width must match what it was before.
4. Re-run the rounds 1–5 items you can still reach: right inspector / left dock behaviour, keyframe drag next to the playhead, group marquee selection, Round-5 vector arrange, compact Transform Details.

PR #10 side:

5. Distribution: select 3+ layers, distribute on an axis — the edge gaps must come out equal, the overall span must be held, and one undo must restore everything.
6. Snapping: toggle snapping off/on; drag a layer onto another layer's edge and onto the stage edge — it must lock with a guide; confirm the guide disappears on release; at two different zooms, a 4px miss locks and a 16px miss does not.
7. Crop: arm crop, drag a region, resize one handle (the opposite edge must stay put), move the region, press Escape (it must drop without cropping); then `Apply crop` — the stage becomes the region and every layer keeps its pixel measured from the new origin; check one undo restores the stage size **and** the placement, and redo is exact.
8. Crop-to-content: use both entries of the `Crop to content` menu at the current frame.
9. Export: run the OGraf export after a crop and confirm the cropped resolution/placement is what ships.

### Pending findings — NOT fixed by this task (carried as open only)

- sidebar toggle handle placement aesthetics;
- GIF panel too long;
- GIF panel should close on click-outside;
- GIF max FPS should be 120;
- property rows should show keyframes only on the channels actually animated/changed;
- Align / Center / Distribute should be direct toolbar icons, not dropdowns;
- Distribute behaviour to be revisited against the Boxy reference;
- remove the unnecessary top-right action toasts;
- Shortcut Reference visual redesign;
- remove the Add/Remove Keyframe controls from the Inspector (e.g. Trim Path);
- resizing a group that contains a rotated child with a horizontal edge scales the child on the wrong axis.

A single remediation prompt will follow after the user finishes PR #10 manual QA.

## 8. Runway state

No tag created, moved or deleted. No GitHub release. Nothing published to npm. No merge. PR #9, PR #10
and PR #11 all stay open; the user's manual QA on 5173 is the gate.

Bundle source files (16) — the doc mirrors are byte-identical to their repository sources:

- CHANGELOG.md, NEXT_SESSION.md, PROJECT_STATE.md
- KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md, KCS_RELEASE_CANDIDATE_SUMMARY.md
- README.md, manifest.txt, OMP_FINAL_RESPONSE.md
- progress_165_pre_qa_repository_cleanup.md … progress_171_manual_qa_round_five_remediation.md, progress_173_camera_transition_blocker_remediation.md

Upload only chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md. No other file in the latest bundle needs to be uploaded.
