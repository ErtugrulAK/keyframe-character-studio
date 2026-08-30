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

### Difficult-bug diagnosis discipline

For a hard, intermittent, regressed, slow, throwing, or unclear bug, refine the existing investigation with this single discipline:

`REPRODUCE → MINIMISE → HYPOTHESISE → INSTRUMENT → FIX ROOT CAUSE → REGRESSION TEST → REMOVE TEMP INSTRUMENTATION → VERIFY`

1. **REPRODUCE** — Establish a red-capable failing signal through the actual path. Prefer a focused test, browser/runtime scenario, CLI or fixture, or an explicitly approved throwaway harness. Interaction bugs should prefer browser/runtime evidence. Reproduce CI or build failures locally where practical.
2. **MINIMISE** — Remove inputs, steps, and configuration one at a time. Keep only load-bearing elements. For intermittent failures, record the exact symptom and observed reproduction rate.
3. **HYPOTHESISE** — For hard or unclear bugs, produce a small ranked set of falsifiable hypotheses. Each hypothesis must predict the result of changing one variable. Skip this extra ceremony for an obvious deterministic bug.
4. **INSTRUMENT** — Prefer debugger/REPL inspection, then targeted logs at authority boundaries. Change one variable at a time. Mark temporary instrumentation clearly so it can be removed.
5. **FIX ROOT CAUSE** — Fix the owning KCS authority. Do not add a duplicate state, evaluator, serializer, clock, geometry, or business-logic authority.
6. **REGRESSION TEST** — Capture the minimised failure at the correct stable public seam where practical. Do not add tautological or implementation-detail tests merely to claim coverage.
7. **REMOVE TEMP INSTRUMENTATION** — Remove temporary logs, harnesses, captured artifacts, and debug behavior before completion.
8. **VERIFY** — Re-run the original reproduction, regression test, focused verification, relevant browser/manual verification, and proportionate KCS validation. Document the root cause and evidence in the progress report.

Controlled reproduction may use explicitly scoped stress or repeated triggering to expose an intermittent failure. This is diagnosis evidence only. Final validation must remain deterministic and must not depend on arbitrary sleeps, retry loops, widened tolerances, weakened assertions, hidden fallbacks, or random thresholds.

## 3. Fix and validate

- Implement the smallest approved source fix at the owning authority.
- Add or change tests only when the approved task requires it or the observable bug contract is otherwise uncovered. Never weaken assertions, add skips/retries/sleeps, widen thresholds/tolerances, or hide the failure.

### Test decision

Apply the KCS test decision defined in `/milestone` when the bug fix also introduces or changes deterministic behavior. For a bug, a reproducible failure with a correct stable seam requires a regression test where practical; use the failing-test → minimal-fix → green sequence.

For hook, cross-domain, renderer/matte, or interaction behavior, prefer a focused test when a stable DOM, pixel, browser, or public seam exists. If the real defect has no stable seam, document the missing seam and use appropriate browser or manual evidence instead of a shallow test. Documentation-only workflow changes do not require product TDD.
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
- diagnosis sequence completed or the reason a shortened path was appropriate;
- exact reproduction signal, minimisation result, hypothesis/instrumentation evidence when used, and cleanup confirmation;
- regression-test seam or the documented reason no correct seam exists;
- root cause and supporting evidence recorded in the progress report.

Do not commit or push.
