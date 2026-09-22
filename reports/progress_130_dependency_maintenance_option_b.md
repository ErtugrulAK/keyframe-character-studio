# Progress 130 — Milestone D item 9 Option B: dependency maintenance

Branch: `chore/dependency-maintenance-option-b` (base `main` at `a4f8642`).
User decision: **Option B approved** — apply the patch and minor group plus a bounded `npm audit fix`
(no `--force`), on its own branch, behind its own review.

## 1. What was asked

Milestone D item 9 left three approval-gated follow-ups open: Option B (patch/minor dependency updates
plus `npm audit fix`), Option C (TypeScript 7 / Vitest 5 majors) and the `engines` + npm-12
`allowScripts` decision. This task is Option B.

## 2. Audited state before the change

`npm outdated` reported 22 directly-outdated packages and `npm audit` reported 7 vulnerabilities
(1 high, 6 moderate): `nanoid` (high), `vitest`, `@vitest/mocker`, `@vitest/coverage-v8`, `postcss`,
`qs`, `undici`.

The user approved the whole patch and minor group, not just the patches: 16 packages plus the audit
fix.

## 3. Applied

| Package | From | To |
|---|---|---|
| `react`, `react-dom` | 19.2.7 | 19.3.0 |
| `@types/react`, `@types/react-dom` | 19.2.17 / 19.2.3 | 19.3.0 |
| `vite` | 8.1.5 | 8.3.0 |
| `vitest`, `@vitest/coverage-v8` | 4.1.10 | 4.1.11 |
| `@vitejs/plugin-react` | 6.0.3 | 6.1.1 |
| `@testing-library/jest-dom` | 7.0.0 | 7.0.1 |
| `@testing-library/react` | 16.3.2 | 16.3.3 |
| `@testing-library/user-event` | 14.6.1 | 14.6.7 |
| `lucide-react` | 1.25.0 | 1.47.0 |
| `pg` | 8.22.0 | 8.23.0 |
| `@types/pg` | 8.20.0 | 8.23.1 |
| `@types/node` | 24.13.3 | 24.13.6 |
| `concurrently` | 10.0.4 | 10.0.5 |
| `npm audit fix` | — | 7 advisories → **0** |

Version specifiers keep the repository's caret convention. The **direct** dependency set is exactly
these sixteen moves: no key was added or removed, no script changed, and the `oxlint` (`^1.71.0`) and
`jsdom` (`^30.0.1`) specifiers are byte-identical to the base commit, because both bumps were applied,
measured and then reverted. The `From` column is the version **installed at the base commit**; the
base specifier can be older than that (`@types/node` was installed at 24.13.3 under `^24.13.2`, and
`vite` at 8.1.5 under `^8.1.1`) — those two lines therefore now move the specifier itself
(`^24.13.2 → ^24.13.6`, `^8.1.1 → ^8.3.0`).

The **lock graph** did change beyond those sixteen: **64 package entries were touched — 1 added, 6
removed, 57 changed version**:

- added: `@rolldown/binding-android-arm-eabi`
- removed: `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`,
  `@rolldown/binding-wasm32-wasi`, `@tybys/wasm-util`
- the security fixes moved `nanoid` 3.3.16 → 3.3.19, `postcss` 8.5.20 → 8.5.28, `qs` 6.15.3 → 6.16.0
  and `undici` 6.27.0 → 6.28.1, plus the jsdom-side `undici` 8.9.0 → 8.11.0 and the selector engine
  `@asamuzakjp/dom-selector` 8.3.0 → 8.3.2.

## 4. Deferred, with evidence

Two minor bumps were applied, verified, and then **deferred** because each one demands work of its own
kind rather than a version bump. Both stay in `package.json` unchanged (`^1.74.0`, `^30.0.1`) and the
lockfile pins the known-good version.

1. **`oxlint` 1.74.0 → 1.85.0 — 33 new rule warnings.**
   With 1.85.0 the linter reports 33 warnings (`react(refs)`, `react(set-state-in-effect)`,
   `typescript(no-non-null-asserted-optional-chain)`) that 1.74.0 does not report at all. The
   project's standard is a clean lint run, and silencing new rules or rewriting React code to satisfy
   them is not a dependency task. The linter therefore stays at `^1.74.0` until the new rules get
   their own triage.

2. **`jsdom` 30.0.1 → 30.1.1 — `URL.createObjectURL` stops accepting the Blob this environment
   produces.** What was measured, in this checkout:

   | Environment | `URL.createObjectURL(new Blob([...]))` | jsdom own symbols on the Blob |
   |---|---|---|
   | `jsdom` 30.0.1 | succeeds | 1 |
   | `jsdom` 30.1.1 | throws `Cannot read properties of undefined (reading '_buffer')` | 0 |

   With 30.1.1 the global `Blob` instance carries no jsdom-internal symbol, and the call then reads
   `_buffer` off an undefined implementation. `src/tests/firstExportFlow.test.tsx` exercises the real
   download step, so the suite fails with `jsdom` 30.1.1 and passes with 30.0.1. Isolated: the failure
   reproduces with `jsdom@30.1.1` + `vitest@4.1.10` and disappears with `jsdom@30.0.1` on the same
   `vitest`, so it is neither a `vitest` regression nor a cross-file isolation problem.
   *Not established:* which jsdom change causes it. The string `createObjectURL` appears nowhere in
   **either** version's `lib/`, so "jsdom 30.1 removed its own implementation" is **not** supported by
   the evidence and is not claimed here.

## 5. Test corrections the upgrade required

`src/tests/styleMatteSection.test.tsx` queried four inputs with
`container.querySelector('input[aria-label="Gradient Angle"]')` while the component renders
`aria-label="Gradient angle"`. The refresh moved the transitive selector engine
`@asamuzakjp/dom-selector` **8.3.0 → 8.3.2** (a patch inside jsdom's `^8.3.0` range), and that patch
made attribute-value matching case-sensitive. Measured with a throwaway probe that renders
`<input aria-label="Gradient angle" />` and asks for the capitalised variant:

| `@asamuzakjp/dom-selector` | exact case matches | capitalised variant matches |
|---|---|---|
| 8.3.0 (base lock) | yes | **yes** (case-insensitive) |
| 8.3.2 (current lock) | yes | no (case-sensitive) |

So the four queries silently stopped finding the element: two asserted `toBeTruthy()` and failed, two
asserted `toBeNull()` and had become vacuous. They now use the exact label the component renders,
which restores the original intent: the angle control is present for a linear gradient, absent for a
radial one, and derived from the matte rather than mirrored in local state.

## 6. Validation

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| `npx tsc --noEmit` | clean |
| `npm test` | PASS — 124 files / 1,858 tests |
| `npm run lint` | clean (exit 0, no output) |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS (2 Chromium tests), release gate recorded candidate `a4f8642` |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 tests |
| `node scripts/check-state-consistency.mjs` | PASS — 32 checks |
| `npm audit` | **0 vulnerabilities** (was 1 high + 6 moderate) |
| `git diff --check` | clean |
| Server runtime | `node server/index.js` starts, `GET /api/health` → 200, `sqlite3` native binding loads and runs a statement |

Scope of these results: they are a green build and a green suite on this checkout, not proof that the
generated bundle is byte-identical to the base one — runtime (`react`, `react-dom`, `lucide-react`,
`pg`) and build (`vite`, rolldown bindings) packages changed, so identical output is neither expected
nor checked. What is checked is that no application source behaviour or public API changed, which the
delta supports by construction: the only non-package product/test edit is the four test selectors in
section 5 (documentation and the handoff bundle also changed).

`npm install` reports that `sqlite3@6.0.1`'s install script is blocked by the npm-12 `allowScripts`
policy. The prebuilt binding repaired during item 9 is still in place and was exercised directly
(`create table` on an in-memory database) plus through the API health check, so runtime behaviour is
unaffected. This is the same policy question that stays open for the `engines`/`allowScripts`
decision (Option C / the follow-up pinned in the roadmap).

## 6a. Command evidence

Recorded verbatim from this run, so the claims above do not rest on prose:

```
$ npm audit --json | <counts>
before: {"info":0,"low":0,"moderate":6,"high":1,"critical":0,"total":7}
after : {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}

$ node -e "…require('sqlite3')…create table…"   → sqlite3 runtime: OK
$ curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/api/health  → 200

$ npx oxlint src        (1.74.0, installed)  → no output, exit 0
$ npx oxlint src        (1.85.0, measured before reverting) → 33 warnings, exit 0
$ npx oxlint@1.74.0 src (fetched fresh)      → no output

$ probe (throwaway vitest file, deleted after use)
  jsdom 30.0.1 → URL.createObjectURL(new Blob([1,2,3])) : succeeded, blob own symbols: 1
  jsdom 30.1.1 → threw "Cannot read properties of undefined (reading '_buffer')", own symbols: 0
  @asamuzakjp/dom-selector 8.3.0 → capitalised attribute selector matched: true
  @asamuzakjp/dom-selector 8.3.2 → capitalised attribute selector matched: false
```

## 7. Not changed

- No application source behaviour change and no public API change: the only non-package product/test
  edit is the four test selectors in section 5. The delta also touches documentation (this report,
  `CHANGELOG.md`, `NEXT_SESSION.md`, `PROJECT_STATE.md`, the roadmap) and the regenerated
  `chatgpt_handoff/**` bundle.
- `package.json` scripts, `.github/workflows/**`, `.gitattributes`, `.env*` and the release tag
  `v1.1.0-rc.1` (`46d2a3e…`) are untouched. No tag, release, npm publish or branch deletion.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics`, `origin/without-mask`, the OMP configuration and the
  QA folders were not touched.

## 8. Open after this task

- Merge decision for `chore/dependency-maintenance-option-b`.
- Option C: TypeScript 7 and Vitest 5 majors (own branch, own review), plus the `engines` declaration
  and the npm-12 `allowScripts` decision.
- The two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x), each with the evidence above.
