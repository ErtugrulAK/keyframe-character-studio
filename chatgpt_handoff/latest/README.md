# KCS Minimal ChatGPT Upload Bundle — manual QA round 2 remediation (R2-01…R2-12)

Task-specific handoff for the MANUAL QA ROUND 2 remediation on branch
`fix/manual-qa-round1-remediation` (2026-10-12): round 1 fixed findings A–J and round 2 fixed the
twelve further findings R2-01…R2-12; the full validation ran green on the round-2 head and PR #9 was
updated. This is not an archive.

## Current truth

- Repository (canonical, untouched): `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`
- Worktree that carries this work: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-manual-qa-r1`
- Branch: `fix/manual-qa-round1-remediation` (base `origin/main` at `8e2df61`)
- PR: **#9 OPEN, not merged** — `https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`
- Round-2 code head: `0078dcd68f2fc01ee8c2504149381593ed03c976` (`0078dcd`), mergeable CLEAN; CI **CI Pipeline** run `38267691521` (`pull_request`) — **success**
- Findings fixed: **round 1 A–J; round 2 R2-01…R2-12**
- Validation: `tsc`, lint, `npm test` (149 files / 2,280 tests), build, `validate:ograf`, `qa:release`, `qa:v6`, `npm run check` (PASS),
  the state-consistency check, `npm audit`, `git diff --check`, and the FULL Chromium suite
  `--retries=0` — see the one-file for the exact counts
- Live preview: `http://localhost:5173/` — served from THIS worktree (vite listener pid 33512)
- API: `127.0.0.1:5000` — pid 8872, **never stopped or restarted**
- Next input: the **user retest on 5173** — that retest is the merge gate

## What changed (round 2)

- **R2-05** rotation holds one world pivot captured at pointer-down (worst frame-centre drift
  40.559px → 0.000px).
- **R2-04** `src/utils/selectionFrame.ts` is the single frame-geometry authority; the synthetic
  `fallbackBounds()` square no longer reaches the multi-selection path or `layerGrouping`.
- **R2-02** a timeline height commit re-measures the stage in the SAME task (151–155 drag frames,
  height 320→441, 0.000px drift, 0.00000 magnification spread).
- **R2-01 / R2-03** collapse/expand, height resize and column resize through ONE sizing authority
  (`src/components/Timeline/timelineConstants.ts`).
- **R2-10 / R2-12** canonical `selectedKeyframeIds` in `useSelection` + marquee; multi-key MOVE is a
  recorded follow-up, not faked.
- **R2-11** 18px hit target with an 8px hollow/filled diamond.
- **R2-09** compact channel tree (one rail, 30/24px shared row constants); the missing opacity lane was
  found and fixed.
- **R2-06** Group/Ungroup removed from Details (toolbar + context menu only; read-only member list kept).
- **R2-07** editor-wide capture-phase contextmenu suppression; propagation never stopped.
- **R2-08** Fill/Stroke removed from the toolbar (paint stays in the Inspector APPEARANCE card); visual
  polish; Boolean always visible with state-aware enable/disable.

## Protected state

`main`, `origin/main`, the canonical checkout, every other worktree, every release tag, the published
`v1.1.0-rc.2` prerelease and the `v1.1.0-rc.1` / `v1.1.0-public-controls` tags were preserved. No tag
was created, moved or deleted, no GitHub release was published or finalized, nothing was published to
npm, and PR #9 was not merged.

## Evidence and files

- `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — the full record: per-finding reproduction, root cause,
  fix, tests, the validation table, the flake evidence and the user retest list.
- `reports/progress_166_manual_qa_round_two_remediation.md` — the round-2 task record.
- `reports/progress_165_pre_qa_repository_cleanup.md` — the preceding pre-QA housekeeping record.

## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. No other file in this bundle needs to be
uploaded.
