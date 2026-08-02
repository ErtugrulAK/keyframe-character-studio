---
description: Safely prepare commits and push changes following the project's Git workflow.
---

# Git Workflow

## Objective

Safely prepare commits and Git operations while preserving a clean project history.

Never perform Git operations automatically without explicit user approval.

---

# Phase 1 — Repository Audit

Before committing, inspect the repository.

Run and analyze:

```bash
git status
git diff --stat
git diff
git branch --show-current
git remote -v
```

Determine:

- Which files changed
- Whether changes belong together
- Whether multiple commits are preferable
- Whether generated files are accidentally staged
- Whether .gitignore needs updates

Do NOT commit yet.

---

# Phase 2 — Commit Plan

Prepare a commit plan.

Include:

- Files included in each commit
- Commit order
- Commit messages
- Why commits are grouped that way

Use Conventional Commits whenever possible.

Examples:

feat:
fix:
refactor:
perf:
test:
docs:
style:
build:
ci:
chore:

Wait for approval.

---

# Phase 3 — Commit

After approval:

Create only the approved commits.

Requirements:

- No force push
- No amend
- No history rewrite
- No squash unless explicitly requested
- Do not modify Git configuration
- Do not change remote configuration
- Do not delete branches
- Do not create tags unless requested

Verify:

```bash
git status
```

Working tree must be clean.

---

# Phase 4 — Push

Never push automatically.

Before pushing:

Verify:

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

---

# Final Report

Provide:

- Branch name
- Remote
- Number of commits created
- Commit hashes
- Commit messages
- Push status
- Final git status

End with:

PASS

or

FAIL