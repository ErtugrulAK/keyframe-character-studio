# Contributing to Keyframe Character Studio

Thank you for your interest in contributing to **Keyframe Character Studio**! We welcome contributions from developers of all skill levels.

Please take a moment to review this document before submitting bug reports, feature requests, or pull requests.

---

## 🏛️ Architectural Principles

Before writing code, please familiarize yourself with the project's core architecture:

1. **Thin Orchestrator Pattern**:
   - `AnimatorContext` serves exclusively as a dependency injection and state orchestration layer.
   - **Do NOT** place heavy business logic or mathematical calculations inside `AnimatorContext`.
2. **Domain-Driven Hooks**:
   - Business logic resides inside modular domain hooks located in `src/hooks/`.
   - Each hook manages a distinct functional domain (`usePlayback`, `useTimeline`, `useSelection`, `useClipboard`, etc.).
3. **Pure Utility Layer**:
   - Mathematical calculations, transform interpolations, and shape algorithms reside inside `src/utils/`.
   - Utilities must remain pure, deterministic, independently testable, and free from React hook dependencies.
4. **Defensive Programming**:
   - Apply optional chaining, safe fallbacks, and exhaustive type checking around external boundaries (e.g., `localStorage`, `JSON.parse`, browser APIs, database responses).

---

## 🌿 Branching Strategy

This repository enforces a domain-driven branching workflow documented in `.agents/BRANCH_STRATEGY.md`:

### Long-Lived Domain Branches
- `main`: Stable production branch.
- `ui`: User interface, inspector, toolbars, drawers, and modal components.
- `timeline`: Sequencer timeline, keyframing, tracks, and channels.
- `renderer`: Canvas renderer, SVG vector engine, gizmos, shapes, and media masks.
- `animation`: Playback controls, motion transitions, bezier interpolation, and broadcast director engine.
- `backend`: Express REST API, PostgreSQL database, and SQLite embedded engine.
- `infrastructure`: Workflows, agent rules, test suites, and build scripts.

### Development Flow
1. Branch off the appropriate long-lived domain branch into a temporary working branch:
   - Feature: `feature/<domain>/<short-name>`
   - Bugfix: `bugfix/<domain>/<short-name>`
   - Refactor: `refactor/<domain>/<short-name>`
2. Implement and validate your changes.
3. Open a Pull Request targeting the parent domain branch.
4. Delete the temporary working branch after merging.

---

## 📝 Commit Conventions

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short description>
```

### Supported Types
- `feat`: A new feature
- `fix`: A bug fix
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `docs`: Documentation changes
- `style`: Formatting or linting fixes without code logic changes
- `build`: Build system or dependency updates
- `ci`: CI pipeline configuration updates
- `chore`: Maintenance tasks

---

## 🧪 Local Setup & Verification

### 1. Clone & Install
```bash
git clone https://github.com/ErtugrulAK/keyframe-character-studio.git
cd keyframe-character-studio
npm install
```

### 2. Run Verification Checks
Before submitting a pull request, ensure all checks pass:

```bash
# 1. Type Check
npx tsc --noEmit

# 2. Linting
npm run lint

# 3. Unit & Integration Tests
npx vitest run

# 4. Production Build
npm run build
```

---

## 📬 Pull Request Guidelines

1. Ensure all new functions have corresponding unit tests in `src/tests/`.
2. Do not introduce circular dependencies between hooks or components.
3. Keep pull requests focused on a single logical change or feature.
4. Fill out the Pull Request Template completely when opening your PR.

Thank you for helping improve Keyframe Character Studio!
