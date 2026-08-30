# KCS Development Report — Matt Pocock Skills Integration Discovery

Metadata:
- Date: 2026-08-30
- Milestone: External engineering skills integration discovery
- Branch: `main`
- Starting HEAD: `d69417e4a74c26093e33a2373d243ad7df58828e`
- Ending HEAD: `d69417e4a74c26093e33a2373d243ad7df58828e`
- Commit status: No commit. The discovery report is the only intentional working-tree change.
- Report number: 006

# 1. Executive Summary

Status: PASS for discovery scope.

The external repository `mattpocock/skills` is a public MIT-licensed collection of Markdown agent skills with Claude Code plugin metadata and Codex-oriented `agents/openai.yaml` metadata. The repository is useful as a source of process patterns, not as an authority for Keyframe Character Studio (KCS).

Recommendation: do not install the external package or plugin in the current milestone. In a separately approved integration milestone, selectively adapt six concepts into the existing KCS workflow and skill authorities: `diagnosing-bugs`, `tdd`, `domain-modeling`, `grill-with-docs`, `codebase-design`, and `writing-for-agents`. Do not copy the full external catalog, add an issue tracker, or enable automatic upstream updates.

The recommended strategy is controlled adaptation into existing KCS files, with the upstream revision pinned to commit `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76` during review. This keeps KCS approval gates, source-of-truth rules, English repository content, no-automatic-commit rule, and domain authorities intact.

No application source, tests, configuration, or existing report was modified. No package install, plugin install, branch operation, commit, push, or runtime launch was performed.

# 2. Original Objectives

Status: PASS.

The discovery objectives were:

1. Map the current KCS workflow, authorities, testing practice, and documentation model.
2. Inspect the actual `mattpocock/skills` repository structure and relevant source files, rather than relying only on a summary page.
3. Evaluate installation options and supply-chain or command-execution risks without installing anything.
4. Compare relevant external skills against KCS architecture, workflow, and safety rules.
5. Define an initial 4-7 skill set with explicit keep/adapt/reject decisions.
6. Recommend a long-term authority and documentation model, including the possible roles of `CONTEXT.md`, architecture documentation, ADRs, and a glossary.
7. Record the result as the next sequential KCS development report without changing product code.

# 3. Problems Discovered

Status: PARTIAL. The problems below are workflow and integration problems, not product defects.

## 3.1 KCS already has a strong local authority model

KCS already has a root `AGENTS.md`, `.agents/AGENTS.md`, `.omp/RULES.md`, local KCS skills, `.omp/commands`, `docs/ARCHITECTURE.md`, and a canonical development reporting policy. Adding a second external workflow verbatim would create competing instructions.

The current local process is already explicit:

1. Discovery and current-behavior analysis.
2. User problem, gap, reuse opportunities, alternatives, and risks.
3. Proposed scope and explicit approval.
4. Implementation through the existing domain and orchestration layers.
5. Focused tests and manual QA where applicable.
6. Full regression using the repository commands.
7. Scope audit and numbered report.
8. Explicit commit and push approval.

External skills must therefore be adapters or references. They must not become a higher-priority instruction source.

## 3.2 External skills assume infrastructure KCS does not have

The external setup and planning skills assume some combination of:

- a repo-level `CONTEXT.md` glossary,
- `docs/adr/` for decisions,
- `docs/agents/issue-tracker.md`,
- `docs/agents/domain.md`,
- optional `docs/agents/triage-labels.md`,
- a GitHub, Linear, or local `.scratch/` issue tracker,
- a `Skill` tool and Claude-style slash-command routing.

KCS currently has no root `CONTEXT.md`, no `CONTEXT-MAP.md`, no `docs/adr/`, no `docs/agents/`, and no configured issue-tracker contract. It uses local KCS skills, `.omp` commands, milestone reports, and repository-specific acceptance gates instead.

The external `/setup-matt-pocock-skills` skill would prefer `CLAUDE.md` when present and otherwise edit `AGENTS.md`. That file-selection rule is not safe to copy into KCS because KCS treats the root authority file and its approval boundaries as protected contracts.

## 3.3 Some external defaults conflict directly with KCS rules

Observed conflicts include:

- `implement` ends by committing the current branch. KCS forbids automatic commits and requires explicit approval.
- `prototype` expects a prototype branch and relaxed test/error-handling expectations. KCS forbids unapproved branch operations and does not allow skipped validation to become the default.
- `to-spec`, `to-tickets`, `triage`, and `wayfinder` publish or mutate issue-tracker state. KCS has no approved tracker integration for this workflow.
- `improve-codebase-architecture` creates and opens a temporary HTML report and invokes sub-agents. KCS does not require this overhead for every architecture review and does not allow an external skill to impose a new delegation policy.
- `diagnosing-bugs` allows sleeps or injection to raise a non-deterministic reproduction rate. That can be useful during controlled reproduction, but KCS prohibits arbitrary sleeps, retries, or tolerance hacks in validation. The distinction must be explicit.
- `grill-with-docs` delegates to `grilling` and `domain-modeling`, but the external documentation model is not the KCS reporting model.

## 3.4 The requested names are not all exact external skill names

The current external repository contains `to-tickets`, not `to-issues`. It does not contain an exact `zoom-out` skill. The closest large-effort planning equivalent is `wayfinder`; the closest architecture/system view equivalents are `codebase-design` and `improve-codebase-architecture`.

# 4. Files Created

Status: PASS.

- `reports/progress_006.md` - this discovery report.

# 5. Files Modified

Status: PASS.

None. No existing KCS file was modified.

# 6. Architecture Overview

Status: PASS for current-state mapping.

KCS uses a pure-domain-core plus React-shell architecture:

- `src/types` defines the domain model and compatibility-facing types.
- `src/utils` contains deterministic domain helpers for geometry, animation evaluation, serialization, validation, defaults, timelines, and transfer payloads.
- `src/hooks` owns orchestration and domain workflows such as playback, project state, selection, history, clipboard, serialization, templates, presets, broadcast, inspector, toolbar, toast, keyboard shortcuts, and math.
- `src/context/AnimatorContext` composes domain hooks and exposes application wiring to the UI. It is not a second business-logic engine.
- `src/components` owns interaction and rendering concerns.
- The SVG compositor and canvas path are represented by `StageCanvas`, `StagePartLayers`, `PartRenderer`, `shapeGeometry`, and `buildMattePath` authorities.
- Vitest and React Testing Library cover deterministic and component contracts; Playwright covers browser workflows and visual/manual behavior where required.

The relevant integration boundary is the repository's agent workflow layer, not the animation runtime. External skill concepts may inform `.omp/commands` and local KCS skills, but they must not introduce an evaluator, playback engine, serializer, state authority, or UI abstraction.

# 7. Data Model Changes

Status: NOT APPLICABLE.

This milestone made no data-model change. The existing contracts remain authoritative, including `Track.channels` as the current animation representation, legacy `Track.keyframes` only for compatibility or migration, and `SceneData` backward compatibility.

# 8. Coordinate Space Model

Status: NOT APPLICABLE.

No geometry, transform, viewport, screen-space, project-space, parent-space, or matte coordinate behavior was changed or tested. Existing coordinate-space authorities remain unchanged.

# 9. Component / Module Walkthrough

Status: PASS for workflow-module mapping.

## 9.1 KCS authority files

- `AGENTS.md`: repository-level engineering authority and source-of-truth hierarchy.
- `.agents/AGENTS.md`: detailed project constitution and approval-first workflow.
- `.omp/RULES.md`: harness-facing safety and scope rules.
- `.agents/PROJECT_CONTEXT.md`: project architecture, domain areas, and module boundaries.
- `.agents/CODING_STYLE.md`: repository coding conventions.
- `.agents/BRANCH_STRATEGY.md`: branch, commit, and push constraints.
- `skills/keyframe-studio/kcs-constitution/SKILL.md`: KCS constitution port for agent use.
- `skills/keyframe-studio/kcs-project-context/SKILL.md`: KCS context port.
- `skills/keyframe-studio/kcs-workflows/SKILL.md`: workflow composition.
- `skills/keyframe-studio/kcs-coding-style/SKILL.md`: coding-style guidance.
- `skills/keyframe-studio/kcs-git-workflow/SKILL.md`: git safety and approval guidance.
- `skills/keyframe-studio/kcs-track-matte/SKILL.md`: protected track, geometry, matte, and rendering contracts.
- `.omp/commands/milestone.md`: feature and milestone discovery/implementation/QA/report flow.
- `.omp/commands/bugfix.md`: reproduce, identify authority, isolate root cause, fix minimally, and regress.
- `.omp/commands/regression.md`: ordered full validation command sequence.
- `reports/DEVELOPMENT_REPORTING_POLICY.md`: sole canonical permanent report format.
- `docs/ARCHITECTURE.md`: architecture overview and domain-hook responsibilities.

## 9.2 External repository modules

The external repository contains:

- `.agents/`: invocation, install, writing, and ADR guidance.
- `.claude-plugin/`: Claude plugin and marketplace manifests.
- `skills/engineering/`: promoted engineering skills.
- `skills/productivity/`: promoted productivity skills.
- `skills/misc/`, `skills/in-progress/`, and `skills/deprecated/`: non-promoted or experimental material.
- `docs/engineering/` and `docs/productivity/`: human-facing documentation for promoted skills.
- `scripts/`: maintainer scripts for linking skills, listing skills, and synchronizing plugin versions.
- `package.json` and `package-lock.json`: private package metadata and development tooling.

Every promoted skill has a `SKILL.md`; many also have `agents/openai.yaml`. `diagnosing-bugs` additionally has a shell template under `scripts/`.

## 9.3 Relevant external inputs and outputs

- `diagnosing-bugs` reads current context/ADR guidance and a live failing loop; it produces evidence, hypotheses, instrumentation, a regression test, and cleanup rather than a fixed repository file.
- `tdd` reads the project context and existing seams; it drives tests through public behavior and implementation in red-green slices.
- `grill-with-docs` routes to `grilling` and `domain-modeling`; the latter may update `CONTEXT.md` and an ADR.
- `domain-modeling` writes a glossary term inline and creates an ADR only for a hard-to-reverse, surprising, real trade-off.
- `codebase-design` provides deep-module, interface, seam, adapter, depth, leverage, and locality vocabulary.
- `writing-for-agents` provides guidance for compact, pointed, progressive agent documentation.
- `setup-matt-pocock-skills` writes tracker/domain setup files and an instruction pointer after confirmation.
- `to-spec`, `to-tickets`, `triage`, and `wayfinder` read and write issue-tracker or `.scratch` state.
- `improve-codebase-architecture` creates an HTML report in the operating-system temporary directory and opens it.
- `implement` performs work from a spec or ticket and explicitly commits at the end.

# 10. Important Code Changes

Status: PASS.

No code changes were made. There is no new runtime behavior, no new dependency, no new test, and no public API change.

# 11. Public Interfaces

Status: NOT APPLICABLE.

No TypeScript export, React prop contract, context value, serialized schema, command API, or external runtime interface changed.

# 12. Algorithms and Geometry

Status: NOT APPLICABLE.

No algorithm, interpolation, transform, bounds, path, Boolean contour, matte, masking, or coordinate calculation was changed.

# 13. Interaction / UX Behavior

Status: NOT APPLICABLE.

No KCS UI was launched or changed. External interactive skills were evaluated as agent workflows only. No issue tracker, browser, dashboard, or plugin UI was operated.

# 14. Design Decisions

Status: PASS for discovery decisions.

## 14.1 Installation strategy comparison

| Strategy | Description | KCS fit | Main risk | Decision |
| --- | --- | --- | --- | --- |
| A. Claude plugin | `claude plugins install mattpocock-skills` or marketplace installation; managed, read-only, upstream updates | Low | Installs the full promoted set, follows Claude plugin assumptions, and reduces reproducibility through managed updates | Reject |
| B. Full editable skills install | `npx skills@latest add mattpocock/skills` and select many skills | Low | Executes a latest-version network installer and adds a second skill tree with competing workflow assumptions | Reject |
| C. Selective KCS adaptation | Review pinned upstream files, adapt selected concepts into existing KCS skills and `.omp` commands, keep KCS authorities | High | Requires manual maintenance and explicit upstream review | Recommend |
| D. Separate reference repository | Keep upstream outside KCS and consult it manually | Medium-low | Not available as a local default, weak offline reproducibility, and no integrated activation rules | Reject as primary |
| E. Maintainer symlink script | Run upstream `scripts/link-skills.sh` to link all skills under user home directories | Very low | Unix-only behavior and destructive `rm -rf` of non-symlink destinations | Prohibit |

Strategy C is the only option that fits the current architecture and approval model. It is adaptation, not a raw copy and not a runtime dependency.

## 14.2 Initial skill set

The initial set for a future integration plan is six concepts:

1. `diagnosing-bugs` - high value for intermittent Canvas, Boolean, matte, serialization, and CI regressions. Adapt its tight reproduction loop, minimization, falsifiable hypotheses, and regression-test closure. Explicitly separate permitted reproduction instrumentation from prohibited validation retries, sleeps, and tolerance hacks.
2. `tdd` - high value as a public-seam and red-green discipline. Adapt it to existing KCS approval and focused-test conventions; do not force implementation-coupled tests or require a new test framework.
3. `domain-modeling` - high value for overloaded terms and durable domain language. Adapt the glossary and selective ADR discipline to KCS's existing model and reporting authority.
4. `grill-with-docs` - useful as an optional clarification on large or ambiguous work. Adapt its interview intent into `/milestone`; do not copy its `Skill`-tool delegation or make it mandatory for every change.
5. `codebase-design` - useful vocabulary for evaluating deep modules, seams, interfaces, adapters, and test surfaces. Use it only when a change has architectural shape; keep KCS's existing pure utility/domain-hook/context/component vocabulary primary.
6. `writing-for-agents` - useful for reducing instruction duplication and improving context pointers, progressive disclosure, completion criteria, and no-op pruning in future KCS skill maintenance.

## 14.3 Skills not selected for the first integration

- `improve-codebase-architecture`: useful as an occasional survey, but its temporary HTML report and sub-agent flow add process overhead and do not match the current KCS review path.
- `prototype`: useful only for an explicitly approved high-risk design question. Its relaxed test/error-handling defaults and branch expectation require a KCS-specific wrapper.
- `to-spec`, `to-tickets`, and `triage`: defer until KCS explicitly adopts an issue-tracker contract and defines its relationship to milestone reports.
- `wayfinder`: defer. KCS roadmap and milestone reports currently provide a local planning path; use this only for a genuinely foggy multi-session effort after tracker and decision-record policy are approved.
- `code-review`: overlap with the existing review workflow. Select concepts only if a later review milestone proves a two-axis review gap.
- `research`: use only when an explicit research task benefits from background delegation and a cited repository artifact is approved.
- `implement`: reject unchanged because its automatic commit instruction conflicts with KCS git safety.
- `setup-matt-pocock-skills`: reject unchanged because it can choose the wrong authority file and assumes tracker setup.
- `ask-matt`, `grilling`, `grill-me`, `handoff`, `wizard`, `resolving-merge-conflicts`, `teach`, `to-questionnaire`, `wait-what`, and productivity-only helpers: defer or use ad hoc. They do not close a current KCS workflow gap.
- Exact `zoom-out`: not present in the inspected external repository. Use KCS milestone architecture mapping, supplemented by `codebase-design` terminology if needed.
- Exact `to-issues`: not present. `to-tickets` is the closest verified name, but it remains tracker-dependent.

## 14.4 Fit matrix

| Skill or closest equivalent | KCS use case | Overlap | Conflict risk | Recommended strategy | Priority |
| --- | --- | --- | --- | --- | --- |
| `diagnosing-bugs` | Hard, intermittent, or regressed behavior | Complements `/bugfix` | Reproduction sleeps/injection can leak into validation | Adapt into bugfix guidance | P1 |
| `tdd` | Public seam, red-green vertical slices | Complements Vitest and existing testing workflow | Could over-prescribe test-first or implementation seams | Adapt selectively | P1 |
| `domain-modeling` | Boolean/matte/sequence/track terminology and durable decisions | Complements project context and architecture docs | Creates a second context/ADR authority if copied raw | Adapt after authority decision | P1 |
| `grill-with-docs` | Clarify ambiguous feature scope before implementation | Overlaps `/milestone` discovery and approval | `Skill` tool and external document layout assumptions | Adapt as optional milestone phase | P1 |
| `codebase-design` | Analyze module depth, seams, adapters, and locality | Complements architecture review | Vocabulary may obscure existing KCS layers | Use as a vocabulary layer | P2 |
| `writing-for-agents` | Maintain smaller, more discoverable agent instructions | Complements KCS skills and rules | Could trigger broad documentation churn | Apply during targeted docs edits | P2 |
| `improve-codebase-architecture` | Periodic architecture hotspot survey | Overlaps KCS architecture review | HTML/temp browser/sub-agent overhead | Keep as optional reference | P3 |
| `prototype` | One explicit UI/state design question | No direct current equivalent | Branching, skipped tests, relaxed errors | Require separate approved spike wrapper | P3 |
| `to-spec` | Publish a buildable multi-session spec | Overlaps milestone report | Tracker mutation and issue publication | Defer until tracker decision | P3 |
| `to-tickets` / requested `to-issues` | Split work into tracer bullets with blockers | Overlaps roadmap/task decomposition | No current tracker contract; `.scratch` would be new | Defer | P3 |
| `wayfinder` / requested `zoom-out` equivalent | Resolve foggy, huge efforts through decisions | Overlaps roadmap planning | Tracker and decision-ticket assumptions | Defer | P3 |
| `triage` | Process incoming issues | No current KCS tracker state machine | Mutates labels/comments and needs setup | Reject for now | P4 |
| `code-review` | Standards plus spec review | Overlaps review workflow | Parallel sub-agent and tracker assumptions | Reuse concepts only | P3 |
| `implement` | Execute an approved spec/ticket | Overlaps milestone implementation | Explicit automatic commit | Reject unchanged | P4 |
| `setup-matt-pocock-skills` | Configure external skill prerequisites | No current setup equivalent | May edit `AGENTS.md`/`CLAUDE.md` and create tracker docs | Reject unchanged | P4 |
| `research` | Background primary-source research | Useful only for explicit research | Adds delegation and repository artifacts | Use per-task, not installed default | P3 |
| `ask-matt` / routing skills | Choose a workflow | Duplicates `.omp` commands | Adds a second router and trigger vocabulary | Do not install | P4 |
| `writing-for-agents` productivity guidance | Improve docs consumed by agents | Complements existing rules | Low direct product value | Selective adoption | P2 |

## 14.5 Authority hierarchy for any future integration

The following hierarchy must remain explicit:

1. Explicit user instruction and task scope.
2. Root `AGENTS.md` and KCS safety boundaries.
3. `.agents/AGENTS.md` and `.omp/RULES.md`.
4. Current source, tests, and runtime behavior for product facts.
5. Domain contracts in KCS skills, `.agents/PROJECT_CONTEXT.md`, and `docs/ARCHITECTURE.md`.
6. `.omp/commands` for workflow mechanics.
7. `reports/DEVELOPMENT_REPORTING_POLICY.md` for permanent report shape.
8. Adapted external concepts, only where explicitly referenced.
9. Upstream external Markdown as reference material, never as an authority.

External skill instructions must never override approval gates, no-commit/no-push safety, current-source priority, animation and geometry authorities, serialization compatibility, focused/full validation requirements, or reporting requirements.

## 14.6 Future file change list

No file in this list was changed during discovery. If Strategy C is approved, the first integration plan should consider only these files:

- `.omp/commands/bugfix.md`: integrate the tight reproduction, minimization, hypothesis, seam, regression-test, and cleanup guidance.
- `.omp/commands/milestone.md`: add an optional clarification/domain-language checkpoint for ambiguous work.
- `.omp/commands/regression.md`: document that reproduction stress techniques must not become validation retries or tolerance hacks, if needed.
- `skills/keyframe-studio/kcs-workflows/SKILL.md`: define the KCS composition and activation rules for the adapted concepts.
- `skills/keyframe-studio/kcs-constitution/SKILL.md`: only if a concise external-adaptation precedence rule is needed; avoid duplicating root authority.
- `CONTEXT.md`: create lazily only when a stable glossary has an actual unresolved or overloaded term worth recording.
- `docs/adr/0001-<decision-slug>.md`: create lazily only for a hard-to-reverse, surprising, and genuinely contested integration decision.
- `AGENTS.md`: change only if a future approved context/ADR pointer is required and the root authority remains the single source of truth.

Do not create `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, or `.scratch/` as part of the initial skill adaptation. Those files belong to a separate issue-tracker adoption decision.

# 15. Invariants That Must Be Preserved

Status: PASS for preservation review.

The future integration must preserve:

- Approval before product or workflow-file mutation.
- No automatic branch, commit, push, merge, rebase, reset, stash, or destructive Git operation.
- Turkish assistant conversation and English repository content.
- Current source and tests as the authority for product behavior; historical reports and wiki content remain historical.
- Thin orchestrator architecture: pure helper, domain hook, thin context, minimal UI.
- One canonical animation/evaluation/playback/serialization/clipboard/history/broadcast authority per domain.
- `Track.channels` as the current animation representation and legacy compatibility behavior.
- `evaluateTransform` and `evaluateFrame` as evaluation authorities.
- `usePlayback` as playhead/playback authority and `useBroadcast`/`broadcastEngine` as broadcast authority.
- `StageCanvas`, `StagePartLayers`, `PartRenderer`, `shapeGeometry`, and `buildMattePath` as rendering and matte authorities.
- SVG-only masking/Boolean behavior and existing coordinate-space contracts.
- `SceneData` compatibility and safe import/export boundaries.
- Existing history, undo/redo, selection, template, preset, and transfer contracts.
- Focused tests, relevant browser/manual QA, and the ordered full regression gate.
- The canonical numbered report format.

# 16. Testing and Verification

Status: PARTIAL by design. This was discovery-only.

## 16.1 Performed verification

- Repository baseline inspection: PASS. `git status --short` was clean before report creation.
- Branch and revision inspection: PASS. Branch was `main`; HEAD and `origin/main` were both `d69417e4a74c26093e33a2373d243ad7df58828e`; ahead/behind was `0 0`.
- Remote inspection: PASS. `origin` points to `https://github.com/ErtugrulAK/keyframe-character-studio.git`.
- KCS authority inspection: PASS. Root and `.agents` instructions, `.omp` rules/commands, local skills, architecture documentation, package configuration, CI configuration, reporting policy, and existing reports were read.
- External repository inspection: PASS. GitHub API tree, repository metadata, README, install block, plugin manifest, package metadata, relevant skill files, domain/ADR formats, and executable scripts were read.
- External revision pinning: PASS. Current external `main` resolves to `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76` at retrieval time. The API reports the commit as unsigned.
- Repository scope check: PASS. No product file was changed before creating this report.

## 16.2 Not performed

- `npm test`: NOT TESTED. No product code or test contract changed.
- `npm run test:e2e`: NOT TESTED. No browser behavior changed.
- `npx tsc --noEmit`: NOT TESTED. No TypeScript source changed.
- `npm run build`: NOT TESTED. No build input changed.
- `npm run lint`: NOT TESTED. No lintable source changed.
- Package/plugin installation: NOT TESTED by explicit scope. No `npx skills` or Claude plugin command was run.

# 17. Manual QA Results

Status: NOT TESTED.

No KCS runtime, browser surface, animation timeline, matte view, import/export path, or issue tracker was launched. Manual QA is not applicable to the discovery artifact itself.

# 18. Regression Risk Assessment

Status: PASS for current scope; PARTIAL for future integration.

Current product regression risk is low because no product file, dependency, command, skill, or configuration was changed. The only current change is a Markdown report.

Future integration risks are medium unless constrained:

- duplicate instruction sources could cause contradictory agent behavior;
- raw external install could add automatic or implicit workflows that bypass KCS approval;
- issue-tracker skills could create external side effects;
- `CONTEXT.md` or ADRs could become a second architecture authority;
- prototype or diagnosis instructions could weaken validation discipline;
- upstream latest installs could change behavior without a reviewed KCS diff;
- prompt-level shell instructions could expose secrets or mutate local state.

Mitigations are selective adaptation, pinned source review, explicit KCS wrappers, no raw installer, no tracker adoption in Phase 1, and the normal KCS validation/report gate for all future changes.

# 19. Performance Considerations

Status: NOT APPLICABLE for runtime; PARTIAL for agent workflow.

No application performance path changed. The external architecture-survey skill can add sub-agent, HTML generation, and browser overhead, which is why it is not part of the initial default workflow. The selected concepts are primarily instructions and should not add runtime dependencies or application allocations.

# 20. Dependencies

Status: PASS for current repository; no new dependency.

The external package metadata identifies a private npm package named `mattpocock-skills`, version `1.2.3`, with no runtime `dependencies`. Its listed development dependencies are Changesets packages used for release management. The documented consumer paths are a Claude plugin or the `npx skills@latest` installer, not `npm install` as a runtime library.

No package, lockfile, plugin, symlink, or global skill directory was changed. Strategy C deliberately adds no runtime or npm dependency.

# 21. Compatibility

Status: PASS for current scope; PARTIAL for future integration.

Current KCS behavior and public interfaces are unchanged.

The external repository offers Claude plugin manifests and `agents/openai.yaml` metadata for cross-agent presentation, but its workflow content assumes Claude-style skill routing and external tracker conventions. Direct installation is therefore not a compatibility-preserving integration for this repository. Adaptation into existing KCS files is compatible only if KCS authority remains primary and external concepts are treated as prose guidance.

# 22. Known Limitations

Status: PARTIAL.

- This report evaluates the external repository at one retrieval point, not its future updates.
- The upstream `main` commit is unsigned according to the GitHub API; no separate signature or release artifact verification was performed.
- No `npx skills` or Claude plugin installation was tested, by design.
- No issue tracker integration was designed or validated.
- No decision was made to create a root `CONTEXT.md` or `docs/adr/`; this report only defines lazy creation criteria.
- No external skill was executed in the KCS environment.
- The exact `zoom-out` and `to-issues` names were not present in the inspected tree; nearest verified equivalents were evaluated instead.
- Existing KCS reports and wiki entries contain historical statuses and counts. They were not treated as current facts when current source/configuration could not verify them.

# 23. Technical Debt

Status: PARTIAL.

Current workflow debt:

- KCS has multiple local instruction surfaces (`AGENTS.md`, `.agents`, `.omp`, skills, architecture docs, and reports) that require disciplined precedence. This is manageable but should not be duplicated further.
- There is no compact, domain-only glossary. Terms such as authored/derived/transient, Boolean parent/operand, Dissolve, sequence, template, broadcast, and coordinate spaces are currently distributed across architecture and skill documents.
- There is no ADR directory for rare hard-to-reverse decisions. Creating one prematurely would add ceremony; the first qualifying decision should establish the policy.
- There is no issue-tracker integration contract. Adding tracker-dependent external skills before deciding this would create hidden process state.
- External skill provenance is not currently represented in a repository manifest. If adaptation proceeds, the integration report or a small approved provenance note should pin the source revision and license without creating an unmanaged dependency.

# 24. Git Summary

Status: PASS.

- Starting branch: `main`.
- Ending branch: `main`.
- Starting HEAD: `d69417e4a74c26093e33a2373d243ad7df58828e`.
- Ending HEAD: `d69417e4a74c26093e33a2373d243ad7df58828e`.
- Commit: NO - prohibited by task scope.
- Push: NO - prohibited by task scope.
- Expected intentional working-tree change after report creation: `reports/progress_006.md` only.
- No branch, merge, rebase, reset, stash, stage, commit, or push operation was performed.

# 25. Updated Project Tree

Status: PASS for the discovery artifact.

Relevant existing structure:

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
  progress_006.md   # new discovery report
skills/
  keyframe-studio/
    kcs-coding-style/
    kcs-constitution/
    kcs-git-workflow/
    kcs-project-context/
    kcs-track-matte/
    kcs-workflows/
```

No `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/agents/`, or `docs/adr/` was created.

# 26. Self Review

Status: PASS.

Checklist:

- Scope stayed at external integration discovery: PASS.
- No product source or test changes: PASS.
- External structure and relevant source files were inspected: PASS.
- Installation strategies were compared: PASS.
- Security and command-execution risks were recorded: PASS.
- Initial 4-7 skill set was selected: PASS, six concepts.
- Conflicts with KCS authority were identified: PASS.
- Future files were named without modifying them: PASS.
- Required report sections are present: PASS.
- Tests and runtime QA were correctly marked not tested rather than implied: PASS.
- Commit and push were not performed: PASS.

# 27. Next Recommended Task

Status: READY.

Approve an integration-plan review for Strategy C, limited to adapting the six selected concepts into the existing KCS workflow and documentation authorities. The plan must first define the exact activation rules and file diffs, then receive explicit approval before any repository integration change.

# 28. Project Status

Status: READY FOR INTEGRATION PLAN REVIEW.

The KCS product remains at the existing repository checkpoint represented by HEAD `d69417e4a74c26093e33a2373d243ad7df58828e`. The external skills package is evaluated but not installed. No product milestone was started and no automatic follow-up implementation is authorized by this discovery.

# 29. AI Development Notes

Status: PASS.

- Research used direct GitHub API and raw-file reads for the upstream repository rather than an unpinned local install.
- The external source was treated as untrusted workflow guidance and compared against current KCS rules.
- Historical KCS reports and wiki material were treated as historical where current source/configuration did not establish the claim.
- The upstream source revision is recorded for reproducibility: `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`.
- The upstream repository reports MIT licensing, package version `1.2.3`, and an unsigned current commit at retrieval time.
- The upstream `scripts/link-skills.sh` was read but not executed. It can remove a non-symlink target under user skill directories before creating a symlink, so it is not an acceptable KCS installation path.
- The `npx skills@latest` route was not run because latest-version network execution is not reproducible enough for the current approval and supply-chain model.

## DO NOT CHANGE CASUALLY

- KCS authority precedence and approval boundaries.
- The no-automatic-commit/no-push rule.
- The English-only repository content policy.
- `Track.channels`, `evaluateTransform`, `evaluateFrame`, playback, broadcast, serialization, history, clipboard, geometry, matte, and rendering authorities.
- `reports/DEVELOPMENT_REPORTING_POLICY.md` as the permanent report authority.
- The decision to defer issue-tracker setup until it has its own approved integration scope.
- The decision to adapt selected external concepts rather than install the full external catalog.

# 30. Lessons Learned

Status: PASS.

1. A popular external skill catalog can provide useful engineering vocabulary without being a safe drop-in workflow. Local authority precedence matters more than catalog completeness.
2. Installation behavior is part of the integration contract. The Claude plugin, `npx skills@latest`, and maintainer symlink script have materially different update, reproducibility, and filesystem risks.
3. KCS already has the right process skeleton for discovery, implementation, QA, reporting, and git safety. The highest-value external work is selective refinement, not replacement.
4. Domain modeling has a real documentation gap in KCS, but a glossary or ADR structure should be introduced lazily, not generated by an installer.
5. `diagnosing-bugs` and `tdd` have the clearest immediate value, provided KCS keeps control of reproduction boundaries, test authority, approval, and validation.

## Sources

KCS sources:

- `AGENTS.md`
- `.agents/AGENTS.md`
- `.agents/PROJECT_CONTEXT.md`
- `.agents/BRANCH_STRATEGY.md`
- `.omp/RULES.md`
- `.omp/commands/milestone.md`
- `.omp/commands/bugfix.md`
- `.omp/commands/regression.md`
- `skills/keyframe-studio/kcs-constitution/SKILL.md`
- `skills/keyframe-studio/kcs-project-context/SKILL.md`
- `skills/keyframe-studio/kcs-workflows/SKILL.md`
- `skills/keyframe-studio/kcs-track-matte/SKILL.md`
- `docs/ARCHITECTURE.md`
- `reports/DEVELOPMENT_REPORTING_POLICY.md`
- `reports/progress_001.md` through `reports/progress_005.md`

External sources, retrieved from `main` at commit `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`:

- Repository metadata: https://api.github.com/repos/mattpocock/skills
- Recursive tree: https://api.github.com/repos/mattpocock/skills/git/trees/main?recursive=1
- README: https://raw.githubusercontent.com/mattpocock/skills/main/README.md
- Installation guidance: https://raw.githubusercontent.com/mattpocock/skills/main/.agents/install-block.md
- Invocation guidance: https://raw.githubusercontent.com/mattpocock/skills/main/.agents/invocation.md
- Repository workflow rules: https://raw.githubusercontent.com/mattpocock/skills/main/CLAUDE.md
- Domain context: https://raw.githubusercontent.com/mattpocock/skills/main/CONTEXT.md
- Domain-modeling skill: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/domain-modeling/SKILL.md
- Context format: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/domain-modeling/CONTEXT-FORMAT.md
- ADR format: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/domain-modeling/ADR-FORMAT.md
- Diagnosing bugs: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/diagnosing-bugs/SKILL.md
- Diagnosing-bugs scripts: https://api.github.com/repos/mattpocock/skills/contents/skills/engineering/diagnosing-bugs/scripts?ref=main
- TDD: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/tdd/SKILL.md
- Grill with docs: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/grill-with-docs/SKILL.md
- Grilling: https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grilling/SKILL.md
- Codebase design: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/codebase-design/SKILL.md
- Architecture improvement: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/improve-codebase-architecture/SKILL.md
- Prototype: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/prototype/SKILL.md
- To-spec: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/to-spec/SKILL.md
- To-tickets: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/to-tickets/SKILL.md
- Wayfinder: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/wayfinder/SKILL.md
- Setup skill: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/setup-matt-pocock-skills/SKILL.md
- Implement skill: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/implement/SKILL.md
- Code-review skill: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/code-review/SKILL.md
- Writing-for-agents: https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/writing-for-agents/SKILL.md
- Plugin manifest: https://raw.githubusercontent.com/mattpocock/skills/main/.claude-plugin/plugin.json
- Package metadata: https://raw.githubusercontent.com/mattpocock/skills/main/package.json
- Maintainer symlink script: https://raw.githubusercontent.com/mattpocock/skills/main/scripts/link-skills.sh
- Git guardrail script: https://raw.githubusercontent.com/mattpocock/skills/main/skills/misc/git-guardrails-claude-code/scripts/block-dangerous-git.sh
