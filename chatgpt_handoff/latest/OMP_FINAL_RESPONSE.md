# OMP final response — manual QA round four remediation

Status: **round 4 implemented, self-reviewed and validated on the frozen head; PR #9 updated. Not merged.**

## What was delivered

Sixteen round-4 findings (R4-01…R4-16) were remediated on `fix/manual-qa-round1-remediation` in sixteen
commits, on top of the already-recorded round-1 (A–J), round-2 (R2-01…R2-12) and round-3 (R3-01…R3-13)
work, plus two part-four commits:

- `9280335` — the two specs that still asserted behaviour round 4 replaced were migrated to the shipped
  contracts: `e2e/authoring-layer-group.spec.ts` now pins the R4-09 canvas rule (a first click on a child
  targets the group; only a canvas double-click drills in and makes the child primary) while keeping the
  original "the decorative frame never intercepts the pointer" intent, asserted directly with
  `document.elementFromPoint` on the child's own geometry; `e2e/workflow.spec.ts` asserts the transport into
  and out of its PLAYING state instead of sleeping a fixed second, because a default 60-frame / 60 FPS
  document is exactly 1.000 s under the R4-15 timebase.
- `d545cfc` — the round record (`reports/progress_170_manual_qa_round_four_remediation.md`) and the changelog.

Key measured outcomes:

- R4-07 sparse ungroup — the travelling-container case drops from one key per channel per frame to the
  container's own key times: **105 → 7 keys per child**, with the evaluated pose preserved at **1e-9**
  parity (and a rotation-mixing container keeping its genuinely dense channels, total < 60).
- R4-15 timebase — playback integrates elapsed wall-clock time, so a 30/60/120 FPS authoring of the same
  animation reaches the same frame at the same wall-clock instant; 30/60/120 parity is verified at t=1s and
  t=2s under 30/60/120/144 Hz cadences.
- R4-12 GIF export ships with **no new dependency**: the editor's own SVG render stack rasterised through an
  isolated image context, plus a from-scratch GIF89a encoder, with timing converted through the timebase.

## Validation

Full validation on the frozen round-4 head `d545cfc` (isolated ports only; 5173/5000 never touched): the
gate was green, including the FULL Chromium suite with `--retries=0` — **379 passed, 0 failed, 0 flaky** on
the repeated run. The one caveat: the first full run recorded the previously documented, load-sensitive
`camera-transition-stability` frame sample, which is **9/9 green in isolation** (`worstDelta=0.000px`) and
was left untouched — no tolerance raised, no retry added, no assertion weakened. No other failure occurred.
The one-file `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` carries the complete table.

## Pull request

**#9 — OPEN, not merged** (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`). Round-4 head
`d545cfca58978e82357c7f8ed8da8d1360710278` (`d545cfc`), mergeable **MERGEABLE**, merge state **CLEAN**;
CI **CI Pipeline** run `38420352883` (`pull_request`) — **success**.

## Live surfaces

The 5173 QA preview keeps serving this worktree (vite listener pid 50876; a branch-only module answers 200
there) and **API 5000 (pid 18280) was never stopped or restarted**. No merge, no tag, no release and no npm
publication happened. The user's retest against 5173 is the merge gate; the exact retest list is in
`chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
