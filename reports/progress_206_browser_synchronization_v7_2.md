# KCS Development Report — V7.2 Browser Synchronization Remediation

- Report: 206 (previous highest verified: 205).
- Date: 2026-10-21. Start snapshot: 2026-10-21T10:20:18.321Z; protected-state audit: 2026-10-21T11:18:08.053Z.
- Scope verdict: **PASS for targeted V7.2 remediation**; no merge/release authorization or general release certification.
- Source PR54: fix/q3-drawer-layout-settle, 752148785db92ba2cabddca1538f5bf58dd8a22d.
- Candidate: test/v72-browser-synchronization, e01eff014822b54ed0004ddb418eb60f882c0225.
- Documentation: docs/v72-browser-synchronization, worktree .worktrees/v72-director; publication commit is identified by Git history, not an impossible self-embedded hash.

# 1. Executive Summary

The previous V7.1 candidate 7b25ddcfa29eda1f73acf31ca77830153a335f86 remains historical **FAIL 465/466**. V7.2 corrects its sole reproduced drawer synchronization failure in the existing PR54 test, without changing production animation or weakening its assertions. PR54's normal forward commit is 752148785db92ba2cabddca1538f5bf58dd8a22d; the new composition is e01eff014822b54ed0004ddb418eb60f882c0225. Independent review is READY. The new candidate's completed full Chromium run passed 467/467, full unit suite 2,983/2,983, actual visual 2/2 and actual release smoke 2/2, with successful exact-head CI. An initial manually interrupted Chromium launch is disclosed in section 16, not counted as green.

# 2. Original Objectives

- Reproduce the old readiness race and fix only PR54's browser synchronization.
- Preserve every original user-facing assertion/tolerance, production easing, accessibility and compatibility.
- Cover close/reopen, reduced motion and real keyboard activation.
- Retain all V7.1 source content and exact source PR heads, including prerequisite #63 for #65.
- Certify the new frozen candidate, publish a numbered report and versioned upload files, preserve canonical services/data/artifacts.
- Exclude import-policy implementation, unrelated UI work, merges and release actions.

# 3. Problems Discovered

| Problem | Evidence / decision | Status |
|---|---|---|
| Reopen gate accepts pre-motion target flash | Original spec expected stage 548, received 908. Held-first-frame Chromium probe: old gate true at dock360/stage548/inline empty; first animation frame writes inline0px/stage908. | Fixed in test synchronization only. |
| Initial worker draft omitted original dockHidden assertion and falsely described Space reopening | Supervisor rejected the draft despite its narrow green runs. Global Space remains play/pause, not handle activation. | Assertion restored; Enter and explicit reopened state/focus verified; both changelogs corrected. |
| Worker opened pre-existing q3 SQLite during initial API5014 setup against new-DB-only instruction | Its idempotent initialization left the recorded hash unchanged. | Disclosed safety deviation; subsequent source rework/review frontend-only; final QA uses fresh candidate DB. |
| Baseline reviewer confused patch content inclusion with Git ancestry | PR63 head is NOT an ancestor of V7.1 candidate (exit1); prior b6c2d78 candidate is (exit0). | Reviewer corrected; manifest records patch composition, not false ancestry. |
| First full Chromium invocation had a harness deadline | Worker cancelled before the deadline, then restarted once durably after old runner/listeners stopped. | Incomplete attempt retained; completed run separately green. |

# 4. Files Created

- Candidate: docs/KCS_V72_CANDIDATE_MANIFEST.json — exact parent, PR54 delta, 13 source heads, #63→#65 dependency, PR64 exclusion and blob proof.
- Documentation branch: reports/progress_206_browser_synchronization_v7_2.md (this report), chatgpt_handoff/latest/CHATGPT_UPLOAD_ONEFILE_V7_2.md and manifest_V7_2.txt.
- TEMP-only probes, runner configurations, screenshots, session journals, JUnit and gate logs under C:\Users\ertugrul.ak\AppData\Local\Temp\kcs-v72. They are evidence, not production dependencies.

# 5. Files Modified

| Existing path in PR54 | Change | Scope |
|---|---|---|
| e2e/left-toolbar-collapse.spec.ts | +158/-14: spec-local settled-edge helper; existing close/reopen gates replaced; normal and reduced-motion coverage; stronger geometry, keyboard, focus and aria checks | Test only; 29 original expect calls retained, 52 total across 2 tests |
| CHANGELOG.md | One new V7.2 synchronization entry | English documentation |
| chatgpt_handoff/latest/CHANGELOG.md | Identical mirrored entry | Existing mirror contract |

Published PR54 total: 3 files, +160/-14. Candidate-vs-parent adds only these paths plus its new manifest. src/, server/, package.json, package-lock.json, Playwright config and visual baselines are unchanged.

# 6. Architecture Overview

Canonical toggle immediately commits target classes and releases inline width, measures the target, then createFrameEase writes interpolated width on requestAnimationFrame. This creates a target-looking pre-motion frame. At final settle, the canonical animation releases inline width back to stylesheet ownership. The spec-local helper observes this existing ownership contract plus actual geometry stability; it does not introduce another animation/timing/state engine.

# 7. Data Model Changes

None. Authored project data, serialization, storage, schema, import/restore and undo semantics are untouched. Candidate manifest is engineering provenance, not a serialized scene model.

# 8. Coordinate Space Model

No production coordinate change. In the original 1280-wide diagnostic context, dock360 = rail56 + drawer304, expanded stage548 and collapsed stage908. These are context-specific observations, NOT fixed expectations at the spec's 1366 viewport. Final assertions independently derive stage footprint changes from measured/validated dock width and left position, retaining original tolerance and bounds. The defect was sampling time, not coordinate mathematics.

# 9. Component / Module Walkthrough

- src/hooks/useDockedPanelEdge.ts: target flush and ease start are unchanged.
- src/utils/workspaceLayout.ts: first rAF width write and final inline release are unchanged.
- e2e/left-toolbar-collapse.spec.ts: waitForDockedEdgeSettled observes dock/drawer/stage and handles pending, running, completed and reduced-motion snap states.
- Existing global keyboard authority still consumes Space for play/pause; Enter activates the focused handle. No shortcut implementation changed.

# 10. Important Code Changes

Before: reopen accepted rounded dock width equal to target plus drawer opacity1; collapse accepted width0 plus visibility hidden. Both express target state, not completed motion.

After: a single waitForFunction Promise samples requestAnimationFrame, within the existing 15 s budget. It requires dock.style.width to be empty, target geometry/state and a stable seven-field signature (inline width, dock width, drawer width, stage width, stage left, dock opacity and transform). Three consecutive equal comparisons mean **four consecutive samples**. Numeric signature quantization is 0.01px, not a widened assertion tolerance. Final geometry assertions remain independent of the readiness check. Final keyboard reopen uses bare page.keyboard.press('Enter') on retained focus and asserts actual expanded state.

# 11. Public Interfaces

No production export/API/type/behavior changes. New helper is local to the browser spec. No dependencies or user-facing commands added.

# 12. Algorithms and Geometry

The helper performs O(1) work per sampled frame. Pending target flash cannot satisfy its stability history before the animation's first frame changes inline ownership; in-flight samples retain inline width; completed and reduced-motion paths can settle without observing a running phase. Rejected alternatives: arbitrary sleeps, more retries, looser assertions, getAnimations()-only (the ease is JS-rAF-driven), and requiring a minimum number of running frames (invalid when already complete or reduced motion).

# 13. Interaction / UX Behavior

Production behavior is unchanged. Test exercises click close/reopen and Enter keyboard roundtrips, retained focus, aria-expanded/aria-controls, hidden/inert states and independent final geometry. A second test explicitly emulates reduced motion and verifies immediate snap without inline animation ownership. A trusted-key throwaway browser smoke verifies that Space changes Play to Pause while leaving the dock unchanged; the shipped spec does not pretend Space reopens it.

# 14. Design Decisions

- Test correction, not production rewrite: no genuine production animation fault was demonstrated.
- Observe canonical completion and settled geometry, not immediate aria/target class state.
- Keep every original assertion and tolerance; additions strengthen independent footprint/a11y/keyboard proof.
- Compose previous source tree plus reviewed PR54 forward delta; manually retain all changelog entries where old branch context prevents hunk application.
- Freeze candidate SHA before all gates; do not reuse earlier candidate success as new-head proof.

# 15. Invariants That Must Be Preserved

- All 29 original PR54 expect calls/tolerances and restored dockHidden assertion.
- Canonical animation, camera/world compensation and stylesheet ownership.
- Enter activation, global Space precedence and collapse inert/aria contract.
- Valid already-settled and reduced-motion paths need no in-flight witness.
- #65 requires #63 content. Patch inclusion is not Git ancestry.
- Existing visual baselines and canonical protected artifacts remain unchanged.

# 16. Testing and Verification

| Gate on e01eff014822b54ed0004ddb418eb60f882c0225 | Actual command / scope | Result |
|---|---|---|
| TypeScript project | `npx tsc -b --force --pretty false` | PASS, exit 0 |
| TypeScript no-emit | `npx tsc --noEmit` (supervisor) | PASS, exit 0 |
| Lint | `npm run lint` | PASS, exit 0; existing unused-screen warning |
| Full Vitest | `npx vitest run --maxWorkers=2`, default + JUnit reporters | PASS: 199 files / 2,983 tests, 117.11 s |
| Production build | `npm run build` | PASS, exit 0; existing chunk-size warning |
| OGraf manifest | `npm run validate:ograf` | PASS, minimal fixture valid |
| State consistency | `node scripts/check-state-consistency.mjs` | PASS: 68 checks |
| Full Chromium, completed attempt | `CI=1 PORT=5015 npx playwright test --project=chromium --workers=1 --retries=0 --reporter=line` | PASS: 467/467, 16.2 min, exit 0; preceding incomplete attempt below |
| Actual visual runner | `CI=1 PORT=5015 npm run qa:visual -- --project=chromium --workers=1 --retries=0 --reporter=line` | PASS: 2/2, existing win32 baselines, no regeneration |
| Actual release runner | `PORT=5015 npm run qa:release`, CI unset | PASS: 2/2 smoke, retries 0; exact candidate SHA echoed; runner uses 2 workers |
| Candidate exact-head CI | [39589982982](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39589982982) | SUCCESS; API headSha verified e01eff014822b54ed0004ddb418eb60f882c0225 |
| PR54 exact-head CI | [39587165397](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39587165397) | SUCCESS; head 752148785db92ba2cabddca1538f5bf58dd8a22d |

Documentation-only publication smoke on .worktrees/v72-director: `node scripts/check-state-consistency.mjs` PASS (80 checks), including the new versioned upload files. This is separate from the candidate's 68-check run; documentation publication does not change the frozen source candidate.

## All attempts and RED/GREEN lineage

- Original V7.1 full run: FAIL 465/466 on 7b25ddcf; raw failure remains in TEMP/kcs-v71/v71-e2e-chromium.log. It is not relabeled green.
- Before edit: controlled first-frame probe reproduced old-predicate false readiness. Three driver-faithful replays produced 2 geometry failures and one flash-window lottery pass; not repeated until green.
- Initial implementation draft: four narrow 2/2 runs are historical only because supervisor subsequently found the omitted assertion/Space-vacuity defects.
- Accepted source rework: 2/2 (5.0 s), frontend5230, workers1/retries0. Independent review: 2/2 (5.1 s), frontend5233, workers1/retries0.
- Combined candidate focused: two runs, 2/2 each (5.6 s and 5.43 s); second captured JSON because the first line reporter did not write the requested JSON artifact. Neither replaced the full suite.
- Neighbour camera specs: 11/11 in initial implementation context; production unchanged. Not misrepresented as an additional final-candidate full run.
- Direct GREEN helper probe stayed unresolved during controlled pre-motion flash, then resolved at genuine settle. Independent per-rAF probe: pending at t15, running t32–266, inline released t282, helper resolved t332. Already-completed case also resolves; reduced snap succeeds without motion witness. Reviewer stale-timer figure7522ms is NOT helper latency.

The first full-Chromium launch omitted the service name, so the harness ignored its readiness option and assigned a 300 s default deadline. After the partial output reached test 40/467, the worker explicitly cancelled its own job at approximately 70 s, BEFORE that deadline; this was not a test assertion failure or a completed suite. The job was confirmed cancelled and UI5188/API5015 listeners absent before one restart as a named durable service. The same candidate, tests, workers=1, retries=0 and output settings then completed 467/467. No test/config/source changes were made between these attempts. The partial run is INCOMPLETE, never PASS; there is no first-attempt full-pass claim. The worker summary's phrase "wrapper-capped interruption" is qualified here by the actual session cancellation record. Both attempts used the same Playwright output directory (the final .last-run.json is the completed run); the initial partial terminal output and cancellation are retained separately in the session, with extracted gate7-attempt1-interrupted.txt. No assertion failure appears in that partial output.

The official project typechecks pass. A separate exploratory standalone e2e TypeScript invocation found pre-existing TS2345 at unchanged seed tuple line39; project tsc-b excludes e2e. It is not a new helper error and was not silently fixed or hidden. Lint/build have existing non-fatal warnings, not clean-warning claims.

## Evidence locations

C:\Users\ertugrul.ak\AppData\Local\Temp\kcs-v72 contains red-probe-result.json, green-gate-result.json, final-review-result.md, rework-implementation-result.md, focused-54-run1/ and focused-54-run2/, gate1-tsc.log, gate2-lint.log, gate3-vitest/{run.log,junit.xml}, gate4-build.log, gate5-6.log, gate7-attempt1-interrupted.txt, gate7-chromium-full.log, full-chromium-results/.last-run.json, gate8-visual.log, gate9-release/run.log and gate10-ci-watch.log. Integration worker raw packet has two qualifications: npm ci was already performed by supervisor before worker start; initial Chromium was manually cancelled before the wrapper limit, not killed at the deadline. This report applies those corrections.

# 17. Manual QA Results

Actual isolated Chromium exercised pending/running/completed/reduced snap and Enter/focus/Space precedence. Screenshots show settled normal/reduced expanded/collapsed/reopened surfaces; they are not mid-flight proof. Per-frame instrumentation proves timing and was restored/removed afterward; tabs and owned services were closed. Linux/macOS visual parity and responsive breakpoint variants were not browser-certified in this run.

# 18. Regression Risk Assessment

| Area | Assessment | Evidence / residual |
|---|---|---|
| Production runtime | Low change risk | No source/config/baseline changes; full candidate browser467/467 |
| Original race | Addressed | Controlled flash reproduced and rejected by actual helper |
| Assertion weakening | No weakening found | Independent review retained all29 originals; strengthened52 total |
| Future drawer fade/ownership changes | Maintenance risk | Helper relies on canonical completion contract; change requires revisiting spec, not arbitrary sleep |
| Composition | Verified | Exact13 heads, allowed4-path delta, spec/changelog blob checks |
| Platform coverage | Limited | Existing win32 visual baselines only, no Linux/mac release certification |
| Process safety | Disclosed deviation | Initial old q3 DB was opened, but hashes prove no byte changes |

# 19. Performance Considerations

No production hot path changed. Test observer uses constant work per frame and waits actual motion plus stable observations; no benchmark or general throughput improvement is claimed. Four equal-signature samples are a condition on settled state, not an arbitrary wall-clock sleep.

# 20. Dependencies

No dependency/version/package/lock change. Supervisor installed the fresh candidate's exact lock via npm ci --no-audit --no-fund (298 packages, about20 s); QA worker correctly found the resulting existing install. Source q3 focused runs resolved existing main-checkout Playwright1.62.0 and Vite, without installing a junction. Package/lock hashes remained fixed.

# 21. Compatibility

Serialization, runtime evaluator, authored timing, import/restore, API and keyboard behavior are unchanged. OGraf manifest validation, OGraf-containing full Chromium suite and actual release smoke pass on the new candidate. Default CI still does NOT execute browser E2E; exact-head CI success is not substituted for local full Chromium. qa:release remains two-spec smoke, qa:visual two Windows baselines.

# 22. Known Limitations

- This is targeted remediation PASS, not permission to merge/release or a universal release-readiness guarantee.
- Malformed temporal import/restore policy is still approval-only and NOT implemented.
- Default PR CI lacks browser coverage; Linux/macOS visual baselines and wider platform/breakpoint proof are absent.
- Standalone pre-existing e2e seed TS2345 and non-fatal warnings remain.
- Initial full Chromium attempt was incomplete; initial implementation draft needed supervisor rework; q3 DB opening deviation remains in the record.
- Historical PR62/64 reports and previous candidate results are not current authority.

# 23. Technical Debt

The settled helper intentionally follows the current canonical inline-ownership/opacity contract. Future product transition changes must update this test contract deliberately. Temporal boundary compatibility/recovery choices remain in inherited docs/KCS_V71_TEMPORAL_INPUT_POLICY.md; this run changes none of them. No speculative product sprint was started.

# 24. Git Summary

Audit 2026-10-21T11:18:08.053Z: canonical status is exactly the initial 21-path dirty/untracked list and every SHA256 matches. Local main, origin/main and live remote main remain b6b3c2cbcfc8727f38129d207526e3167c591526. All 48 original worktrees remain; only v72-director and v72-candidate were added (50 total). UI5173 PID18344 and API5000 PID4288 are unchanged; 4312 is off, and owned 5014/5015/5188/5189/5230/5232/5233 listeners are absent. Three pre-existing SQLite files are byte-identical; the newly created candidate SQLite was removed after owned servers stopped and absence is independently verified. No main edit, merge, PR closure, release, tag, version bump, storage/import policy change, rebase, force-push, reset, stash, broad cleanup, old worktree deletion or global configuration write occurred.

- Source: PR54 752148785db92ba2cabddca1538f5bf58dd8a22d, normal forward commit/push, message test(toolbar): wait for completed drawer frame transitions.
- Candidate: e01eff014822b54ed0004ddb418eb60f882c0225, parent7b25ddcfa29eda1f73acf31ca77830153a335f86, normal new branch/push; no duplicate candidate PR.
- Documentation: three new V7.2 artifacts on docs/v72-browser-synchronization; normal forward publication, identified from Git history/branch checks, no duplicate docs PR.
- Initial q3 SQLite opening despite new-DB-only instruction is explicitly disclosed; unchanged content is proved, "never opened" is not claimed.

## Current PR52–65 readiness inventory

Snapshot: 2026-10-21T11:18:08.053Z. All14 PRs remain OPEN; only54's source head changed in V7.2. CI entries are exact-current-head status checks, not proof of individual browser reruns. Combined validation refers to e01eff01, not each branch in isolation. No merge order or merge approval is implied.

| PR / title | State | Exact head | Exact-head CI | Readiness / dependency |
|---|---|---|---|---|
| [#52](https://github.com/ErtugrulAK/keyframe-character-studio/pull/52) test(gif): event-driven badge readiness in the A1 quota e2e | OPEN | `feb70f71b7213e341a9468213ce9e243f9cd786d` | [SUCCESS / 39427009523](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39427009523) | Included; combined browser PASS. No individual browser rerun this round. |
| [#53](https://github.com/ErtugrulAK/keyframe-character-studio/pull/53) test(history): race-free import-confirmation readiness | OPEN | `af5c5c17d91a88deb1914034342091c2bca0c209` | [SUCCESS / 39427104922](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39427104922) | Included; combined browser PASS. No individual browser rerun this round. |
| [#54](https://github.com/ErtugrulAK/keyframe-character-studio/pull/54) test(toolbar): settle-gate for the collapse geometry baseline | OPEN | `752148785db92ba2cabddca1538f5bf58dd8a22d` | [SUCCESS / 39587165397](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39587165397) | READY for review: new forward fix; isolated, independent and combined browser PASS. |
| [#55](https://github.com/ErtugrulAK/keyframe-character-studio/pull/55) docs(f5): speed-graph inverse-mapping specification | OPEN | `114a05612375e2cf22ebb677909dbf32330ce6a4` | [SUCCESS / 39566449600](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39566449600) | Documentation included; qualified V7.1 numeric/import claims retained. F5b NOT implemented. |
| [#56](https://github.com/ErtugrulAK/keyframe-character-studio/pull/56) test(visual): opt-in screenshot harness with per-platform baselines (V1) | OPEN | `fc1f0df1bee07dda5ea45371dd674891a05d6051` | [SUCCESS / 39496713305](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39496713305) | Conditional: actual visual PASS on 2 existing win32 baselines only; no Linux/mac certification. |
| [#57](https://github.com/ErtugrulAK/keyframe-character-studio/pull/57) feat(graph): built-in easing presets on value-graph handle rows (E1) | OPEN | `a16063980c1811f76f682a7f6f6bb84845e0c34d` | [SUCCESS / 39508582743](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39508582743) | Included; combined unit/browser PASS. No new easing implementation in V7.2. |
| [#58](https://github.com/ErtugrulAK/keyframe-character-studio/pull/58) feat(math): F5a endpoint-slope <-> handle closed form | OPEN | `fb67ebfbe536bfdccc2c60541ab09b274a2a008b` | [SUCCESS / 39566631665](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39566631665) | Included; V7.1 numeric correction retained; combined unit/browser PASS. |
| [#59](https://github.com/ErtugrulAK/keyframe-character-studio/pull/59) test(math): adversarial velocity counterexample sweep (M2) | OPEN | `9a1202ce30813512eaeea9c5a4d2c76dfa6a46b8` | [SUCCESS / 39445150964](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39445150964) | Included; combined full unit/browser PASS. No new math proof claimed here. |
| [#60](https://github.com/ErtugrulAK/keyframe-character-studio/pull/60) fix(graph): segment badges name the curve the authority applies (G2) | OPEN | `a432dbc2541f51276fb7c2298db7311efaada29c` | [SUCCESS / 39508183235](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39508183235) | Included; combined full unit/browser PASS. No new badge change in V7.2. |
| [#61](https://github.com/ErtugrulAK/keyframe-character-studio/pull/61) docs(round3): graph-editing gates, markers, palette, visual plan + O4 guard extension | OPEN | `e0ee195164571fb8f3a2376049c91998d7f21f87` | [SUCCESS / 39564938639](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39564938639) | Included; V7.1 documentation correction retained. Temporal policy remains approval-only. |
| [#62](https://github.com/ErtugrulAK/keyframe-character-studio/pull/62) docs: V6 session handoff | OPEN | `95e94760f37497836e35e1ce96aaa18bf1d5166d` | [SUCCESS / 39506705575](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39506705575) | Historical V6 documentation included as inherited content, NOT current execution authority. |
| [#63](https://github.com/ErtugrulAK/keyframe-character-studio/pull/63) fix(interop): truthful Lottie partial easing-pair diagnostics | OPEN | `8b70a9b465ee27d006f2a121c60f97f5063f0137` | [SUCCESS / 39508715423](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39508715423) | Included; prerequisite content for #65. Patch inclusion, not Git-ancestor claim. |
| [#64](https://github.com/ErtugrulAK/keyframe-character-studio/pull/64) docs: verified V7 report and current upload handoff | OPEN | `8b7cdeb15cbf50f29072e8ac491245898d59f697` | [SUCCESS / 39513830917](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39513830917) | Historical V7 docs, excluded from product composition; use current V7.2 handoff instead. |
| [#65](https://github.com/ErtugrulAK/keyframe-character-studio/pull/65) fix(lottie): preserve target HOLD authority across incoming handles | OPEN | `71fe219784c35ed670ae7852b1e36873b2b5c934` | [SUCCESS / 39564588329](https://github.com/ErtugrulAK/keyframe-character-studio/actions/runs/39564588329) | Included; READY for review only with #63 prerequisite content. No merge performed. |

# 25. Updated Project Tree

- .worktrees/q3-toolbar: existing PR54 branch, published reviewed test/changelog delta.
- .worktrees/v72-candidate: exact combined source + docs/KCS_V72_CANDIDATE_MANIFEST.json at e01eff01.
- .worktrees/v72-director: report206 and versioned ONEFILE/manifest; earlier V5/V7/V7.1 artifacts untouched.
- TEMP/kcs-v72: isolated evidence, no production/test dependency on TEMP or .omp harness files.

# 26. Self Review

**8/10.** Strong points: direct RED/GREEN timing proof, retained assertions, independent skeptical review, final-head full browser/unit plus exact-head CI, corrected historical claims and protected-state hashes. Deductions: initial worker rework and wrapper cancellation, old-DB initialization deviation, platform-limited visual proof and pre-existing standalone e2e typing debt. The final review was a separate local-model session with independent browser experiments, but not a different model or perfectly blinded process. Review verdict READY is narrowly about this fix and its observed evidence.

# 27. Next Recommended Task

Obtain the user's explicit decision on the existing temporal input policy matrix in docs/KCS_V71_TEMPORAL_INPUT_POLICY.md (strict typed/finite boundary rejection, narrow defensive evaluator guard and explicit recovery preview). Approval/design only; implement nothing until that product/compatibility decision is made. This is the single next recommendation.

# 28. Project Status

V7.2 specified remediation and verification package: **PASS** on e01eff014822b54ed0004ddb418eb60f882c0225; PR54 source READY for review, all PRs remain open. Earlier V7.1 FAIL remains historical. General release readiness is NOT asserted: temporal input policy and coverage limitations remain. No merge/tag/release action was performed.

# 29. AI Development Notes

Read-only model-role discovery: task local pennyroyal:high, smol local pennyroyal:medium, judge local pennyroyal:low. Five saved V7.2 journals (smoke, implementation/resume, review/resume, integration/QA, documentation draft) all observed pennyroyal-eng131/pennyroyal with explicit thinking high and zero auxiliary model_usage entries. Seven CLI invocations across those journals, max2 concurrent local workers. Endpoint model inventory was Pennyroyal on the existing local SGLang server; no cloud auxiliary routing or global configuration modification was observed. Sol performed boundary decisions, rejected the incomplete first draft, checked composition/CI/protection evidence and finalized docs; Qwen performed routine source/test/review/QA work.

DO NOT CHANGE CASUALLY: production animation ownership, global Space precedence, original assertions, stable-state helper grammar, exact composition manifest and #63→#65 dependency. Correct source authority beats stale session prose.

# 30. Lessons Learned

Target state can be visible before motion starts. Completion needs an observable canonical ownership contract and settled geometry, without requiring motion to have been witnessed. Green narrow tests can still be vacuous; review must inspect assertions and actual activation. Local-worker summaries are evidence leads, not truth: Git stats, session cancellation records, CI API head SHAs and protected file hashes corrected several claims here.

## ChatGPT upload paths

Primary, current single file: C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.worktrees\v72-director\chatgpt_handoff\latest\CHATGPT_UPLOAD_ONEFILE_V7_2.md
Detailed report: C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.worktrees\v72-director\reports\progress_206_browser_synchronization_v7_2.md
Checksums/authority: C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.worktrees\v72-director\chatgpt_handoff\latest\manifest_V7_2.txt
Candidate input manifest (optional provenance): C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\.worktrees\v72-candidate\docs\KCS_V72_CANDIDATE_MANIFEST.json
Do not upload canonical dirty unversioned V5 ONEFILE/manifest as current V7.2 evidence. The detailed report and manifest are optional companions; the ONEFILE is the primary concise upload.
