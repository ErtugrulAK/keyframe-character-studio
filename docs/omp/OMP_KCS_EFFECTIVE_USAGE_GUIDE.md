# OMP KCS Effective Usage Guide

## Standard milestone

For any non-trivial KCS milestone:

1. Start OMP from the repository root so `.omp/config.yml` is discovered.
2. Build the dependency graph and create a todo list.
3. Fan out two to four read-only scouts for independent inventory.
4. Implement through the parent or isolated child worktrees; never overlap writes.
5. Run focused tests for the changed surface.
6. Ask reviewer-agent for an independent audit.
7. Run the relevant full regression and report exact commands and outcomes.

## Routing guidance

- `smol`/`tiny`: inventory, lightweight classification, and bounded background work.
- `task`: implementation tasks that have a clear ownership boundary.
- `plan` / planner-agent: complex sequencing and architecture planning.
- `designer` / designer-agent: UI, visual, and screenshot critique.
- `slow` / slow-agent: difficult architecture or debugging blockers only.
- `commit` / commit-agent: safe scope and commit guidance; never use for implementation.
- reviewer-agent: post-focused-test or final independent review.
- advisor: manual only; not enabled globally.

The parent must report actual metadata. Use `NOT EXPOSED` when OMP does not emit a field.

## Concurrency and safety

Project fan-out is capped at four tasks. Provider request caps are OpenAI Codex 3, Google Antigravity 2, and OpenCode Go 4. Subagent isolation is enabled with patch integration. This is a throughput/safety balance; do not raise it for routine work.

Compaction and mid-turn compaction remain enabled. Branch summaries remain enabled. Project memory is off to avoid unexpected persistent context. Bash auto-background starts at 60 seconds for development servers and long Playwright runs.

The project policy denies the configured destructive command patterns. `tools.approvalMode` remains `yolo`; do not interpret the deny list as a substitute for review of destructive operations.

## Verification commands

```text
omp config path
omp config list --json
omp config get task.eager
omp config get task.maxConcurrency
omp config get providers.maxInFlightRequests
```

For KCS code changes, use the repository's normal focused test, TypeScript, lint, build, and relevant Playwright commands. Do not make production code depend on `.omp` files.

## Rollback

Restore `.omp/config.yml` from `.omp/backups/config.yml.20260911-011842.bak`. Start a fresh OMP session after changing file-based settings. The global configuration was not edited.
