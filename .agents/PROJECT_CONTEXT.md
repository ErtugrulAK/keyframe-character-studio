# Project Context

Project Name:
Keyframe Character Studio

Purpose:

A browser-based animation editor for creating keyframe animations, character scenes, broadcasts, templates, and motion graphics.

---

## Frontend Stack

- React
- TypeScript
- Vite
- Context API
- Custom Hooks

---

## Backend

- Express
- PostgreSQL

---

## Testing

- Vitest
- React Testing Library
- Playwright

---

## Architectural Style

Thin Orchestrator Pattern

AnimatorContext is a dependency injection layer.

Business logic exists inside domain hooks.

---

## Main Domains

- usePlayback
- useSelection
- useToolbar
- useClipboard
- useHistory
- useBroadcast
- useTimeline
- useInspector
- useTemplates
- useMath
- useSerialization
- useToast
- usePresets
- useProjectState
- useKeyboardShortcuts

---

## Utility Layer

Examples:

- partFactory
- motionTransitions
- trackMutations
- broadcastEngine

Utilities must remain pure.

---

## Important Rules

Do not:

- put logic back into AnimatorContext
- create circular dependencies
- duplicate utilities

Always preserve:

- runtime behavior
- public APIs
- backward compatibility

---

## Current Status

Architecture:
Complete

Testing:
Complete

Defensive Programming:
Complete

Production Hardening:
Partially deferred intentionally.