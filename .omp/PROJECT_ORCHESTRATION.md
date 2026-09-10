# KCS OMP Orchestration Policy

Applies to non-trivial work in this repository.

1. Build a dependency graph before delegating.
2. Launch 2–4 cheap, read-only scouts for inventory and independent evidence.
3. Use `planner-agent` only for complex sequencing or dependency analysis.
4. Use `designer-agent` only for UI, visual, or reference-screenshot review.
5. Use `slow-agent` only for hard architecture or debugging blockers.
6. Use `reviewer-agent` after focused tests pass or for the final audit.
7. The parent owns final integration and all overlapping writes.
8. Do not use expensive specialist agents for grep, inventory, or log sorting.
9. Never run multiple agents editing the same files concurrently.
10. Report actual agent/model metadata; when a field is unavailable, report `NOT EXPOSED`.

Suggested milestone order: research → implementation → focused tests → reviewer → full regression.

The project config keeps model selectors unchanged, limits task fan-out to four concurrent workers, isolates subagents, and caps active provider requests without changing providers or credentials.
