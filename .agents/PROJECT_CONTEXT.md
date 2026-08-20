# Project Context

## Project

**Name:** Keyframe Character Studio

**Purpose:**

Keyframe Character Studio is a browser-based animation editor for creating character animations, keyframe timelines, reusable templates, motion graphics, and scene compositions.

The project prioritizes maintainability, scalability, predictable behavior, and clean architecture.

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Context API
- Custom Hooks

### Backend

- Express
- PostgreSQL

### Testing

- Vitest
- React Testing Library
- Playwright

---

## Architecture

The project follows a **Thin Orchestrator Pattern**.

The `AnimatorContext` acts only as an orchestration and dependency injection layer.

Business logic should reside inside domain hooks and pure utilities.

The architecture is designed around:

- Separation of Concerns
- Domain-driven Hooks
- Pure Utility Layer
- Unidirectional Data Flow
- High Testability

---

## Project Domains

Business logic is organized into independent domain hooks.

Current domains include (but are not limited to):

- Playback
- Selection
- Toolbar
- Clipboard
- History
- Broadcast
- Timeline
- Inspector
- Templates
- Math
- Serialization
- Toast
- Presets
- Project State
- Keyboard Shortcuts

The implementation of these domains may evolve over time while preserving the architectural principles.

---

## Utility Layer

Reusable utilities should remain:

- Pure
- Deterministic
- Independently testable
- Free from React dependencies

Always reuse existing utilities before creating new ones.

---

## Architecture Constraints

Never:

- Move business logic back into `AnimatorContext`.
- Introduce circular dependencies.
- Duplicate business logic.
- Duplicate utilities.
- Mix UI logic with business logic.
- Mix UI logic with mathematical logic.

Always preserve:

- Runtime behavior
- Public APIs
- Backward compatibility

unless explicitly instructed otherwise.

---

## Development Principles

The project emphasizes:

- Defensive programming
- Stable public APIs
- Predictable runtime behavior
- Clean code
- Maintainability
- Incremental improvements
- Test-driven validation whenever applicable

---

## Current Project Status

Current architecture:

- Domain-oriented
- Hook-driven
- Test infrastructure established
- Defensive programming applied

Further improvements should preserve the existing architectural boundaries unless explicitly requested.

---

## Version Control

This project follows a structured, domain-driven Git workflow.

All branch creation, branch selection, merging, and cleanup decisions must follow:

`.agents/BRANCH_STRATEGY.md`