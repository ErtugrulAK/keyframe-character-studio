# KCS Development Report — Role-Aware Commands and Deterministic Model Routing

Metadata:
- Date: 2026-09-08
- Milestone: KCS — ROLE-AWARE COMMANDS + DEDICATED AGENTS + DETERMINISTIC MODEL ROUTING
- Branch: chore/kcs-role-aware-routing
- Starting HEAD: 7b3b5cf docs: record V2 UI redesign gate
- Ending HEAD: 7b3b5cf; no commit created
- Commit status: Not committed; runtime acceptance gate remains blocked
- Report number: 036

# 1. Executive Summary

Implemented the approved project-native OMP routing layer without changing product/runtime code or `main`: five project agents, four slash-command prompt wrappers, project task-agent role overrides, milestone delegation guidance, and routing documentation. Direct task dispatches resolved every configured specialist to the intended concrete model with `agentSource: project`, `modelRole`, and `resolvedModel` evidence. The milestone is **BLOCKED**, not READY, because OMP v18.0.11 did not emit the mandatory explicit `resolvedModelIsFallback: false` field in task metadata, and one slash-command smoke test selected the bundled `reviewer` agent instead of the required `reviewer-agent`.

# 2. Original Objectives

In scope:

- Preserve the main session on DEFAULT/Luna.
- Add project-native dedicated agents under `.omp/agents/`.
- Add `/design`, `/review`, `/plan`, and `/commit` under `.omp/commands/`.
- Configure `task.agentModelOverrides` using role aliases.
- Keep `/milestone` on the default orchestrator path with explicit specialist delegation only.
- Document the routing contract and verification evidence.
- Run safe runtime dispatches and require resolved-model evidence.

Out of scope:

- Product/runtime source changes.
- Main branch changes.
- Model-role identity changes in the user config.
- Dependencies, migrations, or Git history rewriting.
- Merging or pushing an unverified implementation.

# 3. Problems Discovered

## 3.1 Missing explicit fallback boolean

- Symptom: task metadata included `resolvedModel`, `modelRole`, `modelOverride`, and `agentSource`, but did not include `resolvedModelIsFallback: false`.
- Reproduction: synchronous `omp --mode json --config <temporary async-disabled overlay> --no-session -p ...` batch dispatch.
- Evidence: all five `SingleResult` records contained concrete role-resolved models and `agentSource: project`; none contained the required explicit false field.
- Status: BLOCKED by the approved acceptance criterion. Absence is not recorded as an explicit false pass.

## 3.2 File-command dispatch is model-mediated

- Symptom: `/design` expanded its project command and dispatched `designer-agent` successfully; a `/review` smoke request dispatched bundled `reviewer` instead of project `reviewer-agent`.
- Root cause: native `.omp/commands/*.md` files are prompt templates; they do not programmatically invoke a task agent. The main model decides which task call to emit.
- Status: the command template is correct as a UX wrapper, but deterministic command-to-agent enforcement is not proven by the smoke run.

# 4. Files Created

- `.omp/agents/designer-agent.md` — project UI/UX research and visual critique agent.
- `.omp/agents/reviewer-agent.md` — project independent correctness and regression review agent.
- `.omp/agents/planner-agent.md` — project plan-only architecture and implementation planning agent.
- `.omp/agents/commit-agent.md` — project safe Git inspection and checkpoint guidance agent.
- `.omp/agents/slow-agent.md` — project deep architecture/debugging blocker agent.
- `.omp/config.yml` — project-only `task.agentModelOverrides`; concrete model identities remain in user `modelRoles`.
- `.omp/commands/design.md` — design research/specification wrapper.
- `.omp/commands/review.md` — independent review wrapper.
- `.omp/commands/plan.md` — plan-only wrapper.
- `.omp/commands/commit.md` — safe Git guidance wrapper.
- `docs/development/KCS_AGENT_ROUTING.md` — routing contract and runtime verification guide.
- `reports/progress_036.md` — this milestone report.

# 5. Files Modified

- `.omp/commands/milestone.md`
  - Previous responsibility: KCS milestone workflow.
  - Change: added concise specialist delegation guidance while preserving DEFAULT/Luna orchestration.
  - Reason: make specialist use explicit without routing every milestone phase through expensive models.
  - Behavioral impact: prompt guidance only; no product/runtime behavior.
  - Affected consumers: `/milestone` file-command expansion.
  - Risk: LOW; command text is not a model enforcement boundary.

The pre-existing untracked `reports/model_routing_analysis.md` was preserved and not modified.

# 6. Architecture Overview

```text
main session (DEFAULT/Luna)
        |
        | slash-command prompt wrapper
        v
main model emits task(agent=<dedicated name>)
        |
        v
task.agentModelOverrides[agentName]
        |
        v
modelRoles alias (@designer/@advisor/@plan/@commit/@slow)
        |
        v
concrete child model + task artifact
```

Concrete model identities remain in the authoritative user-level `modelRoles` config. Project config owns only agent-to-role policy.

# 7. Data Model Changes

No KCS product data, serialized project data, animation state, scene state, or persistence schema changed. OMP configuration and Markdown agent/command definitions are operational configuration, not product runtime data.

# 8. Coordinate Space Model

Not applicable. This milestone does not affect Canvas, transforms, selection, Boolean geometry, masks, hit testing, viewport/screen coordinates, dragging, or animation.

# 9. Component / Module Walkthrough

Not applicable. No TypeScript or TSX module was materially modified.

# 10. Important Code Changes

Not applicable. The changes are Markdown and YAML configuration only.

The central routing contract is:

```yaml
task:
  agentModelOverrides:
    designer-agent: "@designer"
    reviewer-agent: "@advisor"
    planner-agent: "@plan"
    commit-agent: "@commit"
    slow-agent: "@slow"
```

# 11. Public Interfaces

No exported functions, hooks, components, types, or public application APIs changed.

New OMP project interfaces:

- agent names: `designer-agent`, `reviewer-agent`, `planner-agent`, `commit-agent`, `slow-agent`;
- slash commands: `/design`, `/review`, `/plan`, `/commit`;
- project setting: `task.agentModelOverrides`.

# 12. Algorithms and Geometry

Not applicable. No mathematical, geometry, rendering, evaluation, or timing logic changed.

# 13. Interaction / UX Behavior

Before:

- KCS exposed milestone, regression, and bugfix project commands.
- No project dedicated routing agents existed.
- Specialist model use required manual or model-mediated selection.

After:

- `/design` asks the DEFAULT/Luna orchestrator to dispatch `designer-agent`.
- `/review` asks it to dispatch `reviewer-agent`.
- `/plan` asks it to dispatch `planner-agent`.
- `/commit` asks it to dispatch `commit-agent`.
- `/milestone` retains DEFAULT/Luna orchestration and specialist delegation guidance.

The main top bar remains the parent model. Child model evidence belongs to task metadata and Agent Hub, not the top bar.

# 14. Design Decisions

## Decision: project config owns agent-to-role overrides

Reason: concrete model identities already exist in the authoritative user `modelRoles` config; duplicating them would create configuration drift.

Alternative rejected: repeat concrete provider/model IDs in every agent file.

Trade-off: project behavior depends on the required roles existing in the active user profile.

## Decision: dedicated names use `*-agent`

Reason: avoid collisions with bundled `designer`, `reviewer`, and other agent names and make command intent explicit.

Alternative rejected: override bundled names.

Trade-off: command prompts must use the exact project names.

## Decision: retain Markdown commands as UX wrappers

Reason: this is the native `.omp/commands/*.md` surface and keeps command content reviewable.

Trade-off: file commands expand prompts but do not programmatically force a task call; absolute enforcement would require an OMP extension command.

# 15. Invariants That Must Be Preserved

- Do not modify product/runtime code for this routing layer.
- Do not alter the user canonical concrete `modelRoles` casually.
- Keep DEFAULT/Luna as the parent milestone orchestrator.
- Do not route every milestone phase to specialist models.
- A role route is accepted only when task metadata identifies the expected agent, concrete `resolvedModel`, and explicit `resolvedModelIsFallback: false`.
- `agentSource` must be `project` for these KCS agents.
- Do not treat response text claiming a model as runtime evidence.
- Do not stage or modify `reports/model_routing_analysis.md` unless explicitly requested.
- Commit helper behavior must remain non-destructive by default.

# 16. Testing and Verification

## OMP runtime dispatch

Command:

```text
omp --cwd <repo> --config <temporary async-disabled overlay> --mode json --no-session -p <five-agent read-only batch request>
```

Result: PASS for agent discovery and concrete model resolution; BLOCKED for the explicit fallback boolean requirement.

Observed task metadata:

| Agent | agentSource | modelRole | modelOverride | resolvedModel |
|---|---|---|---|---|
| `designer-agent` | `project` | `designer` | `google-antigravity/gemini-3.1-pro:high` | `google-antigravity/gemini-3.1-pro:high` |
| `reviewer-agent` | `project` | `advisor` | `openai-codex/gpt-5.6-sol:high` | `openai-codex/gpt-5.6-sol:high` |
| `planner-agent` | `project` | `plan` | `openai-codex/gpt-5.6-terra:medium` | `openai-codex/gpt-5.6-terra:medium` |
| `commit-agent` | `project` | `commit` | `openai-codex/gpt-5.6-luna:low` | `openai-codex/gpt-5.6-luna:low` |
| `slow-agent` | `project` | `slow` | `openai-codex/gpt-5.6-sol:medium` | `openai-codex/gpt-5.6-sol:medium` |

`resolvedModelIsFallback: false`: **NOT OBSERVED** in OMP v18.0.11 JSON task metadata.

## Build and TypeScript

```text
npm run build       PASS
npx tsc --noEmit    PASS
```

The production build emitted the existing Vite chunk-size warning for a chunk larger than 500 kB.

## Tests and lint

```text
npm test            PASS — 99 files, 1421 tests
npm run lint        PASS — existing react(only-export-components) warning in src/context/AnimatorContext.tsx
```

No product files were changed by these checks.

## Command verification

- `/design`: PARTIAL/PASS for expansion and dispatch. The expanded command dispatched project `designer-agent`; metadata showed `agentSource: project`, `modelRole: designer`, and `resolvedModel: google-antigravity/gemini-3.1-pro:high`. Explicit fallback false was not emitted.
- `/review`: BLOCKED as a deterministic command-to-agent check. The smoke run expanded a review prompt but the parent dispatched bundled `reviewer`, not project `reviewer-agent`; its metadata showed the SLOW model role rather than the configured project override.
- `/plan`: NOT TESTED after the mandatory fallback evidence gate remained blocked.
- `/commit`: NOT TESTED after the mandatory fallback evidence gate remained blocked.

# 17. Manual QA Results

- Agent Hub: PARTIAL. Runtime task progress exposed the concrete child model and project agent source; explicit fallback false was not exposed in the observed metadata.
- Main top bar behavior: PASS in headless evidence. Parent assistant turns reported `openai-codex` / `gpt-5.6-luna` while the child designer task reported Gemini.
- Product UI/browser manual verification: NOT TESTED; this milestone changes only OMP configuration and prompts.

# 18. Regression Risk Assessment

- Product runtime regression: LOW; no product/runtime files changed.
- OMP command routing ambiguity: MEDIUM; native Markdown commands rely on the main model to emit the exact task agent call.
- Configuration drift: LOW; concrete identities were not duplicated into project config.
- Acceptance evidence risk: HIGH until OMP exposes or an approved verification path proves explicit `resolvedModelIsFallback: false`.

# 19. Performance Considerations

No product render, React rerender, geometry, or runtime performance behavior changed. Specialist task dispatches add model/network work only when the corresponding command or explicit delegation is used.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

- Product React, TypeScript, Vite, browser, serialization, saved-project, and animation compatibility: unchanged by scope.
- OMP compatibility: relies on the documented project `.omp/agents`, `.omp/commands`, `modelRoles`, and `task.agentModelOverrides` contracts.
- User profile compatibility: required concrete roles remain in the existing user config; the project config does not replace them.
- Windows path/private-secret compatibility: no secrets or private machine paths were added to repository files.

# 22. Known Limitations

1. OMP v18.0.11 did not emit explicit `resolvedModelIsFallback: false` in observed task result metadata; the user-required runtime gate therefore remains blocked.
2. Native Markdown commands cannot hard-force a task tool invocation; `/review` demonstrated that the main model can choose a similarly named bundled agent.
3. `/plan` and `/commit` were not run after the mandatory gate was shown to be unsatisfied.
4. No desktop Agent Hub screenshot/manual interaction was performed.

# 23. Technical Debt

- Determine an OMP-supported runtime/API surface that exposes an explicit false fallback flag, or obtain approval to treat absence as false.
- If exact command-to-agent enforcement is required, implement and validate a dedicated OMP extension command rather than relying on a Markdown prompt wrapper.

# 24. Git Summary

- Starting branch: `feat/v6-ui-design-v2`
- Ending branch: `chore/kcs-role-aware-routing`
- Starting HEAD: `7b3b5cf`
- Ending HEAD: `7b3b5cf`
- Upstream at start: `origin/feat/v6-ui-design-v2`
- Starting parity: ahead 0, behind 0
- Main modified: NO
- Product code changed: NO
- Commit: NO — validation acceptance gate blocked.
- Push: NO — validation acceptance gate blocked.
- Pre-existing unrelated untracked file preserved: `reports/model_routing_analysis.md`
- Intended routing/doc files remain uncommitted on the feature branch.

# 25. Updated Project Tree

```text
.omp/
  agents/
    [new] commit-agent.md
    [new] designer-agent.md
    [new] planner-agent.md
    [new] reviewer-agent.md
    [new] slow-agent.md
  [new] config.yml
  commands/
    [new] commit.md
    [new] design.md
    [new] plan.md
    [new] review.md
    [modified] milestone.md
    regression.md
    bugfix.md
docs/
  development/
    [new] KCS_AGENT_ROUTING.md
reports/
  [new] progress_036.md
  [pre-existing] model_routing_analysis.md
```

# 26. Self Review

Good:

- Correct native OMP directories and frontmatter were used.
- Concrete model roles stayed in the existing authoritative user config.
- All five direct project agent routes resolved to the intended concrete models.
- Product code and main branch were untouched.
- Mandatory evidence failure was reported instead of being inferred away.

Could improve:

- Native Markdown command semantics cannot provide the requested hard dispatch guarantee.
- Four command smoke tests could not all be completed after the explicit fallback gate failed.

Score: 8/10. The implementation is structurally correct and validated for direct task routing, but the acceptance evidence contract and command-level enforcement are unresolved.

# 27. Next Recommended Task

Resolve the OMP v18.0.11 fallback-evidence and exact command-dispatch enforcement gaps using an approved runtime/API verification approach before committing or pushing this branch.

# 28. Project Status

- Current milestone: routing files implemented on `chore/kcs-role-aware-routing`.
- Completed work: project agents, project task overrides, command wrappers, milestone guidance, documentation, direct model dispatch verification.
- Remaining milestone work: explicit fallback-false evidence and complete deterministic command verification.
- QA stage: BLOCKED at runtime acceptance gate.

# 29. AI Development Notes

- OMP project agent discovery is first-wins and project agents override bundled agents only by exact name; names are case-sensitive.
- Task model precedence is `task.agentModelOverrides[agentName]` → agent frontmatter → parent active/default fallback.
- Runtime metadata in this version stores expanded concrete selectors in `modelOverride` and separately exposes `modelRole`; it did not expose the expected alias string or explicit false fallback property in the observed JSON.
- Slash command expansion and task dispatch are separate pipeline stages; a file command is not an executable task dispatcher.
- Direct task dispatch is the reliable deterministic seam for this milestone.
- No product state, renderer, evaluator, history, serialization, or animation authority is involved.

## DO NOT CHANGE CASUALLY

- Do not move project agents out of `.omp/agents/`.
- Do not move project commands out of `.omp/commands/`.
- Do not replace role aliases with duplicated concrete model IDs in each agent.
- Do not remove `task.agentModelOverrides` and rely on parent fallback.
- Do not treat top-bar Luna as evidence of a child model failure.
- Do not change `/milestone` to route every phase through specialist models.
- Do not modify `reports/model_routing_analysis.md`.
- Do not weaken the `resolvedModelIsFallback: false` acceptance requirement without explicit approval.

# 30. Lessons Learned

- The native project paths and role override schema work as documented.
- A concrete `resolvedModel` proves model resolution but does not satisfy a separately required fallback boolean contract.
- Prompt-based command wrappers improve UX but cannot guarantee a particular task agent against an autonomous parent model.
- Runtime acceptance must inspect structured task metadata and agent source, not response prose.
- Keeping model identities centralized avoids project configuration drift.
