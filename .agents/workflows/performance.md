---
description: Optimize performance without changing application behavior.
---

# Performance Workflow

Goal:

Improve performance only.

Rules:

- No behavior changes.
- Preserve APIs.
- Preserve architecture.

Look for:

- unnecessary renders
- memoization
- heap allocations
- object recreation
- expensive loops
- deep cloning
- stale closures
- unnecessary effects

Before coding:

Explain:

- Bottleneck
- Proposed optimization
- Risk

Wait for approval.

After implementation:

Validate.

Produce benchmark-style report.