---
description: Safely refactor code while preserving runtime behavior.
---

# Refactoring Workflow

## Objective

Improve internal code quality without changing externally observable behavior.

Follow:

- .agents/AGENTS.md
- .agents/CODING_STYLE.md
- .agents/PROJECT_CONTEXT.md

---

# Phase 1 — Analysis

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

---

# Phase 2 — Refactoring

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

---

# Phase 3 — Validation

Run:

```bash
npm run build
```

```bash
npx tsc --noEmit
```

Run all related tests.

Verify:

- Runtime preserved
- Public APIs preserved
- No regressions

---

# Final Report

Provide:

- Files modified
- Logic moved
- Code quality improvements
- Runtime equivalence
- Validation results

End with:

PASS

or

FAIL