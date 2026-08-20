---
description: Safely prepare commits and push changes following the project's Git workflow.
---

# Git Workflow

## Objective

Safely prepare branches, commits, merges, and Git operations while preserving a clean, stable, and traceable project history.

Never perform Git operations automatically without explicit user approval.

Always follow the project's branching strategy defined in:

.agents/BRANCH_STRATEGY.md

---

# Phase 1 — Repository Audit

Before performing any Git operation, inspect the repository.

Run and analyze:

```bash
git status
git diff --stat
git diff
git branch --show-current
git branch
git remote -v
```

Determine:

- Which files changed
- Whether the changes belong together
- Whether multiple commits are preferable
- Whether generated files are accidentally staged
- Whether `.gitignore` requires updates
- Whether the current branch is appropriate
- Whether a new working branch should be created according to the project's branching strategy

Do NOT commit yet.

---

# Phase 2 — Branch Planning

If the work requires a new branch:

1. Analyze the affected project domain.
2. Determine the appropriate long-lived branch according to the branch strategy.
3. If no suitable long-lived branch exists, ask for approval before creating one.
4. Create a short-lived working branch from the selected long-lived branch.
5. Explain the proposed branch structure.

Wait for approval before creating branches.

---

# Phase 3 — Commit Plan

Prepare a commit plan.

Include:

- Current branch
- Target branch
- Files included in each commit
- Commit order
- Commit messages
- Why commits are grouped that way

Use Conventional Commits whenever possible.

Examples:

- feat:
- fix:
- refactor:
- perf:
- test:
- docs:
- style:
- build:
- ci:
- chore:

Wait for approval.

---

# Phase 4 — Commit

After approval:

Create only the approved commits.

Requirements:

- No force push
- No amend
- No history rewrite
- No squash unless explicitly requested
- Do not modify Git configuration
- Do not modify remote configuration
- Do not delete long-lived branches
- Do not create tags unless explicitly requested

Verify:

```bash
git status
```

The working tree must be clean.

---

# Phase 5 — Merge

Never merge automatically.

Before merging verify:

- Source branch
- Target branch
- Merge strategy
- Working tree is clean
- Requested validations completed

Wait for explicit approval.

Only after approval:

- Merge the working branch into its parent branch.
- Delete the temporary working branch after a successful merge.

Never merge into `main` without explicit approval.

---

# Phase 6 — Push

Never push automatically.

Before pushing verify:

```bash
git branch --show-current
git remote -v
git status
```

Wait for explicit confirmation.

Only after approval:

```bash
git push
```

Never push directly to `main` unless explicitly instructed.

---

# Final Report

Provide:

- Current branch
- Target branch (if merged)
- Remote
- Number of commits created
- Commit hashes
- Commit messages
- Merge status
- Push status
- Final `git status`

End with:

PASS

or

FAIL