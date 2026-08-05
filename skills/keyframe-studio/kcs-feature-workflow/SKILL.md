---
name: kcs-feature-workflow
description: Use when adding a feature in Keyframe Character Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, feature, implementation, workflow]
    related_skills: [kcs-constitution, kcs-architecture-workflow, kcs-testing-workflow]
---

# Feature Implementation Workflow

Hermes port of the repo's `.agents/workflows/feature.md`.

## Objective

Implement a new feature while preserving architecture, stability, backward compatibility, and overall code quality.

Follow all rules defined in:

- `kcs-constitution` (port of .agents/AGENTS.md)
- `kcs-coding-style` (port of .agents/CODING_STYLE.md)
- `kcs-project-context` (port of .agents/PROJECT_CONTEXT.md)

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
