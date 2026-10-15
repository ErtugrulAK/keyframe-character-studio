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
