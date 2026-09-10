# OMP KCS Routing Smoke

Date: 2026-09-11
Prompt for direct routes: `Reply exactly ROUTE_OK`

Metadata is recorded only when emitted by OMP or the task envelope. Missing fields are `NOT EXPOSED`.

| Requested route | Result | Agent name | Source | Model role | Requested model | Resolved model | Provider | Task ID | Duration |
|---|---|---|---|---|---|---|---|---|---|
| TINY (`@tiny`) | PASS (`ROUTE_OK`) | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | `@tiny` | `opencode-go/deepseek-v4-flash` | `opencode-go` | session `01a08d68-387e-7130-a316-4d8efdcf9c61` | 2.87s |
| SMOL (`@smol`) | PASS (`ROUTE_OK`) | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | `@smol` | `opencode-go/deepseek-v4-flash` | `opencode-go` | session `01a08d68-53b9-71f0-b144-609d64208b01` | 3.29s |
| TASK (`@task`) | PASS (`ROUTE_OK`) | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | `@task` | `openai-codex/gpt-5.6-luna` | `openai-codex` | session `01a08d68-8cfe-74d4-92f9-696485de8469` | 3.00s |
| COMMIT (`@commit`) | PASS (`ROUTE_OK`) | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | `@commit` | `openai-codex/gpt-5.6-luna` | `openai-codex` | session `01a08d68-6eec-732c-ba53-fd61b93d7d4a` | 4.39s |
| planner-agent | PASS (`ROUTE_OK`) | PlannerRouteSmoke | NOT EXPOSED | `KCS planning specialist` | NOT EXPOSED | `openai-codex/gpt-5.6-terra` | `openai-codex` | NOT EXPOSED | 10.2s envelope |
| designer-agent | PASS (`ROUTE_OK`) | DesignerRouteSmoke | NOT EXPOSED | `designer` | NOT EXPOSED | `google-antigravity/gemini-3.1-pro` | `google-antigravity` | NOT EXPOSED | 15.0s envelope |
| slow-agent | PASS (`ROUTE_OK`) | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | `openai-codex/gpt-5.6-sol` | `openai-codex` | NOT EXPOSED | 11.5s envelope |
| reviewer-agent | PASS (`ROUTE_OK`) | `reviewer-agent` | NOT EXPOSED | NOT EXPOSED | NOT EXPOSED | `gpt-5.6-sol` | `openai-codex` | NOT EXPOSED | 15.2s envelope |

## Parallel orchestration smoke

PASS. Three independent read-only scout tasks ran through one batch call: branch inventory, test inventory, and OMP inventory. All completed without source edits. A four-agent specialist batch then validated planner, designer, slow, and reviewer routing. No expensive project-wide test suite ran during smoke testing.

## Notes

Direct OMP JSON events exposed provider/model/session IDs. Task envelopes exposed per-task duration and route labels; most agent metadata fields were not exposed. The reviewer route resolved to `gpt-5.6-sol` without the provider prefix in its returned field; the provider was exposed separately.
