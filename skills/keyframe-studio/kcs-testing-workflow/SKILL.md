---
name: kcs-testing-workflow
description: Use when writing tests in Keyframe Character Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, testing, coverage, workflow]
    related_skills: [kcs-constitution, test-driven-development, kcs-feature-workflow]
---

# Testing Workflow

Hermes port of the repo's `.agents/workflows/testing.md`.

## Goal

Improve and maintain reliable automated test coverage across the project.

---

## Allowed

- Unit tests
- Hook tests
- Integration tests
- End-to-end (E2E) tests

---

## Forbidden

- Refactoring production code unless it is strictly required to make the code testable.
- Changing business logic solely to satisfy tests.

---

## Before Implementation

Always explain:

- Test scope
- Files that will be created or modified
- Mock strategy
- Test scenarios that will be covered

Wait for explicit approval before writing tests.

---

## Test Coverage Policy

Whenever a new hook, utility, or core business feature is added:

- Update existing tests if necessary.
- Create new tests covering the new behavior.
- Verify that existing tests still pass.
- No production feature is considered complete without appropriate automated test coverage.

Prefer:

- Unit tests for pure utilities.
- Hook tests for custom React hooks.
- Integration tests for cross-domain interactions.
- End-to-end tests for critical user workflows.

---

## After Implementation

Run the appropriate validation commands, such as:

```bash
npm test
```

or

```bash
vitest
```

and, when applicable:

```bash
npm run test:e2e
```

or

```bash
playwright test
```

Also run:

```bash
npx tsc --noEmit
```

if production code was modified.

---

## Final Report

Provide a concise report including:

- Test files created or modified
- Total tests executed
- Passing / failing test counts
- Coverage summary (if available)
- Mock inventory
- Remaining coverage gaps
- Any production issues discovered during testing (record only; do not fix unless explicitly approved)
