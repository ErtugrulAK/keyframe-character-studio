---
name: kcs-architecture-workflow
description: Use when analyzing architecture of Keyframe Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, architecture, planning, workflow]
    related_skills: [kcs-constitution, kcs-project-context, kcs-feature-workflow]
---

# Architecture & Planning Workflow

Hermes port of the repo's `.agents/workflows/architecture.md`.

## Objective

Analyze the requested work and produce a complete implementation plan without modifying the codebase.

Follow:

- `kcs-constitution` (port of .agents/AGENTS.md)
- `kcs-coding-style` (port of .agents/CODING_STYLE.md)
- `kcs-project-context` (port of .agents/PROJECT_CONTEXT.md)

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
