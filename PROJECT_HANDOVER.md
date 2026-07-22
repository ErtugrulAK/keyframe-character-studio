# 🚀 Keyframe Character Studio - AI Agent Project Handover & Context Guide

> **Note for incoming AI Agent (Antigravity):** This document contains full technical context, user directives, architectural decisions, and Git branching rules for the `keyframe-character-studio` project. Read this carefully before answering or writing code!

---

## 📌 1. Project Overview & Inspiration
`keyframe-character-studio` is a high-performance **2D Motion Sequencer & Keyframe Animation Web Application** built with React, TypeScript, Vite, SVG, and Vanilla CSS.

### Key References & Inspiration:
1. **[Keyframes.studio Editor](https://keyframes.studio/editor?template=demo)**:
   - Adult, sleek, professional dark slate UI (`#12141a`, `#171922`, `#1d202c`).
   - Accent color: Gradient Teal (`#0d9488` ➔ `#14b8a6`) and Cyan (`#06b6d4`).
   - Dual-column left navigation: 86px vertical icon sidebar + 280px expanding drawer panel.
   - Pill-shaped buttons (`border-radius: 9999px`) and micro-glow UI details.
2. **[Unreal Engine 5 Sequencer Workflow](https://www.youtube.com/watch?v=aZUWcdR4Xik)**:
   - **0 Auto Keyframes on Object Add**: Adding shapes/texts does **NOT** auto-generate keyframes.
   - Explicit `+ Keyframe` diamond buttons in inspector and drawer.
   - Curve graph editor with Bezier/Cubic easing curves.

---

## ⚠️ 2. Mandatory Directives & User Preferences

### A. Communication vs Code Language:
- **Chat Language**: Speak with the user in **TURKISH (Türkçe)** in the chat interface.
- **Code & UI Language**: ALL code, comments, variable names, component props, and UI text on the website MUST BE 100% **ENGLISH**. Never put Turkish strings in the code or website UI.

### B. Git Branching & Commit Strategy:
- **Professional Branching Workflow**: Never push dirty or unverified code directly to `main`.
- **Feature/Fix Branches**: Always create dedicated branch for new features/fixes (e.g. `feature/my-feature` or `fix/bug-name`), make commits there, and then merge to `main`.
- **Git Author Identity**:
  - Name: `ErtugrulAK`
  - Email: `102478080+ErtugrulAK@users.noreply.github.com`
  - *This ensures commits link properly to the user's GitHub avatar!*
- **Current Branches on Remote**:
  - `main`: Main production branch (clean, squashed history).
  - `dev/studio-v1-stable`: Snapshot branch of the stable studio baseline.

---

## 🏗️ 3. Architecture & Core Components

```
src/
├── components/
│   ├── Canvas/
│   │   ├── StageCanvas.tsx        # SVG Viewport, Pan/Zoom, 360° Gizmo, Grid
│   │   └── StageCanvas.css
│   ├── Header/
│   │   ├── HeaderBar.tsx          # Top bar, Logo, FPS selector, Export Video
│   │   └── HeaderBar.css
│   ├── Inspector/
│   │   ├── PropertyInspector.tsx  # Right panel: Transform, Color, Easing Curves, Presets
│   │   └── PropertyInspector.css
│   ├── Timeline/
│   │   ├── SequencerTimeline.tsx  # Bottom Timeline, Timecode, Playback Controls, Resizable
│   │   └── SequencerTimeline.css
│   └── Toolbar/
│       ├── LeftToolbar.tsx        # 86px Sidebar + 280px Drawer Panel (Media, Elements, Texts)
│       └── LeftToolbar.css
├── context/
│   └── AnimatorContext.tsx        # Central State: Parts, Tracks, Keyframes, Playhead
├── types/
│   └── animator.ts                # TypeScript interfaces (Transform, Keyframe, Track, Part)
└── index.css                      # Global Design System tokens & CSS variables
```

### Key Technical Implementations:

1. **`StageCanvas.tsx` (Viewport & Transform Gizmo)**:
   - **Infinite Grid**: 600,000px unclipped SVG grid pattern with (0,0) origin axes.
   - **Navigation**: Mouse wheel zoom in/out, Right-click (or Middle-click) drag-to-pan.
   - **Unified 360° Transform Gizmo**:
     - Rendered directly on the selected object on the canvas.
     - Features a 360° dashed Teal rotation ring (`strokeDasharray="5 4"`).
     - Dragging any point on the dashed ring OR the gold top knob rotates the object 360°.
     - Uses `clientToSVG()` coordinate mapping + relative angle delta (`atan2`) for **zero drift/snap**.
     - Red (X) & Green (Y) translate arrows, Cyan center move square, Purple scale corners.

2. **`LeftToolbar.tsx` (Navigation Sidebar & Drawer)**:
   - 86px fixed vertical icon navigation (`Media`, `Keyframes`, `Texts`, `Elements`, `Presets`).
   - 280px sliding drawer panel containing dropzone upload and quick element cards (`UI Card`, `Text Label`, `Banner Card`, `Shield`, `Crown`, etc.).
   - No redundant gizmo mode buttons in sidebar.

3. **`PropertyInspector.tsx` (Right Inspector)**:
   - Clean empty state (`NO OBJECT SELECTED`) without duplicate element creation buttons.
   - Transform controls, color pickers, cubic bezier curve editor, and preset poses.

4. **`SequencerTimeline.tsx` (Bottom Sequencer)**:
   - Digital timecode readout (`MM:SS:FF`).
   - Circular transport playback controls (`Play/Pause`, `Step Forward/Back`, `Loop`).
   - Resizable top border for dragging timeline height up and down.

---

## 🛠️ 4. Quick Verification & Build Commands

Before finalizing any task, ALWAYS run TypeScript compilation check:

```bash
# TypeScript Type Checking (Must pass with 0 errors)
npx tsc -b

# Run Local Dev Server
npm run dev
```

---

## 📋 5. How to Continue Work

When resuming development with the user:
1. Greet the user in **Turkish**.
2. Create a new git branch for any requested task:
   ```bash
   git checkout -b feature/task-name
   ```
3. Make changes and verify with `npx tsc -b`.
4. Commit and merge back to `main`:
   ```bash
   git add -A
   git commit -m "feat: description of task"
   git checkout main
   git merge feature/task-name --no-ff
   git push origin main
   git branch -d feature/task-name
   ```

---
*Generated automatically for AI agent session continuity.*
