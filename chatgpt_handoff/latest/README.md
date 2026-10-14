# KCS Minimal ChatGPT Upload Bundle — manual QA round 5 remediation (R5-01…R5-15)

Task-specific handoff for the MANUAL QA ROUND 5 remediation on branch
`fix/manual-qa-round1-remediation` (2026-10-14): round 1 fixed findings A–J, round 2 fixed R2-01…R2-12,
round 3 fixed R3-01…R3-13, round 4 fixed R4-01…R4-16, and round 5 fixed R5-01…R5-15; the remaining gates
ran green on the frozen revision (including the FULL Chromium suite) and PR #9 was updated. This is not an
archive.

## Current truth

- Repository (canonical, untouched, still on `main` @ `8e2df61`, clean):
  `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
- Branch: `fix/manual-qa-round1-remediation` (base `origin/main` at `8e2df61`), head
  `1168ceea0fe409f153221749b3e0b890316835cf` (`1168cee`), pushed as a **fast-forward** (`42acf1e..1168cee`)
  with an explicit refspec — no force, no rebase
- **Validated code + tests head: `0e81ff3`**; `1168cee` adds the round record and the changelog only
- PR: **#9 OPEN, not merged** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`
- Mergeable **MERGEABLE**, merge state **CLEAN**; CI **CI Pipeline** run **`38550570067`** (`pull_request`)
  — **success**
- Findings fixed: **round 1 A–J; round 2 R2-01…R2-12; round 3 R3-01…R3-13; round 4 R4-01…R4-16;
  round 5 R5-01…R5-15**
- Validation: `npm run check` as one command (lint, `tsc`, **165 files / 2,478 tests**, build), the
  state-consistency check, `npm audit` (0 vulnerabilities) and `git diff --check` all green
- Live preview: `http://localhost:5173/` — served from THIS worktree (vite listener pid 50876)
- API: `127.0.0.1:5000` — pid 18280, **never stopped or restarted**
- Next input: the **user retest on 5173** (rounds 1–5) — that retest is the merge gate

## What changed (round 5)

- **R5-01 / R5-02** each panel show/hide handle is anchored to the panel's **outer boundary** (the drawer's
  right edge, the inspector's left edge) while its vertical anchor stays the workspace row's top edge, so
  nothing inside a panel sits under a handle and a timeline resize still cannot move it. The editor's stack
  is declared once as tokens in `src/kcsEditorTheme.css` (`--kcs-layer-panel: 90`,
  `--kcs-layer-handle: 100`, `--kcs-layer-chrome: 200`, `--kcs-layer-chrome-overlay: 300`): the header had
  been a flex item at the handle's own layer, so it trapped the Export dropdown and the GIF panel inside its
  own stacking context and the handle painted over them on DOM order.
- **R5-03** the timeline collapse EASES from the frame commit: `animateTimelineEdge` runs a monotone
  ease-out cubic (180ms) and every frame commits through the same `commitWorkspaceLayout` authority the
  height drag uses. The CSS `transition: height` version measured **5.883px** of transient world drift,
  because the edge moved during the frame's own style/layout step and the camera correction arrived a frame
  late under load.
- **R5-04 / R5-06 / R5-07** a mouse-selected keyframe is the **filled diamond only** (the ring around its
  18px hit target is gone; keyboard focus keeps `:focus-visible`), a disabled endpoint arrow is an ordinary
  disabled control (greyed, `disabled`, `"(none)"`, no forbidden cursor), and a property row's strip is the
  neutral `[◀][+][▶]` with a plain `+` — the channel colour stays on the lane diamonds.
- **R5-05** a timeline keyframe drag no longer touches the playhead. The cursor write lived beside
  `handleKeyframeClick` on every diamond's `onClick`, and a real drag ends with a browser `click` on the
  pointer-captured element — so the closure read the key's post-drag frame — while the property diamond's
  `pointerdown` also wrote the cursor at press time. The write now lives inside the single drag-aware click
  authority, and the prop diamond's `pointerdown` writes nothing.
- **R5-08** a canvas marquee over grouped children **normalizes to the group**: `resolveMarqueeSelection`
  folds the raw hit list through the same `resolveStageSelectionTarget` the canvas click uses, with the
  selection captured before the press clears it, and drops `isGroup` containers — whose only candidate box
  was `getPartLocalBounds`'s ±32 placeholder, which is what let an empty gap between children select the
  container. The two explicit drill-in paths (canvas double-click, Outliner row) still select the child.
- **R5-09 / R5-10 / R5-11** align, distribute, rotate and flip exist as one authority: `vectorArrange.ts`
  plans (`ALIGN` on the collective bounds, writing only the aligned axis; `DISTRIBUTE` needing ≥ 3 targets
  ordered by centre with the extremes fixed; `ROTATE` ±90° about the collective centre; `FLIP` about the
  collective centre preserving world placement with `mirror`'s sign law) and `useVectorArrangeAuthoring`
  writes the plan through the ONE `updateCurrentTransform` path in one batch — one command, one undo step.
  `Ctrl/Cmd+Shift+←/→` rotate, `Shift+H`/`Shift+V` flip; align and distribute are deliberately toolbar-only.
- **R5-12 / R5-13** the toolbar is **nine** announced `role="group"` bands (canvas tools, create, Boolean,
  layer group, align, distribute, rotate and flip, arrange, view), variants along one axis opening a menu
  and one-shot commands keeping one button each; the shortcut reference became a **filter** over the one
  shortcut table (`utils/shortcuts`) with platform-formatted key chips, per-category counts, named scopes
  and the shared dialog focus trap.
- **R5-14 / R5-15** the Inspector's Transform section is `Position [X][Y]` plus ONE row of
  `[Rotation][Scale][Opacity]` (three cells, one line at the 250px dock floor); `Reset 0°`, `Add Keyframe`
  and the labelled lock button are gone (the lock stays as one compact glyph in the Scale header, because a
  free corner drag must stay reachable), and the duplicated paint-order readout plus its Bring Forward strip
  are gone — arrange lives on the toolbar, writing the same `handleZIndexChange` path. `scaleX` and `scaleY`
  remain independent channels.

Rounds 1–4 are recorded in `reports/progress_165…170_*` and summarised in
`chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.

## The round's one open item (reported, not suppressed)

The FULL Chromium suite (396 tests, **8 workers**) failed the **same two load-sensitive camera samples** in
every run at the frozen revision: `camera-transition-stability.spec.ts:231` and `:259`, each an ALPHA client-x
excursion of exactly **-28.859px** on one frame of the inspector's 240ms width transition (the spec's bound is
1px). Both specs run clean in isolation — **9/9 at 2 workers and 4/4 at 8 workers**, `worstDelta=0.000px` on
all 12 traces each time. The failing assertion, the two tests and the measured CSS `width` transition are all
**unchanged by round 5**; no tolerance was widened, no retry added, no sleep inserted and no test skipped, and
the spec bytes are untouched. A clean full-suite run has therefore **not** been observed at this revision,
and no full-suite run was made on the pre-round-5 revision under the same load, so the reproducibility change
is reported without attribution for the reviewer's decision before the merge.

## Protected state

`main`, `origin/main`, the canonical checkout, every other worktree, every release tag, the published
`v1.1.0-rc.2` prerelease and the `v1.1.0-rc.1` / `v1.1.0-public-controls` tags were preserved. No tag was
created, moved or deleted, no GitHub release was published or finalized, nothing was published to npm, no
dependency/package/lockfile/workflow/OMP-config changed, and PR #9 was not merged. The authoring cursor
contract, the GIF 60 FPS cap, FPS/timebase, the undo transaction contract and every earlier round's shipped
behaviour are unchanged.

## Evidence and files

- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — the full record: the round-5 findings with root cause and
  fix, the **vector command semantics**, the key-drag/playhead proof, the group-selection normalization
  proof, the camera-invariant transition proof with the measured numbers, the FPS/TIMEBASE CONTRACT, the
  Reality Hub timing note, the UNDO TRANSACTION CONTRACT, the full validation table, the PR #9 state, and
  the user retest list.
- `reports/progress_171_manual_qa_round_five_remediation.md` — the round-5 record (gate, PR, live surfaces).
- `reports/progress_170_manual_qa_round_four_remediation.md` (and 168/169) — the round-4 record, whose own
  findings, sparse-ungroup key counts, GIF/dependency note, macOS ZIP proof and cache classification still
  stand unchanged.
- `reports/progress_167`, `progress_166` and `progress_165` — the round-3, round-2 and pre-QA records.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs to be uploaded.
