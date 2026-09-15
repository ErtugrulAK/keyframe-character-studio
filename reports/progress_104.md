# Progress 104 — Post-RC Stability Audit and Next Roadmap

## Preflight

- Checkout: `main`
- Main/origin-main synchronized at the pre-audit HEAD `5353bf5e3f80bc1c4688c917d57777296c578503`.
- Annotated tag `v1.1.0-rc.1` exists and points to `46d2a3e59e065816d972dcd56951803951b577f6`.
- GitHub release exists as a draft prerelease; it was not published or finalized.
- npm publish: not performed; package remains private at `1.1.0-rc.1`.
- Working tree was clean before the audit.

## Lightweight validation

- `npm run validate:ograf`: PASS; committed minimal fixture accepted.
- `npm run qa:release`: PASS; current audit HEAD `5353bf5e3f80bc1c4688c917d57777296c578503`, 2 Chromium tests passed.
- `git diff --check`: PASS.
- Full Vitest/build were not rerun because this audit changed no source, package, workflow, or test files.

## A) Release line status

Stable and evidence-backed:

- Public Controls V1 and OGraf Package Export V2 are integrated.
- SourcePath, output ancestor, path safety, parent-cycle, broadcast-map, SVG-boundary, mask/matte, and generated-runtime parity hardening are integrated.
- Deterministic OGraf validation is hash-pinned for the discovered remote graph.
- Local and manual remote Chromium release smoke are established; remote run `34983770238` passed for code candidate `46d2a3e...`.
- The tag is intentionally on the workflow-tested code candidate; later documentation commits must not move it.

Accepted warnings:

- Hostile concurrent filesystem mutation remains outside the supported threat model.
- OGraf schema validation requires network access; offline validation is not claimed.
- Manual browser gate installs Chromium.
- Existing React Fast Refresh, Vite chunk-size, and sqlite install-script warnings remain.

Do not touch without a new explicit decision: tag/release publication, npm publishing, `without-mask`, global OMP policy/configuration, guessed downstream OGraf vendor contracts, or an OS-level TOCTOU guarantee claim.

## B) User-facing product gaps

- Export diagnostics are technically strong but need a more actionable remediation surface for blocked assets, unsupported features, and trusted-directory requirements.
- OGraf package export is evidence-backed; editable KCS Import remains intentionally separate and unimplemented.
- Track-matte relationships are validated and surfaced, but explicit source-selection affordances remain a documented V6.1 gap.
- Bezier path authoring has an editor and canonical path utility, but direct canvas tangent-handle authoring remains deferred.
- Graph editing has value/speed views and channel-aware editing; keyboard/accessibility coverage remains incomplete.
- Onboarding/sample graphics and a concise “first export / host import” path are not a stable product contract yet.
- Timeline/keyframe usability has substantial delivered coverage; future work should target observable friction, not a broad timeline rewrite.

## C) Engineering quality gaps

- CI validates build/lint/type/test/schema but browser validation remains a manual workflow by design.
- Schema validation is integrity-pinned but network-dependent; vendoring requires a separate licensing/size decision.
- Documentation drift is a recurring risk around release state and candidate SHA terminology; a lightweight current-state consistency check would have high leverage.
- Existing warnings are non-blocking but should be tracked separately from release blockers.
- OGraf downstream compatibility evidence is folder-based and manual because no local downstream application API is available.
- Performance caching is not justified until large path/mask stacks are profiled at the canonical evaluator boundary.

## D) Safety/security follow-ups

| Area | Classification | Decision |
|---|---|---|
| Source/output TOCTOU | Accepted operational constraint | Keep trusted-directory requirement; do not claim perfect no-follow protection without an OS-specific design. |
| Remote schema network dependency | Good future hardening, not current blocker | Investigate vendoring/licensing and a pinned offline closure separately; fail closed remains mandatory. |
| Export diagnostics | Good future hardening | Improve remediation UX without changing validation authority. |
| OGraf host wrapper/vendor metadata | Too risky now | Do not infer undocumented downstream contracts. |
| Broad filesystem rewrite | Too risky now | Avoid until a concrete threat model and platform API design exist. |
| New runtime/cache layer | Not needed now | Measure first; preserve canonical evaluator authority. |

## E) Roadmap candidates

| # | Candidate | Why it matters | Likely files | Risk | Validation | Output/review | Branch |
|---|---|---|---|---|---|---|---|
| 1 | Export diagnostics remediation UX | Converts technically correct export failures into actionable user steps. | `src/ograf/diagnostics.ts`, HeaderBar/export UI, focused tests, one OGraf E2E | Low–medium | Focused Vitest + targeted Chromium export smoke | `progress_105`; ChatGPT review recommended | `feat/export-diagnostics-ux` |
| 2 | Track-matte source selection affordance | Removes relationship-authoring friction while reusing existing validation and `sourcePartId`. | Outliner, inspector, validation tests, targeted E2E | Medium | Focused UI/validation tests + visual smoke | Report and independent review recommended | `feat/track-matte-source-picker` |
| 3 | Direct canvas tangent handles | Improves path authoring depth using canonical Bezier utilities. | Canvas path authoring, `BezierPathEditor`, `src/utils/bezierPath.ts`, tests | Medium–high | Geometry unit tests + Playwright interaction smoke | Separate design/review gate required | `feat/canvas-tangent-authoring` |
| 4 | Graph keyboard/accessibility coverage | Makes existing graph editing usable without pointer-only interaction. | `TemporalGraphPanel`, accessibility tests, E2E | Medium | RTL keyboard tests + Chromium smoke | Accessibility review recommended | `feat/graph-accessibility` |
| 5 | Export/onboarding sample flow | Reduces time-to-first-success for new users and host QA. | Existing templates/assets/UI docs, E2E | Medium | Deterministic fixture and browser smoke | Product review required | `feat/export-onboarding-flow` |
| 6 | Current-state consistency check | Prevents stale SHA/release-state claims after docs-only commits. | New docs-check script/workflow or existing scripts, docs tests | Low | Script fixtures + CI check | Lightweight reviewer pass | `chore/current-state-consistency-check` |
| 7 | OGraf offline schema closure study | Removes network outage risk if redistribution/licensing/size are acceptable. | `scripts/validate-ograf-manifest.mjs`, fixtures, legal/technical report | Medium–high | Hash closure, offline run, license review | Explicit policy decision required | `chore/ograf-offline-schema-study` |
| 8 | Downstream folder QA automation | Makes evidence-backed host import checks repeatable without inventing a host contract. | QA generation scripts, docs, optional Playwright harness | Medium | Clean-folder artifact comparison | External-host limitation report | `test/ograf-folder-qa-automation` |
| 9 | Dependency and warning maintenance | Reduces install/lint/build noise without changing product behavior. | `package.json`, lockfile, affected config/source only | Medium | Targeted install/lint/build checks | Security/dependency review | `chore/dependency-warning-maintenance` |
| 10 | Lottie import mapping | Broad interchange value, but requires semantic mapping and loss diagnostics. | New importer boundary, fixtures, docs, tests | High | Round-trip fixtures and loss diagnostics | Architecture approval required | `feat/lottie-import-mapping` |
| 11 | Evaluator performance profiling | Establishes evidence before any cache/memoization change. | Benchmark/measurement scripts, canonical evaluator docs | Medium | Reproducible profile only; no behavior change | Performance review | `perf/evaluator-profile` |
| 12 | Editable KCS Import | User value is high but scope/API/security surface is broad and intentionally deferred. | Import boundary, validation, UI, fixtures, tests | High | Full compatibility matrix | Separate product/security plan | `feat/kcs-import` |

## F) Recommended next three tasks

1. **Safest first coding task: Export diagnostics remediation UX.** It extends existing diagnostics and export orchestration, does not introduce a new state/evaluation engine, has a narrow user-observable contract, and can be validated with focused tests plus the existing release smoke.
2. **Second: Track-matte source selection affordance.** It targets a known authoring gap while reusing `sourcePartId`, outliner identity, and existing validation; scope must exclude validation duplication and matte-engine changes.
3. **Bigger follow-up: Direct canvas tangent handles.** It is the highest authoring-value V6.1 item but needs a design contract for coordinate transforms, topology, selection, undo, and keyboard behavior before implementation.

## G) Anti-tasks

- Do not publish or finalize the GitHub draft without explicit user instruction.
- Do not npm publish.
- Do not move, recreate, or delete `v1.1.0-rc.1`.
- Do not modify `without-mask`.
- Do not change global OMP configuration, model roles, memory backend, or concurrency.
- Do not claim perfect filesystem TOCTOU protection without an OS-level design.
- Do not start a broad refactor before targeted UX/test work.
- Do not invent OGraf vendor metadata, wrappers, or downstream host contracts.
- Do not add caching or a second evaluator before profiling.

## Protected invariants

- Tag target and draft release unchanged.
- No source, package, test, or workflow changes in this audit.
- `memory.backend: mnemopi`, model roles, task concurrency, and global OMP configuration unchanged.
- `without-mask` untouched.
- No secrets, Supabase production, Strix, Skill UI crawl/init, hooks, routing, or server activation.

## Files changed by this audit

- `reports/progress_104.md`
- `docs/KCS_POST_RC_ROADMAP.md`
- `NEXT_SESSION.md`
- `PROJECT_STATE.md`
- `chatgpt_handoff/latest/*` is a generated review bundle refreshed after the commit.

## Next prompt suggestion

Start a separate approved implementation prompt for `feat/export-diagnostics-ux`. Require a clean preflight, preserve `src/ograf/diagnostics.ts` and existing export authorities, add only consumer-visible remediation behavior, run focused tests plus `npm run qa:release`, and request independent review before merge.
