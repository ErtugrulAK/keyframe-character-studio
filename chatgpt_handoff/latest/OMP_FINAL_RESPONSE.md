# KCS Milestone D Item 9 Follow-Up — Final Response (`engines` + npm-12 `allowScripts`)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** implemented on `chore/engines-allow-scripts` (base `main` at `752ca28`); the merge decision is with the user.
- **Report:** `reports/progress_131_engines_allow_scripts.md`.
- **Decision (user):** close the `engines` and npm-12 `allowScripts` follow-up first, on its own branch, with an independent review before the merge.

## 2) WHAT CHANGED

`package.json` declares the policy, and `package-lock.json` mirrors the root engine metadata:

```json
"engines": { "node": "^22.22.2 || ^24.15.0 || >=26.0.0" },
"allowScripts": { "sqlite3@6.0.1": true }
```

- The Node range is the intersection required by the locked toolchain: `jsdom@30.0.1` requires
  `^22.22.2 || ^24.15.0 || >=26.0.0`; Vite and its React plugin are broader. CI's Node 22 lane and the
  local Node 24.18.0 runtime are supported. The declaration is advisory, but it excludes unsupported
  early Node 22 and odd-major runtimes.
- The `allowScripts` entry is **pinned to `sqlite3@6.0.1`**, so a future release needs a new, deliberate approval. Older npm versions ignore the field, which leaves Node 22's bundled npm behaviour unchanged.

No dependency version, script, workflow, `.npmrc`, tag or release change. `package-lock.json` changed
only at `packages[""].engines`; the dependency graph is unchanged.

## 3) WHY THE APPROVAL IS RIGHT

`sqlite3@6.0.1` declares `"install": "prebuild-install -r napi || node-gyp rebuild"`: it **first downloads a prebuilt NAPI binding** and only falls back to a source build. npm 12 blocks that step without an approval, which left a fresh install without the binding and the API server without a database driver. Approving it restores the toolchain-free path.

## 4) EVIDENCE

| Check | Result |
|---|---|
| `npm install-scripts ls --json` before | `sqlite3@6.0.1` pending, i.e. blocked |
| `npm install-scripts ls --json` after | `{"allowScripts": []}` — nothing blocked |
| End-to-end proof | deleted `node_modules/sqlite3/build`, ran the approved install script → `node_sqlite3.node` restored from the prebuilt download, binding loads (`create table` OK) |
| Server runtime | `node server/index.js` starts, `GET /api/health` → **200** |
| Lockfile | `npm install --package-lock-only --ignore-scripts` synchronized only `packages[""].engines`; the dependency graph is unchanged |

## 5) VALIDATION

| Check | Result |
|---|---|
| `npm run build`, `npx tsc --noEmit` | PASS / clean |
| `npm test` | PASS — 124 files / 1,858 tests |
| `npm run lint` | clean (exit 0) |
| `npm run validate:ograf`, `npm run qa:release` | PASS (2 Chromium tests) |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 tests |
| `node scripts/check-state-consistency.mjs` | PASS — 33 checks |
| `npm audit` | 0 vulnerabilities |

## 6) SAFETY NOTES

- `npm install-scripts deny sqlite3 --dry-run` wrote `"allowScripts": { "sqlite3": false }` into `package.json` despite `--dry-run` (the field did not exist in `HEAD`). That unintended entry was removed and replaced with the deliberate, pinned approval above; the final diff contains only the two intended fields. Recorded because an unrequested manifest edit is exactly what the review discipline exists to catch.
- No tag, release, npm publish or branch deletion; `C:\Users\ertugrul.ak\Desktop\ograf-graphics`, `origin/without-mask`, the OMP configuration and the QA folders were not touched.

## 7) NEXT

Option C (the `typescript` 6→7 major and the `vitest` + `@vitest/coverage-v8` 4→5 pair) and the two
deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x) — each behind its own explicit approval.
