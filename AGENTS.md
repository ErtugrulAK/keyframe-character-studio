# AGENTS.md — Keyframe Character Studio

This repository is developed with AI agents (Hermes Agent, Antigravity, etc.). Follow these rules when working here.

## Rules

1. **Load the project skills first** (Hermes skills under `skills/keyframe-studio/`):
   - `kcs-constitution` — constitution: analyze → plan → approval → implement → validate
   - `kcs-project-context` — architecture (Thin Orchestrator Pattern), stack, constraints
   - `kcs-branch-strategy` + `kcs-git-workflow` — domain-driven branching, commit rules
   - Task workflow skills as applicable: `kcs-feature-workflow`, `kcs-bugfix-workflow`, `kcs-refactor-workflow`, `kcs-cleanup-workflow`, `kcs-performance-workflow`, `kcs-review-workflow`, `kcs-testing-workflow`, `kcs-architecture-workflow`, `kcs-coding-style`
2. **Approval-first**: never modify files, create branches, commit, merge, or push without explicit user approval.
3. **Preserve**: runtime behavior, public APIs, backward compatibility.
4. **Language**: conversation in Turkish; all repo files, code, comments, and commit messages in English.
5. **Validation**: run `npm run build`, `npx tsc --noEmit`, and the relevant tests before declaring work complete.

The full constitution lives in `skills/keyframe-studio/kcs-constitution/SKILL.md` (mirror of `.agents/AGENTS.md`).
