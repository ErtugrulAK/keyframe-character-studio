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
- Read `reports/DEVELOPMENT_REPORTING_POLICY.md` before planning or implementing a meaningful milestone. It is the single canonical reporting policy; do not duplicate it in other workflow files.
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

### Optional clarification gate

Activate this gate only when critical product semantics are materially unclear. Ask only questions that can change:

- scope;
- ownership;
- persistence;
- user-visible behavior;
- compatibility; or
- acceptance criteria.

When activated:

1. Identify overloaded or newly introduced domain terms.
2. Resolve hard-to-reverse design choices before proposing implementation scope.
3. Use one canonical term in the plan and report.
4. Record durable terminology or a decision only when the approved glossary or ADR criteria qualify.
5. Continue to alternatives, risks, proposed scope, and explicit approval.

If semantics are clear, skip this gate and continue the normal milestone workflow. This is a bounded clarification step, not a mandatory interview, external router, issue-tracker flow, or Skill-tool invocation.

### Conditional architecture lens

For ownership changes, new public interfaces, cross-domain behavior, duplicated authorities, high-risk domain boundaries, or meaningful testability/seam questions, use the conditional codebase-design lens in `kcs-workflows`. Inspect module depth, seams, adapters, locality, authority duplication, orchestration versus domain logic, and public interface shape, then map the result to:

`pure helper → domain hook → thin context → minimal component`

Skip this lens for simple copy, local CSS, routine deterministic fixes, and unrelated documentation. Do not rename KCS architecture or create an abstraction solely to match external vocabulary.

### Test decision

Select testing discipline from the observable contract and available seam:

- **REQUIRED** — A reproducible behavioral bug with a correct stable seam; a new pure domain helper; new deterministic core/domain behavior; or a compatibility-sensitive deterministic contract with a public seam. Prefer a failing test, minimal implementation, green result, and only approved or necessary refactoring.
- **RECOMMENDED** — Hook behavior, cross-domain orchestration, renderer/matte behavior with a stable DOM or pixel seam, or interaction behavior with a meaningful browser/DOM/pixel assertion.
- **NOT NECESSARY** — Documentation-only changes, reports, workflow prose, simple agent-instruction maintenance, or a high-friction visual issue with no real stable test seam.

For browser-only behavior, reproduce in the browser first and test the stable portion when a real seam exists. If no correct seam can exercise the defect, document that limitation and use appropriate browser/manual evidence. Preserve focused tests first, relevant E2E/browser checks next, and full regression when scope warrants it.

## 3. Implementation and QA

- Implement only the approved package, in small internally verifiable phases.
- Preserve legacy compatibility unless the approved scope explicitly changes it.
- Prefer extending existing deterministic utilities and domain hooks, with thin context/UI wiring.
- Do not refactor unrelated code or start the next roadmap item.
- For an approved master package, continue through its internal phases without stopping after every small step unless `AGENTS.md`, the user, or a newly discovered protected/high-risk decision requires a new approval boundary.
- After each phase, run focused unit/component/integration tests and relevant Playwright scenarios for the changed contract.
- Run `/regression` after implementation when the package reaches full-regression scope. Classify failures; never weaken assertions or hide failures with skips, retries, sleeps, thresholds, tolerances, or fallbacks.
- Audit the final diff, public contracts, compatibility paths, generated artifacts, and Git scope. Stop for unexpected user changes.
- During final scope audit, create `reports/progress_XXX.md` using the next sequential number and the canonical reporting policy. A meaningful milestone is incomplete until the report exists and is verified.
## Final report

Before the short terminal response:

- Verify the required numbered development report exists and was not written over an earlier report.
- Record exact commands, test paths, outcomes, known limitations, Git state, and remaining risks in the report. Never claim unrun checks.
- Keep chat output short; the permanent technical record belongs in `reports/progress_XXX.md`.

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
