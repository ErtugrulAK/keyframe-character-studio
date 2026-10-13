# KCS Minimal ChatGPT Upload Bundle — manual QA round 3 remediation (R3-01…R3-13)

Task-specific handoff for the MANUAL QA ROUND 3 remediation on branch
`fix/manual-qa-round1-remediation` (2026-10-13): round 1 fixed findings A–J, round 2 fixed the twelve
findings R2-01…R2-12, and round 3 fixed the thirteen further findings R3-01…R3-13; the full validation
ran green on the round-3 head and PR #9 was updated. This is not an archive.

## Current truth

- Repository (canonical, untouched): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
- Branch: `fix/manual-qa-round1-remediation` (base `origin/main` at `8e2df61`)
- PR: **#9 OPEN, not merged** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`
- Round-3 code head: `91f9fde9fb67a24881747aaba3c50f7249590fcb` (`91f9fde`), mergeable MERGEABLE, merge state CLEAN; CI **CI Pipeline** run `38384921198` (`pull_request`) — **success**
- Findings fixed: **round 1 A–J; round 2 R2-01…R2-12; round 3 R3-01…R3-13**
- Validation: `tsc`, lint, `npm test` (153 files / 2,325 tests), build, `validate:ograf`, `qa:release`, `qa:v6`, `npm run check` (PASS),
  the state-consistency check (40 checks), `npm audit` (0 vulnerabilities), `git diff --check`, and the
  FULL Chromium suite `--retries=0` — **361 passed, 0 failed, 0 flaky**; see the one-file for the exact table
- Live preview: `http://localhost:5173/` — served from THIS worktree (vite listener pid 33512)
- API: `127.0.0.1:5000` — pid 8872, **never stopped or restarted**
- Next input: the **user retest on 5173** (rounds 1–3) — that retest is the merge gate

## What changed (round 3)

- **R3-13** ungroup no longer refuses an animated container: the container's motion is baked into every
  child as `containerLocal(t) ∘ childLocal(t)` (an exact affine fold per sequence scope while the
  container's own local transform is constant and unrotated, otherwise a documented per-integer-frame
  bake), with `composeWorldTransform` as the single parent-child composition authority. **World-pose
  parity 0.000e+0 over 26 frames**, plus undo/redo, save/reload, OGraf runtime and static export parity.
  One narrow refusal remains for a child pinned by a stage anchor.
- **R3-10 / R3-11** one canonical authored transform-keyframe truth: the layer-level keyframe action and
  the expanded X/Y rows write the same channels, a legacy composite list is re-expressed through the
  evaluator's own resolution, and `resolveTrackChannels` is the one read truth — no store can show on
  one row and hide on another.
- **R3-04** dragging any selected keyframe moves the whole selected set by one frame delta; the move
  clamps to the project range and stops at the first frame it would overwrite (a set may move onto
  frames its own members vacate).
- **R3-12** the GROUP, BIND and BOOLEAN sections left Details; their commands live in the top authoring
  toolbar and the editor context menu, and Bind is surfaced through one `usePartBindingAuthoring` hook.
- **R3-02** the side-panel show/hide handles are anchored to the editor shell `.app-container`, so a
  timeline resize can no longer drag them vertically.
- **R3-01** the timeline collapse control is a compact edge handle on the panel's own top edge (no
  label, reachable while collapsed, authored height restored exactly).
- **R3-05 / R3-06** the property tree reads Layer > Transform > { Position > {X, Y}, Rotation, Scale >
  {X, Y}, Opacity } and Layer > Trim Path > {Start, End, Offset}, with one shared chevron, no numeric
  count badges, and tree/lane rows pixel-aligned.
- **R3-07 / R3-08 / R3-09** per-layer previous/next keyframe arrows (navigation only), a loop toggle
  that reports its state through `aria-pressed` while staying view-only (never serialized), and a
  go-to-frame-0 transport button.
- **R3-03** the timeline divider drops the indigo/neon glow for a restrained neutral line.

## Protected state

`main`, `origin/main`, the canonical checkout, every other worktree, every release tag, the published
`v1.1.0-rc.2` prerelease and the `v1.1.0-rc.1` / `v1.1.0-public-controls` tags were preserved. No tag
was created, moved or deleted, no GitHub release was published or finalized, nothing was published to
npm, and PR #9 was not merged.

## Evidence and files

- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — the full record: per-finding reproduction, root cause,
  fix, tests, the validation table, the flake status and the user retest list.
- `reports/progress_167_manual_qa_round_three_remediation.md` — the round-3 task record.
- `reports/progress_166_manual_qa_round_two_remediation.md` and
  `reports/progress_165_pre_qa_repository_cleanup.md` — the preceding records.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs to be
uploaded.
