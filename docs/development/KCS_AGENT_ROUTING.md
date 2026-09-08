# KCS Agent Routing

## Purpose

KCS keeps the main session on the configured DEFAULT/Luna model while routing specialist phases to dedicated OMP task agents. Concrete model identities remain in the authoritative user `modelRoles` configuration. Project configuration owns only agent-to-role overrides.

## Native OMP layout

```text
.omp/
  config.yml
  agents/
    designer-agent.md
    reviewer-agent.md
    planner-agent.md
    commit-agent.md
    slow-agent.md
  commands/
    design.md
    review.md
    plan.md
    commit.md
```

Project agents are discovered from `.omp/agents/*.md`. Project file commands are discovered from `.omp/commands/*.md`.

## Routing contract

`.omp/config.yml` contains:

```yaml
task:
  agentModelOverrides:
    designer-agent: "@designer"
    reviewer-agent: "@advisor"
    planner-agent: "@plan"
    commit-agent: "@commit"
    slow-agent: "@slow"
```

The user model-role configuration remains the source of concrete identities:

- `@designer` → `google-antigravity/gemini-3.1-pro:high`
- `@advisor` → `openai-codex/gpt-5.6-sol:high`
- `@plan` → `openai-codex/gpt-5.6-terra:medium`
- `@commit` → `openai-codex/gpt-5.6-luna:low`
- `@slow` → the configured SLOW model

Task model precedence is:

```text
task.agentModelOverrides[agentName]
→ agent frontmatter model
→ parent active model and configured fallback
```

## Commands

### `/design`

Expands a UX wrapper that instructs the main orchestrator to dispatch exactly one `designer-agent` task. The agent performs UI/UX research, browser or screenshot critique when available, and returns an implementation-ready design brief. It is read-only by default.

### `/review`

Dispatches `reviewer-agent` for an independent, severity-ranked correctness, compatibility, and regression review. It is read-only by default.

### `/plan`

Dispatches `planner-agent` for a plan-only architecture and implementation breakdown. It must not edit product or Git files.

### `/commit`

Dispatches `commit-agent` for safe Git status, diff, and scope guidance. It must not perform destructive Git operations, stage unrelated files, commit, or push unless that exact operation is explicitly authorized.

### `/milestone`

Keeps the DEFAULT/Luna orchestrator behavior. It delegates to specialists only when explicitly needed: design-heavy work to `designer-agent`, difficult blockers to `slow-agent`, independent review to `reviewer-agent`, and generic implementation to normal task workers.

## Main-session behavior

The top bar shows the parent/main session model. A designer subagent can run on Gemini while the top bar continues to show Luna:

```text
main session: openai-codex/gpt-5.6-luna
child: google-antigravity/gemini-3.1-pro
```

Selecting `@designer` through `/model` or `--model @designer` changes the main session and is not required for these commands.

## Runtime verification

Do not treat response text as model evidence. Verify the task result metadata and Agent Hub:

- `agent` is the expected dedicated agent name;
- `modelOverride` is the expected role alias;
- `resolvedModel` is the expected provider/model identity;
- `resolvedModelIsFallback` is `false`;
- `agentSource` is `project`;
- Agent Hub shows the same child model.

Expected examples:

```text
agent: designer-agent
modelOverride: @designer
resolvedModel: google-antigravity/gemini-3.1-pro
resolvedModelIsFallback: false
agentSource: project
```

Repeat the same checks for `reviewer-agent`, `planner-agent`, `commit-agent`, and `slow-agent`.

## Limitations

A native markdown file command is a prompt template, not an executable task dispatcher. Its body can instruct the main model to call the exact task agent, while `task.agentModelOverrides` makes the model selection deterministic after dispatch. Programmatic enforcement would require an OMP extension command rather than a file command.

Do not modify product code to implement this routing. Do not manually duplicate concrete model IDs in project agent files or commands.

## V2 extension research and GO/NO-GO

OMP v18.0.11 supports project-local TypeScript/JavaScript extensions under `.omp/extensions`, and extensions can register executable slash commands with `pi.registerCommand(name, { description, handler })`.

The supported `ExtensionCommandContext` exposes session-control methods such as `waitForIdle`, `switchSession`, and `newSession`, plus model query methods through `ctx.models`. It does not expose the native task executor, a named-agent dispatch method, `TaskTool`, `runSubprocess`, or a supported command-handler API for invoking a child task and returning its `SingleResult` to the parent.

`pi.sendUserMessage(...)` only sends another prompt through the normal prompt pipeline. Calling `ctx.exec(...)` or spawning a separate `omp` process would be a separate process/prompt workaround, not the native task subsystem, and is intentionally not used.

Therefore V2 is **NO-GO** for executable deterministic agent commands on the current supported API. The existing Markdown commands, dedicated project agents, and `task.agentModelOverrides` remain the safest supported architecture. The native commands are explicitly prompt-mediated; direct task-tool dispatch remains deterministic after the exact agent name is selected.

No extension was created. No command ownership or precedence was changed.
