# Technical Architecture Specification

## Overview

**Keyframe Character Studio** is built on a **Thin Orchestrator Pattern** designed to maximize modularity, maintainability, testability, and strict separation of concerns.

The application decouples UI components from complex business logic and mathematical state mutations:
- **`AnimatorContext`** acts purely as a thin orchestration and dependency injection container.
- **Domain Hooks** encapsulate all state management, side effects, and event handling.
- **Pure Utility Layer** contains deterministic mathematical functions, transform matrix calculations, and state transition mutators.

---

## Architectural Layers

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                            │
│  (HeaderBar, StageCanvas, Sequencer Timeline, PropertyInspector, etc.) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Consumer
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      AnimatorContext Container                         │
│             (Thin Orchestrator & Dependency Injection)                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Injects
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Domain Hooks Layer                            │
│  (usePlayback, useTimeline, useSelection, useClipboard, useBroadcast,  │
│   useSerialization, useInspector, useHistory, useTemplates, etc.)      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Calls
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Pure Utility Layer                             │
│  (bounds.ts, broadcastEngine.ts, defaults.ts, motionTransitions.ts,    │
│   partFactory.ts, trackMutations.ts, idGenerator.ts)                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Interacts
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Persistence & Storage Layer                        │
│         (LocalStorage, Express REST API, PostgreSQL, SQLite)           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Orchestration Layer (`AnimatorContext`)

- **File**: `src/context/AnimatorContext.tsx`
- **Role**: Combines domain hooks into a single React context provider and exposes actions and state to UI components via `useAnimator()`.
- **Constraint**: `AnimatorContext` must **never** contain inline business logic, mathematical loops, or direct state mutators. It only connects domain hooks together.

---

## 2. Domain Hooks Layer (`src/hooks/`)

Business logic is organized into 15 specialized domain hooks:

| Domain Hook | Responsibility |
| :--- | :--- |
| `usePlayback` | 60 FPS animation playback timer, frame clamping, playhead stepping, looping toggles. |
| `useProjectState` | Core application state management for parts (`characterParts`) and tracks (`tracks`). |
| `useSelection` | Single and multi-part selection state (`selectedPartId`, `selectedPartIds`). |
| `useTimeline` | Keyframe addition/deletion, track visibility toggles, track renaming, and reordering. |
| `useClipboard` | Part & track copy, paste, and duplicate actions. |
| `useHistory` | Undo/redo stack management for history snapshots. |
| `useBroadcast` | Live Director (Reji Mode) state, broadcast object status, PLAY IN/OUT triggers, live stunts. |
| `useSerialization` | Project JSON import, export, auto-save (`AUTOSAVE_STORAGE_KEY`), and REST API persistence. |
| `useTemplates` | Multi-sequence tabs, graphic template switching, and template canvas store. |
| `useInspector` | Property inspector state calculation for transforms, keyframe values, and media masks. |
| `useMath` | Real-time transform interpolation, easing curve calculations, and anchor point offsets. |
| `usePresets` | Custom motion preset storage, creation, and application. |
| `useToolbar` | Active tool selection (Select, Rect, Card, Text, Banner, Cloner, Particle). |
| `useToast` | Toast notification queue (`showToast`). |
| `useKeyboardShortcuts`| Global hotkeys for playback (Space), delete (Delete/Backspace), copy/paste (Ctrl+C/V), undo/redo (Ctrl+Z/Y). |

---

## 3. Pure Utility Layer (`src/utils/`)

Utilities are deterministic, pure functions with zero React dependencies:

- **`bounds.ts`**: Calculates part boundary boxes (`halfW`, `halfH`) for shapes, cards, banners, cloners, and text metrics.
- **`motionTransitions.ts`**: Generates smooth entrance/exit keyframes for PLAY IN and PLAY OUT motion transitions.
- **`trackMutations.ts`**: Pure mutator functions for adding, deleting, and modifying keyframes and bezier control points.
- **`broadcastEngine.ts`**: Manages state tick calculations for live broadcast objects and live stunts.
- **`defaults.ts`**: Default character parts, tracks, interpolation functions, and channel creation.
- **`partFactory.ts`**: Factory function creating new `CharacterPart` and matching `Track` instances.

---

## 4. Backend & Persistence Layer

- **Express Server**: `server/index.js` listens on port `5000`.
- **Database Fallback Strategy**:
  1. Attempts connection to **PostgreSQL** pool (`server/db/index.js`).
  2. If PostgreSQL is unavailable, automatically falls back to embedded **SQLite** database (`server/db/sqlite.js`).
- **Endpoints**:
  - `GET /api/health`: Database connection status.
  - `GET /api/projects`: Fetch project list.
  - `GET /api/projects/:id`: Fetch project payload.
  - `POST /api/projects`: Save/update project.
  - `DELETE /api/projects/:id`: Delete project.
  - `GET /api/presets`: Fetch motion presets.
  - `POST /api/presets`: Save motion preset.

---

## 5. Defensive Programming Mandates

- All external boundary data (`localStorage`, API responses, JSON parses) must be safely validated.
- Optional chaining (`?.`) and fallback default values must be used for nested data access.
- State setter callbacks must remain pure and free from nested side-effect mutations.
