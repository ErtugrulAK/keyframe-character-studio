# KCS Milestone F — Interop and Evaluator Study Final Response

This file is the OMP final response for the Milestone F study task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** Milestone F (items 10, 11, 12) is delivered as **research and design only** — `docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md`, with the task record in `reports/progress_117_interop_study.md`. Nothing is implemented; each item states the approval it needs first.
- Main is at `22335a5` with Milestone E merged and its CI run green; this study sits on branch `docs/milestone-f-interop-study` and is subject to the user merge decision.

## 2) WHAT THE STUDY ESTABLISHES

**Verified current state.** The interop principle already exists (`docs/interop/V6_LOTTIE_MAPPING.md`: KCS stays canonical, unsupported data is preserved, never silently reinterpreted). The channels-only export policy is in force (`src/hooks/useSerialization.ts:114-116`). Evaluation is pure and uncached (`interpolateChannel` and `applyEasing` in `src/utils/defaults.ts:53,141`; `evaluateFrame` 165 lines, `evaluateTransform` 174, `evaluateLayerMasks` 50, `channelKeyframeGroups` 81) with no benchmark harness. Import accepts a `.kcs` scene or the legacy project shape, rejects OGraf manifests/packages with a toast, and parses through `JSON.parse` into `any` before narrowing (`src/hooks/useSerialization.ts:443`).

| Item | Deliverable contract the study fixes | Approval needed before code |
|---|---|---|
| 10 — Lottie import mapping | Source construct → canonical field, mapping kind (lossless / lossy-with-report / unsupported-and-preserved), exact temporal and easing conversion rules, one loss entry per construct in the existing diagnostics shape; expressions, effects, 3D/cameras, text animators, audio and image sequences are preserved and reported, not converted | Design approval (design gate applies to interchange work) |
| 11 — Evaluator profiling | Deterministic parametric scenes, wall-clock per evaluation pass on the pure utilities **and** through the React path, a `scripts/` harness with warm-up and p50/p95 plus a revision-pinned report; the report is evidence, not a gate, and no threshold is asserted before the first run | Approval to build the harness only; caching is separate |
| 12 — Editable KCS import | Product half: compatibility matrix per document kind, migration only through the existing authorities, round-trip guarantee with a fixture per kind, one import entry point that reports before replacing work. Security half: typed parse instead of `JSON.parse` into `any`, size/shape limits, existing path-safety authorities honoured, report-don't-repair | Product/security approval, plus the document kinds that must be editable first |

## 3) VALIDATION

| Check | Result |
|---|---|
| Study coverage | items 10, 11 and 12 each have their contract, validation plan and approval gate |
| Evidence basis | every cited file and line exists at `main` = `22335a5` (checked while writing) |
| Implementation | none, by design |
| Repository changes | documentation only: `docs/design/**`, `reports/**`, roadmap, state documents, handoff |
| `node scripts/check-state-consistency.mjs` | PASS |

## 4) REVIEW

The study goes through the independent read-only review gate before any merge; the verdict is recorded here before the merge request.

## 5) SAFETY

- No source, test, script, dependency, `package.json`, lockfile or workflow change; the canonical model, channel semantics, OGraf package format and export paths are untouched.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6) NEXT — THREE DECISIONS

1. Item 10: approve the Lottie mapping design scope (construct list and loss-report contract).
2. Item 11: approve building the profiling harness only, with the first scene parameters named.
3. Item 12: approve the editable-KCS-import product/security plan and name the first editable document kinds.

With no decision, nothing is implemented and this study remains the Milestone F deliverable.
