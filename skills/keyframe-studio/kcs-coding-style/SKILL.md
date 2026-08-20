---
name: kcs-coding-style
description: Use when writing code in Keyframe Character Studio.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, coding-style, typescript, conventions]
    related_skills: [kcs-constitution, kcs-project-context]
---

# Coding Style

Hermes port of the repo's `.agents/CODING_STYLE.md`. Follow when writing or editing code in the Keyframe Character Studio project.

## Naming

Hooks:

- useSomething.ts

Utilities:

- somethingUtils.ts

Factories:

- somethingFactory.ts

Constants:

- constants.ts

---

## Components

Keep components small.

Avoid giant files.

Prefer:

Component
Hook
Utility

separation.

---

## Imports

Order:

1. React
2. External libs
3. Types
4. Hooks
5. Utils
6. Constants

---

## Functions

Prefer:

- pure functions

Avoid:

- hidden side effects

---

## TypeScript

Always type:

- parameters
- returns
- state

Avoid:

- any
