# KCS Development Report — Astra Correctness/Security Remediation

Metadata:
- Date: 2026-09-28
- Milestone: post-hold remediation of the Astra correctness/security findings F-01…F-10
- Starting HEAD: `7daacce46f0892649e15172d072d310ae4b4dbf0` (main, matching `origin/main`)
- Ending HEAD: the focused documentation commit named `docs: reconcile astra remediation state`; its hash cannot be embedded in its own content
- Integration: one branch per finding, fast-forward only; every implementation commit has a green `main` CI run
- Report number: 151

# 1. Executive Summary

Nine findings were reproduced first and fixed one at a time, each on its own branch with its own
focused regression test, then fast-forwarded into `main` and pushed. The tenth (stale live-document
claims) is this documentation task itself.

The six release-blocking findings were behavioural: a mixed legacy/channel animation lost the
channels the evaluator still resolved from the legacy composite on a save/load cycle; a legacy
project document could bypass the semantic validation that a scene receives; a standard Lottie
position/handle form was silently imported as zero; an OGraf export produced a different animation
than the editor; an OGraf package member could be admitted by under-declaring its size; and a file
dropped on the stage was persisted as a `blob:` URL that died with the page.

Two medium findings (preset storage exceptions, naming-dialog focus lifecycle) and the test-hygiene
finding (101 CI-reported React `act` warnings) were closed as well.

No release action was taken: H7 remains HOLD, the tag, the GitHub draft prerelease and the private
package metadata are unchanged.

# 2. Original Objectives

In scope: reproduce each finding, fix it narrowly on its own branch, add a consumer-visible
regression test, validate locally, fast-forward into `main`, push, confirm green CI, then reconcile
the live documents and the handoff. Out of scope: any release action, branch deletion, dependency or
workflow change, and any change to `C:\Users\ertugrul.ak\Desktop\KCS`,
`C:\Users\ertugrul.ak\Desktop\ograf-graphics`, `origin/without-mask` or the global OMP configuration.

# 3. Problems Discovered and Closed

1. **F-01 — mixed legacy/channel round trip lost the fallback.** `toSceneData` wrote the canonical
   channels *instead of* the legacy composite keyframes, but `evaluateTransform` reads a channel only
   when it carries keyframes for the active template and otherwise falls back to the composite. A
   track with a populated `x` channel and a legacy `y` animation therefore changed on save/load
   (`y = 150` became `0`). Fixed at `2c6e013`.
2. **F-02 — the legacy project format bypassed semantic validation.** A document whose
   `characterParts` array merely existed was accepted, so `{"characterParts":[null]}` imported
   "successfully", applied `[null]`, and crashed the evaluator on the first frame. Fixed at `b8718d2`.
3. **F-03 — Lottie numeric property forms were silently zeroed.** A split position
   (`p: {s: true, x: …, y: …}`) imported both axes as `0`, and a handle written per dimension
   (`o: {x: [0.25, 0.3], y: [0.1, 0.2]}`) became a `{x: 0, y: 0}` curve — both with no diagnostic.
   Fixed at `e19b5fe`.
4. **F-04 — the OGraf export did not reproduce procedural animation.** For `inAnimPreset: 'fade'` with
   `inAnimDuration: 60` at frame 15, the editor produced opacity `0.578125`, the OGraf evaluator
   `0.875` (it never received the duration) and the generated runtime `1` (it renders the timeline
   only). The export now refuses such a scene with `OGRAF_UNSUPPORTED_PROCEDURAL` instead of shipping
   a graphic that plays a different animation. Fixed at `8002659`.
5. **F-05 — the OGraf ZIP budget trusted one declared size.** A stored member of 33,554,433 bytes
   (limit 33,554,432) was admitted after its declared uncompressed size was tampered to `1`, because
   the budget counted the declaration while the reader copied the compressed size. Fixed at `3fa71ff`.
6. **F-06 — dropped media did not survive a reload.** The stage stored `URL.createObjectURL(file)` in
   the document, so the autosave persisted a page-scoped `blob:` URL and the image failed to load
   after a reload. Fixed at `645927a`.
7. **F-07 — preset storage exceptions escaped the hook.** A `getItem` `SecurityError` failed the
   mount and a `setItem` `QuotaExceededError` failed the write, because `localStorage` was used
   without the try/catch this project requires for external boundaries. Fixed at `c12d773`.
8. **F-08 — the naming dialog's focus lifecycle was incomplete.** Tab walked out of the modal, Cancel
   left focus on `body`, the dialog had a delayed focus callback that could target an unmounted node,
   and its icon-only close control had no accessible name. Fixed at `4cd276b`.
9. **F-09 — the suite reported 101 React `act` warnings on CI.** The serialization tests applied
   documents outside `act`, and the environment never declared React's act environment, so the
   warnings appeared only on a slower machine. Fixed at `8a4ca22`.
10. **F-10 — stale live-document claims.** `README.md` recommended `npx tsc --noEmit`, which checks no
    project file; `NEXT_SESSION.md` and `PROJECT_STATE.md` called the replay branch "identical to
    `main`" while it is 152 commits behind; and `NEXT_SESSION.md` still described a separate
    "Import Lottie" control that the unified import entry replaced. Fixed by this task.

# 4. Files Created

- `e2e/dropped-media-persistence.spec.ts` — real drop → autosave → reload proof for F-06.
- `e2e/new-item-modal-focus.spec.ts` — real keyboard smoke for the F-08 focus trap.
- `reports/progress_151_astra_remediation.md` — this record.

# 5. Files Modified

- `src/utils/legacyKeyframeConversion.ts`, `src/hooks/useSerialization.ts` — F-01: a
  `fillChannelsFromLegacyKeyframes` helper (channels the evaluator would resolve from the composite
  are written with those values) and its use in `toSceneData`; the hook also exports
  `UseSerializationApi`, its public surface as a named type.
- `src/utils/importValidation.ts`, `src/tests/importValidation.test.ts`,
  `src/tests/importCompatibilityMatrix.test.ts`, `src/tests/useSerialization.test.ts` — F-02: the
  legacy semantic pass (`legacyPartProblem`, `legacyProjectProblem`), the shared layer-value checks
  both shapes use, and the fixtures that had described unapplyable legacy documents.
- `src/interop/lottie/mapDocument.ts`, `src/interop/lottie/temporal.ts`,
  `src/tests/lottieImport.test.ts` — F-03: split positions, per-dimension handle components, and
  `LOTTIE_UNREADABLE_POSITION` / `LOTTIE_UNREADABLE_EASING` reports instead of fabricated zeros.
- `src/ograf/types.ts`, `src/ograf/diagnostics.ts`, `src/ograf/validation.ts`,
  `src/tests/ografDiagnostics.test.ts`, `src/tests/ografExport.test.ts`,
  `src/tests/ografGeneratedParity.test.ts` — F-04: the `OGRAF_UNSUPPORTED_PROCEDURAL` rule with its
  remediation, and the three-way editor/evaluator/runtime parity test for a supported scene.
- `src/ograf/packageImport.ts`, `src/tests/ografPackageImport.test.ts` — F-05: per-method size
  accounting, the stored-entry consistency rule and the unsupported-compression refusal.
- `src/components/Canvas/StageCanvas.tsx`, `src/tests/ografLegacyCompatibility.test.ts` — F-06: the
  drop handler stores the file's own bytes and the export resolves that form.
- `src/hooks/usePresets.ts`, `src/tests/usePresets.test.ts` — F-07: the storage boundary.
- `src/hooks/useDialogFocusRestoration.ts`, `src/components/Modal/NewItemModal.tsx`,
  `src/components/Modal/ConfirmationDialog.tsx`, `src/components/Modal/ImportReportDialog.tsx`,
  `src/tests/dialogFocusRestoration.test.tsx` — F-08: the shared focus trap and the dialog migrations.
- `src/tests/setup.ts`, `src/tests/importAtomicity.test.tsx` — F-09: the declared act environment and
  the document calls moved inside `act`.
- `README.md`, `CHANGELOG.md`, `NEXT_SESSION.md`, `PROJECT_STATE.md`,
  `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`, `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`,
  `docs/README_INDEX.md`, `reports/README.md` — F-10 and the record of the fixes.
- `chatgpt_handoff/latest/**`, `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` — the bundle rebuilt from
  the current documents only.

# 6. Architecture Overview

```text
Editor document -> toSceneData -> channels (+ the composite values the evaluator would fall back for)
Legacy document -> importValidation (legacy semantic pass) -> the legacy apply path
Lottie document -> readNumericProperty/handle readers -> per-channel timing -> KCS channels
Scene -> validateSceneForOGraf -> compileOGrafPackage -> generated runtime (timeline only)
Untrusted archive -> admitPackageEntry (per method, materialised bytes) -> fflate -> guarded decode
Dropped file -> FileReader data URL -> document -> autosave -> reload
Dialog open -> shared focus restoration + shared focus trap -> close -> opener restored
```

No parallel geometry, animation, playback or serialization authority was introduced; each fix either
extended the authority that already owned the behaviour or made the export refuse what it cannot
reproduce.

# 7. Data Model Changes

No serialized field was added or removed. `SceneData` still writes channels and no `keyframes[]`
(`fillChannelsFromLegacyKeyframes` only fills channels the evaluator would otherwise resolve from the
composite), the Lottie keyframe type keeps the document's handle lists until the channel that maps a
dimension resolves its own component, and a dropped image now reaches the document as a `data:` URL
instead of a `blob:` URL.

# 8. Coordinate Space Model

Unchanged. No canvas, transform, selection, hit-test, drag, mask or animation coordinate space was
altered.

# 9. Component / Module Walkthrough

`fillChannelsFromLegacyKeyframes` states the evaluator's own precedence rule (a channel scope with
canonical keyframes wins; the others are filled from the converted composite). `legacyProjectProblem`
reuses the scene pass's layer-value checks and adds the part rules the verbatim legacy apply path
needs. `mapLottieSegmentTiming` now resolves each handle component for the dimension its channel
maps. `validateLayer` refuses a procedural preset the runtime cannot reproduce.
`admitPackageEntry` derives the budget from the compression method. `StageCanvas` reads the dropped
file once and stores its bytes. `useDialogFocusTrap` owns the keyboard contract the three modals
share.

# 10. Important Code Changes

F-02 split the layer-value checks out of `layerProblem` into `sharedLayerValueProblem` so the scene
and legacy passes cannot drift. F-04 added `OGRAF_UNSUPPORTED_PROCEDURAL` to the diagnostic contract
(a `Record<OGrafDiagnosticCode, …>` entry is required, so the code cannot be emitted without a
remediation). F-05 replaced "declared size" with "materialised bytes by method". F-06 removed
`URL.createObjectURL` from the drop path entirely, which also removed the object URL that had no
revocation.

# 11. Public Interfaces

- `useSerialization` now exports `UseSerializationApi`, the type of its return value (additive).
- New server-free diagnostics: `LOTTIE_UNREADABLE_POSITION`, `LOTTIE_UNREADABLE_EASING`,
  `OGRAF_PACKAGE_INCONSISTENT_SIZE`, `OGRAF_PACKAGE_UNSUPPORTED_COMPRESSION`,
  `OGRAF_UNSUPPORTED_PROCEDURAL`.
- `admitPackageEntry` takes the archive reader's full entry header (`name`, `size`, `originalSize`,
  `compression`); it is exported for tests only.
- No endpoint, response schema, saved-project format or component prop changed.

# 12. Algorithms and Geometry

F-01's fill is a per-channel set operation over `(channel, template scope)` covered by canonical
keyframes. F-05's accounting is O(entries). F-03's handle resolution is a per-dimension index with a
last-entry fallback, matching the value reader that already existed.

# 13. Interaction / UX Behavior

A dropped image now survives a reload. The naming dialog keeps the keyboard inside itself, names its
close control, and returns focus to its opener on Cancel, submit and Escape; the confirmation and
import-report dialogs use the same trap. An OGraf export of a scene whose layer carries an in/out
preset now reports a blocker with an actionable remedy instead of producing a graphic that plays a
different animation, and the first-export readiness check reports the same blocker because it reads
the same authority.

# 14. Design Decisions

- Fix the fallback by writing the values the evaluator would resolve, rather than by re-introducing
  `keyframes[]` to the file: the import path drops a legacy keyframe's `templateId`, so the canonical
  form is the one that survives a round trip faithfully.
- Validate legacy documents against the values the consumer dereferences, and only those, so a valid
  legacy file is never refused.
- Report an unreadable Lottie handle and keep the segment linear instead of inventing a zero curve.
- Refuse an export the runtime cannot reproduce instead of shipping a different animation; the
  alternative (porting a second preset engine into the generated runtime, or baking preset motion
  into `scene.kcs`) would either duplicate an authority or cost the package its editable scene.
- Measure the archive budget by the bytes the reader will materialise for that compression method,
  and refuse a method whose output cannot be bounded, rather than parsing the ZIP grammar a second
  time.
- Declare React's act environment in the test setup so the suite reports the defect on every machine.

# 15. Invariants That Must Be Preserved

- Canonical channels win where they carry data for a template scope; the composite fallback stays the
  fallback.
- The import boundary refuses before any state update; a refused document leaves the editor untouched.
- The generated OGraf runtime renders the timeline; anything it cannot reproduce is refused at
  validation, never silently dropped.
- An archive member is measured by the bytes it materialises, and the archive is decoded under the
  existing count, path, duplicate and prototype-key guards.
- A persisted document never depends on a page-scoped object URL.
- `localStorage` is an external boundary: a failure is contained, never propagated as a crash.
- Dialog focus is owned by one authority; a disabled action is not a focus stop.
- H7 remains HOLD until a new explicit release instruction.

# 16. Testing and Verification

Per finding: the focused files passed, then `npx tsc -b --pretty false`, `npm run lint`,
`npm run build`, `npm run validate:ograf`, the full Vitest suite, `node scripts/check-state-consistency.mjs`
and `git diff --check`; the OGraf-affecting tasks also ran `npm run qa:release`, `npm run qa:v6` and
the export/Lottie/matte browser specs, and the UI tasks ran their own browser smoke.

- F-01: 104 tests in `useSerialization.test.ts`; the suite reached 1,957 tests.
- F-02: 38 tests in `importValidation.test.ts`; `sequencer-project.json` and the server's seed project
  were verified to still validate.
- F-03: 103 tests in `lottieImport.test.ts` plus `e2e/lottie-import-report.spec.ts` (3 tests).
- F-04: `ografExport`/`ografGeneratedParity`/`ografSvg`/`ografV6Parity`/`ografDiagnostics` (114 tests),
  `qa:release` (2), `qa:v6` (3).
- F-05: 13 tests in `ografPackageImport.test.ts`: the tampered stored member end to end, the
  per-method size and total-budget rules through the reader's own seam, and the unsupported-method
  refusal. (The first version of these tests allocated ~150 MB of payloads, which made an unrelated
  allocation-heavy test in the same file time out under parallel load; the rule-level cases replaced
  the redundant end-to-end ones, and the file is now faster than before the fix.)
- F-06: `e2e/dropped-media-persistence.spec.ts` passed with the fix and was shown to fail against the
  pre-fix handler (it persisted `blob:http://127.0.0.1:5188/…`).
- F-07: 29 tests in `usePresets.test.ts`.
- F-08: 19 tests in `dialogFocusRestoration.test.tsx` plus `e2e/new-item-modal-focus.spec.ts`.
- F-09: full-suite `act` warnings measured 110 with the environment declared, 0 after the fix
  (128 files / 1,995 tests pass).
- F-10: `node scripts/check-state-consistency.mjs` PASS and `git diff --check` clean.

# 17. Manual QA Results

- PASS — a PNG dropped on the stage is stored as `data:image/png;base64,…`, and after a page reload
  the rendered `<image>` resolves with HTTP 200 from the document's own bytes.
- PASS — the naming dialog focuses its field, six Tabs and three Shift+Tabs never leave the modal,
  and `Escape` returns focus to the "Create New Sequence" opener.
- PASS — the OGraf editor/evaluator/runtime parity scene renders the same transform at frames
  0/15/30/45/60 through `evaluateOGrafScene`, `renderOGrafSvg` and the generated runtime.

# 18. Regression Risk Assessment

- F-01: LOW-MEDIUM — the fill is per template scope and the round-trip is pinned by six tests,
  including canonical precedence and stability across a second cycle.
- F-02: MEDIUM — it refuses documents that were previously accepted. The pass validates only the
  values the legacy apply path dereferences, and both real legacy samples in this repository still
  import; the risk is a legacy file that is genuinely unapplyable.
- F-03: LOW — the changed numbers are the ones the document actually describes.
- F-04: MEDIUM — an OGraf export of a preset-carrying scene is now blocked. That is the finding's
  remedy, and the readiness check reports it before the export is attempted.
- F-05: LOW — the budgets are the same constants, measured against materialised bytes.
- F-06: LOW — a data URL is the form the Media drawer already writes and the export already packages.
- F-07: LOW — a failure that previously escaped now stops at the boundary.
- F-08: LOW-MEDIUM — three dialogs share one trap; the existing dialog tests (44) still pass.
- F-09: LOW — the production change is a type-only export.

# 19. Performance Considerations

No measured regression. F-01 adds a bounded per-channel merge with a set lookup per keyframe;
F-05 adds one comparison per entry; F-06 replaces an object URL with a file read that the drawer
path already performs.

# 20. Dependencies

None added, removed or upgraded. No package, lockfile, workflow or dependency change was made.

# 21. Compatibility

Saved scenes, OGraf packages, manifests, Lottie documents and the API payloads keep their formats.
Legacy project documents are now checked before they are applied, and the two legacy samples in this
repository still import.

# 22. Known Limitations

- The OGraf export cannot carry procedural in/out preset motion; a scene that uses one is refused
  with a remedy (clear the preset and author keyframes, or do not export that scene as a graphic).
- `evaluateOGrafScene` applies the editor's procedural delta without the export gate only when a
  caller bypasses validation; the export path always validates first.
- The archive preflight cannot observe a local/central header disagreement through fflate's API, so
  the budget is bounded per compression method and the decoded scene still passes the KCS boundary.
- Full Vitest on this Windows machine needs a raised per-test timeout for the two tests that spawn
  `git` many times; with the default 5s they can time out under parallel load, which is a pre-existing
  property of those tests, not of this work.

# 23. Technical Debt

The GitHub Actions Node 20 runtime and Ubuntu 26 migration annotations remain (workflow maintenance,
not a product failure). The two CI-reported `act` warnings that originally motivated F-09 were a
symptom of an undeclared test environment; the environment is now declared, so the contract is
enforced on every machine.

# 24. Git Summary

Implementation commits, all fast-forwarded into `main` and pushed:

- `2c6e013` — `fix: preserve mixed channel animation round trips`
- `b8718d2` — `fix: validate legacy imports before apply`
- `e19b5fe` — `fix: preserve lottie numeric property forms`
- `8002659` — `fix: align ograf procedural animation runtime`
- `3fa71ff` — `fix: enforce ograf zip materialization budgets`
- `645927a` — `fix: persist dropped media across reloads`
- `c12d773` — `fix: contain preset storage failures`
- `4cd276b` — `fix: complete new item modal focus lifecycle`
- `8a4ca22` — `test: eliminate react act warnings`

Documentation branch: `docs/audit-state-reconciliation`; commit message
`docs: reconcile astra remediation state`. Integration policy: fast-forward only. No rebase, reset,
force push, branch deletion, tag, release or npm action.

# 25. Updated Project Tree

```text
e2e/
  dropped-media-persistence.spec.ts   [new]
  new-item-modal-focus.spec.ts        [new]
reports/
  progress_151_astra_remediation.md   [new]
chatgpt_handoff/
  CHATGPT_UPLOAD_ONEFILE.md           [rebuilt]
  latest/                             [clean rebuilt document bundle]
```

# 26. Self Review

Good: every finding was reproduced before it was fixed, each fix carries a consumer-visible
regression, the branches stayed small, and the integration was fast-forward only with green CI per
commit. F-04 is the one finding whose remedy is a refusal rather than a new capability, and that is
the contract the finding itself allows. Could improve: the F-05 preflight still cannot see a
local/central header disagreement; the OGraf procedural restriction deserves a dedicated product
decision (bake at export, or implement the presets in the runtime). Uncertainty: F-02 narrows what a
legacy document may contain, so an unapplyable legacy file that used to import and then break is now
refused. Score: 9/10.

# 27. Next Recommended Task

Run the full post-fix regression gate on `main` (this run's Task 11) and then a read-only
release-readiness audit for a future RC candidate; do not publish, finalize or retag.

# 28. Project Status

Milestones A–G are complete, Milestone H is complete through H6 with its release decision held (H7),
and the Astra remediation findings F-01…F-10 are closed. The release tag, draft prerelease, private
package version and npm state are unchanged.

# 29. AI Development Notes

The authorities to reuse: `fillChannelsFromLegacyKeyframes` for the evaluator's channel precedence;
`legacyProjectProblem` (with `sharedLayerValueProblem`) for legacy documents; `resolveHandle` for
Lottie handles; `validateSceneForOGraf`'s procedural rule for anything the generated runtime cannot
reproduce; `admitPackageEntry` for archive budgets; the Media drawer's data-URL form for dropped
media; `useDialogFocusTrap`/`useDialogFocusRestoration` for dialog focus.
