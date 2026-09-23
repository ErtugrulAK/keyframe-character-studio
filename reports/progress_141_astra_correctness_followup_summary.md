# Progress 141 — the post-review correctness follow-up: final summary

Branch: `docs/final-correctness-gate` (base `main` at `2b0bba0`).
Scope: every finding from the full-project review, closed one task at a time, each on its own branch with its own validation, a read-only self-review and an approval-gated fast-forward merge.

## 1. Finding map

| Finding | Status | Task | Branch | Merged at | Report |
|---|---|---|---|---|---|
| **H-01** — a blocking dialog left the editor's global commands live | **CLOSED** | A | `fix/modal-shortcut-isolation` | `0c19751` | `reports/progress_134_modal_shortcut_isolation.md` |
| **H-02** — the OGraf inverted alpha matte did not invert alpha | **CLOSED** | D | `fix/ograf-inverse-alpha-matte` | `ac3bda1` | `reports/progress_137_ograf_inverse_alpha_matte.md` |
| **H-03** — the import boundary accepted malformed values | **CLOSED** | B | `fix/import-serialization-transaction-integrity` | `fc672f2` | `reports/progress_135_import_serialization_integrity.md` |
| **H-04** — save/load lost persistent authoring state | **CLOSED** | B | `fix/import-serialization-transaction-integrity` | `fc672f2` | `reports/progress_135_import_serialization_integrity.md` |
| **H-05** — multiple geometry in one Lottie layer was silently overwritten | **CLOSED** | C | `fix/lottie-structure-correctness` | `85c3929` | `reports/progress_136_lottie_structure_correctness.md` |
| **H-06** — the writable API was exposed on every interface without authentication | **CLOSED** | E | `fix/api-network-trust-boundary` | `352d272` | `reports/progress_138_api_trust_boundary.md` |
| **M-01** — a Lottie parent resolved by array offset instead of `ind` | **CLOSED** | C | `fix/lottie-structure-correctness` | `85c3929` | `reports/progress_136_lottie_structure_correctness.md` |
| **M-02** — a static child skipped its parent transform | **CLOSED** | C | `fix/lottie-structure-correctness` | `85c3929` | `reports/progress_136_lottie_structure_correctness.md` |
| **M-03** — import undo did not restore the whole document | **CLOSED** | B | `fix/import-serialization-transaction-integrity` | `fc672f2` | `reports/progress_135_import_serialization_integrity.md` |
| **M-04** — the profile harness did not build the workload it measured | **CLOSED** | F | `fix/evaluator-profile-fixtures` | `16e1610` | `reports/progress_139_evaluator_profile_fixture_fix.md` |
| **M-05** — live documents could contradict each other while the check passed | **CLOSED** | G | `fix/state-consistency-live-docs` | `2b0bba0` | `reports/progress_140_state_consistency_live_docs.md` |

**No finding is deferred, blocked or silently dropped.** Two were closed with a scope boundary stated in their own report and repeated below (§3): H-02's image-source behaviour follows the editor authority, and H-06 added no authentication.

## 2. What each fix is, in one line

- **H-01.** The global shortcut handler reads the dialogs' own `aria-modal` contract and returns before any command; `NewItemModal` declares the contract it was missing and owns `Escape` at the dialog level.
- **H-02.** An inverted matte is a **luminance** mask with a white backdrop and the source painted black (the technique the editor documents) instead of an alpha mask whose black source stayed opaque; the inverted luminance branch had the same defect and both modes now share one construction. The generated runtime mirrors it.
- **H-03.** A semantic pass at the boundary refuses a scene version this build does not know, a non-positive frame rate or timeline, a canvas size that is not positive, a non-text `textValue`, a layer without a usable id or z-order, duplicate layer ids, a path the geometry builder cannot walk, a mask without a path, a channel that is not a keyframe list and a keyframe value that is not finite — each with a stable code and the offending path, before any state is touched.
- **H-04.** A track's `visible`, `editVisible` and `locked` flags and its sequence link are written on export and read back on import, with the documented defaults for older files.
- **H-05.** A layer carrying more than one geometry item is reported instead of silently keeping the last one.
- **H-06.** The API binds `127.0.0.1` by default; a wider interface is an explicit opt-in (`KCS_API_HOST`) and the server warns with what it published and how to undo it.
- **M-01.** Parents resolve through an `ind` map after the layer loop, so order no longer matters; a missing index, a self-reference and a duplicated index are reported, and the depth walk is cycle-safe.
- **M-02.** The hierarchy is resolved for every layer; only the keyframe evaluation is skipped.
- **M-03.** The history snapshot carries the document-level state, so one undo restores the whole document.
- **M-04.** The scenes carry real `baseTransform` and real masks, and the harness verifies the built scene before anything is timed.
- **M-05.** `LIVE_DOCUMENTS` is the checker's authority, with rules for the checkout, the `main` revision and the release tag, and the stale live documents reconciled.

## 3. Scope boundaries that were stated, not hidden

- **H-02, image matte sources.** An image cannot be repainted, so the luminance mask reads the image's own luminance — which is exactly what the editor does for an inverted image matte, and its spec pins that structure. A true inverse of an image's *alpha* would need a filter chain the editor does not use either.
- **H-06, authentication.** None was added: the product does not claim a shared deployment, and inventing an auth architecture is a decision of its own. The exposure is removed by binding loopback, and the documentation says plainly that the API has no authentication and that CORS is not access control.
- **H-04, `SceneLayer.visible`.** Written as a constant and read by the OGraf evaluation; it is the *document's* layer visibility, not the editor's per-track mute. Mapping the mute onto it changes what an exported package renders — a separate product decision.
- **M-03, the legacy project-template registry.** A legacy (non-scene) import also registers a project tab, which belongs to the template manager rather than the scene document. A modern scene import — the normal path — is fully covered.

## 4. Residual observations (recorded, deliberately not changed)

These are not review findings; they were found while closing the ones above, and each needs its own decision.

| Observation | Evidence | Why it is not changed here |
|---|---|---|
| `npx tsc --noEmit` checks **zero** project files | `tsc -b --listFiles` reports 151 source files; `npx tsc --noEmit --listFiles` reports none (the root `tsconfig.json` is a solution file with `files: []`) | The CI workflow and the documented validation steps are outside every finding's scope; the real gate is `npm run build` (`tsc -b`), which is what this run used |
| `SceneLayer.visible` is a constant `true` | `toSceneData` writes `visible: true`; the OGraf evaluation reads it | Changing it changes what an exported graphic renders |
| CORS is unrestricted and is not access control | `cors()` with no allowlist; `docs/API.md` now says so | Narrowing it changes behaviour for any other frontend origin; the finding was about network exposure |
| `server/db/keyframe_studio.sqlite` is **tracked** in git | `git ls-files server/db/` lists it | Repository hygiene outside the findings; it is also why the API trust test is a unit test plus a recorded run rather than a process-level test |
| `vite --host` publishes the frontend dev server | `package.json` `dev` script | A deliberate dev convenience for a static editor with no server-side data, and not the writable API |
| Focus is not restored when the import report or the confirmation dialog closes | Those two dialogs have no previous-focus capture (the bezier editor does) | An accessibility change beyond H-01's command-isolation scope; recorded in `reports/progress_134_…` §6 |
| One full-suite run in Task B reported a single failure that never reproduced | Six further full runs, ten runs of the new integration case and six runs of the state-check suite are clean | No failure name was captured before the output was trimmed; recorded in `reports/progress_135_…` §6 |

## 5. The final gate (clean `main` at `2b0bba0`)

| Check | Result |
|---|---|
| `git pull --ff-only origin main` | up to date; `main == origin/main == 2b0bba0` |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npx tsc --noEmit` | exits 0 — and checks no project file (see §4); `tsc -b` covers 151 |
| `npm test` | PASS — 126 files / 1,932 tests |
| Focused regression suites from Tasks A–G (10 files) | PASS — 387 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium tests, candidate `2b0bba0` |
| `npx playwright test e2e/lottie-import-report.spec.ts e2e/ograf-matte-visual.spec.ts` | PASS — 7 tests (3 + 4) |
| `npx vitest run --config perf/vitest.perf.config.ts` | PASS — the harness verifies every scene before timing |
| `node scripts/check-state-consistency.mjs` | PASS — 35 checks |
| `npm audit` | 0 vulnerabilities |
| `git diff --check` | clean |

Every one of these ran on the merged `main`, not on a branch.

## 6. Release view

- The release **tag, draft prerelease and package metadata are unchanged**: `v1.1.0-rc.1` still points at the workflow-tested candidate `46d2a3e59e065816d972dcd56951803951b577f6`, the package stays private at `1.1.0-rc.1`, and nothing was published.
- **The review's release blockers are closed.** The remaining release work is the human decision the repository already defers: the approval-gated **Option C** (the `typescript` 6→7 major and the `vitest` + `@vitest/coverage-v8` 4→5 pair) and the two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x), plus any publish/finalize instruction.
- **Option C is still deferred**, and it is not a blocker: the current toolchain builds, tests and lints cleanly.
- The findings that were about *user-visible correctness* (H-01, H-02, H-03, H-04, M-01, M-02, M-03) each carry a reproduction that fails before their fix and passes after it, at the level a user observes — a deleted layer, a matte pixel, a refused import, a restored document, a placed child.

## 7. How this run behaved

- One branch per task, each fast-forward merged only after the user approved the merge gate; no rebase, no force push, no merge commit, no history rewrite.
- Every task carried a read-only self-review by the same model and a report under `reports/`.
- The handoff bundle was rebuilt after every merged task, and the one-file regenerated from scratch.
- One working-tree accident was recorded rather than hidden: the Task A changelog edit landed after the state check had run, which turned `main` red for one push; it was fixed by a docs-only commit (`1291bb8`) before the next task started, and the Task B branch was recreated on top of it.
