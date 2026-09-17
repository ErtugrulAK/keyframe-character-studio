# Progress 113 — Warning Maintenance (Option A) and Local SQLite Binding Repair

## 1. Scope

Implements **Option A** of the item-9 audit (`reports/progress_112_dependency_warning_audit.md` §7) plus the **approved local repair of the SQLite binding (D9-1)**. Every item was approved by the user before implementation.

In scope: W1, W2, W3, W4, W5, D9-2, and the local `node_modules` binding repair.
Out of scope (unchanged, still approval-gated): the dependency updates of Option B, the major upgrades of Option C, the `engines` declaration, any `package.json`/`package-lock.json`/workflow edit, and Milestone E.

## 2. Branch

- Branch: `chore/warning-maintenance`, based on `main` at `bb3cac9f61a60048f1fe9f0ae6ec69eabe46e1e4`
- This is a source change, so the branch is reviewed by an independent agent before the merge request.

## 3. What changed

### W1 — Fast Refresh warning removed at its root

- New `src/context/useAnimator.ts` owns the `AnimatorContext` object and the `useAnimator` hook.
- `src/context/AnimatorContext.tsx` now exports `AnimatorProvider` (and the `AnimatorContextType` type) only; it imports the context object from the new module. The type-only import direction keeps the dependency acyclic at runtime.
- 23 files were migrated to the new hook module (16 source files, 7 test files), including the `vi.mock` factories: mocks that supply `useAnimator` now target `../context/useAnimator`, mocks that supply the provider keep targeting `../context/AnimatorContext`.
- `src/components/Toast/ToastPortal.tsx` reads `ToastItem` from its canonical source (`src/hooks/useToast.ts`), so the provider module no longer re-exports it.
- Evidence: `npm run lint` reports **no** warnings (previously one at `AnimatorContext.tsx:651`).

### W2 — chunk-size advisory removed by splitting, not by raising the limit

- `vite.config.ts` declares `build.rolldownOptions.output.codeSplitting.groups` for three stable third-party groups: `react-vendor` (react/react-dom/scheduler), `icons` (lucide-react), `geometry` (polygon-clipping/fflate).
- No import became lazy and no module order changed, so runtime behaviour is identical; only the chunk boundaries moved, which also improves caching across releases.
- Evidence (before → after): single `index-*.js` **621.99 kB (gzip 182.39)** → `index-*.js` **382.19 kB (gzip 104.53)** + `react-vendor` 189.64 kB (gzip 59.65) + `geometry` 36.09 kB (gzip 13.09) + `icons` 14.30 kB (gzip 5.13) + runtime 0.56 kB. No chunk now exceeds the 500 kB threshold and `npm run build` emits no chunk-size advisory.

### W3 — jsdom noise removed in the test setup

- `src/tests/setup.ts` now replaces `HTMLCanvasElement.prototype.getContext` with a function that returns `null` (jsdom's own outcome, minus the "Not implemented" log) and skips the navigation attempt for download links (`download` attribute or `blob:`/`data:` href) while leaving ordinary anchors on jsdom's normal path.
- Why it is behaviour-identical: the production text-measurement helper (`src/utils/bounds.ts:61`) already falls back when `getContext` returns null, and the download helpers only build an anchor whose own state the tests assert.
- Evidence: the full suite previously printed **6** "Not implemented" lines (3 canvas from `ografPackage` / `presetConversion`, 3 navigation from the download flows in `presetExportImportUi` / `firstExportFlow`); after the change `grep -c "Not implemented"` on a full run returns **0**.

### W4 — the two `react-hooks/exhaustive-deps` suppressions are gone

- `src/components/Canvas/StageCanvas.tsx`: the `[appMode]` viewport-sync effect needed no suppression at all — it only closes over refs and stable state setters, so the comment was removed and lint stays clean.
- The mouse-move callback read the later-declared `handleMouseUp` and carried a suppression for that declaration cycle. It now reads the handler through `handleMouseUpRef` (a latest-ref published in an effect), so the dependency array is honest and complete with no cycle.
- Evidence: `npm run lint` is clean; `npx tsc --noEmit` passes; the pointer paths were exercised in a real browser (draw + drag + select) and by the canvas unit specs.

### W5 — line-ending noise removed

- New `.gitattributes` with `* text=auto eol=lf` plus explicit binary guards, so scripted git runs stop printing "LF will be replaced by CRLF" for every text file.

### D9-2 — the state checker now catches item-level stale claims

- `scripts/check-state-consistency.mjs` gained two `STALE_ACTIVE_PATTERNS` entries that fail an active claim that a roadmap item has not started / is not implemented yet (the exact class that survived a PASS before).
- `src/tests/stateConsistencyCheck.test.ts` gained three focused cases: two negative (item reported as not started, item reported as not yet begun) and one guard (a truthful item-level status passes).
- `reports/progress_112_dependency_warning_audit.md` §12 is now headed "Independent review history (superseded states are quoted verbatim)", which is what it is — quoting superseded states — and is therefore exempt from the stale-claim scan by the checker's own rule.

### D9-1 — local SQLite binding repaired (root cause refined)

- **Refined root cause:** the binding was missing because **npm 12 blocks `sqlite3`'s install script** — `npm install-scripts ls` reported `sqlite3@6.0.1 (install: prebuild-install -r napi || node-gyp rebuild)` as "blocked because they are not covered by allowScripts" — so `npm rebuild sqlite3` was a no-op and the prebuilt NAPI archive stayed unused in the npm cache. The Node 24 ABI is still **not** involved (`sqlite3@6.0.1` ships NAPI v3/v6 prebuilds).
- **Repair performed:** ran the package's own install command inside `node_modules/sqlite3` (`node ../../node_modules/prebuild-install/bin.js -r napi`), which extracted the cached prebuild to `node_modules/sqlite3/build/Release/node_sqlite3.node`.
- **Evidence:** `require('sqlite3')` now loads; `node server/index.js` starts and `GET http://127.0.0.1:5000/api/health` returned **200**.
- **`package.json` stayed unchanged.** The exploratory `npm install-scripts approve sqlite3 --dry-run` wrote an `allowScripts` entry despite the dry-run flag; that unintended edit was reverted immediately (`git checkout -- package.json`) and the file is byte-identical to `main`. Consequence to record: **a fresh `npm install` on npm 12 will block that script again**, so either the `allowScripts` pin or an explicit re-extraction step has to be approved as its own change.

## 4. Validation matrix (branch `chore/warning-maintenance`)

| Check | Command | Result |
|---|---|---|
| Full unit/integration suite | `npm test` | PASS — 113 files / **1,694** tests (1,691 + 3 new D9-2 cases) |
| jsdom noise | `npm test 2>&1 \| grep -c "Not implemented"` | **0** (was 6) |
| Lint | `npm run lint` | **clean** (was one Fast Refresh warning) |
| TypeScript | `npx tsc --noEmit` | PASS |
| Build | `npm run build` | PASS — no chunk-size advisory; largest chunk 382.19 kB |
| OGraf fixture | `npm run validate:ograf` | PASS |
| Release gate | `npm run qa:release` | PASS — 2 Chromium tests |
| State consistency | `node scripts/check-state-consistency.mjs` | PASS |
| Backend probe | `node server/index.js` + `curl /api/health` | PASS — HTTP 200 (repair verified) |
| Built-app smoke | `vite preview` + real browser | PASS — editor loads from the split chunks, layer drawn, transform gizmo, inspector, timeline lane |

## 5. Warning status after this task

| # | Warning | Status |
|---|---|---|
| W1 | Fast Refresh export warning | **Removed** (root cause fixed) |
| W2 | Vite chunk-size advisory | **Removed** (real splitting) |
| W3 | jsdom canvas/navigation noise | **Removed** (test setup) |
| W4 | Two `exhaustive-deps` suppressions | **Removed** (honest dependency arrays) |
| W5 | git CRLF noise | **Removed** (`.gitattributes`) |
| W6 | `e2e/**` outside the Vitest glob | Unchanged by design (documented) |
| W7 | `NO_COLOR`/`FORCE_COLOR` env warning | Unchanged (environment, not the repository) |

## 6. Protected invariants

- `package.json`, `package-lock.json`, `.github/workflows/**` and `node_modules` dependency versions: unchanged. (The `node_modules` change is the repaired native binding only; the accidental `allowScripts` edit was reverted.)
- No dependency was updated; the outdated list and the `npm audit` findings from `progress_112` are untouched and still open.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, global OMP configuration, `C:\Users\ertugrul.ak\Desktop\KCS` and `ograf-graphics`: untouched.
- Runtime behaviour: unchanged — the only production-code changes are the module split, the latest-ref indirection and the build-time chunk grouping, each verified by the existing suite plus a real-browser smoke.
