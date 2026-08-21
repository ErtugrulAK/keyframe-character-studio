---
description: Execute an approved large feature or refactor package through discovery, implementation, and QA.
---

# Keyframe Character Studio Milestone

Approved package request:

$ARGUMENTS

Follow this workflow:

`DISCOVERY → CURRENT CONTRACT → USER GOAL → GAP → EXISTING AUTHORITIES TO REUSE → ALTERNATIVES → RISKS → IMPLEMENTATION → FOCUSED QA → FULL REGRESSION → SCOPE AUDIT → FINAL REPORT`

## 1. Discovery and safety

- Read repository-root `AGENTS.md` first; it is the main engineering authority.
- Confirm the user-approved package and boundaries from `$ARGUMENTS` and the conversation. Do not invent milestone numbering or begin unrelated roadmap work.
- Inspect branch, HEAD, upstream, ahead/behind, staged/unstaged changes, and untracked files. Existing unrelated `.hermes/desktop-attachments/` files are local artifacts only and must never be touched. Stop for any other unexpected user change.
- Do not create/switch branches, commit, push, merge, rebase, reset, or stash.
- Before editing, identify protected/high-risk contracts and authorities touched by the package, including applicable animation channels/evaluation, playback, broadcast, rendering/matte/geometry, history, serialization/migration, presets, clipboard, and backward-compatibility paths.

## 2. Contract and design

1. Document current observable behavior and canonical ownership from current source, tests, types, and configuration.
2. State the approved user goal and the exact gap.
3. Identify existing pure utilities, domain hooks, context wiring, renderer paths, validators, serializers, and tests to extend.
4. Compare viable alternatives and reject duplicate engines, stores, serializers, clocks, evaluators, clipboard systems, or UI-owned business logic.
5. List compatibility, migration, public-API, data-loss, history, performance, rendering, and regression risks that actually apply.
6. Define implementation phases, affected files, contract tests, and validation before editing.

If approval is missing for implementation or a protected/high-risk contract, stop after the plan and request the required approval. If a destructive migration or unresolved architecture decision is required, stop and report options and trade-offs instead of guessing.

## 3. Implementation and QA

- Implement only the approved package, in small internally verifiable phases.
- Preserve legacy compatibility unless the approved scope explicitly changes it.
- Prefer extending existing deterministic utilities and domain hooks, with thin context/UI wiring.
- Do not refactor unrelated code or start the next roadmap item.
- For an approved master package, continue through its internal phases without stopping after every small step unless `AGENTS.md`, the user, or a newly discovered protected/high-risk decision requires a new approval boundary.
- After each phase, run focused unit/component/integration tests and relevant Playwright scenarios for the changed contract.
- Run `/regression` after implementation when the package reaches full-regression scope. Classify failures; never weaken assertions or hide failures with skips, retries, sleeps, thresholds, tolerances, or fallbacks.
- Audit the final diff, public contracts, compatibility paths, generated artifacts, and Git scope. Stop for unexpected user changes.

## Final report

Return:

- approved scope and completed phases;
- current contract, goal, and resolved gap;
- authorities reused and architectural decisions;
- files changed;
- focused QA and full regression results;
- compatibility/migration impact;
- scope-audit result;
- remaining risks or blocked decisions;
- final working-tree summary;
- commit readiness: `READY`, `NOT READY`, or `BLOCKED` with reason.

Do not commit or push.
