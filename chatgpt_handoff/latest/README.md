# PR #11 Combined Manual QA Remediation Handoff

This task-specific bundle supersedes the earlier aggregation-only handoff. The approved scope is the user's combined PR #9/#10 manual QA findings on `qa/pr9-pr10-combined`, not a merge or release.

## Current engineering record

- Worktree: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-combined-qa`.
- PR #11: https://github.com/ErtugrulAK/keyframe-character-studio/pull/11 — OPEN; user retest remains the gate.
- `OMP_FINAL_RESPONSE.md` records findings, root causes, fixes, affine transform math, property-channel authority, snap-guide invariant, GIF timing decision, observed validation, service state, the approved canonical metadata exception and the numbered retest procedure.
- PR #9 and #10 remain OPEN with unchanged heads `fac2bc1` and `74603de`.
- No merge, release, tag, npm publication, rebase, force push or API 5000 restart.

Local gates passed (latest V3.6 head, 2026-10-15): 173 files / 2599 unit tests and FULL Chromium **426 passed / 0 failed / 0 flaky** on the isolated QA config (UI 5188; API 5000 never touched); the earlier PR #11 round recorded 2598 unit tests / 415 Chromium at code commit `679f54f` with CI run [38744301819](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/38744301819). Live 5173 serves this same combined worktree (listener 48984) and shows the V3.6 head; API 5000 remains healthy on unchanged listener 2308. The V3.6 documents-only refresh adds no runtime changes; its head/CI is reported in `manifest.txt` on delivery.

## Record precedence

The remediation record and manifest are the current task authority. Other documents retained here are historical snapshots or exact mirrors of root documents. Their old validation counts and next-session narratives are context, not current remediation results. No root document, historical report or mirrored roadmap was modified for this task.


## Upload

Upload only `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`. The one-file is regenerated from this scoped handoff before delivery; do not upload individual bundle files.
