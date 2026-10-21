# KCS Development Report — V7.1 Targeted Remediation

Metadata:
- Date: 2026-10-21. Preflight snapshot: 07:33:28 UTC; final preservation snapshot: 08:35:29 UTC. Not an overnight/unattended execution claim.
- Milestone: Task A Lottie HOLD, Task B documentation accuracy, Task C numeric hygiene, Task D approval-only temporal-input policy audit.
- Documentation branch/worktree: `docs/v71-targeted-remediation` / `.worktrees/v71-director`, starting at `8b7cdeb15cbf50f29072e8ac491245898d59f697`. Its own publication commit is identified by Git, not a self-embedded hash.
- Starting and final canonical main / origin/main / live remote main: `b6b3c2cbcfc8727f38129d207526e3167c591526`, unchanged.
- Starting certified V7 candidate: `b6c2d78d3f96e10fa9df2d21d0d13cde2595d586`.
- Final V7.1 candidate: `7b25ddcfa29eda1f73acf31ca77830153a335f86`, `test/v71-targeted-verified`.
- Commit status: four reviewed forward delta commits and candidate pushed; no merge, PR closure, release, tag, version bump or history rewrite. Versioned documentation is published separately without creating a duplicate documentation PR.
- Report number: 205; highest existing report in this documentation tree was 204. Missing historical203 was not fabricated.

# 1. Executive Summary

A–D scoped deliverables are implemented or, for D, explicitly audit-only. **Overall integration validation: FAIL / NOT MERGE-READY.** Final candidate passed 2983 unit tests and exact-head CI but its first-pass full Chromium run passed465/466, failing the existing left-toolbar reopen synchronization test. An isolated pass is not a full-suite pass. Sol subsequently proved its readiness predicate can pass before the first opening animation frame. No out-of-scope #54 patch or repeat-until-green run was made.

Delivered: minimal Lottie HOLD fix in new stacked PR65; truthful existing PR55/61 documentation; existing PR58 finite-range and inverse-loss corrections; source-grounded compatibility/decision/rollback matrix. No import/restore policy was implemented.

# 2. Original Objectives

- A: independently reproduce the three-keyframe Lottie target-HOLD overwrite; preserve incoming data and segment-start authority; evaluate scalar/mask and emitted runtime; minimal source PR.
- B: forward corrections in existing PR61 and PR55, separating actual import behavior, pure utility contracts, authored storage and proposed F5b constraints.
- C: independent numeric tests before correction; reject unrepresentable readings through the existing unavailable result; preserve public declarations and signed true cusps; investigate inverse underflow/loss metadata.
- D: actual import/restore/evaluator compatibility matrix, alternatives, impact, proposed tests and rollback for approval, with no implementation.
- Validation: independent local reviews, final-content full unit/browser runs, separate CI/visual/release-smoke evidence and current upload files.

No broad feature sprint, CI-trigger expansion, F5b, storage/schema migration, silent saved-project repair or unapproved interaction semantics.

# 3. Problems Discovered

| Finding | Root cause / observed counterexample | Outcome |
|---|---|---|
| R1 HIGH | Incoming handle assignment also renamed the target's own outgoing easing; incoming-only→HOLD→next at F18 evaluated75 instead of50 | Fixed in65; incoming data retained |
| R2 MEDIUM | KCS temporal fields are not shape/finite-validated by import/restore; exponent text1e309 is admitted | Audit and approval matrix only; risk remains |
| R3 MEDIUM | PR61 doc and fuzz comment asserted upstream rejection that source does not provide | Corrected in61, including comment-only companion |
| R4 MEDIUM | Default PR CI executes no browser tests; manual/weekly smoke is not full Chromium | Classified, workflows unchanged |
| R5 LOW | Finite coefficient ratios can overflow to limit-Infinity or total-underflow to false zero; inverse loss metadata only tracked envelope clamps | Corrected in58 without new type/reason |
| #55 accuracy | Global infinity/import guarantees; cusp example had wrong Taylor coefficient | Corrected spec and boundary distinctions |
| Validation blocker | Existing54 reopen predicate observes a temporary target width before the frame ease starts | Full browser FAIL; deterministic read-only triage, no scope expansion |

# 4. Files Created

- `docs/KCS_V71_TEMPORAL_INPUT_POLICY.md` on documentation branch: compatibility matrix, actual boundary evidence, A/B/C alternatives, impact, proposed tests, rollback and approval decisions. Status AUDIT ONLY.
- `docs/KCS_V71_CANDIDATE_MANIFEST.json` on candidate: exact13 source heads, certified parent, four reviewed deltas, source-patch method and keep-all overlap resolution. Historical V7 manifest preserved.
- This report, `chatgpt_handoff/latest/CHATGPT_UPLOAD_ONEFILE_V7_1.md` and `manifest_V7_1.txt`: current truthful upload and file checksums. No canonical dirty V5 file overwritten.
- No new permanent test file; real regressions were added to existing test modules. TEMP probes, screenshots and model journals are evidence only, not production dependencies.

# 5. Files Modified

| Branch / path | Previous responsibility; exact change and consumer impact |
|---|---|
|65 `src/interop/lottie/temporal.ts` | Shared scalar/mask mapper; retain unconditional bezierIn assignment, prevent easing promotion only for target HOLD. Other target promotion/diagnostics unchanged. One behavioral guard plus ownership comment. |
|65 `src/tests/lottieImport.test.ts` | Existing real-document importer suite; three added regressions evaluate scalar HOLD, preserved non-HOLD fallback and mask-path HOLD, plus retained incoming data/diagnostics. |
|65 `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` | Mapping specification; explicit HOLD-target authority and retained incoming half. |
|58 `src/utils/speedInverse.ts` | Unwired pure math; finite quotient overflow/total-underflow becomes existing cusp-NaN unavailable reading; true zero and divergent cusp sign preserved. Existing lossy additionally covers total collapse and subnormal entry read-back mismatch. Header/gesture guarantees narrowed to actual semantics. |
|58 `src/tests/speedInverse.test.ts` |13 added cases (59 total): signed range failures, exact powers-of-two boundaries, true cusps, signed underflow, asymmetric half-ULP cancellation, lossy quantization vs exact subnormal ladder. Arbitrary draft sample tolerance removed before publication. |
|55 `docs/KCS_F5_SPEED_GRAPH_INVERSE_SPEC.md` | Specification only; distinguish gesture envelope, utility validation, storage and unguarded KCS import; range-unavailable sentinel, intentional signed cusps, rounding limitations and F5b approval gate. Correct y'=3q−1.5q². |
|61 `docs/KCS_ROUND3_BLUEPRINTS.md` | O4 audit statement; finite-shape paired drift coverage is not import rejection or mathematical correctness. |
|61 `src/tests/ografInterpolationDriftGuard.test.ts` | False upstream-rejection COMMENT corrected; no executable or assertion changes. |
|65/58 `CHANGELOG.md` and tracked `chatgpt_handoff/latest/CHANGELOG.md` | One scoped entry per source fix; mirrors byte-identical. Candidate preserves both entries and all prior V7 content. |

Published deltas:65 five files+92/−3;58 four files+275/−15;55 one file+36/−10;61 two files+16/−4. Final candidate delta vs certified parent:11 paths+463/−32, including its new manifest. These counts describe patches, not product value.

# 6. Architecture Overview

Lottie document→single `mapLottieSegmentTiming` authority→numeric keyframes or mask-path timing→canonical editor evaluator→renderer; OGraf compiler/runtime consumes the imported scene with matching HOLD precedence. No new evaluator, playback clock, store, serializer or handle authority.

The F5a module remains pure and has no production UI importer. KCS import/restore and OGraf export/runtime boot are separate trust boundaries; one boundary's validation cannot certify another.

# 7. Data Model Changes

None. Authored channels/legacy compatibility, serialized versions, handles/control-point shapes, masks, templates, autosave keys and history contracts unchanged. Source fixes do not migrate or repair persisted payloads. R2 document is a proposed policy, not a schema or validation change.

# 8. Coordinate Space Model

Temporal controls remain normalized segment-time/progress coordinates; Lottie document frame rate and frame shift unchanged. Incoming half belongs to the preceding segment, outgoing mode to the start keyframe. Physical velocity remains signed value-units/frame via k=(v1−v0)/deltaFrames.

Mask vertices retain local→world rendering conversion; browser mask fixture at world center(620,420) held its square at local±30 through F18, not the square-to-diamond midpoint. No world/camera/viewport conversion was changed. Drawer failure triage sampled DOM border boxes only; no workspace animation/geometry code was edited.

# 9. Component / Module Walkthrough

- `mapLottieSegmentTiming`: pass1 derives each key's own outgoing state; pass2 attaches a predecessor's incoming half. New guard protects only HOLD from the existing promotion. `mapLottieKeyframes` and mask mapping share it.
- `endpointSlopesFromHandles`: derivative-order classification; ordinary live/equal-order ratios need a finite reportable quotient. Nonzero ratios rounded completely to0 are unavailable, not flat geometry. True order-divergent cusps retain signed Infinity.
- `handlesFromEndpointSlopes`: closed-form y values, existing gesture envelope, existing clamped endpoints; structural information loss augments existing lossy. No application state.
- Existing test modules exercise import→evaluated output and numerical boundaries; documentation/comment-only paths introduce no runtime state.

# 10. Important Code Changes

Lottie pass2 retains the incoming point, then applies `if (target.easing !== 'hold') target.easing = 'bezier'`. Removing incoming data would break the previous segment; removing every promotion would silently alter non-HOLD behavior outside the approved fix.

Numeric live ratio accepts `finite(value) && (d1y === 0 || value !== 0)`; equal-order nonzero leads require `finite(value) && value !== 0`. Otherwise existing `{kind:'cusp', value:NaN}` means unavailable, not a geometric vertical tangent.

Inverse structural flags: nonzero entry→stored0; nonzero exit→stored incoming-y1; or nonzero subnormal entry product whose forward read-back differs from the requested number. Subnormal threshold2^-1022 is the IEEE normal boundary, not a tuned tolerance. Normal-range rounding is not universally flagged.

# 11. Public Interfaces

No exported function signature, union member, field, public error reason or serialized API added/removed. Independent final review compared15 declaration lines to the prior head. Existing unavailable NaN sentinel also represents numeric range loss; callers must distinguish it from signed Infinity. Existing clamped remains envelope-only; existing lossy does not promise exact arithmetic or universal error bounds. No F5b consumer was introduced.

# 12. Algorithms and Geometry

For equal leading derivative orders, the real finite coefficient ratio can exceed IEEE range or lie below its nonzero floor; neither event is a true cusp. Example MAX/MIN is finite in real arithmetic but unreportable; MIN/MAX is nonzero but rounds to0. Normal ratio/limit and true divergent sign rules remain.

For entry inverse,3·MIN at x=.5 ties to2·MIN; forward division reads4·MIN, now lossy=true. Exact10200·MIN at x=.25 stores2550·MIN and round-trips, lossy=false. Positive2e-16 exit survives as pred(1); negative counterpart can round to1 because the representable spacing above/below1 differs. No optimizer, curve fit or arbitrary threshold. Existing O(1) math remains O(1); source mapper remains linear in keyframes.

# 13. Interaction / UX Behavior

Before: importing an incoming handle before HOLD could animate the HOLD's outgoing span. After: scalar/mask step to the next key while the preceding incoming handle remains usable. Actual user flow: choose Lottie file→review diagnostics→Import and replace project→scrub timeline.

No new controls, shortcuts or gestures. Math/doc changes are not a new editor interaction. Import-policy/recovery UX remains a decision, not a shipped affordance.

# 14. Design Decisions

- Minimal HOLD guard, not a broad mapping rewrite: preserves existing non-HOLD partial-pair behavior; that inherited convention remains documented.
- Reuse existing unavailable sentinel rather than adding a public error contract. Different causes of NaN remain intentionally indistinguishable to this API.
- Preserve ordinary IEEE rounding semantics; report documented structural loss, not every floating-point discrepancy.
- Separate policy audit from enforcement; preserve original saved data and require explicit approval for rejection/recovery semantics.
- New65 stacked on63 avoids duplicating its pending diagnostic diff. Candidate uses exact source deltas, not merge/cherry-pick/rebase. Documentation published on its own versioned branch, no extra PR noise.
- Keep full Chromium FAIL. The #54 readiness correction is outside A–D, so this run does not silently widen scope to make the aggregate badge green.

# 15. Invariants That Must Be Preserved

HOLD precedes handles; segment-start mode and previous-segment incoming data have distinct owners. One Lottie temporal mapper serves scalar/mask. Complete-pair behavior and diagnostics unchanged outside HOLD targets. Public API/scene versions/history/storage unchanged. True signed cusps survive range hygiene; NaN is not rendered as a vertical tangent. clamped does not include underflow events. Valid partial pairs, crossed x and Elastic y outside the gesture envelope remain supported authored data. No assertion weakening, retry increase, sleeps, tolerance relaxation or baseline regeneration.

# 16. Testing and Verification

## RED/GREEN and independent source proof

| Surface | Actual evidence |
|---|---|
| A importer RED |113 tests:2 new HOLD failures/111pass before source edit; log a-red.log |
| A importer GREEN |113/113 after guard; a-green.log |
| A direct supervisor reproduction |Original frame12.5 expected100/actual112.916193; frame15 actual150; final browser fixture F18 expected50/actual50 |
| A independent emitted-runtime |63 checks/0fail: imported scalar and mask scenes, full-pair-before-HOLD and before/after mapping/diagnostic comparisons; a-probe-runtime.log |
| A independent focused suites |4files/145tests pass; Lottie entry and OGraf parity |
| C first RED/GREEN |8fail/48pass of56→56pass; c-red.log. Draft review requested corrections, not accepted as final. |
| C rework RED/GREEN |3fail/56pass of59→59pass; rework-c-red.log and rework-c-green-focused.log |
| C smoke |Final worker26/26 direct probes; final independent54/54 expectations plus59/59 focused. Reviewer corrected its own mis-derived probe expectation; not hidden. |
| Branch gates |A types/lint/build/OGraf/checker pass, but initial full Vitest2873pass/1timeout (195files/2874tests); isolated38pass is not fullPASS. C final196files/2923pass,7parityfiles/62pass, types/lint/build/OGraf pass. B consistency68/68 per branch. |

A branch timeout was in a git-fixture state-consistency test; causality as machine load was not proven solely by an isolated pass. Final candidate full unit result below supersedes neither the historical failure nor its logs.

## Final exact-content candidate:7b25ddcfa29eda1f73acf31ca77830153a335f86

| Gate | Command / environment | Result |
|---|---|---|
| Project types |npx tsc -b --force --pretty false|PASS|
| Lint |npm run lint|PASS;0errors,1pre-existing unused import warning|
| Full unit |npx vitest run --maxWorkers=2|PASS199files/2983tests,135.18s; JUnit200suites/0failures|
| Production |npm run build|PASS|
| OGraf |npm run validate:ograf|PASS|
| State consistency |node scripts/check-state-consistency.mjs|PASS68checks|
| Full Chromium FIRST PASS |CI=1 PORT=5013 npx playwright test --project=chromium --workers=1 --retries=0 --reporter=line|**FAIL465/466**,15.8min|
| Isolated drawer diagnostic |same spec alone on same candidate|1pass/3.7s; NOT full-suite success|
| Actual release smoke |PORT=5013 npm run qa:release;UI5189;effective retries0|PASS2tests;exact SHA echoed|
| Actual visual runner |CI=1 PORT=5013 npm run qa:visual -- --retries=0;existingwin32baselines|PASS2tests/3.8s;no regeneration|
| Default CI dispatch |[39566988919](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39566988919)|SUCCESS, exact candidate head; NO browser job|

Actual API used newly created SQLite in the new candidate only; isolated services stopped and that newly created database removed. Canonical services/DB were not used for test writes. QA process wrappers were twice severed by the harness while underlying runners finished; gate evidence comes from runner logs/JUnit, not wrapper speculation.

Raw logs are under Windows TEMP/kcs-v71: v71-tsc.log, v71-lint.log, v71-vitest-full.bg5.log, v71-vitest-junit.bg5.xml, v71-build.log, v71-ograf.log, v71-consistency.log, v71-e2e-chromium.log, v71-qa-release.log, v71-qa-visual.log. Later narrow runs replaced the original test-results error-context directory; original raw failure log survived. No original trace retained (retries0/trace-on-first-retry).

Documentation bundle smoke: `node scripts/check-state-consistency.mjs` on `docs/v71-targeted-remediation` passed76checks after the four versioned deliverables were written. This documentation-only check does not change the source candidate's browser verdict.

# 17. Manual QA Results

**PASS, actual UI on65 head71fe219:** private frontend5226, real import report and timeline controls. Incoming-only scalar F9=37.5,F12/F13/F18=50,F24=100; full-pair scalar F9=39.52931589494144,F18=50. Mask F18 DOM path equals HOLD-start square; F24 diamond.5 screenshots persisted under TEMP/kcs-v71/browser-a; Sol inspected f2-F18.png. Exact vertex proof is DOM geometry, not pixel-equality certification. Page errors empty; expected Lottie anchor/partial-easing warnings reported. Tab/service closed; no canonical API writes.

**FAIL integration readiness, deterministic read-only triage on candidate:** original #54 test expects reopened stage548, receives908. Sol's fresh5227 UI probe (not a suite rerun) observed immediate Show dock360/stage633/inline-width empty, original wait predicate TRUE; next animation frame dock0/stage993/inline-width0px; second frame dock130.6875/stage862.3125. Source first commits target class, then schedules first frame-ease write. Target geometry is not completion. Raw supervisor-drawer-transient.json and supervisor-drawer-triage.md; screenshot omp-sshots-15aeb35c56e70438.webp. Own tab/service closed. No test/source patch applied.

# 18. Regression Risk Assessment

| Area | Risk / evidence |
|---|---|
| Lottie correction |LOW local patch risk; paired incoming preserved, emitted scalar/mask and actual UI verified. Pre-existing non-HOLD promotion remains. |
| Numeric correction |MEDIUM future-consumer interpretation risk; no current production caller; existing NaN means unavailable, not cusp Infinity. Independent analytic boundaries passed. |
| Import/restore |MEDIUM unresolved safety risk; malformed temporal data still admitted. Policy approval required. |
| Integration |HIGH readiness blocker: full browser gate FAIL; no green aggregate certification. |
| CI/visual scope |MEDIUM credibility limitation: defaultCI noE2E;2win32visual fixtures not cross-platform blanket coverage. |

# 19. Performance Considerations

No benchmark claimed. Lottie adds one conditional in the existing pass; numeric work remains constant-time and only computes subnormal read-back after short-circuit eligibility checks. No production UI consumer or new render/state loop. Two local model workers maximum; heavy browser QA serialized, unit workers bounded2 and browser worker1.

# 20. Dependencies

No dependency, package-lock or version changes. Exact existing lock installed with npm ci --no-audit --no-fund in the new candidate:298packages/21s; existing prebuild-install deprecation warning recorded. A new worktree reused installed dependencies through an ignored local junction. Windows block-clone unsupported notices fell back to plain checkout; no data loss or source change.

# 21. Compatibility

Saved-document shapes, legacy conversion, evaluator precedence, partial-pair fallback and runtime emission remain compatible outside approved HOLD correction. Scalar/mask incoming pair semantics verified. Crossed x and Elastic y must not be rejected by a future gesture-envelope policy. Node24.18.0, TypeScript7.0.2, Vitest5.0.2 and Windows Chromium used. Linux visuals and universal release readiness not certified.

# 22. Known Limitations

- Full Chromium remains FAIL. Do not treat isolated drawer pass, green CI,2-test release smoke or old V7 green as current full-suite proof.
- Malformed/nonfinite KCS temporal fields remain accepted; finite inputs can still overflow the general evaluator. No silent repair or import-policy patch.
- Numeric lossy is structural metadata, not an exact-error bound. Surviving pred(1) exit cancellation can have material relative drift and remains ordinary rounding under the documented current contract. Existing unavailable sentinel does not distinguish invalid input from range failure.
- Non-HOLD orphan-incoming promotion and HOLD-source handle dropping are inherited behavior, not a broad rewrite in65.
- Existing visual baselines win32-only and narrow. Original failure error-context was overwritten by later runner artifact reuse; raw failure log retained.

# 23. Technical Debt

Approval-gated temporal boundary/recovery semantics; default PR browser coverage decision; existing #54 reopen test synchronization. No dead code, new schema or speculative UI was added to anticipate them.

# 24. Git Summary

New candidate commit7b25ddc: `test(v71): assemble reviewed temporal remediation candidate`; parent certifiedb6c2d78; source-patch assembly of exact four forward deltas.8disjoint paths blob-verified; changelog keep-all mirror blob56ea467c93df1d91a1c5a95da51d7f44476279f5. Candidate and source branches pushed normally, clean at08:35audit. Historical45worktrees preserved; three added(A/director/candidate),48total. Canonical dirty21paths and their hashes exactly unchanged.

All PRs52–65 remainOPEN. Review-ready is NOT merge authorization or an aggregate browser pass. Existing-source PRs not re-reviewed from scratch this run; current heads/CI verified and final candidate exercised them.

| PR | State / base | Exact head | Exact-head CI run | Readiness |
|---|---|---|---|---|
| [#52](https://github.com/ErtugrulAK/keyframe-character-studio/pull/52) | OPEN / main | `feb70f71b7213e341a9468213ce9e243f9cd786d` | [39427009523](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39427009523) success | SOURCE INCLUDED; unchanged this run; CI green is not full-browser certification |
| [#53](https://github.com/ErtugrulAK/keyframe-character-studio/pull/53) | OPEN / main | `af5c5c17d91a88deb1914034342091c2bca0c209` | [39427104922](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39427104922) success | SOURCE INCLUDED; unchanged this run; CI green is not full-browser certification |
| [#54](https://github.com/ErtugrulAK/keyframe-character-studio/pull/54) | OPEN / main | `4af5a1666bafe8f63066172ea3afcb4e73ecf806` | [39427186472](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39427186472) success | BLOCKED: reopen-readiness race reproduced; no green full Chromium |
| [#55](https://github.com/ErtugrulAK/keyframe-character-studio/pull/55) | OPEN / main | `114a05612375e2cf22ebb677909dbf32330ce6a4` | [39566449600](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39566449600) success | DOCS REVIEW READY; not an import-policy change |
| [#56](https://github.com/ErtugrulAK/keyframe-character-studio/pull/56) | OPEN / main | `fc1f0df1bee07dda5ea45371dd674891a05d6051` | [39496713305](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39496713305) success | SOURCE INCLUDED; unchanged this run; CI green is not full-browser certification |
| [#57](https://github.com/ErtugrulAK/keyframe-character-studio/pull/57) | OPEN / main | `a16063980c1811f76f682a7f6f6bb84845e0c34d` | [39508582743](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39508582743) success | SOURCE INCLUDED; unchanged this run; CI green is not full-browser certification |
| [#58](https://github.com/ErtugrulAK/keyframe-character-studio/pull/58) | OPEN / main | `fb67ebfbe536bfdccc2c60541ab09b274a2a008b` | [39566631665](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39566631665) success | CODE REVIEW READY; final numeric review READY; integration browser gate remains blocked |
| [#59](https://github.com/ErtugrulAK/keyframe-character-studio/pull/59) | OPEN / main | `9a1202ce30813512eaeea9c5a4d2c76dfa6a46b8` | [39445150964](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39445150964) success | SOURCE INCLUDED; unchanged this run; CI green is not full-browser certification |
| [#60](https://github.com/ErtugrulAK/keyframe-character-studio/pull/60) | OPEN / main | `a432dbc2541f51276fb7c2298db7311efaada29c` | [39508183235](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39508183235) success | SOURCE INCLUDED; unchanged this run; CI green is not full-browser certification |
| [#61](https://github.com/ErtugrulAK/keyframe-character-studio/pull/61) | OPEN / main | `e0ee195164571fb8f3a2376049c91998d7f21f87` | [39564938639](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39564938639) success | DOCS/COMMENT REVIEW READY; no executable drift-guard change |
| [#62](https://github.com/ErtugrulAK/keyframe-character-studio/pull/62) | OPEN / main | `95e94760f37497836e35e1ce96aaa18bf1d5166d` | [39506705575](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39506705575) success | SOURCE INCLUDED; unchanged this run; CI green is not full-browser certification |
| [#63](https://github.com/ErtugrulAK/keyframe-character-studio/pull/63) | OPEN / main | `8b70a9b465ee27d006f2a121c60f97f5063f0137` | [39508715423](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39508715423) success | SOURCE INCLUDED; apply dependency before stacked #65 |
| [#64](https://github.com/ErtugrulAK/keyframe-character-studio/pull/64) | OPEN / main | `8b7cdeb15cbf50f29072e8ac491245898d59f697` | [39513830917](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39513830917) success | HISTORICAL V7 DOCS ONLY; unchanged, not current V7.1 certification |
| [#65](https://github.com/ErtugrulAK/keyframe-character-studio/pull/65) | OPEN / fix/v7-lottie-partial-easing-diagnostics | `71fe219784c35ed670ae7852b1e36873b2b5c934` | [39564588329](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39564588329) success | CODE REVIEW READY; stacked on OPEN #63; not independently merge-authorized |

Documentation publication remains on `docs/v71-targeted-remediation`; no new documentation PR, no changes to64. Its commit/CI are identified in the final delivery and branch checks rather than recursively embedding its own hash.

# 25. Updated Project Tree

- .worktrees/v71-lottie-hold — fix/v71-lottie-hold-authority,65
- .worktrees/m1-speed-inverse — existing58,updatedforward
- .worktrees/f5-spec — existing55,updatedforward
- .worktrees/round3-docs — existing61,updatedforward
- .worktrees/v71-candidate/docs/KCS_V71_CANDIDATE_MANIFEST.json — finalsourceassembly
- .worktrees/v71-director/docs/KCS_V71_TEMPORAL_INPUT_POLICY.md — approval-onlymatrix
- .worktrees/v71-director/reports/progress_205_targeted_remediation_v7_1.md — thisrecord
- .worktrees/v71-director/chatgpt_handoff/latest/CHATGPT_UPLOAD_ONEFILE_V7_1.md and manifest_V7_1.txt — currentupload

Canonical V5 dirty ONEFILE/manifest and V7 documentation remain unchanged.

# 26. Self Review

A and C received separate local reviewer sessions; shared Mnemopi context means perfect blinding is not claimed. A reviewer derived63runtime expectations without implementation packets and returnedREADY. C first review returnedREWORK; final independent review returnedREADY after exact assertions, corrected figures, total-underflow refusal and partial-subnormal metadata. Sol independently reproduced before/after numeric cases, inspected ownership code, actual screenshot and live drawer transition.

Rejected claims: initial aggregate flake classification as proven machine-load-only, isolatedpass=fullpass, allroundingflagged, false import enforcement and wrong draft TaskD/branch labels. This final record identifies D correctly as policy audit. Review is scoped evidence, not a security/release certification.

# 27. Next Recommended Task

Seek explicit approval for the narrow existing54 readiness-test correction: synchronize canonical frame-ease completion while retaining all geometry assertions; no sleeps, retries, relaxed thresholds or product-animation rewrite. A forward54commit would require a new candidateSHA and new full gates; do not relabel7b25ddc green. Separately request policy decisions in KCS_V71_TEMPORAL_INPUT_POLICY.md before any rejection/guard/recovery implementation. Stop the current feature scope atA–D.

# 28. Project Status

A: FIXED and independentlyverified; B: CORRECTED andpublished; C: FIXED andindependentlyverified; D: AUDIT DELIVERED, implementationNOTapproved. **Integration validationFAIL; merge/release readinessBLOCKED.** Main unchanged; no PR merged/closed. Publication records the failure rather than hiding it.

# 29. AI Development Notes

GPT-6.1 Sol supervised boundaries, counterexamples, source checkpoints, evidence correction and final verdict. Existing LAN Qwen registration `pennyroyal-eng131/pennyroyal` performed implementation, routine search/tests, independent review, browser QA, integration and evidence drafting; max2concurrent local workers. Model endpoint returned pennyroyal; all12saved V7.1 journals observed that model and explicit high,0auxiliary model_usage events at final audit.13CLI invocations include one smoke and one supported resume of an existing journal; no paid-cloud task agents used, no globalconfig changes. This is observed routing evidence, not an external billing guarantee.

An initial rework CLI printed raw XML tool markup instead of executing it; not accepted as completion. Same explicit model/high session resumed with supported --resume and executed real work. Browser inline screenshot helper did not persist requested paths; actual disk proof used same live page's screenshot API. Fresh-process imports avoided long-lived module-cache proof errors. Reports/tests do not depend on .omp or TEMP harness artifacts.

## DO NOT CHANGE CASUALLY

Segment ownership/HOLD precedence; retained incoming points; single evaluator/mapper; signed cusp vs unavailable NaN distinction; clamped envelope-only semantics; atomic import/history/storage boundaries; exact-SHA evidence; original dirty artifacts. No source truth may be overwritten by a report's reputation.

# 30. Lessons Learned

Finite input does not imply a finite representable calculation. Paired-runtime agreement does not prove mathematics or import enforcement. A target-layout predicate can pass before an animation starts. A narrow green smoke cannot erase a red full run. Scope and truthful failure reporting are safety contracts, not obstacles to an attractive completion badge.
