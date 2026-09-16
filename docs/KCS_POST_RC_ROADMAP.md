# KCS Post-RC Stability Roadmap

## Current state

- `v1.1.0-rc.1` is an annotated tag on workflow-tested code candidate `46d2a3e59e065816d972dcd56951803951b577f6`.
- The GitHub release is a draft prerelease; it is not published/finalized.
- The package remains private at `1.1.0-rc.1`; npm publish was not performed.
- Remote `release-smoke.yml` run `34983770238` passed with 2 Chromium tests.
- Current main documentation may be newer than the tag target; the tag must not move.
- Accepted warnings remain: hostile filesystem concurrency is unsupported, schema validation is network-dependent, Chromium installation is manual, and existing React/Vite/sqlite warnings are non-blocking.

## Task status

| Priority | Task | Status | Evidence |
|---|---|---|---|
| 1 | Export diagnostics remediation UX | Completed | `reports/progress_105.md`; branch `feat/export-diagnostics-ux` |

## Recommended roadmap

| Priority | Task | Risk | Dependency/order | Validation |
|---|---|---|---|---|
| 1 | Export diagnostics remediation UX | Low–medium | First coding task; extend existing diagnostics and export UI | Focused Vitest plus targeted Chromium export smoke |
| 2 | Track-matte source selection affordance | Medium | After task 1; reuse `sourcePartId` and existing validation | UI/validation tests plus Chromium interaction smoke |
| 3 | Direct canvas tangent handles | Medium–high | Design contract before implementation; reuse canonical Bezier utilities | Geometry tests, undo/selection tests, Playwright interaction smoke |
| 4 | Graph keyboard/accessibility coverage | Medium | Independent of task 3; may share inspector test helpers | RTL keyboard tests and Chromium accessibility smoke |
| 5 | Export/onboarding sample flow | Medium | After diagnostics UX stabilizes | Deterministic fixture and browser smoke |
| 6 | Current-state consistency check | Low | Independent docs/tooling task | Fixture-based script check in CI |
| 7 | OGraf offline schema closure study | Medium–high | Policy/licensing decision before implementation | Offline hash closure and licensing review |
| 8 | Downstream folder QA automation | Medium | Requires preserving evidence-backed folder import model | Clean-folder artifact comparison and host-limited report |
| 9 | Dependency and warning maintenance | Medium | Separate from product UX work | Targeted install/lint/build checks |
| 10 | Lottie import mapping | High | Architecture and lossless/lossy mapping design first | Round-trip fixtures and loss diagnostics |
| 11 | Evaluator performance profiling | Medium | Measurement before caching | Reproducible profile only; no behavior change initially |
| 12 | Editable KCS Import | High | Separate product/security plan; intentionally deferred | Compatibility matrix and full import/export validation |

## Safest first coding task

**Export diagnostics remediation UX** — completed in Task 105 (`reports/progress_105.md`, branch `feat/export-diagnostics-ux`). Roadmap item 2, the track-matte source selection affordance, is the next candidate.

Why it was first:

- Extends the existing diagnostic authority instead of creating a parallel validator.
- Narrower than import, filesystem, or interchange work.
- Directly improves blocked-export recovery for missing assets, unsupported features, and trusted-directory constraints.
- Can preserve package/runtime behavior while changing only user-facing remediation.
- Clear acceptance boundary: every blocking diagnostic has a stable message, actionable next step, and no false “export succeeded” state.

Delivered branch: `feat/export-diagnostics-ux`.

## Task policy

Every implementation task must:

1. Start from a clean tree and preserve the tag/draft release.
2. Reuse canonical domain hooks, validators, evaluators, and serialization authorities.
3. Avoid new animation, evaluation, timing, package, or state engines.
4. Add tests only for observable behavior and real edge cases.
5. Run focused validation and `npm run qa:release` when the export/runtime surface changes.
6. Request independent review before merging.
7. Update the roadmap only when the task outcome is known.

## Safety and release restrictions

- Do not publish/finalize the GitHub draft without explicit user instruction.
- Do not run npm publish.
- Do not move, recreate, or delete `v1.1.0-rc.1`.
- Do not alter `without-mask`.
- Do not modify global OMP configuration, model roles, `memory.backend`, or task concurrency.
- Do not claim perfect OS-level TOCTOU protection without a platform-specific design.
- Do not invent undocumented OGraf vendor metadata or downstream host wrappers.
- Do not begin broad refactors, caching, Lottie import, or editable KCS Import before their dedicated design/validation gates.

## ChatGPT handoff expectation

The next implementation prompt should receive the clean contents of `chatgpt_handoff/latest/`, including this roadmap, `reports/progress_104.md`, current state documents, package metadata, and the checked-in CI/release workflows. Omitted files are not deleted from the repository.
