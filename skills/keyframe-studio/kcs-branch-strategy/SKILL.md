---
name: kcs-branch-strategy
description: Use when planning git branches in Keyframe Character Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, git, branching, workflow]
    related_skills: [kcs-constitution, kcs-git-workflow]
---

# Branch Strategy

Hermes port of the repo's `.agents/BRANCH_STRATEGY.md`. All Git branching decisions for the Keyframe Character Studio project must follow this document.

## Objective

Maintain a clean, stable, and scalable Git history by following a structured, domain-driven branching model.

---

## Core Principles

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

---

## Branch Types

This project uses two types of branches.

### 1. Long-lived Branches

Long-lived branches represent major functional domains of the project.

Examples may include:

- ui
- timeline
- renderer
- animation
- backend
- infrastructure

These are examples only.

The actual list of long-lived branches may evolve as the project grows.

When selecting a long-lived branch:

- Prefer reusing an existing long-lived branch.
- If no appropriate branch exists, propose a new one.
- Explain why the new branch is necessary.
- Wait for explicit user approval before creating it.

Do not create new long-lived branches automatically.

---

### 2. Working Branches

Every implementation must be performed inside a temporary working branch.

Examples:

Feature:

- feature/ui/new-toolbar
- feature/timeline/onion-skin
- feature/renderer/masking

Bug Fix:

- bugfix/timeline/playhead-jump
- bugfix/backend/project-loading

Refactor:

- refactor/renderer/render-pipeline

Performance:

- performance/renderer/canvas-cache

Cleanup:

- cleanup/remove-dead-code

Documentation:

- docs/api-update

Working branches must always be created from the most appropriate long-lived branch.

---

## Branch Selection

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

---

## Development Workflow

Standard workflow:

Long-lived Branch

↓

Create Working Branch

↓

Implementation

↓

Validation

↓

Commit

↓

Merge into Long-lived Branch

↓

Delete Working Branch

Example:

timeline

↓

feature/timeline/onion-skin

↓

Implementation

↓

Validation

↓

Commit

↓

Merge into timeline

↓

Delete feature/timeline/onion-skin

---

## Branch Lifecycle

Working branches are temporary.

After a successful merge into their parent branch:

- Delete the working branch.
- Keep the parent long-lived branch.
- Continue future work from the appropriate long-lived branch.
- Never reuse an old working branch for unrelated work.

Long-lived branches evolve continuously as their project domains evolve.

Never delete:

- `main`
- Long-lived branches

unless explicitly approved by the user.

---

## Main Branch Policy

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

Preferred promotion flow:

Working Branch

↓

Long-lived Branch

↓

main

Direct promotion from a working branch to `main` should be avoided unless explicitly approved.

---

## Branch Naming

Use:

- Lowercase names
- Hyphens
- Clear, descriptive names

Good examples:

- feature/timeline/onion-skin
- feature/ui/new-toolbar
- bugfix/backend/project-save
- refactor/renderer/cache-system
- performance/timeline/playback
- cleanup/remove-unused-hooks

Avoid:

- NewBranch
- TimelineFix
- branch1
- temp
- mybranch

---

## Merge Policy

Before every merge, verify:

- Correct source branch
- Correct target branch
- Clean working tree
- Successful validation
- Approved commit history

Wait for explicit user approval before merging.

Never merge automatically.

---

## Branch Cleanup

After a successful merge:

- Delete the temporary working branch.
- Keep long-lived branches.
- Never delete long-lived branches without approval.

Verify that the working tree remains clean after branch cleanup.

---

## AI Responsibilities

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

Always wait for explicit user approval before:

- Creating branches
- Creating commits
- Merging branches
- Deleting branches
- Pushing to remote repositories

---

## Scalability

This branching strategy is intentionally domain-driven.

The branch names shown in this document are illustrative examples rather than a fixed list.

As the project evolves, new functional domains may emerge.

When selecting a branch:

- Analyze the affected domain first.
- Reuse existing long-lived branches whenever possible.
- Propose new long-lived branches only when necessary.
- Keep the branch hierarchy simple.
- Avoid unnecessary fragmentation.
- Maintain a clean, understandable, and traceable Git history.
