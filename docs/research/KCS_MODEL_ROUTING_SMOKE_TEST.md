# KCS Model Routing Smoke Test

Date: 2026-09-09
Branch: `feat/v6-ui-v34-control-cleanup`

## Scope

Eight direct, read-only smoke tasks were dispatched for the configured KCS routes. Each task was deliberately small. No routing configuration was changed. Missing runtime metadata is recorded as `NOT EXPOSED`; no model identity is inferred.

## Routing Verification Table

| ROUTE | AGENT | EXPECTED MODEL | RESOLVED MODEL | VERIFIED | NOTES |
|---|---|---|---|---|---|
| TINY | `TinyRoutingSmoke` / `sonic` | NOT EXPOSED | NOT EXPOSED | PARTIAL | Read `package.json`; result `keyframe-character-studio`. Agent/model/provider metadata not exposed. |
| SMOL | `SmolRoutingSmoke` / `scout` | NOT EXPOSED | NOT EXPOSED | PARTIAL | Counted 6 files under `src/components/Toolbar`. Model metadata not exposed. |
| TASK | `TaskRoutingSmoke` / `task` | NOT EXPOSED | NOT EXPOSED | PARTIAL | Located `.viewport-tools-overlay` in `CanvasViewportToolbar.tsx:77-79`. Model metadata not exposed. |
| COMMIT | `CommitRoutingSmoke` / `commit-agent` | NOT EXPOSED | NOT EXPOSED | PARTIAL | Read-only branch audit and commit-title suggestion. Model metadata not exposed. |
| planner-agent | `PlannerRoutingSmoke` / `planner-agent` | `openai-codex/gpt-5.6-terra` | `openai-codex/gpt-5.6-terra` | PASS | Exposed route metadata in `reports/model_routing_analysis.md`; produced a two-step plan. |
| designer-agent | `DesignerRoutingSmoke` / `designer-agent` | NOT EXPOSED | NOT EXPOSED | PARTIAL | Completed pre-implementation visual review. Model metadata not exposed. |
| slow-agent | `SlowRoutingSmoke` / `slow-agent` | NOT EXPOSED | `openai-codex/gpt-5.6-sol` | PARTIAL | Resolved model was exposed; expected model and provider were not. Verified stage-origin invariant. |
| reviewer-agent | `ReviewerRoutingSmoke` / `reviewer-agent` | NOT EXPOSED | NOT EXPOSED | PARTIAL | Completed tiny reset-contract risk review. Model metadata not exposed. |

## Execution Metadata

| taskName | agentName | agentSource | modelRole | requestedModel | resolvedModel | resolvedModelIsFallback | provider | task id | duration |
|---|---|---|---|---|---|---|---|---|---|
| TINY | `TinyRoutingSmoke` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | 10.4s |
| SMOL | `SmolRoutingSmoke` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | 12.3s |
| TASK | `TaskRoutingSmoke` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | 42.1s |
| COMMIT | `CommitRoutingSmoke` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | 51.1s |
| planner-agent | `PlannerRoutingSmoke` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | `openai-codex/gpt-5.6-terra` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | 1m6s |
| designer-agent | `DesignerRoutingSmoke` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | 1m42s |
| slow-agent | `SlowRoutingSmoke` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | `openai-codex/gpt-5.6-sol` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | 1m5s |
| reviewer-agent | `ReviewerRoutingSmoke` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | 5m33s |

## Available but Not Routed

No Muse, Spark, or other additional cheap-model route was exposed in the runtime results. No route was invented.

## Conclusion

All eight requested route tasks executed directly and returned results. Only planner-agent and slow-agent exposed resolved model identities. The remaining route metadata is intentionally `NOT EXPOSED`, not guessed.
