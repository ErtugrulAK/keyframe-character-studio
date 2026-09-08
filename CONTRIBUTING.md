# Contributing to Keyframe Character Studio

Thank you for contributing to Keyframe Character Studio. KCS is an active open-source prototype for browser-based motion design and broadcast-oriented graphics authoring. Keep contributions focused, explicit, and easy to verify.

## Before you start

1. Read the [architecture guide](docs/ARCHITECTURE.md) and the [current roadmap](docs/V6_PLUS_ANIMATION_ROADMAP.md).
2. Search existing issues and pull requests before opening a new one.
3. For behavior changes, identify the existing domain authority before editing.
4. Do not include private files, credentials, generated local databases, or personal screenshots.

## Local development

Prerequisites: Node.js 22 or newer and npm.

```bash
git clone https://github.com/ErtugrulAK/keyframe-character-studio.git
cd keyframe-character-studio
npm install
npm run dev
```

Open `http://localhost:5173`. The development script starts the Vite frontend and Express service together. Use `npm run dev:frontend` or `npm run server` when an isolated process is useful.

## Branches and commits

- Keep `main` protected and target the appropriate reviewed branch for the work.
- Use a focused branch such as `feature/<domain>/<short-name>` or `bugfix/<domain>/<short-name>`.
- Do not merge, force-push, reset, or rewrite shared branch history.
- Use [Conventional Commits](https://www.conventionalcommits.org/), for example `fix: preserve mask path interpolation`.
- Keep one logical change per pull request where practical.

## Architecture boundaries

KCS uses a thin-orchestrator architecture:

- `AnimatorContext` composes state and actions; it is not a second business-logic layer.
- Domain hooks in `src/hooks/` own playback, timeline, history, clipboard, serialization, broadcast, and related orchestration.
- Pure deterministic utilities in `src/utils/` own evaluation, geometry, migration, and state mutations.
- `Track.channels`, `evaluateTransform`, and `evaluateFrame` are canonical animation authorities.
- `StageCanvas`, `PartRenderer`, `shapeGeometry`, and `buildMattePath` remain rendering and geometry authorities.

Do not introduce a parallel evaluator, animation clock, serializer, history store, clipboard, or compositor. Preserve legacy import/export paths and existing scene compatibility unless a change explicitly defines migration behavior.

## Verification

Run the checks relevant to your change. For a normal pull request:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

For browser or rendering changes, also run:

```bash
npm run test:e2e
npm run qa:v6
```

Focused tests should defend observable behavior, boundaries, invariants, transitions, or compatibility. Do not weaken assertions, add arbitrary sleeps or retries, hide failures, or widen pixel tolerances without evidence. UI changes require Chromium/browser verification and a screenshot in the pull request when useful.

## Pull requests

Describe the user-visible problem, the scope of the change, the affected authority, and the verification performed. Complete the repository pull request template. Include screenshots for visual changes and call out compatibility, rendering, serialization, performance, or regression risks.

## Reporting issues

Use the repository issue templates for reproducible bugs and feature proposals. Include the commit or version, operating system and browser, a minimal reproduction, expected behavior, actual behavior, and a safe fixture or screenshot when relevant. Do not publish security vulnerabilities in a public issue; follow [SECURITY.md](SECURITY.md).
