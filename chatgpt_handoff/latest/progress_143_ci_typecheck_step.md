# Progress 143 — the CI type-check step (H1's required fix)

Branch: `chore/ci-typecheck-step` (base `main` at `951bbf5`).
Origin: the one required item from `reports/progress_142_release_readiness_audit.md` §5.1, approved by the user.

## 1. What was wrong

`.github/workflows/ci.yml` carried a step named **"Run TypeScript Type Check"** that ran
`npx tsc --noEmit`. The root `tsconfig.json` is a solution file (`files: []` with two project
references), and `--noEmit` does not build references, so that command type-checks **no project file**:

```
npx tsc -b --listFiles        → 151 files under src/
npx tsc --noEmit --listFiles  → 0
```

Type coverage was never lost — the step below it, `npm run build`, runs `tsc -b` and would fail on a
type error — but the release evidence contained a green tick that meant nothing, and `package.json`'s
`check` script had the same flaw.

## 2. Applied

| File | Before | After |
|---|---|---|
| `.github/workflows/ci.yml` | `run: npx tsc --noEmit` | `run: npx tsc -b --pretty false` |
| `package.json` (`check` script) | `npm run lint && npx tsc --noEmit && …` | `npm run lint && npx tsc -b --pretty false && …` |

No dependency, version or lockfile change: `package-lock.json` is untouched, and the only manifest edit
is one script string.

## 3. Evidence

| Check | Result |
|---|---|
| The new command actually checks the project | `npx tsc -b --listFiles` → **151** files under `src/` |
| The new command passes | `npx tsc -b --pretty false` → exit 0 |
| The old command, for contrast | `npx tsc --noEmit --listFiles` → **0** files |
| The changed script end to end | `npm run check` (lint → `tsc -b` → test → build) → PASS |
| `npm test` | PASS — 126 files / 1,934 tests |
| `npm run build` | PASS |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `node scripts/check-state-consistency.mjs` | PASS — 35 checks |
| `git diff --check` | clean |

## 4. Self-review (read-only, same model)

- **The CI job's outcome cannot change for the worse.** `tsc -b` is what `npm run build` already runs
  in the same job, so a type error that fails the new step already failed the build step; the step now
  reports what it claims.
- **`tsc -b` writes build info** to `node_modules/.tmp/` (the path the tsconfigs already declare) and
  emits nothing else (`noEmit: true` in both projects), so it leaves no artefact in the tree.
- **`--pretty false`** keeps CI logs free of terminal colour codes.
- **One string in `package.json`** and one line in the workflow: no other script, dependency, engine
  or lockfile entry is touched.

## 5. Not changed

- No dependency version, `engines` range, `allowScripts` entry or lockfile content.
- No test, source or `src/` file.
- No tag, release, draft or npm action.
