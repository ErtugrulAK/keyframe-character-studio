---
name: kcs-bugfix-workflow
description: Use when fixing a bug in Keyframe Character Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, bugfix, debugging, workflow]
    related_skills: [kcs-constitution, kcs-testing-workflow, systematic-debugging]
---

# Bug Fix Workflow

Hermes port of the repo's `.agents/workflows/bugfix.md`.

## Objective

Fix a defect with the smallest possible change while preserving runtime behavior.

Follow:

- `kcs-constitution` (port of .agents/AGENTS.md)
- `kcs-coding-style` (port of .agents/CODING_STYLE.md)
- `kcs-project-context` (port of .agents/PROJECT_CONTEXT.md)

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
