# Progress 131 — Milestone D item 9 follow-up: `engines` and the npm-12 install-script policy

Branch: `chore/engines-allow-scripts` (base `main` at `752ca28`).
User decision: take the `engines` declaration and the npm-12 `allowScripts` question first, before the
Option C majors, on its own branch with an independent review and an approval-gated fast-forward.

## 1. What was open

Item 9 left three follow-ups: Option B (merged at `73426e5`), Option C (TypeScript 7 / Vitest 5) and
the `engines` declaration with the npm-12 `allowScripts` pin. This task closes the third.

The concrete problem: npm 12 blocks `sqlite3@6.0.1`'s install script unless the project approves it, so
a fresh install on npm 12 leaves `node_modules/sqlite3` without its native binding and the API server
cannot open the database. The project had no policy in `package.json` at all, and no declared Node
requirement.

## 2. What the dependency actually does

`sqlite3@6.0.1` declares `"install": "prebuild-install -r napi || node-gyp rebuild"` and
`"engines": { "node": ">=20.17.0" }`:

- it **first downloads a prebuilt NAPI binding** — no compiler, no Python, no Visual Studio toolchain;
- the `node-gyp rebuild` step is only the fallback for platforms without a prebuilt binary.

So approving the script does not force a source build; it restores the fast, toolchain-free path.

## 3. Applied

`package.json` declares the policy, and `package-lock.json` mirrors the root engine metadata:

```json
"engines": { "node": "^22.22.2 || ^24.15.0 || >=26.0.0" },
"allowScripts": { "sqlite3@6.0.1": true }
```

- **`engines.node: "^22.22.2 || ^24.15.0 || >=26.0.0"`** — this is the intersection required by the
  locked toolchain: `jsdom@30.0.1` requires `^22.22.2 || ^24.15.0 || >=26.0.0`, while Vite and its
  React plugin require `^20.19.0 || >=22.12.0`. CI pins the Node 22 major and resolves within the
  supported `^22.22.2` lane; the local Node 24.18.0 runtime is in the `^24.15.0` lane. The declaration
  is advisory (no `engine-strict`), but it no longer advertises unsupported early Node 22 or odd-major
  runtimes.
- **`allowScripts: { "sqlite3@6.0.1": true }`** — npm 12 reads this field from `package.json` (the
  project layer of its `cli > package.json > .npmrc` policy chain). It is **pinned to the exact
  version**, so a future `sqlite3` release needs a new, deliberate approval instead of inheriting one.
  Older npm versions ignore the unknown field, which keeps Node 22's bundled npm behaviour unchanged.

No script, workflow, dependency version or `.npmrc` change. `package-lock.json` changed only at
`packages[""].engines` to mirror `package.json`; the dependency graph is unchanged.

## 4. Evidence

| Check | Result |
|---|---|
| `npm install-scripts ls --json` before the change | `sqlite3@6.0.1` listed as pending, i.e. blocked |
| `npm install-scripts ls --json` after the change | `{"allowScripts": []}` — nothing blocked or pending |
| End-to-end proof | deleted `node_modules/sqlite3/build`, ran the now-approved install script (`npm rebuild sqlite3`) → "rebuilt dependencies successfully", `build/Release/node_sqlite3.node` present again, and the binding loads: `create table` on an in-memory database returns OK |
| Server runtime | `node server/index.js` starts and `GET /api/health` returns **200** |
| Manifest/lockfile scope | dependency specifiers unchanged; `npm install --package-lock-only --ignore-scripts` updated only the lockfile root's `engines` metadata |
| `git status` after the sqlite rebuild, before lockfile synchronization | only `M package.json` — the rebuild itself did not touch the lockfile |

The `sqlite3` binding before this task came from the item-9 repair; it now comes from the package's own
approved install step, which is what a fresh clone will get.

## 5. Validation

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| `npx tsc --noEmit` | clean |
| `npm test` | PASS — 124 files / 1,858 tests |
| `npm run lint` | clean (exit 0) |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS (2 Chromium tests) |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 tests |
| `node scripts/check-state-consistency.mjs` | PASS — 33 checks |
| `npm audit` | 0 vulnerabilities |
| `git diff --check` | clean |

## 6. Note on a working-tree accident during this task

`npm install-scripts deny sqlite3 --dry-run` wrote `"allowScripts": { "sqlite3": false }` into
`package.json` **despite `--dry-run`** (the field did not exist in `HEAD` before the command). The
unintended entry was removed and `package.json` was rewritten deliberately with the two fields above;
the lockfile then received only the matching root engine metadata. Recorded here because an unrequested
manifest edit is exactly what the project's review discipline is meant to catch, and because the same
command would silently change a manifest for anyone else running it.

## 7. Not changed

- No dependency version, script, workflow, `.npmrc`, tag or release change. The lockfile dependency
  graph is unchanged; only its root `engines` metadata was synchronized.
- Option C (TypeScript 7 / Vitest 5) and the two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x)
  remain open and approval-gated.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics`, `origin/without-mask`, the OMP configuration and the QA
  folders were not touched.
