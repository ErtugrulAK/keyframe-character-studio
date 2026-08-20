---
name: kcs-workflows
description: Use when implementing any task in Keyframe Studio: feature, bugfix, refactor, cleanup, performance, review, tests, architecture planning.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, workflows, feature, bugfix, refactor, cleanup, performance, review, testing, architecture]
    related_skills: [kcs-constitution, kcs-project-context, kcs-coding-style, kcs-git-workflow]
---

# KCS Task Workflows

Consolidated Hermes port of the repo's `.agents/workflows/*.md` files (architecture, feature, bugfix, refactor, cleanup, performance, review, testing).

## Dispatch — Which Section Applies

| Task type | Section |
|---|---|
| Planning / analyzing architecture before coding | §1 Architecture & Planning |
| Adding a new feature | §2 Feature |
| Fixing a bug | §3 Bugfix |
| Refactoring existing code | §4 Refactor |
| Cleaning up / hardening the codebase | §5 Cleanup & Hardening |
| Performance optimization | §6 Performance |
| Reviewing code (read-only) | §7 Code Review |
| Writing / improving tests | §8 Testing |

## Common Rules (apply to all workflows)

- Follow `kcs-constitution` — approval-first: analyze → plan → approval → implement → validate. Never modify files without explicit user approval.
- Follow `kcs-coding-style` and `kcs-project-context`.
- Preserve runtime behavior, public APIs, and backward compatibility unless explicitly approved.
- No unrelated refactoring, no formatting-only changes, no feature additions (unless the workflow is for features).
- Conversation in Turkish; code, comments, and commits in English.
- Validation (run whenever available): `npm run build`, `npx tsc --noEmit`, and the relevant tests.
- End every task with a final report ending in PASS or FAIL.

---

## §1 Architecture & Planning

Port of `.agents/workflows/architecture.md`.

**Objective:** Analyze the requested work and produce a complete implementation plan without modifying the codebase.

### Phase 1 — Request Analysis

Understand:

- Requested change
- Business objective
- Functional requirements
- Non-functional requirements

Determine:

- Affected domains
- Existing implementation
- Architectural constraints

### Phase 2 — Boundary Analysis

Identify:

- Hooks
- Components
- Context Providers
- Utilities
- Types
- Constants
- Shared modules
- External integrations

Verify:

- Dependency direction
- Separation of concerns
- Circular dependency risks
- Runtime boundaries

### Phase 3 — Architectural Assessment

Explain:

- Current architecture
- Proposed architecture
- Why the proposal is preferred
- Alternative solutions
- Trade-offs

### Phase 4 — Implementation Plan

Produce:

- Files to modify
- Files to create
- Files to remove
- Public API impact
- Runtime impact
- Validation strategy
- Testing strategy
- Potential risks
- Estimated implementation order

### Phase 5 — Approval

Stop here. Do NOT modify, create, delete, or rename files. Wait for explicit user approval before implementation begins.

---

## §2 Feature

Port of `.agents/workflows/feature.md`.

**Objective:** Implement a new feature while preserving architecture, stability, backward compatibility, and overall code quality.

### Phase 1 — Analysis

Analyze the requested feature before writing any code.

Determine:

- Feature scope
- Business requirements
- Affected domains
- Affected architectural boundaries
- Dependencies
- Runtime implications
- Existing reusable utilities/hooks/components

Identify:

- Files to modify
- Files to create
- Files to remove (if necessary)

Do NOT modify any files yet. Present:

- Scope
- Architectural analysis
- Dependency analysis
- Risks
- Implementation plan

Wait for explicit approval.

### Phase 2 — Implementation

After approval, implement only the approved scope.

Requirements:

- Preserve runtime behavior unless explicitly requested.
- Preserve public APIs unless explicitly approved.
- Preserve backward compatibility.
- Respect existing architecture.
- Respect coding conventions.
- Write defensive code.
- Reuse existing utilities whenever possible.
- Avoid duplicated logic.
- Prefer composition over duplication.
- Keep business logic outside UI components.
- Keep Context Providers thin.
- Do not perform unrelated refactoring.
- Do not perform formatting-only changes.

### Phase 3 — Validation

Run the shared validation commands (see Common Rules). Run all relevant tests.

Verify:

- Runtime behavior preserved
- Public APIs preserved
- TypeScript clean
- ESLint clean
- Tests passing

### Final Report

Provide:

- Files modified
- Files created
- Feature summary
- Runtime impact
- Public API impact
- Validation results
- Remaining risks

End with PASS or FAIL.

---

## §3 Bugfix

Port of `.agents/workflows/bugfix.md`.

**Objective:** Fix a defect with the smallest possible change while preserving runtime behavior.

### Phase 1 — Investigation

Do NOT modify code.

Determine:

- Root cause
- Affected files
- Runtime impact
- Regression risk
- Related domains
- Whether existing tests already cover the issue

Present:

- Root cause
- Proposed fix
- Risk assessment

Wait for approval.

### Phase 2 — Implementation

Implement the minimal safe fix.

Requirements:

- Preserve runtime behavior.
- Preserve public APIs.
- No unrelated refactoring.
- No unrelated optimization.
- No architectural changes unless approved.
- Keep the patch as small as possible.
- Use defensive programming when appropriate.

### Phase 3 — Validation

Run `npx tsc --noEmit` and all related tests.

Verify:

- Bug resolved
- No regressions
- Runtime preserved
- Public APIs preserved

### Final Report

Provide:

- Root cause
- Files modified
- Exact fix
- Regression risks
- Validation results

End with PASS or FAIL.

---

## §4 Refactor

Port of `.agents/workflows/refactor.md`.

**Objective:** Improve internal code quality without changing externally observable behavior.

### Phase 1 — Analysis

Determine:

- Why refactoring is needed
- Scope
- Affected architecture
- Risks
- Runtime equivalence

Present:

- Analysis
- Proposed changes
- Expected improvements

Wait for approval.

### Phase 2 — Refactoring

Requirements:

- Preserve runtime behavior.
- Preserve public APIs.
- Preserve UX.
- Preserve architecture.
- No feature additions.
- No behavior changes.
- Reduce duplication.
- Improve readability.
- Improve maintainability.
- Respect existing naming conventions.

### Phase 3 — Validation

Run the shared validation commands (see Common Rules). Run all related tests.

Verify:

- Runtime preserved
- Public APIs preserved
- No regressions

### Final Report

Provide:

- Files modified
- Logic moved
- Code quality improvements
- Runtime equivalence
- Validation results

End with PASS or FAIL.

---

## §5 Cleanup & Hardening

Port of `.agents/workflows/cleanup.md`.

**Objective:** Improve the quality, safety, and maintainability of the existing codebase. This workflow is **NOT** for adding new features — strictly for cleaning, simplifying, and hardening existing code.

### Phase 1 — Codebase Audit

Before making any changes, perform a complete audit. Inspect for:

- Dead code
- Unused files, exports, imports, variables, parameters
- Duplicate logic / duplicate utilities
- Orphan components, hooks, types
- Unreachable code
- Legacy compatibility code
- Stale TODO/FIXME comments

Also inspect:

- Defensive programming
- Runtime safety
- Optional chaining opportunities
- Null/undefined handling
- Error handling
- JSON.parse safety
- Async error handling
- Missing try/catch
- Fallback correctness

### Phase 2 — Cleanup Plan

Explain:

- What should be removed
- What should be simplified
- What should remain
- What is intentionally preserved
- Possible risks

Wait for approval. Do NOT modify code yet.

### Phase 3 — Cleanup

After approval, only perform approved cleanup.

Allowed:

- Remove dead code, unused imports/exports/variables
- Remove duplicate code
- Simplify repetitive logic
- Improve defensive programming
- Add optional chaining where appropriate
- Add safe guards against runtime crashes
- Add try/catch around unsafe boundaries

Forbidden:

- New features
- UI changes
- API changes
- Runtime behavior changes
- Performance optimizations unrelated to cleanup
- Architectural refactoring unless explicitly requested

### Phase 4 — Validation

Run `npx tsc --noEmit` and tests if available.

Verify:

- Runtime behavior unchanged
- Public APIs unchanged
- No dead code / unused imports / unused exports / duplicate logic remains
- Defensive programming improved

### Final Report

Produce a detailed report including:

- Files modified
- Dead code removed
- Duplicate logic removed
- Defensive improvements
- Runtime safety improvements
- Remaining technical debt

End with PASS or FAIL.

---

## §6 Performance

Port of `.agents/workflows/performance.md`.

**Goal:** Improve performance only.

Rules:

- No behavior changes.
- Preserve APIs.
- Preserve architecture.

Look for:

- unnecessary renders
- memoization
- heap allocations
- object recreation
- expensive loops
- deep cloning
- stale closures
- unnecessary effects

Before coding, explain:

- Bottleneck
- Proposed optimization
- Risk

Wait for approval. After implementation, validate and produce a benchmark-style report.

---

## §7 Code Review

Port of `.agents/workflows/review.md`.

Read-only mode. Do NOT modify code.

Review:

- Architecture
- Dependency graph
- Runtime risks
- Dead code
- Defensive programming
- Performance
- React patterns
- Type safety
- API consistency

Classify findings:

- Critical
- High
- Medium
- Low

Produce recommendations only.

---

## §8 Testing

Port of `.agents/workflows/testing.md`.

**Goal:** Improve and maintain reliable automated test coverage across the project.

### Allowed

- Unit tests
- Hook tests
- Integration tests
- End-to-end (E2E) tests

### Forbidden

- Refactoring production code unless strictly required to make the code testable.
- Changing business logic solely to satisfy tests.

### Before Implementation

Always explain:

- Test scope
- Files that will be created or modified
- Mock strategy
- Test scenarios that will be covered

Wait for explicit approval before writing tests.

### Test Coverage Policy

Whenever a new hook, utility, or core business feature is added:

- Update existing tests if necessary.
- Create new tests covering the new behavior.
- Verify that existing tests still pass.
- No production feature is considered complete without appropriate automated test coverage.

Prefer:

- Unit tests for pure utilities.
- Hook tests for custom React hooks.
- Integration tests for cross-domain interactions.
- End-to-end tests for critical user workflows.

### After Implementation

Run the appropriate validation commands (see Common Rules), such as `npm test`, `vitest`, `npm run test:e2e`, or `playwright test`. Also run `npx tsc --noEmit` if production code was modified.

### Final Report

Provide a concise report including:

- Test files created or modified
- Total tests executed
- Passing / failing test counts
- Coverage summary (if available)
- Mock inventory
- Remaining coverage gaps
- Any production issues discovered during testing (record only; do not fix unless explicitly approved)
