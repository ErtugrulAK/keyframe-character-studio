---
name: kcs-performance-workflow
description: Use when optimizing performance in Keyframe Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, performance, optimization, workflow]
    related_skills: [kcs-constitution, kcs-refactor-workflow]
---

# Performance Workflow

Hermes port of the repo's `.agents/workflows/performance.md`.

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
