# KCS Minimal ChatGPT Upload Bundle — manual QA round 4 remediation (R4-01…R4-16)

Task-specific handoff for the MANUAL QA ROUND 4 remediation on branch
`fix/manual-qa-round1-remediation` (2026-10-13): round 1 fixed findings A–J, round 2 fixed R2-01…R2-12,
round 3 fixed R3-01…R3-13, and round 4 fixed R4-01…R4-16; the full validation ran green on the frozen
round-4 head (including the FULL Chromium suite) and PR #9 was updated. This is not an archive.

## Current truth

- Repository (canonical, untouched): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
- Branch: `fix/manual-qa-round1-remediation` (base `origin/main` at `8e2df61`)
- PR: **#9 OPEN, not merged** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`
- Round-4 head: `d545cfca58978e82357c7f8ed8da8d1360710278` (`d545cfc`), mergeable **MERGEABLE**, merge state
  **CLEAN**; CI **CI Pipeline** run `38420352883` (`pull_request`) — **success**
- Findings fixed: **round 1 A–J; round 2 R2-01…R2-12; round 3 R3-01…R3-13; round 4 R4-01…R4-16**
- Validation: `tsc`, lint, `npm test` (163 files / 2,438 tests), build, `validate:ograf`, `qa:release`,
  `qa:v6`, `npm run check`, the state-consistency check (46 checks), `npm audit` (0 vulnerabilities),
  `git diff --check`, and the FULL Chromium suite `--retries=0` — **379 passed, 0 failed, 0 flaky**
  (the first run recorded one non-reproducible load-sensitive `camera-transition-stability` sample; see the
  one-file for the exact table and the caveat)
- Live preview: `http://localhost:5173/` — served from THIS worktree (vite listener pid 50876)
- API: `127.0.0.1:5000` — pid 18280, **never stopped or restarted**
- Next input: the **user retest on 5173** (rounds 1–4) — that retest is the merge gate

## What changed (round 4)

- **R4-03 / R4-04** the timeline keyframe drag is a POINTER gesture: the press arms it, the pressed diamond
  captures the pointer for the whole sweep, and `pointerup`, `pointercancel`, a lost capture or a move with
  no button held end it at once — a release can no longer be missed. `Delete` clears the **whole** keyframe
  selection in one document write (one undo entry), and while the timeline holds focus it can only remove
  keyframes, never a layer.
- **R4-05 / R4-06** every expanded keyable row carries the layer row's own `[◀][+][▶]`, scoped to that
  property, on the stated 0/1/2+ never-wrapping policy; the redundant `Transform` tree wrapper row is gone
  and the tree still aligns with the lanes row for row.
- **R4-07** ungroup bakes **sparsely**: a container that merely travels keeps its own key times
  (**105 → 7 keys per child** in the travelling case), pose parity 1e-9 against the evaluator, and the rare
  per-frame fallback is recorded as a `bakeNote` instead of passing silently.
- **R4-08 / R4-01 / R4-02** the interpolation connector is split into one segment per gap, so a hollow
  keyframe stays hollow (the 8px glyph inside its 18px hit target is unchanged); the dock handles are the
  timeline's compact edge-handle family pinned to the workspace row's top edge, and the outliner divider
  matches the height divider.
- **R4-09** `resolveStageSelectionTarget` answers the click on both canvas entry points: a plain click
  targets the layer's **outermost group ancestor**, and a child becomes draggable/primary through the
  explicit drill-in (a canvas double-click or an Outliner row click).
- **R4-10 / R4-11** the toolbar is six announced `role="group"` bands with one hitbox and one optical glyph
  size, and Bind/Unbind left the strip (the bond model still loads, moves and round-trips). `Delete` could
  reach the layer path while the pointer was on the timeline; that scope bug is fixed and
  `src/utils/shortcuts.ts` is the single keymap authority.
- **R4-12** GIF export, **with no new dependency**: the editor's own SVG render stack rasterised through an
  isolated image context, a median-cut/exact palette and a from-scratch GIF89a encoder, with the frame rate,
  size and delay all converted through the R4-15 timebase.
- **R4-13** the exported OGraf ZIP is structurally verified rather than assumed (the test decodes the
  central directory itself; four independent extractors plus PowerShell's .NET `ZipFile` agree), and
  `foldDiacritics` fixes the stray separator an accented scene title used to leave in the graphic id.
- **R4-14** every continuous authoring gesture is ONE history transaction, opened on the press and closed on
  the release; discrete edits stay their own entries and panel/timeline resizes never enter document
  history.
- **R4-15 / R4-16** playback integrates elapsed wall-clock time (`src/utils/timebase.ts`), so the monitor
  refresh rate can no longer change an animation's duration; the dev preview pins `no-store` on its entry
  document and retires any stale service-worker registration, while production asset caching is untouched.

## Protected state

`main`, `origin/main`, the canonical checkout, every other worktree, every release tag, the published
`v1.1.0-rc.2` prerelease and the `v1.1.0-rc.1` / `v1.1.0-public-controls` tags were preserved. No tag was
created, moved or deleted, no GitHub release was published or finalized, nothing was published to npm, no
dependency/package/lockfile changed, and PR #9 was not merged.

## Evidence and files

- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — the full record: the round-4 findings with root cause and
  fix, the SHORTCUT MAP, the UNDO TRANSACTION CONTRACT, the sparse-ungroup key counts, the GIF/dependency
  note, the macOS ZIP proof, the FPS/TIMEBASE CONTRACT, the Reality Hub timing note, the cache
  classification, the full validation table, PR #9 state and the user retest list.
- `reports/progress_170_manual_qa_round_four_remediation.md` — the round-4 part-four record (spec
  migrations, self-review, gate, PR and CI).
- `reports/progress_168_manual_qa_round_four_remediation.md` and
  `reports/progress_169_manual_qa_round_four_remediation.md` — parts one–three of the round-4 record.
- `reports/progress_167_manual_qa_round_three_remediation.md`,
  `reports/progress_166_manual_qa_round_two_remediation.md` and
  `reports/progress_165_pre_qa_repository_cleanup.md` — the preceding records.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs to be
uploaded.
