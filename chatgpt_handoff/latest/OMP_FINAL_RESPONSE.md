# KCS Milestone F Item 12 — Final Response (Unified Import Entry)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** done and merged. `feat/unified-import-entry` was fast-forward merged into `main` at `ce6cec2` (base `main` was `81b87a3`) and pushed; the branch is kept.
- **Report:** `reports/progress_128_unified_import_entry.md`.
- One import control replaces the fragmented ones, and it decides what a file is from its **content**, never from its name alone.

## 2) WHAT CHANGED

| File | Change |
|---|---|
| `src/utils/importDispatch.ts` | New `classifyImport(fileName, text)`: package names first, then the boundary size gate (no parse), then one parse shared by an OGraf-schema check and a Lottie shape check, with the KCS scene/legacy decision delegated to `validateImportedDocument` |
| `src/components/Header/HeaderBar.tsx` | One `Import` button and input (`.json`, `.kcs`, `.lottie.json`, `.ograf.json`, `.zip`, `.ograf`) whose label names every accepted kind; the separate `Import Lottie` control is gone; the handler routes each kind to its existing behaviour |
| `src/components/Modal/ImportReportDialog.{tsx,css}` | The Lottie report dialog generalised with a `title` prop (renamed from `LottieImportReportDialog`) so the OGraf package slice can reuse it; its accessibility, sanitiser, blocker-first order and 40-entry cap are unchanged |
| `src/tests/importDispatch.test.ts` | New, 4 cases: the classification matrix, content-over-extension, the unclassifiable cases, the OGraf-marker precedence and the oversized route |
| `src/tests/lottieImportEntry.test.tsx` | 13 cases rewritten around the single control: report/cancel/apply, KCS import, OGraf rejection, unclassifiable refusal, refusal dialog, focus trap, sanitisation, cap |
| `e2e/lottie-import-report.spec.ts` | 2 browser tests: the Lottie report flow, and a `.kcs` project importing through the same control while a refused file changes nothing |

## 3) VALIDATION

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| focused suites (`importDispatch`, `lottieImportEntry`, `lottieImport`) | PASS — 105 cases |
| `npm test` (full Vitest) | PASS — 122 files / 1,841 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 2 real-browser tests |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 4) REVIEW

Three independent read-only rounds (`reviewer-agent`, evidence-cited):

| Round | Verdict | Findings |
|---|---|---|
| 1 | BLOCKED | The dispatcher parsed before applying the boundary's size gate; the canonical OGraf schema (`ograf.ebu.io`) was not recognised by content, only by the `/ograf/` substring and the file name; the control's accessible label did not name the legacy and package kinds; the new tests missed both the canonical-schema and the oversized cases |
| 2 | BLOCKED | The OGraf marker had been moved behind the KCS shape check, so an OGraf-marked document that also carried a KCS shape could reach the project authority |
| 3 | READY WITH WARNINGS | Every blocker closed; the remaining notes were a duplicated changelog bullet, stale test counts in the report and a misplaced import — all fixed |

The production fixes: the size gate now runs before any parse (so an oversized document is never parsed by the dispatcher), the canonical `OGRAF_GRAPHICS_SCHEMA_URL` authority is reused instead of a substring, and the OGraf marker wins over the KCS shape so an OGraf document can never be applied as a project.

## 5) SAFETY

- The validated import boundary is still the only path that turns text into a project, and `importProject` still validates before it applies anything.
- `.kcs`, legacy, OGraf manifest and OGraf package outcomes are unchanged; the OGraf kinds keep their existing messages.
- Lottie still reports before it replaces, and cancel still performs no mutation, no save and no toast.
- No network or filesystem access; the document text is the only input.
- No renderer/evaluator change, no dependency, and no `package.json`, lockfile or workflow change.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the GitHub draft release, npm metadata, `origin/without-mask`, the OMP configuration and the user folders are unchanged.
- Integration was fast-forward only: no merge commit, no rebase, no force push, no tag change, no branch deletion.

## 6) NEXT

The OGraf package/editable import expansion (the next task of this orchestrator run), reusing
`ImportReportDialog` and the same validated apply path; then the approval-gated package and toolchain
follow-ups (Option B, `engines`/`allowScripts`, Option C).
