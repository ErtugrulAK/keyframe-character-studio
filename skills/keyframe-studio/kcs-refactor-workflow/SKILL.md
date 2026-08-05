---
name: kcs-refactor-workflow
description: Use when refactoring code in Keyframe Character Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, refactor, workflow]
    related_skills: [kcs-constitution, kcs-testing-workflow]
---

# Refactoring Workflow

Hermes port of the repo's `.agents/workflows/refactor.md`.

## Objective

Improve internal code quality without changing externally observable behavior.

Follow:

- `kcs-constitution` (port of .agents/AGENTS.md)
- `kcs-coding-style` (port of .agents/CODING_STYLE.md)
- `kcs-project-context` (port of .agents/PROJECT_CONTEXT.md)

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
