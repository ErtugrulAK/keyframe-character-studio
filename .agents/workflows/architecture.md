---
description: Analyze the architecture and prepare an implementation plan without modifying code.
---

# Architecture & Planning Workflow

## Objective

This workflow is strictly for analysis and planning.

Do NOT modify any code.

Do NOT create, edit, rename or delete files.

---

# Phase 1 — Understand the Request

Carefully analyze the requested feature, bug, refactor or improvement.

Understand:

- What is being requested.
- Why it is needed.
- Which domains are involved.
- Which files may be affected.

---

# Phase 2 — Boundary Analysis

Determine:

- Affected hooks
- Components
- Context providers
- Utilities
- Types
- Constants
- Shared modules

Verify architectural boundaries.

Detect:

- Cross-domain coupling
- Dependency direction
- Potential circular dependencies
- Runtime risks

---

# Phase 3 — Architectural Assessment

Explain:

- Current implementation
- Proposed implementation
- Why this approach is preferred
- Possible alternatives

If multiple approaches exist, compare them.

---

# Phase 4 — Implementation Plan

Produce a detailed implementation plan.

Include:

1. Files to modify
2. Files to create
3. Files to remove (if any)
4. Public API impact
5. Runtime impact
6. Risks
7. Validation strategy

---

# Phase 5 — Wait

Stop here.

Do NOT implement anything.

Explicitly wait for user approval.

Only after approval should implementation begin.