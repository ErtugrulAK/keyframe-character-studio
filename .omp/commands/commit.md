---
description: Route safe Git status and commit-scope guidance through the dedicated commit helper agent.
---

# KCS Safe Commit Guidance

Commit request:

$ARGUMENTS

You are the main orchestrator. Keep the current main-session model unchanged.

Use the task tool and dispatch exactly one task with:

- agent: `commit-agent`;
- task: inspect Git state and explain the safe approved scope for the requested checkpoint or commit;
- no destructive Git operation and no unrelated staging.

The commit agent must inspect status and diff, preserve unrelated files, and never reset, clean, stash, amend, merge, rebase, push, or commit unless that exact operation was already explicitly authorized.

Present evidence-backed guidance. Do not modify product files or Git state.
