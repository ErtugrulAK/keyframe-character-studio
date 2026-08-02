# Keyframe Character Studio AI Constitution

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

# General Rules

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

# Defensive Programming

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

# React Rules

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

# Architecture Rules

Respect:

- Thin Orchestrator pattern
- Domain Hooks
- Pure Utility Layer
- Unidirectional Data Flow
- Separation of Concerns

Never:

- Create circular dependencies
- Mix UI logic with business logic
- Mix UI logic with mathematical logic
- Duplicate utilities
- Duplicate business logic

---

# Utility Rules

Before creating a new utility:

1. Search existing utilities.
2. Reuse existing implementations whenever possible.
3. Create a new utility only if no suitable abstraction exists.

Utilities should:

- Be deterministic whenever possible.
- Avoid React dependencies.
- Remain independently testable.

---

# Code Cleanup Rules

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

# Validation Rules

Before completing any implementation:

Run (when available):

```bash
npm run build
```

```bash
npx tsc --noEmit
```

Run all relevant tests.

Verify:

- Runtime behavior preserved.
- Public APIs preserved.
- No TypeScript errors.
- No ESLint errors.
- Tests still pass.

---

# Git Workflow

Always:

- Inspect `git status` before committing.
- Prepare a commit plan first.
- Group related changes into logical commits.
- Use Conventional Commits.

Examples:

- feat:
- fix:
- refactor:
- perf:
- test:
- docs:
- chore:

Never:

- Commit automatically.
- Push automatically.
- Force push.
- Rewrite Git history.
- Amend commits unless explicitly requested.
- Change Git remotes.
- Delete branches without approval.

Never push directly to `main` unless explicitly approved.

Always wait for explicit approval before:

- Creating commits
- Pushing to remote repositories

---

# Standard Workflow

Unless explicitly instructed otherwise, always follow this process:

1. Analyze the request.
2. Identify affected files and architectural boundaries.
3. Produce an implementation plan.
4. Wait for explicit approval.
5. Implement only the approved scope.
6. Validate the implementation.
7. Produce a final validation report.

Never skip the approval step unless the user explicitly requests immediate implementation.

---

# Language Policy

Communication:

- Communicate with the user in Turkish unless explicitly requested otherwise.

Source Code:

- All source code must be written in English.
- All identifiers (variables, functions, classes, interfaces, enums, types, constants, files, folders, and modules) must use English names.
- All comments inside source code must be written in English.
- Commit messages must be written in English using Conventional Commits.

Application:

- All user-facing text must be written in English.
- This includes UI labels, buttons, menus, dialogs, notifications, tooltips, validation messages, logs intended for users, and API response messages.

Documentation:

- Repository documentation (README, Architecture docs, API docs, guides, Markdown files, etc.) should be written in English unless the user explicitly requests otherwise.

Never introduce Turkish text into the production codebase or application UI unless explicitly requested.

---

# Rule Priority

If multiple rules appear to conflict, follow this priority order:

1. Explicit user instructions.
2. AGENTS.md
3. Active Workflow instructions.
4. Existing project conventions.
5. Personal assumptions.

Never make assumptions when an existing rule or project convention already defines the expected behavior.