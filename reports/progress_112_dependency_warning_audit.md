# Progress 112 — Milestone D Item 9: Dependency and Warning Maintenance Audit

## 1. Scope

**Audit and proposal only.** No `package.json`, lockfile, workflow, source, or test change was made for this task; no install/update/audit-fix command was run. Item 9 implementation requires separate explicit user approval, which is why this report separates the findings into approval-gated plan options.

Out of scope (unchanged): dependency updates, warning remediation, lockfile regeneration, workflow edits, release/publish work.

## 2. Branch

- Branch: `chore/dependency-warning-audit`
- Commit: `docs: audit dependency and warning maintenance`
- Baseline `main`: `bcf92413ebc23868344c43a83f1c0f9318d3e4e7` (Milestones A, B, C and D item 6 merged; `main == origin/main`)
- `v1.1.0-rc.1` tag target (unchanged): `46d2a3e59e065816d972dcd56951803951b577f6`
- Toolchain at audit time: Node `v24.18.0` (ABI 137), npm `12.0.2`

## 3. Dependency inventory

| | Count | Notes |
|---|---|---|
| `dependencies` | 10 | `cors`, `dotenv`, `express`, `fflate`, `lucide-react`, `pg`, `polygon-clipping`, `react`, `react-dom`, `sqlite3` |
| `devDependencies` | 22 | Playwright, Testing Library, Vite/Vitest/oxlint/TypeScript toolchain, `concurrently`, `jsdom`, `ajv` |
| `engines` | **absent** | no declared Node range — see finding D9-1 |
| `private` / version | `true` / `1.1.0-rc.1` | package stays unpublished |
| Package manager | `package-lock.json` present, no `packageManager` field | npm-managed |

## 4. Outdated dependency table (`npm outdated --long`, read-only)

| Package | Type | Current | Wanted | Latest | Update | Risk | Package/lock edit |
|---|---|---|---|---|---|---|---|
| `@playwright/test` | dev | 1.62.0 | 1.63.0 | 1.63.0 | minor | medium (test runner + browser binaries) | YES |
| `playwright` | dev | 1.62.0 | 1.63.0 | 1.63.0 | minor | medium | YES |
| `@testing-library/jest-dom` | dev | 7.0.0 | 7.0.1 | 7.0.1 | patch | low | YES |
| `@testing-library/react` | dev | 16.3.2 | 16.3.3 | 16.3.3 | patch | low | YES |
| `@testing-library/user-event` | dev | 14.6.1 | 14.6.7 | 14.6.7 | patch | low | YES |
| `@types/node` | dev | 24.13.3 | 24.13.5 | *22.20.3* | patch (wanted) | low — **do not follow "latest"**: the registry `latest` tag points at the 22.x line and would downgrade the typings | YES |
| `@types/pg` | dev | 8.20.0 | 8.23.1 | 8.23.1 | minor | low | YES |
| `@types/react` | dev | 19.2.17 | 19.3.0 | 19.3.0 | minor | low | YES |
| `@types/react-dom` | dev | 19.2.3 | 19.3.0 | 19.3.0 | minor | low | YES |
| `@vitejs/plugin-react` | dev | 6.0.3 | 6.1.1 | 6.1.1 | minor | medium (build pipeline) | YES |
| `@vitest/coverage-v8` | dev | 4.1.10 | 4.1.11 | **5.0.1** | patch, or major to 5 | high for the major | YES |
| `concurrently` | dev | 10.0.4 | 10.0.5 | 10.0.5 | patch | low | YES |
| `jsdom` | dev | 30.0.1 | 30.1.0 | 30.1.0 | minor | low | YES |
| `lucide-react` | **prod** | 1.25.0 | 1.47.0 | 1.47.0 | minor (large jump) | medium (icon set/API surface) | YES |
| `oxlint` | dev | 1.74.0 | 1.83.0 | 1.83.0 | minor | low | YES |
| `pg` | **prod** | 8.22.0 | 8.23.0 | 8.23.0 | minor | medium (DB client) | YES |
| `react` / `react-dom` | **prod** | 19.2.7 | 19.3.0 | 19.3.0 | minor | medium (runtime) | YES |
| `typescript` | dev | 6.0.3 | 6.0.3 | **7.0.2** | none wanted; **major** to 7 | high | YES |
| `vite` | dev | 8.1.5 | 8.3.0 | 8.3.0 | minor | medium (build pipeline) | YES |
| `vitest` | dev | 4.1.10 | 4.1.11 | **5.0.1** | patch, or major to 5 | high for the major | YES |

Summary: **20 packages behind**. 7 patch-level, 11 minor-level, 2 major-level (`typescript` 6→7, `vitest`/`@vitest/coverage-v8` 4→5). Two entries are "already at wanted" (`typescript` 6.0.3) or must not chase `latest` (`@types/node`).

## 5. `npm audit` result (read-only; registry reachable)

Whole tree: **7 vulnerabilities — 6 moderate, 1 high**.

| Package | Severity | Direct? | Path / advisory | Fix |
|---|---|---|---|---|
| `nanoid` | **high** | no | "custom generators can loop indefinitely when size is zero" | `npm audit fix` (lockfile) |
| `qs` | moderate | no | array-limit bypass; DoS via attacker-controlled `isBuffer` | `npm audit fix` (lockfile) |
| `undici` | moderate | no | retry-interceptor desync; CRLF injection via blob `type`; cookie attribute injection | `npm audit fix` (lockfile) |
| `postcss` | moderate | no | incomplete fix — `sourceMappingURL` arbitrary `.map` read | `npm audit fix` (lockfile) |
| `@vitest/mocker` | moderate | no | path traversal / arbitrary file read via redirect mock | `npm audit fix` (lockfile) |
| `vitest` | moderate | **yes (dev)** | via `@vitest/mocker` / `@vitest/coverage-v8` | `npm audit fix` (lockfile) |
| `@vitest/coverage-v8` | moderate | **yes (dev)** | via `vitest` | `npm audit fix` (lockfile) |

Production tree only (`npm audit --omit=dev`): **2 moderate** (`qs`, `undici`) — both transitive, both fixed by the same in-range bump. The high-severity `nanoid` and the remaining moderates are **development-only** (Vitest/Vite toolchain), which is why they are not release blockers but are still worth a bounded `npm audit fix` run.

## 6. Warning inventory (collected, none fixed)

| # | Warning | Exact command | Evidence | Impact | Proposed fix (no package change) | Risk | Needs package/lock/workflow edit | Approval |
|---|---|---|---|---|---|---|---|---|
| W1 | `react(only-export-components)` — "Fast refresh only works when a file only exports components" | `npm run lint` | `src/context/AnimatorContext.tsx:651` (exports `AnimatorProvider` **and** `useAnimator`) | Fast-refresh (HMR) degrades for that module; no runtime impact | Move the context object + `useAnimator` hook into a sibling module (e.g. `src/context/useAnimator.ts`) and re-export from the provider file's consumers — pure source refactor | low–medium (touches every `useAnimator` import path; mechanical) | NO | Option A (source-only) — a small refactor; recommend a separate tiny task |
| W2 | Rolldown/Vite chunk-size advisory — "Some chunks are larger than 500 kB after minification" | `npm run build` | `dist/assets/index-*.js` = 621.99 kB (gzip 182.39 kB); CSS 120.62 kB (gzip 21.11 kB) | advisory only; slower first load for large editors | Real fix: route-level `import()` splitting for the Inspector/Modal surfaces; alternative `build.chunkSizeWarningLimit` only silences the warning and is **not** proposed | medium (build output changes) | `vite.config.ts` is a build config, not package/lock/workflow; changing it is a **build-behaviour** change → treat as Option A/B boundary and require approval | Option A with approval, or defer |
| W3 | jsdom "Not implemented: HTMLCanvasElement's `getContext()`" (×3) and "navigation to another Document" (×3) | `npm test` | jsdom lacks canvas; tests that touch canvas log noise | test-output noise only; no production impact | Stub `HTMLCanvasElement.prototype.getContext` (and the navigation call) in `src/tests/setup.ts` | low | NO (`canvas` npm package would be a dependency → Option B if chosen) | Option A (test-setup stub) |
| W4 | `eslint-disable-next-line react-hooks/exhaustive-deps` ×2 | `grep` | `src/components/Canvas/StageCanvas.tsx:81,547` | deliberate suppressions; risk of stale closures if dependencies change | Re-derive the dependency arrays defensively; requires pointer-interaction testing | medium (canvas drag semantics) | NO | Option A, but only with focused interaction tests |
| W5 | git CRLF noise during scripted runs — "LF will be replaced by CRLF the next time Git touches it" | `npm test`, `git add` | working tree on Windows | noise in local output only | Add `.gitattributes` (`* text=auto eol=lf`) — repository config, not package/lock/workflow | low, but it rewrites working-tree line endings on next checkout | NO | Option A with approval |
| W6 | `e2e/**` outside the Vitest include glob | design | `vitest.config.ts` `exclude: [..., 'e2e/**']` | intentional: Playwright specs are not unit tests | none needed; documented | none | NO | not required |
| W7 | Node "The `NO_COLOR` env is ignored due to the `FORCE_COLOR` env being set" | `npm run qa:release` | emitted by the Playwright web server and workers; `FORCE_COLOR` is set by the surrounding terminal/harness env, not by `scripts/*.mjs`, `playwright.config.ts`, or `package.json` (grep found no repo reference) | environment noise only; no repo defect | none in-repo; document | none | NO | not required |

Undocumented findings worth recording:

- **D9-1 (medium, environment): the backend cannot load its native SQLite binding under the current Node.** `node -e "require('sqlite3')"` fails with "Could not locate the bindings file" for **ABI 137 (Node 24)**; running `node server/index.js` therefore logs "Running backend server in Auto-Fallback / In-Memory Mode" and, when launched without a PTY, exits with the binding error. The frontend is unaffected (it falls back to its localStorage path) — verified live: `vite` served the editor, a rectangle layer was drawn, and an OGraf export produced `template-ograf.zip`. Root cause is a missing prebuilt binding for Node 24 plus **no declared `engines` range**, so a newer Node silently degrades the backend. Options: declare `engines.node` (package.json → approval), rebuild/upgrade `sqlite3`, or migrate to `node:sqlite`/`better-sqlite3` (separate task).
- **D9-2 (low): `@types/node`'s `latest` dist-tag is behind the installed major** — chasing `latest` would downgrade the typings; the wanted patch (24.13.5) is the correct target.

## 7. Proposed plan options

**Option A — no package changes (docs/source/test/build-config only, each item still needs approval to implement).**
1. W1: split `useAnimator` out of `AnimatorContext.tsx` (removes the lint warning at its root).
2. W3: stub canvas/navigation gaps in `src/tests/setup.ts` (removes test-output noise).
3. W4: re-derive the two suppressed dependency arrays with focused canvas-interaction tests.
4. W5: add `.gitattributes` to normalise line endings.
5. W2: route-level code splitting (or leave the advisory documented).
None of these touch `package.json`, the lockfile, or the workflows.

**Option B — patch/minor dependency maintenance (requires explicit approval; edits `package.json` + lockfile).**
- Patch set: `@testing-library/*` (3), `@types/node` → 24.13.5, `concurrently`, `vitest` → 4.1.11, `@vitest/coverage-v8` → 4.1.11.
- Minor set: `@playwright/test` + `playwright` → 1.63, `@types/pg`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react` → 6.1.1, `jsdom` → 30.1, `oxlint` → 1.83, `vite` → 8.3, `lucide-react` → 1.47, `pg` → 8.23, `react` + `react-dom` → 19.3.
- Plus a bounded `npm audit fix` (in-range only) to clear the 2 production moderates (`qs`, `undici`) and the dev-tree advisories.
- Validation required: `npm test`, `npm run build`, `npx tsc --noEmit`, `npm run lint`, `npm run validate:ograf`, `npm run qa:release` (Playwright browsers may need `npx playwright install`), plus the live smoke and `node scripts/check-state-consistency.mjs`.

**Option C — major upgrades (separate branch and task; requires explicit approval).**
- `typescript` 6 → 7, `vitest` 4 → 5 (+ `@vitest/coverage-v8` 5). Both change toolchains that every suite depends on; each needs its own validation pass and rollback plan. Do not bundle them with Option B.

**Option D — defer item 9 and move to Milestone E planning.**
- Item 6 (state consistency check) already merged; the audit above is the deliverable for item 9. Deferring keeps `main` exactly as it is (no lockfile churn) and starts Milestone E (OGraf QA / schema hardening study, items 7 and 8), which itself needs a licensing/size decision.

## 8. Approval gates

- Any `package.json`, `package-lock.json`, or `.github/workflows/**` edit: **explicit user approval required**, with the exact package list and validation plan above.
- `npm audit fix`, `npm install`, `npm update`, `npm rebuild sqlite3`: all mutate state (lockfile and/or native modules) → **approval required**.
- Option A items change source/test/build-config or add `.gitattributes` → approval per item; none touch package/lock/workflow.
- Release, tag, draft-release, or npm changes: never without explicit approval (unchanged by this audit).

## 9. Recommended next action

1. **Approve Option A narrowly** (W1 + W3 + W5 first; they are low risk and remove two of the three persistent warnings without touching dependencies), then
2. **approve a single bounded Option B run** for the patch/minor set plus `npm audit fix`, validated by the full suite + release gate, and
3. leave **Option C** (TypeScript 7, Vitest 5) and the **D9-1 SQLite/`engines` decision** for their own tasks, or postpone them with **Option D** and start Milestone E planning.

## 10. Validation run for this audit

| Command | Result |
|---|---|
| `node scripts/check-state-consistency.mjs` | PASS (34 checks) |
| `npm run lint` | PASS — one warning (W1) |
| `npm run build` | PASS — one advisory (W2) |
| `npm test` | PASS — jsdom noise only (W3) |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests |
| `git diff --check` | clean |
| `npm outdated --long`, `npm audit`, `npm audit --omit=dev`, `npm ls --depth=0` | read-only informational runs |

## 11. Protected invariants

- No `package.json`, lockfile, workflow, source, or test file was modified by this audit; the only changes are this report plus the state documents listed above.
- No install/update/audit-fix command was executed; `node_modules` and `package-lock.json` are untouched (`git status` shows only documentation paths).
- Tag `v1.1.0-rc.1`, the draft release, and npm metadata are unchanged; the package remains private at `1.1.0-rc.1`.
- `without-mask`, global OMP configuration (`memory.backend: mnemopi`, `task.maxConcurrency: 8`), `C:\Users\ertugrul.ak\Desktop\KCS`, and `ograf-graphics` are untouched.
- The handoff bundle still carries documentation only (no source/test copies, no secrets).
