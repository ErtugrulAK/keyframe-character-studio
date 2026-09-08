---
description: Route an independent correctness and regression review through the dedicated reviewer agent.
---

# KCS Independent Review

Review target:

$ARGUMENTS

You are the main orchestrator. Keep the current main-session model unchanged.

Use the task tool and dispatch exactly one task with:

- agent: `reviewer-agent`;
- task: independently review the requested target for correctness, compatibility, risks, and regressions;
- read-only behavior unless implementation was already explicitly authorized.

The reviewer agent must return severity-ranked findings with concrete evidence, verified strengths, checks performed, residual risks, and an explicit approval or blocking recommendation.

Present the review without modifying product files and do not interrupt the user unnecessarily.
