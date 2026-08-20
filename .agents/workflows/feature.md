---
description: Safely implement new features while preserving existing behavior.
---

# Feature Implementation Workflow

## Objective

Implement a new feature while preserving architecture, stability, backward compatibility, and overall code quality.

Follow all rules defined in:

- .agents/AGENTS.md
- .agents/CODING_STYLE.md
- .agents/PROJECT_CONTEXT.md

---

# Phase 1 — Analysis

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

Do NOT modify any files yet.

Present:

- Scope
- Architectural analysis
- Dependency analysis
- Risks
- Implementation plan

Wait for explicit approval.

---

# Phase 2 — Implementation

After approval:

Implement only the approved scope.

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

---

# Phase 3 — Validation

Run whenever available:

```bash
npm run build
```

```bash
npx tsc --noEmit
```

Run all relevant tests.

Verify:

- Runtime behavior preserved
- Public APIs preserved
- TypeScript clean
- ESLint clean
- Tests passing

---

# Final Report

Provide:

- Files modified
- Files created
- Feature summary
- Runtime impact
- Public API impact
- Validation results
- Remaining risks

End with:

PASS

or

FAIL