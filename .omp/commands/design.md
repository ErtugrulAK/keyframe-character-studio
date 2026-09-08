---
description: Route UI design research and visual critique through the dedicated designer agent.
---

# KCS Design Phase

Design task:

$ARGUMENTS

You are the main orchestrator. Keep the current main-session model unchanged.

Use the task tool and dispatch exactly one task with:

- agent: `designer-agent`;
- task: research the requested UI task, inspect the current implementation, and return an implementation-ready design brief;
- real browser or screenshot evidence when the task concerns visual behavior and that evidence is available.

The designer agent must:

1. Research, audit, and specify before implementation.
2. Inspect current UI behavior and existing architecture.
3. Separate confirmed observations from recommendations.
4. Identify UX, visual, accessibility, and implementation risks.
5. Return a screen-level and component-level design brief.
6. Avoid modifying product files unless implementation was already explicitly authorized.

After the agent returns, present its findings, implementation contract, validation suggestions, and unresolved questions. Do not interrupt the user unnecessarily.
