---
description: Safely fix bugs without changing unrelated behavior.
---

# Bug Fix Workflow

## Objective

Fix a defect with the smallest possible change while preserving runtime behavior.

Follow:

- .agents/AGENTS.md
- .agents/CODING_STYLE.md
- .agents/PROJECT_CONTEXT.md

---

# Phase 1 — Investigation

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

---

# Phase 2 — Implementation

Implement the minimal safe fix.

Requirements:

- Preserve runtime behavior.
- Preserve public APIs.
- No unrelated refactoring.
- No unrelated optimization.
- No architectural changes unless approved.
- Keep the patch as small as possible.
- Use defensive programming when appropriate.

---

# Phase 3 — Validation

Run:

```bash
npx tsc --noEmit
```

Run all related tests.

Verify:

- Bug resolved
- No regressions
- Runtime preserved
- Public APIs preserved

---

# Final Report

Provide:

- Root cause
- Files modified
- Exact fix
- Regression risks
- Validation results

End with:

PASS

or

FAIL