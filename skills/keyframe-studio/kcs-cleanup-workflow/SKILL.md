---
name: kcs-cleanup-workflow
description: Use when cleaning up code in Keyframe Character Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, cleanup, hardening, workflow]
    related_skills: [kcs-constitution, kcs-testing-workflow]
---

# Codebase Cleanup & Hardening Workflow

Hermes port of the repo's `.agents/workflows/cleanup.md`.

## Objective

Improve the quality, safety, and maintainability of the existing codebase.

This workflow is **NOT** for adding new features.

It is strictly for cleaning, simplifying, and hardening existing code.

---

# Phase 1 — Codebase Audit

Before making any changes, perform a complete audit.

Inspect the project for:

- Dead code
- Unused files
- Unused exports
- Unused imports
- Unused variables
- Unused parameters
- Duplicate logic
- Duplicate utilities
- Orphan components
- Orphan hooks
- Orphan types
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

---

# Phase 2 — Cleanup Plan

Explain:

- What should be removed
- What should be simplified
- What should remain
- What is intentionally preserved
- Possible risks

Wait for approval.

Do NOT modify code yet.

---

# Phase 3 — Cleanup

After approval:

Only perform approved cleanup.

Allowed:

- Remove dead code
- Remove unused imports
- Remove unused exports
- Remove unused variables
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

---

# Phase 4 — Validation

Run:

```bash
npx tsc --noEmit
```

Run tests if available.

Verify:

- Runtime behavior unchanged
- Public APIs unchanged
- No dead code remains
- No unused imports remain
- No unused exports remain
- No duplicate logic remains
- Defensive programming improved

---

# Final Report

Produce a detailed report including:

- Files modified
- Dead code removed
- Duplicate logic removed
- Defensive improvements
- Runtime safety improvements
- Remaining technical debt

End with:

PASS

or

FAIL
