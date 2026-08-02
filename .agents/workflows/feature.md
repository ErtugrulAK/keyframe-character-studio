---
description: Safely implement new features while preserving existing behavior.
---

# Feature Implementation Workflow

When implementing a new feature:

## Phase 1 — Analysis
- Understand the requested feature completely.
- Identify all affected files.
- Identify affected hooks, utilities, context providers and components.
- Verify architectural boundaries.
- Do NOT modify code yet.

Present:

- Scope
- Files affected
- Risks
- Dependency graph
- Implementation plan

Stop and wait for approval.

---

## Phase 2 — Implementation

After approval:

Implement only the approved scope.

Requirements:

- Preserve runtime behavior unless explicitly requested.
- Preserve public APIs unless explicitly requested.
- Respect existing architecture.
- Follow existing naming conventions.
- Write defensive code.
- Avoid duplicated logic.
- Reuse existing utilities whenever possible.
- Prefer composition over duplication.
- No unrelated refactoring.
- No formatting-only commits.

---

## Phase 3 — Validation

Run:

```bash
npm run typecheck
```

If unavailable:

```bash
npx tsc --noEmit
```

Run tests if they exist.

Report:

- Files modified
- Exact behavior added
- Public API changes
- Runtime impact
- Validation results
- Remaining technical debt

End with:

PASS

or

FAIL