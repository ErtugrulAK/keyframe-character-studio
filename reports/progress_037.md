# KCS Development Report — Deterministic Agent Commands V2

Metadata:
- Date: 2026-09-08
- Milestone: KCS — DETERMINISTIC AGENT COMMANDS V2
- Branch: chore/kcs-role-aware-routing
- Starting HEAD: 7b3b5cf docs: record V2 UI redesign gate
- Ending HEAD: c895005 feat: add role-aware agent routing
- Commit status: Committed and pushed to `origin/chore/kcs-role-aware-routing`
- Report number: 037

# 1. Executive Summary

Researched the installed OMP v18.0.11 extension, slash-command, task, agent-discovery, model, SDK, and RPC surfaces before implementation. OMP supports project-local executable extensions and `pi.registerCommand`, but the supported extension command context does not expose the native task executor or a named-agent subagent dispatch API. Therefore the requested executable deterministic command layer is **NO-GO**. No extension hack was created. Existing dedicated agents, role overrides, and Markdown command wrappers remain intact and are documented as the supported architecture.

# 2. Original Objectives

The objective was to replace prompt-mediated command ambiguity with an executable extension that maps `/design`, `/review`, `/plan`, `/commit`, and optionally `/slow` directly to named project agents while keeping the parent model on DEFAULT/Luna.

In scope:

- verify the real installed OMP extension and command API;
- decide GO/NO-GO before implementation;
- preserve progress_036 routing work;
- update routing documentation and report the decision;
- avoid product code and main branch changes.

Out of scope:

- unsupported subprocess or shell hacks;
- product/runtime source changes;
- main branch changes;
- command/API invention;
- weakening runtime evidence requirements.

# 3. Problems Discovered

## 3.1 No supported command-to-task bridge

OMP extensions can register executable slash commands, but `ExtensionCommandContext` exposes session control and model query APIs, not `TaskTool`, `runSubprocess`, task executor access, or named-agent dispatch. `pi.sendUserMessage` feeds another prompt through normal prompt flow and is not deterministic dispatch.

## 3.2 Existing native commands remain prompt-mediated

`.omp/commands/*.md` files expand prompt templates. They cannot invoke a child task directly. A main model can follow the exact agent instruction, but can also choose a similarly named bundled agent, as observed in progress_036.

## 3.3 Fallback field remains absent

Direct task dispatch metadata exposed concrete `resolvedModel`, `modelRole`, `modelOverride`, and `agentSource: project`; OMP v18.0.11 did not emit explicit `resolvedModelIsFallback: false`. This is reported as `NOT EXPLICITLY EXPOSED`, never fabricated.

# 4. Files Created

- `reports/progress_037.md` — this NO-GO milestone record.

No extension file was created.

# 5. Files Modified

- `docs/development/KCS_AGENT_ROUTING.md`
  - Added the V2 extension research, supported API boundary, NO-GO decision, and rejected workaround rationale.
  - No product behavior changed.

All `.omp/agents/*`, `.omp/commands/*`, `.omp/config.yml`, and `reports/progress_036.md` routing work from the previous milestone was preserved unchanged except for the already-recorded milestone guidance change.

# 6. Architecture Overview

```text
Supported current architecture:
main Luna
  -> native Markdown command prompt wrapper
  -> exact task agent requested by the parent model
  -> task.agentModelOverrides
  -> modelRoles alias
  -> specialist child model

Unsupported V2 target:
executable command handler
  -> native named-agent task dispatch
```

The second arrow is not available in the supported extension API.

# 7. Data Model Changes

No product data, serialized project data, animation state, scene state, or persistence schema changed.

# 8. Coordinate Space Model

Not applicable. No Canvas, transform, geometry, rendering, selection, hit testing, viewport, or animation contract changed.

# 9. Component / Module Walkthrough

Not applicable. No TypeScript or TSX product module changed. No extension module was authored.

# 10. Important Code Changes

No code changes. The relevant supported registration shape researched was:

```ts
pi.registerCommand("name", {
  description: "...",
  handler: async (_args, ctx) => {
    // ExtensionCommandContext has session/UI/model-query actions.
  },
});
```

The researched API has no supported task-dispatch call to insert here.

# 11. Public Interfaces

No KCS public API changed. No OMP extension API was wrapped or re-exported.

# 12. Algorithms and Geometry

Not applicable.

# 13. Interaction / UX Behavior

No user-facing command behavior was changed in V2. Existing commands remain prompt-mediated wrappers. The documented user workflow remains:

```text
/design <request> -> main model is instructed to dispatch designer-agent
/review <request> -> main model is instructed to dispatch reviewer-agent
/plan <request> -> main model is instructed to dispatch planner-agent
/commit <request> -> main model is instructed to dispatch commit-agent
```

This is not claimed to be hard enforcement.

# 14. Design Decisions

## Decision: NO-GO for executable deterministic commands

Reason: no official API connects `pi.registerCommand` handlers to the native task executor and named-agent resolver.

Rejected alternative: call `ctx.exec` or spawn a separate `omp` process. This would be a shell/process workaround, not the native task subsystem, and would complicate parent-child output, permissions, cancellation, lifecycle, and evidence.

Rejected alternative: use `pi.sendUserMessage`. It is explicitly prompt-mediated and permits parent-model deviation.

## Decision: Preserve current routing work

Reason: project agent definitions and `task.agentModelOverrides` are supported and direct task dispatch resolves correctly.

# 15. Invariants That Must Be Preserved

- Never invent an extension task-dispatch API.
- Never use shell spawning as a substitute for native task execution.
- Keep concrete model identities in authoritative `modelRoles`.
- Keep agent-to-role mappings in `task.agentModelOverrides`.
- Keep DEFAULT/Luna as the parent milestone orchestrator.
- Do not treat command prompt text as deterministic execution evidence.
- Do not fabricate `resolvedModelIsFallback: false`.
- Do not modify product/runtime code or main.
- Preserve the existing routing analysis content; redact machine-specific paths before committing related documentation.

# 16. Testing and Verification

## Installed OMP version

```text
omp --version
omp/18.0.11
```

## Documentation and API research

Read:

- `omp://extensions.md`
- `omp://extension-loading.md`
- `omp://slash-command-internals.md`
- `omp://task-agent-discovery.md`
- `omp://tools/task.md`
- `omp://models.md`
- `omp://sdk.md`
- `omp://rpc.md`

Findings:

- project-local extension discovery: supported under `.omp/extensions`;
- executable command registration: supported through `pi.registerCommand`;
- model-role lookup: supported through `ctx.models.resolve`;
- native named-agent task dispatch from command handler: not exposed;
- child task result return through command handler: not exposed;
- parent model preservation: possible for prompt injection, but no native child-dispatch path;
- command conflicts: executable command conflicts with built-ins are skipped with diagnostics;
- extension lifecycle: registration during factory load, runtime actions after initialization;
- extension security: same-process and not sandboxed, so shell workaround would increase risk.

## Existing direct task evidence

From progress_036 runtime checks, all direct named-agent dispatches resolved with `agentSource: project`, the expected `modelRole`, and the expected concrete `resolvedModel`:

- `designer-agent` → `google-antigravity/gemini-3.1-pro:high`;
- `reviewer-agent` → `openai-codex/gpt-5.6-sol:high`;
- `planner-agent` → `openai-codex/gpt-5.6-terra:medium`;
- `commit-agent` → `openai-codex/gpt-5.6-luna:low`;
- `slow-agent` → `openai-codex/gpt-5.6-sol:medium`.

Fallback field: `NOT EXPLICITLY EXPOSED`; no fallback warning was observed.

## Project validation

Previously executed for the preserved routing work:

- `npm run build`: PASS;
- `npx tsc --noEmit`: PASS;
- `npm test`: PASS — 99 files, 1421 tests;
- `npm run lint`: PASS with existing warning in `src/context/AnimatorContext.tsx`;
- `omp models --json`: PASS.

For this V2 NO-GO research, no product/runtime code was added, so no extension typecheck/build was applicable.

# 17. Manual QA Results

- Extension runtime UI: NOT TESTED; no extension was authored because the official task-dispatch API is absent.
- Existing direct Agent Hub/task evidence: PARTIAL; concrete child model and project agent source were observed, but the explicit fallback-false field was not exposed.
- Parent model behavior: PASS in prior headless evidence; parent remained `openai-codex/gpt-5.6-luna` while child routing resolved independently.

# 18. Regression Risk Assessment

- Product regression: LOW; no product code changed.
- Unsupported extension risk: ELIMINATED; no hack was added.
- Current Markdown command ambiguity: MEDIUM and documented.
- Model evidence ambiguity: MEDIUM; fallback boolean is not explicitly exposed by this OMP version.

# 19. Performance Considerations

No product performance behavior changed. No extension runtime, subprocess, polling loop, or extra model router was introduced.

# 20. Dependencies

No dependency changes.

# 21. Compatibility

The supported existing OMP project agent and command paths remain unchanged. No OMP version-specific extension module was added. No product, browser, saved-project, serialization, or animation compatibility impact exists.

# 22. Known Limitations

1. OMP v18.0.11 cannot be proven to support executable deterministic named-agent commands through its documented extension API.
2. Native Markdown command wrappers remain parent-model-mediated.
3. `resolvedModelIsFallback: false` is not explicitly emitted in observed task JSON.
4. No `/slow` executable command was added because the same unsupported bridge would be required.

# 23. Technical Debt

Revisit only if a future OMP release documents and exposes a native command-handler-to-task-executor API with named-agent dispatch and structured child result metadata.

# 24. Git Summary

- Starting branch: `chore/kcs-role-aware-routing`.
- Main modified: NO.
- Product code changed: NO.
- NO-GO implementation: no extension created.
- Existing routing/docs work remains the supported deliverable.
- `reports/model_routing_analysis.md` was pre-existing and preserved; its machine-specific config path was redacted before commit.
- Commit/push result: c895005 was committed and pushed; no fake V2 extension was committed.

# 25. Updated Project Tree

```text
.omp/
  agents/                 [preserved from progress_036]
  config.yml              [preserved from progress_036]
  commands/               [preserved from progress_036]
  extensions/             [not created — NO-GO]
docs/development/
  KCS_AGENT_ROUTING.md    [updated]
reports/
  progress_036.md         [preserved]
  progress_037.md         [new]
  model_routing_analysis.md [preserved with machine-path redaction]
```

# 26. Self Review

Good: the extension API was researched before implementation; unsupported behavior was not approximated with shell or prompt hacks; existing supported routing was preserved; the NO-GO boundary is explicit.

Could improve: a future OMP release may add a task bridge, requiring a fresh source-level review before any implementation; the fallback field remains a runtime observability limitation.

Score: 9/10. The requested V2 extension was correctly rejected on evidence, while the supported architecture remains intact.

# 27. Next Recommended Task

Re-run this GO/NO-GO API audit after an OMP release that documents a command-handler native task-dispatch interface.

# 28. Project Status

- V2 decision: NO-GO.
- Supported routing layer: preserved.
- Extension implementation: intentionally not created.
- QA stage: API research complete; no executable V2 layer to validate.

# 29. AI Development Notes

- Extension registration is supported, but registration is not task orchestration.
- `ctx.models.resolve` resolves a model; it does not create a child task session.
- `sendUserMessage` preserves prompt semantics, not deterministic command semantics.
- `ctx.exec` is not an acceptable substitute for OMP task execution.
- Extension runtime is same-process and unsandboxed; adding shell execution would broaden safety risk.

## DO NOT CHANGE CASUALLY

- Do not add `.omp/extensions` code that shells out to `omp` for task dispatch.
- Do not claim `/design`, `/review`, `/plan`, or `/commit` is hard deterministic while it is a Markdown prompt wrapper.
- Do not remove or weaken `task.agentModelOverrides`.
- Do not duplicate concrete model IDs into agents or command handlers.
- Do not treat missing fallback metadata as explicit false without documented OMP semantics.
- Do not modify main or product code.

# 30. Lessons Learned

- The extension and command APIs are real and supported, but their scope stops at command handling, messaging, model queries, and session controls.
- Deterministic routing needs an exposed task-executor bridge; model selection alone is insufficient.
- Refusing an unsupported integration is safer than creating a second, partially compatible orchestration engine.
