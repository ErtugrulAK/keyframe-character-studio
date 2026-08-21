---
description: Investigate and implement an approved minimal bug fix with evidence-driven validation.
---

# Keyframe Character Studio Bugfix

Bug request:

$ARGUMENTS

Follow this workflow:

`USER BUG → REPRODUCE → AUTHORITY → ROOT CAUSE → COMPATIBILITY/RISK → MINIMAL FIX → FOCUSED TESTS → REGRESSION → VALIDATION → SCOPE AUDIT → REPORT`

## 1. Safety and approval

- Read repository-root `AGENTS.md` first; it is the main authority.
- Inspect branch, HEAD, upstream, ahead/behind, staged/unstaged changes, and untracked files before investigation.
- Existing unrelated files under `.hermes/desktop-attachments/` are local artifacts only; never touch them. Stop and report any other unexpected user change.
- Treat `$ARGUMENTS` as the bug description, not automatic permission for unapproved protected/high-risk changes. Do not edit until the conversation contains explicit implementation approval required by `AGENTS.md`.
- Never create/switch branches, commit, push, merge, rebase, reset, or stash.

## 2. Investigate without guessing

1. Reproduce the reported behavior through the smallest realistic path and record the observed result.
2. Trace the exact state, data, evaluation, render, or persistence authority. Distinguish a UI symptom from canonical data mutation.
3. Inspect relevant boundaries when implicated: serialization/import/export, history/undo, templates/presets, runtime/playback/broadcast, clipboard, migration, renderer, and browser storage/API boundaries.
4. Identify the exact trigger and root cause from evidence. Classify it as data/state mutation, derivation/evaluation, rendering, orchestration, persistence/migration, compatibility, environment/tooling, test defect, or unresolved.
5. Explain backward-compatibility, public-API, history, serialization, playback, broadcast, and rendering risks that actually apply.
6. Reuse the existing canonical utility, domain hook, context path, or renderer authority. Do not add a parallel system or perform unrelated refactoring.

If the root cause remains unproven, stop and report the missing evidence. Do not guess.

## 3. Fix and validate

- Implement the smallest approved source fix at the owning authority.
- Add or change tests only when the approved task requires it or the observable bug contract is otherwise uncovered. Never weaken assertions, add skips/retries/sleeps, widen thresholds/tolerances, or hide the failure.
- Re-run the original reproduction and focused tests.
- Run relevant regression for affected boundaries.
- Run the full validation workflow when the risk or approved scope warrants it, using the real repository commands from `/regression` and repository-local executables when wrappers fail.
- Audit the final diff for unrelated edits, compatibility changes, debug code, generated artifacts, and unexpected working-tree changes.

## Final report

Return:

- reproduction and post-fix confirmation;
- proven root cause and classification;
- exact trigger;
- exact fix and owning authority;
- files changed;
- focused tests and broader validation results;
- regressions checked;
- remaining risks or environment limits;
- final working-tree scope;
- commit readiness: `READY`, `NOT READY`, or `BLOCKED` with reason.

Do not commit or push.
