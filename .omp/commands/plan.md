---
description: Produce a read-only implementation plan through the dedicated planning agent.
---

# KCS Planning Phase

Planning request:

$ARGUMENTS

You are the main orchestrator. Keep the current main-session model unchanged.

Use the task tool and dispatch exactly one task with:

- agent: `planner-agent`;
- task: inspect the current repository and produce an implementation-ready plan;
- plan-only behavior with no product or Git changes.

The planner agent must identify the current contract, exact gap, affected files, canonical authorities, ordered work, alternatives, risks, compatibility constraints, acceptance criteria, and validation sequence.

Present the resulting plan and do not modify files.
