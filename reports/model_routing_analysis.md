# KCS Model Routing Analysis

## Scope

This report documents the model-role configuration and routing behavior inspected for Keyframe Character Studio. It does not change model mappings, routing configuration, or Git state.

## Current Route Table

The active global configuration contains:

| Route | Model selector | Thinking level | Primary intent |
|---|---|---:|---|
| `DEFAULT` | `openai-codex/gpt-5.6-luna` | `medium` | Main session and normal work |
| `SMOL` | `opencode-go/deepseek-v4-flash` | `low` | Lightweight model and prewalk/background use |
| `SLOW` | `openai-codex/gpt-5.6-sol` | `medium` | Deliberate, heavier general analysis |
| `VISION` | `google-antigravity/gemini-3.1-pro` | `high` | Vision-capable model preference |
| `PLAN` | `openai-codex/gpt-5.6-terra` | `medium` | Plan-mode/planning model alias |
| `DESIGNER` | `google-antigravity/gemini-3.1-pro` | `high` | Designer/UI/UX agent model alias |
| `COMMIT` | `openai-codex/gpt-5.6-luna` | `low` | Commit/checkpoint helper work |
| `TINY` | `opencode-go/deepseek-v4-flash` | `low` | Lightweight online background work |
| `TASK` | `openai-codex/gpt-5.6-luna` | `medium` | Generic subagent model alias |
| `ADVISOR` | `openai-codex/gpt-5.6-sol` | `high` | Independent advisor/reviewer model |

The route names are role aliases. A role alias does not, by itself, create a prompt classifier or force every task of a matching natural-language type onto that model.

## Exact Configuration Files Inspected

### Active global configuration

```text
<active OMP agent config path>
```

Relevant lines:

```yaml
modelRoles:
  default: openai-codex/gpt-5.6-luna:medium
  smol: opencode-go/deepseek-v4-flash:low
  slow: openai-codex/gpt-5.6-sol:medium
  vision: google-antigravity/gemini-3.1-pro:high
  designer: google-antigravity/gemini-3.1-pro:high
  plan: openai-codex/gpt-5.6-terra:medium
  commit: openai-codex/gpt-5.6-luna:low
  tiny: opencode-go/deepseek-v4-flash:low
  task: openai-codex/gpt-5.6-luna:medium
  advisor: openai-codex/gpt-5.6-sol:high
```

### KCS project-native commands

```text
.omp/commands/bugfix.md
.omp/commands/milestone.md
.omp/commands/regression.md
```

`milestone.md` defines the KCS milestone workflow and QA gates, including:

```text
DISCOVERY → CURRENT CONTRACT → USER GOAL → GAP →
EXISTING AUTHORITIES TO REUSE → ALTERNATIVES → RISKS →
IMPLEMENTATION → FOCUSED QA → FULL REGRESSION →
SCOPE AUDIT → FINAL REPORT
```

The KCS project command files do not contain a model-role mapping such as `/milestone -> @task` or `/commit -> @commit`.

### OMP documentation inspected

```text
omp://models.md
omp://settings.md
omp://task-agent-discovery.md
omp://tools/task.md
omp://advisor-watchdog.md
omp://tools/inspect_image.md
omp://slash-command-internals.md
omp://magic-keywords.md
```

## What Each Route Does

### DEFAULT

`DEFAULT` is the normal main-session model. A new session without an explicit model selection resolves to the configured default model, subject to model availability, saved session state, and runtime overrides.

### SMOL

`SMOL` is the lightweight role. It is suitable for faster, lower-cost work and is also the documented default target for prewalk hand-offs when prewalk is enabled. It may also be selected explicitly through the model UI or role alias.

### SLOW

`SLOW` is a deliberate general-purpose model selection for work that benefits from more careful analysis. The current configuration gives it Sol at `medium` effort. It is not automatically selected for every difficult prompt merely because the prompt looks difficult.

### VISION

`VISION` is the preferred role for image-capable model resolution. The `inspect_image` tool tries `@vision` first, then other candidates, and verifies that the resolved model advertises image input. The route name alone is not the capability check.

### PLAN

`PLAN` is the configured planning/plan-mode role. It can be selected by plan-related runtime behavior or explicitly through a model/role selection. A normal prompt containing words such as "plan" does not, by itself, prove or guarantee a model switch.

### DESIGNER

`DESIGNER` is a semantic role for designer agents and UI/UX-oriented work. The current mapping uses the same Gemini model as `VISION`, but the role meaning is different. Selecting `DESIGNER` does not automatically grant browser, image-generation, or other tools.

### COMMIT

`COMMIT` is a low-effort Luna role intended for commit/checkpoint helper work. A commit-related subsystem or agent must explicitly resolve this role; the existence of the alias does not force every `/commit` command to use it.

### TINY

`TINY` is the dedicated lightweight background role. OMP documentation identifies it for online work such as session titles, memory operations, automatic thinking-difficulty classification, and unexpected-stop detection. When it is not configured, those uses can fall back to `SMOL`.

### TASK

`TASK` is the generic subagent role. Actual task-agent model resolution has higher-priority sources: `task.agentModelOverrides`, agent frontmatter `model`, and then parent active/configured fallback. Therefore, a dispatched task does not universally guarantee the configured `modelRoles.task` value.

### ADVISOR

`ADVISOR` is the model role for the optional advisor subsystem. When the advisor is enabled and no advisor roster entry supplies an explicit model, OMP resolves `modelRoles.advisor`. The advisor reviews primary transcript deltas in its own context and usage stream and can emit advice or blockers; it does not directly approve primary actions.

## Automatic Versus Manual Routing

### Normal prompts

A normal prompt uses the current active model. On a new session with no saved or runtime override, that is normally `DEFAULT`:

```text
openai-codex/gpt-5.6-luna:medium
```

If the user changes the active model, subsequent normal prompts continue with that active selection. `DEFAULT` is not necessarily reselected before every prompt.

### What can select a role

Role selection can come from:

- `/model` or the model browser;
- CLI/runtime options such as `--model`, `--smol`, `--slow`, or `--plan`;
- explicit role aliases such as `@smol`, `@slow`, or `@designer`;
- agent frontmatter such as `model: "@designer"`;
- `task.agentModelOverrides`;
- specialized subsystems such as `inspect_image` and advisor;
- model fallback or context-promotion behavior, when configured and triggered.

There is no general configuration table in the inspected KCS files that maps natural-language task categories to routes through heuristics.

## Slash Command Behavior

OMP processes slash input through a command pipeline that checks, in order:

1. built-in commands;
2. extension commands;
3. TypeScript/custom/MCP prompt commands;
4. discovered file-based commands such as `.omp/commands/*.md`;
5. prompt-template expansion;
6. normal model delivery if the input remains a prompt.

The KCS project currently defines native file commands for `/bugfix`, `/milestone`, and `/regression`. `milestone.md` expands into a workflow prompt; it does not contain a model route selector.

No KCS project-native `/review`, `/plan`, or `/commit` file command was found. A command with one of those names may still come from an OMP built-in, user configuration, extension, or another provider. The inspected KCS project files do not establish a route mapping for them.

The `orchestrate` and `workflowz` magic keywords add hidden workflow instructions when enabled. They do not directly select a model role.

## Delegation Behavior

The `task` tool can dispatch one or more subagents, including parallel batches when enabled. Subagent model resolution follows this precedence:

1. `task.agentModelOverrides[agentName]`;
2. the agent definition's prioritized `model` list;
3. the parent's active model and configured/default fallback.

Role aliases in those fields are expanded through `modelRoles`.

Parallelism comes from the task subsystem, async job manager, and session-scoped concurrency semaphore. It does not come from the `TASK` model role itself.

Subagents have their own sessions and tool policies. They can be restricted by agent `tools`, parent spawn policy, recursion depth, isolation mode, and approval settings. Subagents are not automatically assigned advisors; advisor pairing requires agent frontmatter or `task.agentAdvisor` opt-in.

Plan mode can restrict child agents to read-only discovery tools and can clear child spawning.

## KCS-Specific Recommendations

| KCS work | Recommended route | Selection guidance |
|---|---|---|
| Normal coding | `DEFAULT` | Use as the normal default. |
| Hard architecture/debugging | `SLOW` | Select explicitly when cross-file reasoning or difficult trade-offs dominate. |
| Code review | `ADVISOR` for continuous review; `SLOW` for a deliberate one-shot review | Enable advisor for ongoing transcript review; use a reviewer agent or SLOW for an explicit review task. |
| Planning | `PLAN` | Use plan mode or explicitly select the plan role. |
| UI/UX design | `DESIGNER` | Use for inspector, canvas, timeline, layout, and interaction critique. |
| Screenshot/image analysis | `VISION` | `inspect_image` already prioritizes `@vision` and checks image capability. |
| Tiny mechanical edits | `TINY` or `SMOL` | Appropriate for low-risk mechanical work; use the main model when correctness risk is meaningful. |
| Git commit/checkpoint work | `COMMIT` | Appropriate when the commit/checkpoint flow resolves that role. |
| Large milestone execution | `DEFAULT` orchestrator with `TASK` workers; `SLOW` when the main design requires it | Use the task subsystem for independent work and verification. |
| Second opinion/advisor review | `ADVISOR` | Enable the advisor subsystem or use a dedicated reviewer/advisor agent. |

## Implications of the Routes

### Context window

A role alias does not independently set a context window. Context limits, maximum output, compaction metadata, and context-promotion behavior come from the resolved model's registry metadata. Two roles using the same model inherit the same model-level limits unless another override applies.

### Reasoning depth

The thinking suffix is significant:

- `low`: `SMOL`, `COMMIT`, and `TINY`;
- `medium`: `DEFAULT`, `SLOW`, `PLAN`, and `TASK`;
- `high`: `VISION`, `DESIGNER`, and `ADVISOR`.

The provider/model capability ladder may clamp or otherwise interpret the requested effort.

### Speed

Speed is affected indirectly by model family and thinking level. Low effort generally favors latency; high effort generally favors deeper reasoning at higher latency. Provider availability and transport behavior also affect observed speed.

### Cost and usage limits

The resolved provider/model determines pricing and provider-side usage limits. Advisor and subagent usage is separate from the primary session's usage accounting. `SMOL` and `TINY` are configured as low-effort lightweight options, but actual cost is provider metadata, not the route label.

### Tool access

Routes do not grant tools. Tool availability comes from session policy, agent definitions, plan-mode restrictions, approval policy, recursion limits, and advisor tool grants. Selecting `DESIGNER` does not automatically grant `browser` or image-generation tools.

### Parallel agents

Routes do not enable parallelism. The `task` tool, batch shape, async execution, and `task.maxConcurrency` control concurrent subagents.

### Vision capability

`VISION` is a model preference for image-capable resolution. `inspect_image` verifies actual image-input capability and may fall back to another suitable model if the preferred role cannot resolve or lacks the capability.

## Redundant or Duplicate Routes

### `DEFAULT` and `TASK`

Both currently resolve to Luna at `medium` effort. Their semantics differ:

- `DEFAULT`: main session;
- `TASK`: generic subagent.

Keeping both allows worker models to be changed later without changing the main session route.

### `SMOL` and `TINY`

Both currently resolve to DeepSeek Flash at `low` effort. Their semantics differ:

- `SMOL`: lightweight selectable role and common prewalk target;
- `TINY`: automatic lightweight background role.

Keeping both preserves independent tuning for interactive lightweight work and background work.

### `SLOW` and `ADVISOR`

They use the same Sol model family but different effort levels:

- `SLOW`: `medium`;
- `ADVISOR`: `high`.

They also have different lifecycles, contexts, and usage accounting. They are not functionally duplicate routes.

## Practical Cheat Sheet

| Task type | Best route | Auto or manual? | Why |
|---|---|---|---|
| Routine KCS coding | `DEFAULT` | Default/automatic | Balanced main-session model. |
| Cross-file state or evaluator debugging | `SLOW` | Manual | Requires deliberate deeper analysis. |
| Continuous second opinion | `ADVISOR` | Enable explicitly | Separate reviewer context and advice channel. |
| Plan-only work | `PLAN` | Plan mode or manual | Planning-specific model role. |
| UI/UX critique | `DESIGNER` | Manual or designer agent | Explicit design specialization. |
| Screenshot inspection | `VISION` | `inspect_image` automatic | Image-capable model resolution. |
| Low-risk mechanical edit | `TINY`/`SMOL` | Usually manual outside background systems | Fast, low-effort execution. |
| Generic independent subtask | `TASK` | Task dispatch | Subagent model precedence still applies. |
| Large milestone | `TASK` workers plus `DEFAULT`/`SLOW` main agent | Delegation-driven | Parallelism belongs to the task subsystem. |
| Commit/checkpoint helper work | `COMMIT` | Flow-dependent/manual | Low-effort commit-oriented alias. |

## Final Recommendation

**KEEP CURRENT ROUTING**

The duplicate model identities are intentional semantic aliases rather than clear configuration errors. The current setup keeps useful future flexibility between main sessions, workers, lightweight background work, and advisor review. No route changes are recommended or applied in this report.

## Possible Config Changes (Not Applied)

If later approved, possible changes would be:

1. Keep `DEFAULT` and `TASK` separate but assign a cheaper or specialized worker model to `TASK` if subagent cost becomes a concern.
2. Keep `SMOL` and `TINY` separate unless there is no need to tune interactive lightweight work independently from background work.
3. Consider increasing `SLOW` to `:high` for especially difficult architecture/debugging work, but only after confirming the provider's quota, latency, and cost behavior.
4. Keep `ADVISOR` at `:high` if review quality matters; reduce it only if advisor usage or latency is excessive.
5. Add explicit project/user agent definitions that reference `@designer`, `@review`, `@plan`, or `@commit` only when those workflows need deterministic role selection.

These are recommendations only. No model mapping, route, or configuration file was changed.
