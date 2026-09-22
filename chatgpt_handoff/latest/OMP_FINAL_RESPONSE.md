# KCS Milestone D Item 9 Option B — Final Response (Dependency Maintenance)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** Option B is implemented on `chore/dependency-maintenance-option-b` (base `main` at `a4f8642`); the merge decision is with the user.
- **Report:** `reports/progress_130_dependency_maintenance_option_b.md`.
- **Decision (user):** apply the patch and minor group plus a bounded `npm audit fix` (no `--force`), on its own branch.

## 2) WHAT CHANGED

| Area | Change |
|---|---|
| Dependencies (16 direct moves) | `react`/`react-dom` 19.3.0, `@types/react(-dom)` 19.3.0, `vite` 8.3.0, `vitest`/`@vitest/coverage-v8` 4.1.11, `@vitejs/plugin-react` 6.1.1, `@testing-library/{jest-dom,react,user-event}` 7.0.1/16.3.3/14.6.7, `lucide-react` 1.47.0, `pg` 8.23.0, `@types/pg` 8.23.1, `@types/node` 24.13.6, `concurrently` 10.0.5 — caret convention kept, no key added or removed, `oxlint` and `jsdom` specifiers byte-identical to the base commit |
| Lock graph | 64 transitive entries touched (1 added, 6 removed, 57 version changes), including the security fixes below |
| Security | bounded `npm audit fix`: 7 advisories (1 high `nanoid`, 6 moderate) → **0** |
| Tests | the refresh moved the transitive selector engine `@asamuzakjp/dom-selector` 8.3.0 → 8.3.2, which made attribute-value matching case-sensitive; four `styleMatteSection` queries used `aria-label="Gradient Angle"` while the component renders `"Gradient angle"` and now use the rendered label (measured with a throwaway probe: 8.3.0 matched the capitalised variant, 8.3.2 does not) |

## 3) DEFERRED, WITH EVIDENCE

- **`oxlint` 1.85.0:** reports 33 warnings (`react(refs)`, `react(set-state-in-effect)`, `typescript(no-non-null-asserted-optional-chain)`) that 1.74.0 does not report. Clean lint is the project standard; silencing rules or rewriting React code is not a dependency task → stays `^1.74.0`.
- **`jsdom` 30.1.1:** measured in this checkout — with 30.1.1 the Blob carries no jsdom-internal symbol and `URL.createObjectURL(new Blob([...]))` throws `Cannot read properties of undefined (reading '_buffer')`; with 30.0.1 the same call succeeds. Isolated (`jsdom@30.1.1` + `vitest@4.1.10` still fails; `jsdom@30.0.1` on the same `vitest` passes), so it is not a `vitest` regression. Which jsdom change causes it is **not** established and is not claimed → stays `^30.0.1`.

## 4) VALIDATION

| Check | Result |
|---|---|
| `npm run build`, `npx tsc --noEmit` | PASS / clean |
| `npm test` | PASS — 124 files / 1,858 tests |
| `npm run lint` | clean (exit 0) |
| `npm run validate:ograf`, `npm run qa:release` | PASS (2 Chromium tests) |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 tests |
| `node scripts/check-state-consistency.mjs` | PASS — 32 checks |
| `npm audit` | 0 vulnerabilities |
| Server runtime | `node server/index.js` starts, `GET /api/health` → 200, `sqlite3` native binding loads and executes a statement |

The results are a green build and a green suite on this checkout, not an output-identity comparison:
runtime and build packages changed, so an identical bundle is neither expected nor checked.

`npm install` confirms `sqlite3@6.0.1`'s install script is blocked by the npm-12 `allowScripts` policy; the existing prebuilt binding still loads (verified directly and through the API), which is the same open question as the `engines`/`allowScripts` follow-up.

## 5) SAFETY

- No application source behaviour or public API change: the only non-package product/test edit is the four test selectors. Documentation and the handoff bundle were also regenerated.
- Scripts, workflows, `.gitattributes`, the tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release and npm metadata are untouched; no tag, release, publish or branch deletion.
- Integration is for the user to approve; nothing was merged or pushed in this task.

## 6) NEXT

The merge decision for this branch, then Option C (TypeScript 7 / Vitest 5 majors) with the `engines`/
npm-12 `allowScripts` decision, then the two deferred minor bumps with their own triage.
