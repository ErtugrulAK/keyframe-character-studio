# Progress 110 — Milestone C: First Export / Onboarding Flow

## Scope

Roadmap item 5 (Milestone C of `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`): give a new user a short, safe path to a first successful OGraf export, reusing the Task 105 diagnostics authority and the existing export UI. The downloadable archive is named `<sanitized scene name>-ograf.zip` by the existing writer; the package format it contains (OGraf V1) is untouched.

Out of scope (unchanged): export engine, package materializer, OGraf package format (`.ograf.zip` and the runtime), host/vendor contracts, dependency/package/workflow/release changes, a forced wizard, telemetry, and any new persistence flag.

## Branch

- Implementation branch: `feat/export-onboarding`
- Commits: `73b22a2` (feature), `ba9837e` (round-1 review fixes), `31cb407` (round-2 consistency fixes), `6d8371d` (round-3 claim scoping)
- Feature commit message: `feat: add first export onboarding flow`
- Baseline `main`: `f5dbb3f8ef16a48d9ade89d4e1c9a48536e672d5` (Milestones A and B merged, `main == origin/main`)
- `v1.1.0-rc.1` tag target (unchanged): `46d2a3e59e065816d972dcd56951803951b577f6`

## Implementation summary

1. **One OGraf compile path in `HeaderBar`.** `compileOGrafPlan()` now owns `exportProject()` → `prepareLegacyOGrafExport()` → `compileOGrafPackage()`. The package export, the legacy single-file export, and the new readiness check all call it, so the check reads the same diagnostics the export reads. (Previously the same three lines were duplicated in both export handlers.) The check is a summary rather than a copy of the export: it reports the first blocking finding and the warning count, while the export reports every blocking toast and the warning details, and it can still fail later during ZIP materialization — and a scene edited between the check and the export is recompiled at export time.
2. **Pre-flight readiness summarizer.** `summarizeOGrafExportReadiness(diagnostics, packageBaseName?)` was added to the existing Task 105 authority (`src/ograf/diagnostics.ts`). It reads `getOGrafExportRemediationReport` and returns one status: `blocked` (carrying the first blocking remediation and its concrete next step), `warnings` (explicitly "warnings do not block", with the deduplicated root-cause count), or `ready`. It names the archive the writer would produce (`<sanitized name>-ograf.zip`, the same rule as `browserZip`) and never claims that a package was written. No second diagnostics system: it is a presenter over the existing report.
3. **First-export guidance panel.** `src/components/Header/FirstExportGuide.tsx` is a compact, opt-in panel behind a labelled header button ("First export help"): three steps (keep a visible layer, run the readiness check, choose "OGraf Package" in the Export menu), the statement that nothing is written until you export, and a labelled "Check export readiness" button with its running state. It blocks nothing, opens nothing automatically, and is rendered outside the existing `role="menu"` so the export menu semantics stay intact.
4. **Readiness result routing.** `handleCheckOGrafReadiness` compiles the current scene and routes the summary through the existing toast surface with Task 105's title/action model: blocked → error toast with the blocking title and next step (long duration); warnings → info toast; ready → success toast. Failures reuse `describeOGrafPackageWriteFailure` and the sanitizer, exactly like the export handlers.
5. **No template/sample affordance was added** because no starter-scene or sample-scene machinery exists in the app (the project templates are motion-sequence records, not scene starters). Inventing one would have been new machinery outside this milestone; the guidance therefore points at the existing surfaces instead.

## Existing authorities reused

| Concern | Authority | Reused for |
|---|---|---|
| Export pipeline | `compileOGrafPackage`, `prepareLegacyOGrafExport`, `exportProject()` | the single compile path behind export, legacy export, and the check |
| Diagnostics + remediation | `src/ograf/diagnostics.ts` — `getOGrafExportRemediationReport`, `describeOGrafExportDiagnostic`, `describeOGrafPackageWriteFailure`, `sanitizeOGrafDiagnosticText` | the readiness summary and every failure message |
| Archive naming | `sanitizeOGrafDownloadName` + `browserZip`'s `<name>-ograf.zip` rule | the name quoted by the readiness message |
| Notifications | `showToast` from `useToast` via the animator context | readiness and export results |
| Export UI | the existing Header export menu (`role="menu"`, three `menuitem`s) | untouched; the guide is a sibling panel |
| Templates | `projectTemplates` + the existing new-template modal | untouched (no starter-scene capability exists) |

## Files changed

| File | Change |
|---|---|
| `src/ograf/diagnostics.ts` | new `summarizeOGrafExportReadiness` + `OGrafExportReadiness` (presenter over the existing remediation report) |
| `src/components/Header/FirstExportGuide.tsx` | **new** — the opt-in first-export guidance panel |
| `src/components/Header/HeaderBar.tsx` | shared `compileOGrafPlan`; the guidance button + panel; `handleCheckOGrafReadiness`; both export handlers now use the shared path |
| `src/tests/ografExportReadiness.test.ts` | **new** — 5 tests for the readiness summary |
| `src/tests/firstExportGuide.test.tsx` | **new** — 3 tests for the guidance panel |
| `src/tests/firstExportFlow.test.tsx` | **new** — 5 tests for the HeaderBar first-export flow |
| `src/tests/ografBrowserZip.test.tsx` | one timing assertion now awaits the shared compile path (contract unchanged: exactly one writer call) |
| `e2e/export-onboarding.spec.ts` | **new** — real-browser first-export journey |
| `NEXT_SESSION.md` | the stale "Milestone C" section now describes Milestone C (it had described Milestone B work), records the branch state instead of "not started", and the checkout line names this branch |
| `PROJECT_STATE.md` | remaining work records Milestone C as implemented on this branch and awaiting merge |
| `reports/progress_110_export_onboarding.md` | this report |

## User-facing behavior

- **First-export/onboarding behavior:** a labelled "First export help" button next to Export opens a compact panel with the three steps, the "nothing is written until you export" statement, and a readiness button. Nothing opens automatically and nothing is persisted.
- **Diagnostics behavior:** the readiness check reports from the same diagnostics authority the export uses: the first blocking finding shows Task 105's stable title, context, message, and concrete next step; warnings show a "does not block" summary with their count; a clean scene shows "Ready to export". Blockers beyond the first are not enumerated by the check (the export reports them all).
- **Success/blocked behavior:** blocked never shows ready — the summary is derived from the same report the export handler reads before it writes anything, and the blocked branch carries no archive name. Success language ("Exported …") remains exclusive to the actual export handlers, which are the only writers.
- **Accessibility:** the panel is a `role="group"` named "First export help", the trigger exposes `aria-expanded`/`aria-controls`, the readiness button has an explicit accessible name and a disabled/running state, and the existing export menu keeps its `role="menu"`/`menuitem` structure.
- **Unsupported/out-of-scope:** no wizard, no forced first-run experience, no sample-scene generator, no host/vendor destination, no change to `.ograf.zip` shape or the generated runtime, no new dependency, no telemetry, no release/publish change.

## Tests added/updated

| File | Tests | Focus |
|---|---|---|
| `src/tests/ografExportReadiness.test.ts` | 5 | ready copy names the real archive; blocked never says ready and carries the remediation + next step; warnings stay non-blocking; root-cause dedupe and plural wording; no-name fallback |
| `src/tests/firstExportGuide.test.tsx` | 3 | group name + steps; labelled readiness action with running state; never renders success/completion wording |
| `src/tests/firstExportFlow.test.tsx` | 5 | guide hidden until asked, no writer call; ready path (success toast, no archive written); unsupported layer → blocked toast with next step, no writer call; clip-matte warning path; the existing export still works after a check |
| `src/tests/ografBrowserZip.test.tsx` | 18 (1 timing update) | existing export/ZIP coverage, now awaiting the shared compile path |
| `e2e/export-onboarding.spec.ts` | 1 | real Chromium: guidance opens/closes, readiness reports "Ready to export" without any "Exported" toast, then the real export downloads a `-ograf.zip` archive and shows the success toast, with no console errors |

## Validation matrix

| Command | Result |
|---|---|
| Focused Vitest (`ografExportReadiness`, `firstExportGuide`, `firstExportFlow`) | PASS — 3 files / 13 tests |
| `npx playwright test e2e/export-onboarding.spec.ts` | PASS — 1 test |
| Full Vitest (`npm test`) | PASS — 112 files / 1,665 tests |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests |
| `npm run build` | PASS |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (pre-existing `AnimatorContext` Fast Refresh warning only) |
| `git diff --check` | clean |

## Known warnings

- Pre-existing only: the `AnimatorContext` Fast Refresh warning, the Vite chunk-size advisory, and the `e2e` folder being outside the Vitest include glob.

## Protected invariants

- No export engine, package materializer, OGraf package/runtime format, host or vendor contract, dependency, workflow, release, or publishing change.
- `.ograf.zip` naming and contents come from the unchanged `compileOGrafPackage` + `createOGrafBrowserZip` path; the readiness check only reads diagnostics and never writes.
- This branch changes only the files listed above; nothing has been merged or pushed yet, and the tag `v1.1.0-rc.1`, the draft release, npm metadata, `without-mask`, global OMP configuration, `C:\Users\ertugrul.ak\Desktop\KCS`, and `ograf-graphics` are untouched.

## Independent review result

_Pending — recorded after the review round below._

## Merge/push status

_Pending — recorded after the review gate._

## Next recommended task

Milestone D — state / CI / warning hygiene (roadmap items 6 and 9). Item 6 (current-state consistency check) is documentation/tooling; **item 9 (dependency and warning maintenance) requires explicit user approval because it touches `package.json`/`package-lock.json`.**
