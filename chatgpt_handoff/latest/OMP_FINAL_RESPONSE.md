# OMP final response — manual QA round three remediation

Status: **round 3 implemented and validated on the current head; PR #9 updated. Not merged.**

## What was delivered

Thirteen round-3 findings (R3-01…R3-13) were remediated on `fix/manual-qa-round1-remediation` in seven
commits, on top of the already-recorded round-1 (A–J) and round-2 (R2-01…R2-12) work:

- `947dd48` — R3-10/R3-11 one canonical authored transform-keyframe truth: the layer-level keyframe
  action and the expanded X/Y rows write the same channels, a legacy composite list is re-expressed
  through the evaluator's own resolution, and `resolveTrackChannels` is the one read truth.
- `7931867` — R3-04 dragging any selected keyframe moves the whole selected set (clamped to the project
  range, stopping at the first frame it would overwrite; a set may move onto frames its members vacate).
- `a123a5a` — R3-13 ungroup bakes an animated container's motion into every child instead of refusing;
  `composeWorldTransform` is the single parent-child composition authority.
- `53f1941` — R3-01/R3-02/R3-05/R3-06/R3-07/R3-08/R3-09 timeline navigation and workspace controls.
- `06abc93` — R3-03/R3-05/R3-06 timeline hierarchy and resize affordances; tree/lane row alignment.
- `90b602e` — R3-12 GROUP/BIND/BOOLEAN out of Details; Bind through one `usePartBindingAuthoring` hook.
- `91f9fde` — the two specs that still asserted behaviour round 3 replaced were migrated to the new
  authorities (not weakened, skipped or retried).

Key measured outcome: R3-13 ungroup parity — the child's standalone world pose equals the in-container
world pose at **0.000e+0 over 26 sampled frames**; the R3-10/R3-11 channel authority is proven by
`src/tests/channelKeyframeAuthority.test.tsx`, and the R3-04 collision policy by
`src/tests/keyframeSetMove.test.ts`.

## Validation

Full validation on the round-3 head (isolated ports only; 5173/5000 never touched): the full gate was
green, including the FULL Chromium suite `--retries=0` (**361 passed, 0 failed, 0 flaky**) — the
one-file `chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md` carries the complete table. The first full-suite run
on the pre-migration revision caught two stale specs (359 passed / 2 failed); both were migrated to the
new behaviour and the suite was re-run green. No assertion was weakened, no spec was skipped and no
retry was added.

## Pull request

**#9 — OPEN, not merged** (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/9`). Round-3
code head `91f9fde9fb67a24881747aaba3c50f7249590fcb` (`91f9fde`), mergeable MERGEABLE, merge state CLEAN;
CI **CI Pipeline** run `38384921198` (`pull_request`) — **success**.

## Live surfaces

The 5173 QA preview keeps serving this worktree (vite listener pid 33512) and **API 5000 (pid 8872) was
never stopped or restarted**. No merge, no tag, no release and no npm publication happened. The user's
retest against 5173 is the merge gate; the exact retest list is in
`chatgpt_handoff\CHATGPT_UPLOAD_ONEFILE.md`.
