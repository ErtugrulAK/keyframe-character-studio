---
description: Safely fix bugs without changing unrelated behavior.
---

# Bug Fix Workflow

## Phase 1

Investigate only.

Do NOT modify code.

Identify:

- Root cause
- Files involved
- Runtime impact
- Risk level

Wait for approval.

---

## Phase 2

Implement the minimal fix.

Rules:

- Preserve existing behavior.
- Do not introduce refactoring.
- Do not optimize unrelated code.
- Keep patch minimal.
- Preserve public APIs.

---

## Phase 3

Validate.

Run:

```bash
npx tsc --noEmit
```

Run related tests.

Produce:

- Root cause
- Files modified
- Exact fix
- Regression risks
- Validation

PASS / FAIL