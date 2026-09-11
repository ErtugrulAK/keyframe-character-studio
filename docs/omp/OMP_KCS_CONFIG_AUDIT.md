# OMP KCS Configuration Audit

Date: 2026-09-11
Scope: `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`

## Sources and precedence

- Official repository reviewed: https://github.com/can1357/oh-my-pi/tree/main
- Official settings reviewed: https://github.com/can1357/oh-my-pi/blob/main/docs/settings.md
- Effective schema checked with `omp config list --json`.
- Effective precedence: built-in defaults <- global config <- project config <- CLI overlays <- runtime overrides.
- Project settings were evaluated from the KCS repository root, where `.omp/` is non-empty.

## Configuration paths and backups

- Global config: `C:\Users\ertugrul.ak\.omp\agent\config.yml`
- Project config: `.omp/config.yml`
- Project backup: `.omp/backups/config.yml.20260911-011842.bak`
- Global backup: `.omp/backups/global-config.yml.20260911-011842.bak`

Backups were created before project configuration edits. The global file was not edited.
The project intentionally keeps `memory.backend: mnemopi`; this is a user-approved, deliberate setting. Project memory is enabled, not disabled.

## Model freeze

| Role | Effective selector |
|---|---|
| default | `openai-codex/gpt-5.6-luna:medium` |
| smol | `opencode-go/deepseek-v4-flash:high` |
| slow | `openai-codex/gpt-5.6-sol:medium` |
| vision | `google-antigravity/gemini-3.1-pro:high` |
| designer | `google-antigravity/gemini-3.1-pro:high` |
| plan | `openai-codex/gpt-5.6-terra:medium` |
| commit | `openai-codex/gpt-5.6-luna:medium` |
| tiny | `opencode-go/deepseek-v4-flash:high` |
| task | `openai-codex/gpt-5.6-luna:medium` |
| advisor | `openai-codex/gpt-5.6-sol:high` |

No `modelRoles.*`, provider ID, model ID, suffix, credential, or role mapping was changed.

## Effective changes

| Setting | Before | After | Reason |
|---|---:|---:|---|
| `task.eager` | `default` | `preferred` | Proactively delegate non-trivial work. |
| `task.maxConcurrency` | `8` | `4` | Bound useful fan-out and reduce rate-limit bursts. |
| `task.isolation.enabled` | `false` | `true` | Keep child writes isolated before parent integration. |
| `task.isolation.apply` | `true` | `true` | Preserved. |
| `task.isolation.merge` | `patch` | `patch` | Preserved. |
| `compaction.enabled` | `true` | `true` | Explicitly pinned project behavior. |
| `compaction.midTurnEnabled` | `true` | `true` | Explicitly pinned project behavior. |
| `branchSummary.enabled` | `true` | `true` | Already enabled; explicitly pinned. |
| `memory.backend` | `mnemopi` | `mnemopi` | Preserved as the user's intentional, approved memory setting; project memory remains enabled. |
| `providers.maxInFlightRequests` | `{}` | `openai-codex: 3`, `google-antigravity: 2`, `opencode-go: 4` | Bound actual providers without changing models. |
| `bash.autoBackground.thresholdMs` | `60000` | `60000` | Already suitable for dev servers and long Playwright runs. |
| `bash.patterns` | `[]` | Five deny rules | Block high-risk reset, force-push, branch-delete, and recursive-delete patterns. |

`tools.approvalMode` remains `yolo`; safety was not loosened. Explicit deny patterns remain project-local policy.

## Rollback

Restore `.omp/config.yml` from `.omp/backups/config.yml.20260911-011842.bak`, or remove the added project keys manually. Do not restore the global backup over the live global file unless explicitly requested. A fresh OMP session is required for file-based setting changes to be discovered reliably.

## Approval still required

No model/provider replacement was proposed. Any future model, provider, credential, account, global-config, or memory-backend change requires explicit user approval.
