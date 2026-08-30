# KCS Development Report — Selected Skills Integration Plan

Metadata:
- Date: 2026-08-30
- Milestone: Selected engineering skills integration plan
- Branch: `main`
- Starting HEAD: `d69417e4a74c26093e33a2373d243ad7df58828e`
- Ending HEAD: `d69417e4a74c26093e33a2373d243ad7df58828e`
- Commit status: No commit. This plan-only task creates the numbered report only.
- Report number: 007

# 1. Executive Summary

Status: PASS for plan-only scope.

The approved basis is `reports/progress_006.md`, which evaluated `mattpocock/skills` at pinned revision `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`. This report converts that discovery into an exact, selective adaptation plan for six concepts:

1. `diagnosing-bugs`
2. `tdd`
3. `domain-modeling`
4. `grill-with-docs`
5. `codebase-design`
6. `writing-for-agents`

The integration must remain a KCS workflow-documentation change. It must not install the upstream catalog, execute `npx skills`, install a Claude plugin, add runtime dependencies, modify product runtime code, create a second workflow authority, or introduce automatic Git operations.

The minimum proposed implementation surface is:

- `.omp/commands/bugfix.md`
- `.omp/commands/milestone.md`
- `.omp/commands/regression.md`
- `skills/keyframe-studio/kcs-workflows/SKILL.md`

No change is currently justified for `AGENTS.md`, `skills/keyframe-studio/kcs-constitution/SKILL.md`, `CONTEXT.md`, or `docs/adr/`. `CONTEXT.md` and `docs/adr/` should be created lazily only when their qualifying conditions occur. The existing root authority and reporting policy remain unchanged.

Implementation status: NOT STARTED. This report is the deliverable and requires separate user approval before any plan item is implemented.

# 2. Original Objectives

Status: PASS.

## Approved scope

- Produce an exact integration plan for the six approved external concepts.
- Use only the reviewed upstream source at the pinned revision.
- Strengthen existing KCS workflows without replacing them.
- Define per-concept file targets, sections, guidance, reuse, non-duplication, activation, precedence, conflicts, and verification.
- Define the KCS-specific diagnosis loop, TDD policy, optional clarification gate, architecture vocabulary, and agent-document writing rules.
- Define the activation matrix and file-by-file diff plan.
- Decide whether to create `CONTEXT.md` or `docs/adr/` now.
- Define minimal upstream provenance and future acceptance criteria.
- Create the next sequential permanent report.

## Explicit non-goals

- Installing the upstream skills catalog.
- Running `npx skills`.
- Installing a Claude plugin.
- Copying upstream skill directories verbatim.
- Creating a second workflow router or authority.
- Adding issue-tracker setup, `.scratch/`, `docs/agents/issue-tracker.md`, or triage labels.
- Modifying product runtime code, tests, data models, serialization, rendering, geometry, playback, broadcast, history, presets, clipboard, or public APIs.
- Creating `CONTEXT.md` or `docs/adr/` during this plan-only task.
- Creating or switching branches.
- Committing or pushing.
- Starting any roadmap item or milestone beyond this documentation plan.

# 3. Problems Discovered

Status: PARTIAL. These are integration and workflow gaps, not product defects.

## 3.1 Existing KCS workflow is authoritative but duplicated across surfaces

KCS has overlapping statements in the root `AGENTS.md`, `.agents/AGENTS.md`, `.omp/RULES.md`, local KCS skills, and `.omp/commands`. The duplication is currently intentional in part: different tools consume different files. It still creates maintenance risk when the same approval, testing, or Git rule changes in one place but not another.

The external `writing-for-agents` concept confirms the right remedy: use explicit context pointers, progressive disclosure, co-location, and completion criteria. The remedy is not a broad rewrite in this milestone. The integration plan therefore centralizes new behavior in the workflow command that owns the behavior and keeps the other surfaces as concise pointers or existing authorities.

## 3.2 `/bugfix` lacks an explicit diagnosis discipline

Current `/bugfix` already requires reproduction, authority tracing, root cause, risk review, minimal fix, focused tests, regression, validation, scope audit, and report. It does not explicitly require the external sequence:

`REPRODUCE → MINIMISE → HYPOTHESISE → INSTRUMENT → FIX ROOT CAUSE → REGRESSION TEST → REMOVE TEMP INSTRUMENTATION → VERIFY`

The gap is procedural clarity for difficult, intermittent, interaction, and tooling failures. The plan adds this as a refinement of the existing bugfix workflow, not as a second bug engine.

## 3.3 Testing guidance needs a non-dogmatic TDD decision rule

KCS already requires focused tests, relevant E2E coverage, TypeScript/build/lint validation, and full regression when scope warrants it. The external `tdd` skill adds valuable public-interface seam discipline, but its red-green language must not force unit tests onto browser-only visual behavior or documentation-only changes.

The plan adds explicit `REQUIRED`, `RECOMMENDED`, and `NOT NECESSARY` cases while preserving the current KCS test commands and approval boundary.

## 3.4 KCS has no compact domain glossary or ADR directory

The existing architecture, project context, track/matte skill, reports, and source code contain domain terms, but there is no root `CONTEXT.md` or `docs/adr/`. This is a documentation gap, not evidence that both structures must be created immediately.

The approved plan uses lazy creation. A term must be stable, project-specific, and materially ambiguous or overloaded before it enters a glossary. A decision must be hard to reverse, surprising without context, and the result of a real trade-off before it receives an ADR.

## 3.5 External architecture vocabulary is useful but can displace KCS vocabulary

`codebase-design` provides precise language for module, interface, depth, seam, adapter, leverage, and locality. KCS already has a concrete architecture vocabulary: pure utility, domain hook, thin context, and minimal component. The external terms should sharpen architecture reviews, not require renaming existing modules or introduce a new layering model.

## 3.6 External installation and routing assumptions do not fit KCS

The selected upstream files are Markdown instructions, but their surrounding repository assumes Claude-style Skill routing, optional `CONTEXT.md`, `docs/adr/`, and in some flows an issue tracker. The two user-invoked concepts among the six (`grill-with-docs` and its delegated flow) must be adapted into the existing `/milestone` command. Upstream invocation metadata and the upstream router must not become KCS authority.

# 4. Files Created

Status: PASS.

- `reports/progress_007.md` - the approved-scope integration plan and permanent planning record.

No other file is planned for creation in the initial implementation package. `CONTEXT.md` and `docs/adr/` are explicitly deferred and are not part of this report's implementation.

# 5. Files Modified

Status: PASS.

None. The existing untracked `reports/progress_006.md` is the prior discovery deliverable and was not modified. This task adds only `reports/progress_007.md`.

The four files below are proposed future modification targets only:

- `.omp/commands/bugfix.md`
- `.omp/commands/milestone.md`
- `.omp/commands/regression.md`
- `skills/keyframe-studio/kcs-workflows/SKILL.md`

# 6. Architecture Overview

Status: PASS for current contract and planned integration boundary.

## 6.1 Current KCS dependency and authority flow

```text
User request
    |
    v
Root AGENTS.md and KCS safety rules
    |
    v
.omp command or local KCS workflow skill
    |
    v
Domain analysis and explicit approval
    |
    v
Pure utility -> domain hook -> thin AnimatorContext -> minimal component
    |
    v
Focused QA -> relevant E2E/manual QA -> full regression when warranted
    |
    v
Scope audit -> numbered report -> explicit commit/push approval
```

The planned adaptation remains in the workflow-documentation layer. It does not add a runtime layer or a second state/evaluation path.

## 6.2 Current product authorities that remain untouched

No selected concept requires a product runtime change. The following authorities remain protected:

- `Track.channels` and `TrackChannel` for current timeline animation.
- `evaluateTransform` and `evaluateFrame` for animation evaluation.
- `usePlayback` for edit playback and playhead state.
- `useBroadcast` and `broadcastEngine` for broadcast state and timing.
- `StageCanvas`, `StagePartLayers`, `PartRenderer`, `shapeGeometry`, and `buildMattePath` for rendering and matte composition.
- `useHistory` for scene undo/redo semantics.
- `useSerialization` and existing validation/migration paths for persistence.
- Existing presets, clipboard, animation-transfer, template, selection, and compatibility paths.

The integration plan can direct agents to inspect these authorities when a task reaches them; it must not duplicate them.

# 7. Data Model Changes

Status: NOT APPLICABLE.

The plan changes no `CharacterPart`, `Track`, `SceneData`, preset, matte, keyframe, or serialized schema. Domain-modeling guidance will describe how to name existing concepts, not change their structure.

# 8. Coordinate Space Model

Status: NOT APPLICABLE.

No coordinate-space behavior is changed. The plan only requires agents to identify coordinate contracts when an affected product task reaches geometry, transform, selection, hit testing, viewport, or matte code. It does not create a new coordinate model or modify existing conversions.

# 9. Component / Module Walkthrough

Status: PASS for planned workflow modules.

## 9.1 `.omp/commands/bugfix.md`

This remains the operational owner for approved bug investigation and repair. It already owns reproduction, authority tracing, risk analysis, minimal fixes, tests, validation, and reporting. The plan adds the difficult-bug diagnosis sequence directly to those existing sections.

No React component, hook, utility, type, renderer, or context is involved.

## 9.2 `.omp/commands/milestone.md`

This remains the operational owner for approved large feature or refactor packages. It already owns discovery, current contract, goal, gap, reuse, alternatives, risks, implementation, QA, regression, scope audit, and report creation. The plan adds an optional clarification gate between current-contract analysis and proposed scope when product semantics or domain terms are materially unclear.

No milestone numbering or product roadmap state is added.

## 9.3 `.omp/commands/regression.md`

This remains the validation command authority. The plan adds one distinction: stress techniques used to raise a diagnosis reproduction rate are not validation retries, arbitrary sleeps, widened tolerances, or hidden fallbacks. Existing validation order and package scripts remain unchanged.

## 9.4 `skills/keyframe-studio/kcs-workflows/SKILL.md`

This remains the consolidated local workflow skill. The plan adds a compact adapter map and precedence rule, then points to the existing commands for operational detail. It does not copy six upstream skill bodies into the consolidated file.

# 10. Important Code Changes

Status: NOT APPLICABLE.

No code changes are part of this plan. Future implementation is limited to English Markdown workflow guidance in the four proposed files, subject to separate approval.

# 11. Public Interfaces

Status: NOT APPLICABLE.

No TypeScript, React, serialized, HTTP, persistence, or CLI runtime interface changes are planned. `.omp` commands and KCS skills are agent workflow documents, not product APIs. Their activation wording must remain backward-compatible with existing task types and command names.

# 12. Algorithms and Geometry

Status: NOT APPLICABLE.

No product algorithm or geometry calculation changes are planned. The diagnosis sequence is a process algorithm only:

```text
red-capable reproduction
    -> smallest failing scenario
    -> ranked falsifiable hypotheses
    -> one-variable evidence probes
    -> owning-authority fix
    -> correct-seam regression test
    -> temporary-artifact cleanup
    -> original reproduction and validation
```

# 13. Interaction / UX Behavior

Status: NOT APPLICABLE.

No application interaction changes are planned. For future product bugs, the adapted bugfix guidance will prefer browser/runtime evidence for interaction issues, including DOM, console, network, and visual evidence where the existing test surface supports it.

# 14. Design Decisions

Status: PASS for the plan.

## 14.1 Precedence rule

KCS remains authoritative. The future text must state the following precedence without restating every root rule:

1. Explicit user scope and approval.
2. Root `AGENTS.md` and protected KCS contracts.
3. `.agents/AGENTS.md` and `.omp/RULES.md`.
4. Current source, tests, types, and configuration for product facts.
5. Existing KCS domain skills and `docs/ARCHITECTURE.md`.
6. Existing `.omp` command workflow.
7. Adapted external concepts as optional guidance.
8. Upstream files as reviewed reference only.

An external concept cannot authorize a file change, branch operation, commit, push, issue mutation, test shortcut, runtime fallback, or compatibility change.

## 14.2 `diagnosing-bugs` plan

### Target files and sections

- File: `.omp/commands/bugfix.md`
- Sections: workflow line, `## 2. Investigate without guessing`, `## 3. Fix and validate`, and `## Final report`.
- Supporting pointer: `skills/keyframe-studio/kcs-workflows/SKILL.md`, §3 Bugfix and a compact selected-concept adapter note.

### New guidance

Replace the current broad investigation sequence with an explicit nested discipline:

1. **REPRODUCE**: Build and run one tight, red-capable signal through the actual failing path. Prefer a focused test, then an HTTP/CLI fixture, headless browser path, replay artifact, or approved throwaway harness as appropriate. Redact secrets before recording commands, logs, payloads, or captured artifacts.
2. **MINIMISE**: Remove one input, caller, step, configuration value, or fixture at a time and rerun the signal. Keep only load-bearing elements. For intermittent failures, record reproduction rate and the exact symptom; diagnosis stress is not final validation.
3. **HYPOTHESISE**: Produce 3-5 ranked, falsifiable hypotheses. Each must state the predicted effect of changing one variable. Show the list to the user before testing when the active interaction permits; record it in the report when the user is unavailable and the approved task can proceed.
4. **INSTRUMENT**: Use the debugger or REPL first where available, then targeted logs at authority boundaries. Change one variable at a time. Tag temporary logs with a unique marker and keep instrumentation out of the final patch.
5. **FIX ROOT CAUSE**: Trace the symptom to the owning KCS authority and implement only the approved minimal fix. Do not create a parallel evaluator, store, serializer, clock, clipboard, geometry helper, or component-owned business rule.
6. **REGRESSION TEST**: Before the fix, convert the minimized scenario into a failing test at the correct public seam where practical. If no correct seam exists, record that architectural finding instead of adding a shallow confidence test.
7. **REMOVE TEMP INSTRUMENTATION**: Remove tagged logs, throwaway harnesses, captured secrets, and temporary artifacts. Do not leave debug behavior in production or tests.
8. **VERIFY**: Rerun the original reproduction, the regression test, focused validation, relevant E2E/manual checks, and the proportionate KCS validation commands. Record the root cause and evidence in the numbered progress report.

### Existing text to reuse

- Existing `USER BUG → REPRODUCE → AUTHORITY → ROOT CAUSE → COMPATIBILITY/RISK → MINIMAL FIX → FOCUSED TESTS → REGRESSION → VALIDATION → SCOPE AUDIT → REPORT` workflow.
- Existing authority boundary checklist for serialization, history, templates/presets, playback/broadcast, clipboard, migration, renderer, and browser storage/API.
- Existing rule to stop when root cause is unproven.
- Existing focused-test, regression, validation, scope-audit, and report requirements.

### Duplication explicitly avoided

- Do not copy the complete upstream `diagnosing-bugs/SKILL.md`.
- Do not add a second bugfix command.
- Do not add a diagnosis library, logger, repro runner, timing loop, or test harness to product code.
- Do not restate the complete regression command list in bugfix; keep `/regression` authoritative.

### Activation conditions

Use the full sequence when the task is a hard, intermittent, regressed, slow, throwing, or otherwise unclear failure. Use a shortened reproduce-authority-fix path for a deterministic, obvious bug with an existing failing test, while preserving the regression and verification requirements.

Interaction bugs must prefer browser/runtime evidence. CI/build failures must be reproduced locally where possible before source changes. If no red-capable loop can be built, stop and report the missing artifact or environment instead of guessing.

### Conflicts and KCS resolution

- Upstream diagnosis permits increasing reproduction rate with parallel runs, stress, sleeps, or injected timing. KCS permits controlled reproduction evidence but final validation remains deterministic and must not gain arbitrary sleeps, retries, tolerance hacks, or fallbacks.
- Upstream asks for ranked hypotheses before testing. KCS approval and user availability control whether an additional conversational checkpoint is possible; it cannot justify unbounded delay.
- Upstream suggests commit/PR learning. KCS does not permit automatic commits; record the proven cause in the report and use a commit message only if a later approved commit occurs.

### Verification needed

Future implementation: review the command diff against the eight-step sequence, verify every step has a completion condition, verify no validation command changed, and run a representative approved bugfix dry run only if the user requests runtime workflow verification. Because this is documentation-only, product tests are not required unless an unrelated runtime/config change appears.

## 14.3 `tdd` plan

### Target files and sections

- File: `.omp/commands/bugfix.md`
- Sections: `## 3. Fix and validate`, specifically the regression-test and focused-test bullets.
- File: `.omp/commands/milestone.md`
- Sections: contract/design item 6 and implementation/QA bullets.
- File: `.omp/commands/regression.md`
- Sections: validation order and failure policy only if needed to state the test-seam distinction.
- Supporting pointer: `skills/keyframe-studio/kcs-workflows/SKILL.md`, §8 Testing and a compact TDD adapter note.

### New guidance

Use a KCS test decision table:

- **REQUIRED**: A reproducible behavioral bug with a correct stable seam, especially pure utilities, domain mutators, serialization/migration, history, playback, broadcast, or other deterministic contracts. Write the regression test before the fix where practical and make the test fail for the actual bug pattern.
- **REQUIRED**: A new pure domain helper or core business behavior with a stable public interface. Use one vertical slice at a time: one behavior, one test, one minimal implementation.
- **RECOMMENDED**: New hook behavior, cross-domain orchestration, renderer/matte behavior with a stable DOM/pixel seam, user-visible interaction, or a compatibility-sensitive change. Choose the narrowest public seam that exercises the real contract.
- **RECOMMENDED**: A browser-only bug when a stable DOM, console, network, pixel, or integration seam exists. Reproduce in the browser first, then lock the stable portion in the appropriate test layer.
- **NOT NECESSARY**: Documentation-only changes, report creation, workflow prose, or simple agent-instruction maintenance. Use document and Git scope checks instead.
- **NOT NECESSARY**: A high-friction browser-only visual issue when no stable seam can reproduce the actual defect. Perform browser/runtime evidence first and document the absent seam; do not create a shallow or tautological unit test.

The TDD wording must preserve focused tests first, relevant E2E next, and full regression only when scope warrants it. It must not require every test to be written before all design understanding exists, and it must not turn horizontal bulk test writing into a rule.

### Existing text to reuse

- `kcs-workflows` §8 Testing: test scope, files, mock strategy, scenarios, explicit approval, test-layer preferences, and no production changes solely to satisfy tests.
- `/bugfix` existing rule to add tests only when required by the approved task or uncovered observable behavior.
- `/milestone` existing step-by-step validation and relevant Playwright requirement.
- `/regression` canonical commands and failure classifications.

### Duplication explicitly avoided

- Do not add a second test framework or test command.
- Do not copy upstream `tests.md` or `mocking.md` into KCS unless a later approved gap requires a narrowly scoped reference.
- Do not require tests for implementation details, private methods, or every UI branch.
- Do not make test count or code coverage a substitute for behavior or seam quality.

### Activation conditions

TDD is selected by the task shape, not by the presence of a feature label. It activates automatically for required cases above and is recommended for the listed cross-domain and user-visible cases. It is explicitly not necessary for documentation-only workflow changes unless the task changes a runtime configuration or executable command.

### Conflicts and KCS resolution

- Upstream requires pre-agreed seams. KCS should preserve that discipline for high-risk or new observable behavior, but the existing user approval boundary remains the approval authority.
- Upstream says refactoring belongs after the red-green loop. KCS keeps its separate refactor and review workflows; no code structure change is smuggled into a test cycle.
- A test that cannot reach the real bug pattern is worse than no test. KCS reports the missing seam as a design finding and does not weaken the contract.

### Verification needed

Future implementation: inspect the decision table for mutually exclusive and complete categories; ensure the existing `kcs-workflows` test guidance remains reachable; verify no package scripts changed. A documentation-only implementation needs Markdown/scope review, not Vitest or Playwright.

## 14.4 `domain-modeling` plan

### Target files and sections

- File: `skills/keyframe-studio/kcs-workflows/SKILL.md`
- Section: new compact `Selected Concept Adapters` section near `Common Rules`, plus §1 Architecture & Planning guidance.
- File: `.omp/commands/milestone.md`
- Section: contract/design item 1 or a new optional clarification gate before proposed scope.
- No `CONTEXT.md` or `docs/adr/` file in this implementation package.

### New guidance

When the task uses an overloaded or newly introduced domain term:

1. Trace the term against current source, types, tests, and existing documentation.
2. Identify whether it means authored/serialized state, derived/evaluated state, or transient editor/UI state.
3. Ask a targeted clarification question when two interpretations would change behavior, ownership, persistence, or acceptance criteria.
4. Use one canonical term in the approved plan and report.
5. Add a glossary entry only when the term meets the criteria in §14.7 below.
6. Add an ADR only when the decision meets all three ADR criteria below.

The planned glossary candidates are:

- authored state;
- derived state;
- transient editor state;
- Boolean Parent;
- Boolean Operand;
- Dissolve;
- Cascade Delete;
- Edit Operands;
- Template;
- Sequence;
- Track;
- SceneData;
- Mask / Track Matte;
- Broadcast;
- project-local, parent-local, world, and screen coordinates.

These are candidate terms, not a mandate to define all of them. Existing current-source meanings take precedence. The future glossary must not become an implementation spec, test plan, scratchpad, or duplicate of `docs/ARCHITECTURE.md`.

### Existing text to reuse

- `.agents/PROJECT_CONTEXT.md` for domain names and architectural boundaries.
- `skills/keyframe-studio/kcs-track-matte/SKILL.md` for Boolean, matte, animation, and coordinate contracts.
- `AGENTS.md` for authored/current source, compatibility, and state-authority rules.
- `docs/ARCHITECTURE.md` for implementation-layer responsibilities.
- `reports/DEVELOPMENT_REPORTING_POLICY.md` for milestone-specific decisions and evidence.

### Duplication explicitly avoided

- Do not restate source implementation details in a glossary.
- Do not copy `PROJECT_CONTEXT.md` or `docs/ARCHITECTURE.md` into `CONTEXT.md`.
- Do not create an ADR for a reversible implementation detail, routine coding choice, or decision with no meaningful alternative.
- Do not use a glossary to override current source or tests.

### Activation conditions

Activate domain modeling only when terminology is materially ambiguous, overloaded across domains, newly introduced and user-facing, or necessary to resolve an irreversible contract. Skip it for a routine bug with an unambiguous existing term, a mechanical documentation edit, or a direct implementation of an already-settled contract.

### Conflicts and KCS resolution

The upstream skill updates `CONTEXT.md` immediately when a term crystallizes. KCS adds the approval boundary: no documentation file is created or modified without explicit scope approval. The reporting policy remains the place for this milestone's plan and evidence; a glossary or ADR is a separate durable artifact only when its criteria are met.

### Verification needed

Future implementation: review every proposed glossary/ADR addition against current source and tests, ensure terms are project-specific and concise, verify no implementation details leaked into the glossary, and verify report links if a new durable document is created.

## 14.5 `grill-with-docs` plan

### Target files and sections

- File: `.omp/commands/milestone.md`
- Sections: workflow line and `## 2. Contract and design`, immediately after current-contract analysis and before final proposed scope.
- Supporting pointer: `skills/keyframe-studio/kcs-workflows/SKILL.md`, §1 Architecture & Planning and selected adapter note.

### New guidance

Add an optional clarification gate:

```text
If critical product semantics are materially unclear:
  1. Ask only targeted questions that can change scope, ownership, persistence,
     user-visible behavior, or acceptance criteria.
  2. Identify overloaded domain terms and propose canonical alternatives.
  3. Resolve hard-to-reverse choices before proposing implementation scope.
  4. Record a durable term or decision only when the glossary/ADR criteria pass.
  5. Continue to alternatives, risks, proposed scope, and approval.
Otherwise skip the gate and continue the normal milestone workflow.
```

The gate is not a generic interview. It must be short, finite, and tied to concrete ambiguity. It must not call an external Skill tool, require a new router, or force documentation on routine work.

### Existing text to reuse

- Existing milestone `DISCOVERY → CURRENT CONTRACT → USER PROBLEM → GAP → EXISTING AUTHORITIES TO REUSE → ALTERNATIVES → RISKS → IMPLEMENTATION → FOCUSED QA → FULL REGRESSION → SCOPE AUDIT → FINAL REPORT` workflow.
- Existing current-contract and user-goal questions.
- Existing approval requirement and report policy.
- Existing instruction to inspect high-risk animation, history, serialization, geometry, matte, playback, and broadcast impact.

### Duplication explicitly avoided

- Do not copy upstream `grill-with-docs`, `grilling`, or `domain-modeling` bodies.
- Do not create a second planning command.
- Do not create `CONTEXT.md` or ADRs merely because the optional gate ran.
- Do not publish issue-tracker records.

### Activation conditions

Trigger only when semantics are materially ambiguous, terms have competing meanings, an irreversible architectural choice is unresolved, or acceptance criteria conflict. Skip routine feature work with clear behavior, deterministic bugfixes, mechanical docs, and narrow maintenance.

### Conflicts and KCS resolution

The upstream `grill-with-docs` file is a two-line router that calls a Skill tool. KCS has no approved need for that router. Its useful intent is the clarification gate; KCS's command flow, user approval, report policy, and Turkish conversation rules remain primary.

### Verification needed

Future implementation: inspect the milestone diff for an explicit skip path, bounded questions, and a transition back to scope/approval. Run one documentation walkthrough for an ambiguous hypothetical only if requested; do not launch product code or an issue tracker for this change.

## 14.6 `codebase-design` plan

### Target files and sections

- File: `skills/keyframe-studio/kcs-workflows/SKILL.md`
- Sections: §1 Architecture & Planning, Phase 2 Boundary Analysis, Phase 3 Architectural Assessment, and Phase 4 Implementation Plan.
- File: `.omp/commands/milestone.md`
- Section: existing contract/design item 3 and 4, only as a conditional architecture checklist.

### New guidance

When a change is architecture-heavy, inspect:

- **Module depth**: how much behavior is hidden behind the interface that callers and tests must learn.
- **Seam**: the public or internal location where behavior can be changed and tested without reaching through callers.
- **Adapter**: a concrete implementation filling a real seam where behavior varies; do not introduce an adapter for a single hypothetical implementation.
- **Locality**: whether a rule, bug, and verification remain concentrated in the owning module.
- **Authority duplication**: whether the proposal creates a second evaluator, serializer, state owner, clock, clipboard, geometry authority, or workflow router.
- **Orchestration versus domain logic**: whether a hook or context is coordinating existing behavior or incorrectly owning business rules.
- **Public interface shape**: required parameters, invariants, ordering, errors, compatibility, and performance characteristics, not only a TypeScript signature.

Map the result back to the KCS preference:

```text
pure helper -> domain hook -> thin context -> minimal component
```

Use this vocabulary to examine an existing or approved boundary. Do not rename KCS components to satisfy external terminology. Do not create a new module merely to make a diagram look cleaner.

### Existing text to reuse

- `.agents/PROJECT_CONTEXT.md` Thin Orchestrator Pattern.
- `docs/ARCHITECTURE.md` layer diagram and domain-hook responsibilities.
- `kcs-workflows` §1 boundary analysis and architectural assessment.
- Root `AGENTS.md` rules against duplicate utilities, engines, state, and business logic.

### Duplication explicitly avoided

- Do not copy the full upstream glossary into every command.
- Do not use `module`, `interface`, `seam`, or `adapter` as a reason to alter public APIs.
- Do not require deep modules where a small existing pure helper is clearer.
- Do not run the upstream architecture survey or create a temporary HTML report as a default process.
- Do not add sub-agent requirements to ordinary milestone planning.

### Activation conditions

Use when a task changes ownership, introduces cross-domain behavior, proposes a new public interface, touches a high-risk authority, exposes duplicated logic, or has a meaningful seam/testability question. Skip for routine UI copy, simple local fixes, and documentation-only edits without architecture implications.

### Conflicts and KCS resolution

KCS vocabulary remains the architecture model. The external terms are diagnostic lenses, not a new architecture. Existing current source and tests decide whether a seam is real. No external “deep module” rule can justify changing animation, rendering, persistence, or context ownership without approved evidence.

### Verification needed

Future implementation: ensure the plan identifies one owning authority, one public seam, caller/test surfaces, dependency direction, and no duplicate authority. If product code is unchanged, use documentation and scope checks only. If a future product change follows the plan, apply the existing focused-test and regression gates for the selected seam.

## 14.7 `writing-for-agents` plan

### Target files and sections

- File: `skills/keyframe-studio/kcs-workflows/SKILL.md`
- Sections: `Common Rules`, `Dispatch`, and a new compact `Agent-document maintenance` subsection near the selected adapter map.
- The audit covers `AGENTS.md`, `.agents/AGENTS.md`, `.omp/RULES.md`, local KCS skills, and `.omp/commands`, but does not propose rewriting them in this milestone.

### New guidance

Use these maintenance rules for future targeted document changes:

- Keep the root `AGENTS.md` as the repository authority and put only repository-wide rules there.
- Keep `.agents/AGENTS.md` as the detailed project constitution; do not invent another constitutional copy.
- Keep `.omp/RULES.md` short and sticky; point to the root authority instead of adding detailed product rules.
- Keep `.omp/commands/*.md` procedural and command-specific; place the ordered steps and completion criteria there.
- Keep `skills/keyframe-studio/*` as reusable KCS guidance and pointers; do not copy every command body into every skill.
- Use progressive disclosure: inline the steps needed on every branch, point to detailed references only for branches that activate them.
- Use concise activation conditions in skill descriptions and dispatch tables.
- Give every ordered phase a visible completion criterion.
- When a line duplicates an existing authority without adding trigger, rationale, or a missing guardrail, remove it from the proposed change rather than expanding the duplicate.
- Audit changed-document links, file paths, headings, and scope before completion.

### Existing text to reuse

- Existing root authority pointers in `.omp/commands` and local skills.
- `kcs-workflows` Common Rules and Dispatch table.
- Reporting policy's requirement that reports are the permanent technical record.
- Existing KCS rule that source/configuration, not stale documentation, is authoritative for current behavior.

### Duplication explicitly avoided

- Do not rewrite all instruction files in one pass.
- Do not copy the whole root constitution into `.omp/RULES.md` or each command.
- Do not create a new documentation index, router, or meta-skill for this integration.
- Do not move product architecture facts into agent-writing guidance.

### Activation conditions

Use when creating or editing `AGENTS.md`, `.agents/AGENTS.md`, `.omp/RULES.md`, a local skill, or an `.omp` command. It is recommended for agent-document maintenance and not necessary for ordinary product source changes unless their task also changes agent documentation.

### Conflicts and KCS resolution

The external writing skill emphasizes its own leading words and document model. KCS may adopt the pruning and pointer discipline, but KCS file authorities and English repository policy remain primary. No external writing convention can remove required KCS report sections or high-risk contract warnings.

### Verification needed

Future implementation: compare the four changed documents for repeated meanings, confirm each new rule has one owner, verify pointers name their activation condition, verify completion criteria are observable, and run `git diff --check`. No product tests are needed for pure workflow prose.

## 14.8 `CONTEXT.md` decision

Decision: **B. Defer until the first qualifying domain term or change.**

Evidence:

- KCS currently has no root context file, but current source, `.agents/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, track/matte skill, reports, and tests provide enough context for this workflow plan.
- This task does not resolve a product term or change a domain contract; it only plans how future ambiguity will be handled.
- Creating a glossary now would require choosing definitions for terms that may already have source-specific meanings and would add another always-read file without a current trigger.
- The first term that is project-specific, stable, overloaded or newly introduced, and relevant to future decisions should create `CONTEXT.md` lazily after explicit scope approval.

When created, the file should contain only concise English domain definitions and avoided synonyms. It should not contain implementation details, module paths, test plans, or workflow rules. `docs/ARCHITECTURE.md` remains the implementation architecture authority.

## 14.9 `docs/adr/` decision

Decision: **B. Defer until the first qualifying architectural decision.**

Evidence:

- This plan does not make a hard-to-reverse product or architecture decision; it recommends a bounded documentation adaptation.
- A report is sufficient to record this milestone's alternatives, risks, and plan.
- Creating an empty ADR directory or an ADR for the obvious choice to keep KCS authoritative would add ceremony without preserving a surprising trade-off.

Create `docs/adr/0001-<slug>.md` lazily when all three conditions hold:

1. The decision is hard to reverse or expensive to change.
2. It would be surprising without recorded context.
3. It results from real alternatives and a chosen trade-off.

Examples that may qualify later include a durable decision to adopt an external issue tracker, establish a multi-context architecture, or choose a workflow authority boundary with meaningful lock-in. Routine wording, test placement, or reversible helper choices do not qualify.

## 14.10 Upstream provenance mechanism

Decision: record provenance in the numbered integration report only for the initial conceptual adaptation.

The report records:

- source repository: `mattpocock/skills`;
- pinned revision: `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`;
- license: MIT;
- adapted concepts: the six approved concepts;
- reviewed source URLs and the fact that no installer was executed.

This is sufficient because Strategy C adapts concepts rather than copying an external runtime or maintaining a vendored upstream tree. It avoids an unnecessary new documentation file and avoids a package dependency. If a future implementation copies more than concepts or retains upstream wording in a skill, add a concise source note to that existing skill's metadata in the same approved diff; do not create a provenance subsystem.

# 15. Invariants That Must Be Preserved

Status: PASS for planned preservation.

The future implementation must preserve:

- Root `AGENTS.md` as the main engineering authority.
- Explicit approval before product or workflow-file mutation.
- No automatic branch, commit, push, merge, rebase, reset, stash, or destructive Git operation.
- English repository content and Turkish assistant conversation.
- Current source, tests, types, and configuration as product truth.
- `reports/DEVELOPMENT_REPORTING_POLICY.md` as the sole permanent report authority.
- Existing `/bugfix`, `/milestone`, and `/regression` names and understandable flow.
- Existing KCS testing commands, order, failure classifications, and no-shortcut policy.
- No arbitrary sleeps, retries, tolerance changes, thresholds, skipped assertions, or hidden fallbacks in final validation.
- Temporary diagnosis instrumentation must be removed before completion.
- Browser/runtime evidence for interaction bugs and local reproduction of CI/build failures where possible.
- Pure helper -> domain hook -> thin context -> minimal component architecture.
- All existing animation, playback, broadcast, rendering, matte, geometry, history, serialization, migration, preset, clipboard, and compatibility authorities.
- No runtime dependency or product code change.
- No issue-tracker side effects or new `.scratch` convention.
- Lazy glossary and ADR creation criteria.
- Concise, pointed, progressively disclosed agent documents without a duplication explosion.

# 16. Testing and Verification

Status: NOT TESTED for implementation; PARTIAL for planning inspection.

## 16.1 Verification performed for this plan

- Read the approved discovery report `reports/progress_006.md`: PASS.
- Read root `AGENTS.md`, including current workflow, safety, architecture, protected contracts, and roadmap status: PASS.
- Read `.agents/AGENTS.md`, `.agents/PROJECT_CONTEXT.md`, `.agents/CODING_STYLE.md`, and `.agents/BRANCH_STRATEGY.md`: PASS.
- Read `.omp/RULES.md`, `.omp/commands/bugfix.md`, `.omp/commands/milestone.md`, and `.omp/commands/regression.md`: PASS.
- Read `skills/keyframe-studio/kcs-workflows/SKILL.md` and `skills/keyframe-studio/kcs-constitution/SKILL.md`: PASS.
- Read `reports/DEVELOPMENT_REPORTING_POLICY.md` and `docs/ARCHITECTURE.md`: PASS.
- Read all six selected upstream `SKILL.md` files at the pinned revision: PASS.
- Confirmed the next available report number by inspecting `reports/progress_001.md` through `reports/progress_006.md`: PASS; `progress_007.md` was not present before this report.
- Confirmed initial Git state: PASS; branch `main`, HEAD and `origin/main` at `d69417e4a74c26093e33a2373d243ad7df58828e`, ahead/behind `0 0`, no staged or unstaged diff, and only the prior intentional `reports/progress_006.md` untracked file.

## 16.2 Future implementation verification plan

Because the planned change is workflow Markdown only:

1. Review the four-file diff for scope and English repository content.
2. Verify all referenced files and headings exist.
3. Verify the existing command names and regression command order are unchanged.
4. Verify each selected concept has an activation condition, precedence rule, completion criterion, and non-duplication boundary.
5. Run `git diff --check`.
6. Reinspect branch, HEAD, upstream, ahead/behind, staged/unstaged changes, and untracked files.
7. Do not run product tests by default. Run `npm run build`, TypeScript, Vitest, Playwright, or lint only if the approved implementation unexpectedly changes runtime-affecting configuration or product files.

# 17. Manual QA Results

Status: NOT TESTED.

No product runtime, browser surface, animation timeline, matte view, import/export path, or issue tracker was launched. The planned future documentation change may receive a prompt walkthrough if the user requests it, but this plan does not claim one.

# 18. Regression Risk Assessment

Status: PARTIAL for future implementation; LOW for this plan artifact.

## Current artifact

Risk: LOW. Only a Markdown report is created. Product runtime, tests, configuration, dependencies, public APIs, saved data, and browser behavior are unchanged.

## Future documentation integration

| Risk | Rating | Evidence and mitigation |
| --- | --- | --- |
| Conflicting instruction precedence | MEDIUM | Four workflow files already overlap. Add one adapter section and explicit precedence; do not copy upstream bodies. |
| `/bugfix` becomes too heavy for simple defects | MEDIUM | Add a clear shortened path for deterministic known bugs and full diagnosis only for hard/unclear failures. |
| Diagnostic stress leaks into validation | HIGH | State the distinction directly in `/bugfix` and `/regression`; final validation remains deterministic and shortcut-free. |
| TDD becomes dogmatic | MEDIUM | Use REQUIRED/RECOMMENDED/NOT NECESSARY categories based on stable seams and task type. |
| Glossary or ADR drift | MEDIUM | Defer creation, require current-source check and explicit criteria, and keep each document single-purpose. |
| External terminology displaces KCS architecture | MEDIUM | Treat deep-module vocabulary as a conditional lens; keep KCS layer names and authorities primary. |
| Unintended issue-tracker or installer side effects | LOW | No tracker files, installer, plugin, `npx`, or external command are part of the plan. |
| Product runtime regression | LOW | No product files are targeted; future implementation must stop if scope expands. |

# 19. Performance Considerations

Status: NOT APPLICABLE for product runtime; PARTIAL for agent workflow.

No render, geometry, playback, React render, serialization, or browser performance path changes. The future documentation should avoid making every task run all six concepts, external sub-agents, HTML reports, or long interviews. Conditional activation is the performance and attention safeguard.

# 20. Dependencies

Status: PASS.

No dependency changes are planned. The upstream repository is reference material only. No npm package, plugin, CLI, symlink, lockfile, or global skill directory may be added or changed.

# 21. Compatibility

Status: PASS for product compatibility; PARTIAL for future agent compatibility.

- React, TypeScript, Vite, Node, browser, persistence, serialization, and saved-project compatibility are unchanged by this plan.
- Existing command names and KCS skill names remain unchanged.
- The future changes are Markdown workflow refinements and should not alter application behavior.
- External Claude/Codex invocation metadata is intentionally not adopted as a runtime or repository dependency.
- If future document changes alter a command's activation behavior, the command must retain a skip path and existing approval/report requirements.

# 22. Known Limitations

Status: PARTIAL.

- This report does not implement or execute any of the six concepts.
- The plan does not validate a real future prompt walkthrough.
- No glossary term has been formally resolved, so `CONTEXT.md` remains deferred.
- No hard-to-reverse integration decision exists, so `docs/adr/` remains deferred.
- No issue tracker integration is defined.
- The upstream revision is pinned for review, but no signed upstream commit verification was performed in this task.
- Documentation duplication was mapped conceptually, not measured line-by-line across every instruction file.
- The plan does not determine whether a future browser-only bug has a correct test seam; that remains task-specific evidence.

# 23. Technical Debt

Status: PARTIAL.

Intentional postponements:

1. **Compact domain glossary** - deferred until the first qualifying term. Revisit when a current task exposes a stable, project-specific ambiguity.
2. **ADR directory and decision practice** - deferred until the first qualifying trade-off. Revisit when a hard-to-reverse and surprising architecture decision is actually made.
3. **Issue tracker integration** - outside this package. Revisit only through a separate approved discovery that defines tracker ownership, labels, side effects, and relationship to reports.
4. **Full instruction deduplication** - outside this package. Revisit only as targeted edits when a concrete contradiction or stale duplicate is found; never as an automatic rewrite.
5. **External upstream synchronization** - intentionally manual. Revisit only when an approved review compares a new pinned revision against KCS-adapted behavior.

# 24. Git Summary

Status: PASS for plan-only scope.

- Starting branch: `main`.
- Ending branch: `main`.
- Starting HEAD: `d69417e4a74c26093e33a2373d243ad7df58828e`.
- Ending HEAD: `d69417e4a74c26093e33a2373d243ad7df58828e`.
- `origin`: `https://github.com/ErtugrulAK/keyframe-character-studio.git`.
- `origin/main`: `d69417e4a74c26093e33a2373d243ad7df58828e`.
- Ahead/behind: `0 0`.
- Starting staged changes: none.
- Starting unstaged changes: none.
- Starting untracked file: `reports/progress_006.md`, the prior intentional discovery report.
- Ending intentional untracked files: `reports/progress_006.md`, `reports/progress_007.md`.
- Commit: NO — prohibited by task scope.
- Push: NO — prohibited by task scope.
- No branch, merge, rebase, reset, stash, stage, commit, or push operation was performed.

# 25. Updated Project Tree

Status: PASS for plan scope.

```text
AGENTS.md
.agents/
  AGENTS.md
  BRANCH_STRATEGY.md
  CODING_STYLE.md
  PROJECT_CONTEXT.md
  workflows/
.omp/
  RULES.md
  commands/
    bugfix.md
    milestone.md
    regression.md
docs/
  ARCHITECTURE.md
reports/
  DEVELOPMENT_REPORTING_POLICY.md
  progress_001.md
  progress_002.md
  progress_003.md
  progress_004.md
  progress_005.md
  progress_006.md
  progress_007.md   # new plan-only report
skills/
  keyframe-studio/
    kcs-coding-style/
    kcs-constitution/
    kcs-git-workflow/
    kcs-project-context/
    kcs-track-matte/
    kcs-workflows/
```

The four proposed future targets are existing files and are not marked as changed in this tree. No `CONTEXT.md`, `docs/adr/`, `docs/agents/`, `.scratch/`, plugin, or external skill tree is added.

# 26. Self Review

Status: PASS.

## What is good

- All six selected concepts have exact future file and section targets.
- Existing KCS workflow and authorities are reused rather than replaced.
- The diagnosis sequence includes reproduction, minimization, falsifiable hypotheses, temporary instrumentation, correct-seam regression testing, cleanup, and verification.
- TDD has explicit required, recommended, and not-necessary conditions.
- The clarification gate is optional and bounded.
- Architecture vocabulary is conditional and mapped to the KCS helper/hook/context/component flow.
- The documentation strategy prefers pointers and progressive disclosure over broad rewriting.
- `CONTEXT.md` and ADR decisions are concrete and lazy.
- Provenance, risks, non-goals, implementation sequence, and acceptance criteria are explicit.
- No implementation, installation, runtime change, commit, or push was performed.

## What could improve

- A future implementation review may reveal that one of the four targets needs no change after the first precise diff. The plan intentionally keeps that option open through scope verification.
- Prompt walkthrough quality cannot be proven until the adapted text exists.
- The glossary candidate list still requires current-source term-by-term review before any file is created.

## Uncertainty

The future correct test seam for a browser-only visual defect remains task-specific. The plan explicitly requires evidence rather than assuming a unit-test seam.

## Score

9/10. The plan is implementation-ready and bounded. It is not 10/10 because prompt-level behavior and document ergonomics require validation against the actual future diff, and no implementation or walkthrough was authorized here.

# 27. Next Recommended Task

Status: READY.

Approve implementation of this four-file selective KCS adaptation plan, beginning with the `kcs-workflows` adapter/preference text and then applying the command-specific bugfix, milestone, and regression refinements.

# 28. Project Status

Status: READY FOR USER APPROVAL.

The selected-skills integration is planned but not implemented. The repository remains at HEAD `d69417e4a74c26093e33a2373d243ad7df58828e`. Product runtime behavior, tests, dependencies, configuration, and public APIs remain unchanged. The only task artifacts are the prior discovery report and this plan report.

# 29. AI Development Notes

Status: PASS.

- The approved upstream source is reference-only and pinned to `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`.
- The selected upstream `grill-with-docs` file is a router that calls a Skill tool; KCS should adapt its clarification intent, not its invocation mechanism.
- The selected upstream `domain-modeling` format expects lazy `CONTEXT.md` and `docs/adr/`; KCS adopts the lazy criteria but keeps its own approval and reporting authority.
- The selected upstream `codebase-design` vocabulary must remain subordinate to current KCS architecture names and source ownership.
- The selected upstream `diagnosing-bugs` stress guidance applies only to controlled reproduction. KCS final validation remains deterministic and shortcut-free.
- `reports/DEVELOPMENT_REPORTING_POLICY.md` is the only report authority. This report must not be copied into command files.
- Product high-risk paths are intentionally out of scope. If future document implementation expands into those paths, stop and require a new approved scope.
- Existing historical reports and wiki content remain historical evidence. Current source, tests, types, configuration, and current Git state remain authoritative.

## DO NOT CHANGE CASUALLY

- Root `AGENTS.md` precedence and approval boundaries.
- `.omp/RULES.md` safety rules.
- `reports/DEVELOPMENT_REPORTING_POLICY.md` structure or authority.
- Existing `/bugfix`, `/milestone`, and `/regression` command contracts.
- `Track.channels`, evaluation, playback, broadcast, rendering, matte, geometry, history, serialization, migration, preset, clipboard, and backward-compatibility authorities.
- The no-installer, no-dependency, no-automatic-commit/push integration strategy.
- The lazy `CONTEXT.md` and `docs/adr/` decisions.
- The rule that external concepts are adapted guidance, never a second KCS workflow authority.

# 30. Lessons Learned

Status: PASS.

1. The best upstream contribution is a small behavioral refinement at an existing KCS seam, not a new directory of competing commands.
2. Difficult-bug diagnosis benefits from a red-capable feedback loop and minimization, but the reproduction phase must be separated explicitly from final validation.
3. TDD is most valuable when tied to public seams and observable contracts; a stable seam matters more than a dogmatic test-first label.
4. Domain modeling should record only durable language decisions. A glossary and ADR directory created before their first qualifying decision would increase context load without current value.
5. Architecture vocabulary is useful when it increases locality and exposes duplicate authority, but it must not rename or replace KCS's existing layer model.
6. Agent-document quality improves through pointers, activation conditions, progressive disclosure, and completion criteria. Broad instruction rewrites create more risk than they remove.
7. A pinned reference revision and report-only provenance are sufficient for conceptual adaptation without introducing an external runtime dependency.

## Upstream Sources

All selected upstream files were read at commit `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`:

- `diagnosing-bugs`: https://raw.githubusercontent.com/mattpocock/skills/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/diagnosing-bugs/SKILL.md
- `tdd`: https://raw.githubusercontent.com/mattpocock/skills/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/tdd/SKILL.md
- `domain-modeling`: https://raw.githubusercontent.com/mattpocock/skills/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/domain-modeling/SKILL.md
- `grill-with-docs`: https://raw.githubusercontent.com/mattpocock/skills/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/grill-with-docs/SKILL.md
- `codebase-design`: https://raw.githubusercontent.com/mattpocock/skills/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/engineering/codebase-design/SKILL.md
- `writing-for-agents`: https://raw.githubusercontent.com/mattpocock/skills/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/productivity/writing-for-agents/SKILL.md
- Pinned commit metadata: https://api.github.com/repos/mattpocock/skills/commits/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76
