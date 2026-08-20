---
description: Analyze the architecture and prepare an implementation plan without modifying code.
---

# Architecture & Planning Workflow

## Objective

Analyze the requested work and produce a complete implementation plan without modifying the codebase.

Follow:

- .agents/AGENTS.md
- .agents/CODING_STYLE.md
- .agents/PROJECT_CONTEXT.md

---

# Phase 1 — Request Analysis

Understand:

- Requested change
- Business objective
- Functional requirements
- Non-functional requirements

Determine:

- Affected domains
- Existing implementation
- Architectural constraints

---

# Phase 2 — Boundary Analysis

Identify:

- Hooks
- Components
- Context Providers
- Utilities
- Types
- Constants
- Shared modules
- External integrations

Verify:

- Dependency direction
- Separation of concerns
- Circular dependency risks
- Runtime boundaries

---

# Phase 3 — Architectural Assessment

Explain:

- Current architecture
- Proposed architecture
- Why the proposal is preferred
- Alternative solutions
- Trade-offs

---

# Phase 4 — Implementation Plan

Produce:

- Files to modify
- Files to create
- Files to remove
- Public API impact
- Runtime impact
- Validation strategy
- Testing strategy
- Potential risks
- Estimated implementation order

---

# Phase 5 — Approval

Stop here.

Do NOT:

- Modify files
- Create files
- Delete files
- Rename files

Wait for explicit user approval before implementation begins.