---
name: kcs-git-workflow
description: Use when doing git operations in Keyframe Studio: branching, commits, merges, push.
version: 2.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, git, branching, commits, merges, workflow]
    related_skills: [kcs-constitution, kcs-workflows]
---

# Git Workflow

Hermes port of the repo's `.agents/workflows/git.md` and `.agents/BRANCH_STRATEGY.md` (consolidated).

## Objective

Safely prepare branches, commits, merges, and Git operations while preserving a clean, stable, and traceable project history.

Never perform Git operations automatically without explicit user approval.

---

## Branch Strategy

All Git branching decisions for the Keyframe Character Studio project must follow this strategy.

### Core Principles

Always:

- Keep `main` stable and production-ready.
- Isolate development work.
- Use descriptive branch names.
- Keep branch history clean and understandable.
- Reuse existing branches whenever appropriate.
- Delete temporary working branches after successful merges.

Never:

- Work directly on `main` unless explicitly approved.
- Push unfinished work to `main`.
- Merge without validation.
- Leave obsolete working branches behind.
- Create unnecessary long-lived branches.

### Branch Types

This project uses two types of branches.

**1. Long-lived Branches** — represent major functional domains of the project.

Examples may include: ui, timeline, renderer, animation, backend, infrastructure. These are examples only; the actual list evolves as the project grows.

When selecting a long-lived branch:

- Prefer reusing an existing long-lived branch.
- If no appropriate branch exists, propose a new one.
- Explain why the new branch is necessary.
- Wait for explicit user approval before creating it.

Do not create new long-lived branches automatically.

**2. Working Branches** — every implementation must be performed inside a temporary working branch.

Examples:

- feature/ui/new-toolbar
- feature/timeline/onion-skin
- feature/renderer/masking
- bugfix/timeline/playhead-jump
- bugfix/backend/project-loading
- refactor/renderer/render-pipeline
- performance/renderer/canvas-cache
- cleanup/remove-dead-code
- docs/api-update

Working branches must always be created from the most appropriate long-lived branch.

### Branch Selection

Before creating any branch:

1. Analyze the requested task.
2. Identify the affected project domain.
3. Search for an existing long-lived branch representing that domain.
4. Reuse the existing branch whenever possible.
5. If none exists:
   - Explain why.
   - Propose a meaningful branch name.
   - Wait for explicit approval before creating it.

Avoid creating unnecessary branches.

### Development Workflow

Standard workflow:

Long-lived Branch → Create Working Branch → Implementation → Validation → Commit → Merge into Long-lived Branch → Delete Working Branch

### Branch Lifecycle

Working branches are temporary. After a successful merge into their parent branch:

- Delete the working branch.
- Keep the parent long-lived branch.
- Continue future work from the appropriate long-lived branch.
- Never reuse an old working branch for unrelated work.

Never delete `main` or long-lived branches unless explicitly approved by the user.

### Main Branch Policy

The `main` branch always represents the stable version of the project.

Never:

- Commit directly to `main`.
- Merge directly into `main`.
- Push directly to `main`.

Unless explicitly approved by the user.

Before merging into `main`:

- All validations must pass.
- TypeScript must compile successfully.
- Relevant tests must pass.
- Runtime behavior must be preserved unless intentionally changed.
- The feature must already be integrated into its appropriate long-lived branch.

Preferred promotion flow: Working Branch → Long-lived Branch → main. Direct promotion from a working branch to `main` should be avoided unless explicitly approved.

### Branch Naming

Use lowercase names with hyphens and clear, descriptive names.

Good examples: feature/timeline/onion-skin, feature/ui/new-toolbar, bugfix/backend/project-save, refactor/renderer/cache-system, performance/timeline/playback, cleanup/remove-unused-hooks.

Avoid: NewBranch, TimelineFix, branch1, temp, mybranch.

### Merge Policy

Before every merge, verify:

- Correct source branch
- Correct target branch
- Clean working tree
- Successful validation
- Approved commit history

Wait for explicit user approval before merging. Never merge automatically.

### Branch Cleanup

After a successful merge:

- Delete the temporary working branch.
- Keep long-lived branches.
- Never delete long-lived branches without approval.

Verify that the working tree remains clean after branch cleanup.

### AI Responsibilities

When performing Git operations, always:

- Analyze the requested task.
- Select the most appropriate project domain.
- Reuse existing branches whenever possible.
- Explain branch selection.
- Explain merge targets.
- Explain why a new branch is or is not required.
- Verify the Git state before every commit or merge.

Never:

- Assume the correct branch without analysis.
- Create branches unnecessarily.
- Merge automatically.
- Push automatically.

Always wait for explicit user approval before: creating branches, creating commits, merging branches, deleting branches, pushing to remote repositories.

### Scalability

This branching strategy is intentionally domain-driven. The branch names shown above are illustrative examples rather than a fixed list. When selecting a branch: analyze the affected domain first, reuse existing long-lived branches whenever possible, propose new long-lived branches only when necessary, keep the branch hierarchy simple, avoid unnecessary fragmentation, maintain a clean, understandable, and traceable Git history.

---

## Git Operation Phases

### Phase 1 — Repository Audit

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
- Whether a new working branch should be created according to the Branch Strategy above

Do NOT commit yet.

### Phase 2 — Branch Planning

If the work requires a new branch:

1. Analyze the affected project domain.
2. Determine the appropriate long-lived branch according to the Branch Strategy.
3. If no suitable long-lived branch exists, ask for approval before creating one.
4. Create a short-lived working branch from the selected long-lived branch.
5. Explain the proposed branch structure.

Wait for approval before creating branches.

### Phase 3 — Commit Plan

Prepare a commit plan. Include:

- Current branch
- Target branch
- Files included in each commit
- Commit order
- Commit messages
- Why commits are grouped that way

Use Conventional Commits whenever possible:

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

### Phase 4 — Commit

After approval, create only the approved commits.

Requirements:

- No force push
- No amend
- No history rewrite
- No squash unless explicitly requested
- Do not modify Git configuration
- Do not modify remote configuration
- Do not delete long-lived branches
- Do not create tags unless explicitly requested

Verify with `git status` — the working tree must be clean.

### Phase 5 — Merge

Never merge automatically.

Before merging verify:

- Source branch
- Target branch
- Merge strategy
- Working tree is clean
- Requested validations completed

Wait for explicit approval. Only after approval:

- Merge the working branch into its parent branch.
- Delete the temporary working branch after a successful merge.

Never merge into `main` without explicit approval.

### Phase 6 — Push

Never push automatically.

Before pushing verify:

```bash
git branch --show-current
git remote -v
git status
```

Wait for explicit confirmation. Only after approval:

```bash
git push
```

Never push directly to `main` unless explicitly instructed.

### Final Report

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
