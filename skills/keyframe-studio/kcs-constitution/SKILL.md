---
name: kcs-constitution
description: Use when working on Keyframe Character Studio project.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, constitution, rules, approval-first, defensive-programming]
    related_skills: [kcs-branch-strategy, kcs-coding-style, kcs-project-context]
---

# Keyframe Character Studio AI Constitution

Hermes port of the repo's `.agents/AGENTS.md`. Apply whenever working on the Keyframe Character Studio project (zd-staj-proje).

## Project Philosophy

This project prioritizes:

- Stability over speed
- Predictability over cleverness
- Backward compatibility
- Defensive programming
- Clean architecture
- Testability
- Explicit behavior
- Maintainability
- Readability

---

## General Rules

Always:

- Analyze the request before implementing.
- Explain the implementation plan before writing code.
- Wait for explicit user approval before modifying files.
- Preserve existing runtime behavior unless explicitly requested otherwise.
- Preserve public APIs unless explicitly requested otherwise.
- Preserve backward compatibility.
- Respect the existing project architecture.
- Keep TypeScript strict mode clean.
- Keep ESLint clean.
- Keep tests passing whenever applicable.

Never:

- Refactor unrelated code.
- Rename files unnecessarily.
- Change folder structures without approval.
- Introduce hidden behavior.
- Remove intentional fallbacks without approval.
- Remove defensive checks without approval.
- Add unnecessary dependencies.
- Change coding style inconsistently.

---

## Defensive Programming

Prefer:

- Optional chaining
- Null checks
- Type guards
- Safe parsing
- Exhaustive switch statements where appropriate
- Defensive default values only when they preserve intended behavior
- try/catch around external boundaries

Treat these as external boundaries:

- localStorage
- sessionStorage
- clipboard
- JSON.parse
- API responses
- imports / exports
- database responses
- browser APIs

Never wrap internal pure mathematical or deterministic logic in unnecessary try/catch blocks.

---

## React Rules

Follow:

- Rules of Hooks
- Stable dependency arrays
- useCallback when function identity matters
- useMemo for expensive derived values
- useRef for mutable runtime state

Avoid:

- Unnecessary renders
- Stale closures
- Duplicated state
- Business logic inside components
- Business logic inside Context Providers

---

## Architecture Rules

Respect:

- Thin Orchestrator Pattern
- Domain Hooks
- Pure Utility Layer
- Unidirectional Data Flow
- Separation of Concerns

Never:

- Create circular dependencies.
- Mix UI logic with business logic.
- Mix UI logic with mathematical logic.
- Duplicate utilities.
- Duplicate business logic.

---

## Utility Rules

Before creating a new utility:

1. Search existing utilities.
2. Reuse existing implementations whenever possible.
3. Create a new utility only if no suitable abstraction exists.

Utilities should:

- Be deterministic whenever possible.
- Avoid React dependencies.
- Remain independently testable.

---

## Code Cleanup Rules

When cleaning code:

Allowed:

- Remove dead code.
- Remove unused imports.
- Remove unused exports.
- Remove unused variables.
- Remove duplicate logic.
- Improve defensive programming.

Never:

- Change runtime behavior.
- Remove intentional compatibility code.
- Remove fallbacks without approval.
- Perform hidden refactors.

---

## Validation Rules

Before completing any implementation:

Run (when available):

```bash
npm run build
npx tsc --noEmit
```

Run all relevant tests.

Verify:

- Runtime behavior is preserved.
- Public APIs are preserved.
- No TypeScript errors remain.
- No ESLint errors remain.
- All relevant tests pass.
- The project builds successfully when a build script exists.

Do not consider a task complete if validation fails.

---

## Git Workflow

Follow the branching strategy defined in the `kcs-branch-strategy` skill (port of `/.agents/BRANCH_STRATEGY.md`).

Always:

- Inspect `git status` before committing.
- Prepare a commit plan first.
- Group related changes into logical commits.
- Use Conventional Commits.

Supported commit types:

- feat
- fix
- refactor
- perf
- test
- docs
- chore
- build
- ci
- style

Never:

- Commit automatically.
- Push automatically.
- Force push.
- Rewrite Git history.
- Amend commits unless explicitly requested.
- Change Git remotes.
- Delete branches without approval.

Always wait for explicit approval before:

- Creating branches.
- Creating commits.
- Merging branches.
- Deleting branches.
- Pushing to remote repositories.

Never push directly to `main` unless explicitly approved.

---

## Standard Workflow

Unless explicitly instructed otherwise, always follow this process:

1. Analyze the request.
2. Identify affected files and architectural boundaries.
3. Determine the appropriate Git branch according to `kcs-branch-strategy`.
4. Produce an implementation plan.
5. Wait for explicit approval.
6. Implement only the approved scope.
7. Validate the implementation.
8. Produce a final validation report.

Never skip the approval step unless the user explicitly requests immediate implementation.

---

## Language Policy

### Communication

Conversation Language:
- Turkish only.

Repository Language:
- English only.

Never generate repository files in Turkish.
Never explain repository changes in English.

### Source Code

- All source code must be written in English.
- All identifiers must use English names, including:
  - Variables
  - Functions
  - Classes
  - Interfaces
  - Enums
  - Types
  - Constants
  - Files
  - Folders
  - Modules
- All source code comments must be written in English.
- Commit messages must be written in English using Conventional Commits.

### Application

All user-facing text must be written in English, including:

- UI labels
- Buttons
- Menus
- Dialogs
- Notifications
- Tooltips
- Validation messages
- User-facing logs
- API response messages

### Documentation

Repository documentation should be written in English unless explicitly requested otherwise, including:

- README
- Architecture documents
- API documentation
- Markdown guides
- Technical documentation

Never introduce Turkish text into the production codebase or application UI unless explicitly requested.

---

## Rule Priority

If multiple rules appear to conflict, follow this priority order:

1. Explicit user instructions
2. This constitution (kcs-constitution, port of AGENTS.md)
3. Active workflow skill instructions (kcs-architecture-workflow, kcs-bugfix-workflow, kcs-feature-workflow, kcs-git-workflow, etc.)
4. kcs-branch-strategy
5. Existing project conventions
6. Personal assumptions

Never make assumptions when an existing rule or project convention already defines the expected behavior.
