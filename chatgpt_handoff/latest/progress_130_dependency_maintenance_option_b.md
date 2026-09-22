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

Version specifiers keep the repository's caret convention; only the numbers changed. No dependency was
added or removed, and no script, workflow or release metadata changed.

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

2. **`jsdom` 30.0.1 → 30.1.1 — `URL.createObjectURL` no longer accepts a Blob.**
   jsdom 30.1.1 dropped its own `createObjectURL` implementation (the string does not appear anywhere
   in its `lib/`), the environment's `Blob` no longer carries a jsdom implementation symbol, and
   `URL.createObjectURL(new Blob([...]))` throws
   `Cannot read properties of undefined (reading '_buffer')`. `src/tests/firstExportFlow.test.tsx`
   exercises the real download step, so the suite fails with `jsdom` 30.1.1 and passes with 30.0.1.
   Proven by isolation: the failure reproduces with `jsdom@30.1.1` + `vitest@4.1.10` and disappears
   with `jsdom@30.0.1` on the same `vitest`; it is not a `vitest` regression and not a cross-file
   isolation problem.

## 5. Test corrections the upgrade required

`src/tests/styleMatteSection.test.tsx` queried four inputs with
`container.querySelector('input[aria-label="Gradient Angle"]')` while the component renders
`aria-label="Gradient angle"`. The old selector engine matched HTML attribute values
case-insensitively; jsdom's current selector engine (`@asamuzakjp/dom-selector` 8.3.0 → 9.2.1) matches
them case-sensitively, so the four queries silently stopped finding the element (two of them asserted
`toBeNull()`, so they had become vacuous). The queries now use the exact label the component renders,
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

`npm install` reports that `sqlite3@6.0.1`'s install script is blocked by the npm-12 `allowScripts`
policy. The prebuilt binding repaired during item 9 is still in place and was exercised directly
(`create table` on an in-memory database) plus through the API health check, so runtime behaviour is
unaffected. This is the same policy question that stays open for the `engines`/`allowScripts`
decision (Option C / the follow-up pinned in the roadmap).

## 7. Not changed

- No source behaviour change: the only non-package edit is the four test selectors above.
- `package.json` scripts, `.github/workflows/**`, `.gitattributes`, `.env*` and the release tag
  `v1.1.0-rc.1` (`46d2a3e…`) are untouched. No tag, release, npm publish or branch deletion.
- `C:\Users\ertugrul.ak\Desktop\ograf-graphics`, `origin/without-mask`, the OMP configuration and the
  QA folders were not touched.

## 8. Open after this task

- Merge decision for `chore/dependency-maintenance-option-b`.
- Option C: TypeScript 7 and Vitest 5 majors (own branch, own review), plus the `engines` declaration
  and the npm-12 `allowScripts` decision.
- The two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x), each with the evidence above.
