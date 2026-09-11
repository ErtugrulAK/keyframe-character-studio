# OMP KCS Optimization Plan

## Applied project-local plan

1. Prefer task delegation with `task.eager: preferred`.
2. Cap concurrent subagents at four.
3. Isolate subagent changes and apply successful patches through the parent.
4. Cap concurrent requests per actual provider: OpenAI Codex 3, Google Antigravity 2, OpenCode Go 4.
5. Keep compaction and mid-turn compaction enabled.
6. Keep branch summaries enabled.
7. Preserve project memory with the user-approved `memory.backend: mnemopi` setting; memory is intentionally enabled.
8. Keep bash auto-background at 60 seconds for long-running development commands.
9. Deny the explicitly listed destructive Git/filesystem command patterns.
10. Preserve the existing role-to-model map exactly.

## Deliberately not applied

- No model or provider replacement.
- No global configuration write.
- No advisor enablement; advisor remains manual.
- No context promotion; it is unnecessary without a demonstrated overflow.
- No GitHub CLI enablement.
- No browser or vision setting changes; existing settings already expose browser/headless routing.
- No retry fallback-chain changes; existing retry behavior remains intact because changing fallback targets risks model/provider semantics.

## Milestone operating order

Research → implementation → focused tests → reviewer → full regression.

Use 2–4 cheap read-only scouts first. Use planner-agent only for difficult sequencing, designer-agent for visual work, slow-agent for hard blockers, and reviewer-agent after focused validation. The parent integrates overlapping writes and reports metadata honestly.

## Rollback

Restore the pre-edit project file from `.omp/backups/config.yml.20260911-011842.bak`. No global rollback is needed because the global file was not modified.
