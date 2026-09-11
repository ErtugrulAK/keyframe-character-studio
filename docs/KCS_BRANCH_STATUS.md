# KCS Branch Status

Known branch heads are recorded for the release-candidate integration. No merge to `main` is implied.

| BRANCH | PURPOSE | BASE | STATUS | LATEST KNOWN COMMIT | MERGE TARGET | RISK | NEXT ACTION |
|---|---|---|---|---|---|---|---|
| `main` | Protected release baseline | — | PROTECTED / UNCHANGED | `8024d4f` | None without explicit approval | High | Preserve |
| `integration/v6-ui-stable` | V6 UI integration baseline | V6 predecessor | BASE | `0289402` | Release candidate | Older baseline | Used as RC base |
| `feat/v6-ui-v34-control-cleanup` | V3.4.1 handle correction | Integration baseline | INCLUDED | `eba9895` | RC | Historical branch | No separate merge needed |
| `feat/v6-ui-v35-ux-corrections` | V3.5 UX corrections | V3.4.1 line | INCLUDED | `1ff6c61` | RC | Historical branch | No separate merge needed |
| `feat/v6-ui-v36-ograf-package-v2` | V3.6 and OGraf Package V2 | V3.5 line | INCLUDED | `de830d6` | RC | Export/UI integration | No separate merge needed |
| `feat/ograf-v21-spec-compliance` | OGraf V2.1 and import UX | V3.6/OGraf line | INCLUDED | `62ad6a7` | RC | OGraf contract | No separate merge needed |
| `feat/ograf-host-compat-package` | Host folder QA handoff | OGraf V2.1 | INCLUDED | `c2db6a4` | RC | External host boundary | Manual smoke |
| `docs/kcs-current-state-consolidation` | Current-state docs | Host compatibility | INCLUDED | `3ac1765` | RC | Documentation history | Included line |
| `docs/record-host-qa-pass` | Host PASS and readiness docs | Current-state docs | INCLUDED | `3a7eda3` | RC | External evidence | Included line |
| `integration/v6-ui-ograf-release-candidate` | Product/docs release candidate | `integration/v6-ui-stable` | ACTIVE | `3a7eda3` before RC report | User release decision | Validation and release scope | Validate, then request approval |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | Independent | SEPARATE / COMPLETE | `50b42d4` | None by default | Tooling/config scope | Keep separate |

## Integration strategy

The accepted product/documentation branches were linear descendants. The RC was created from `integration/v6-ui-stable` and fast-forwarded to `docs/record-host-qa-pass`; no cherry-pick or conflict resolution was needed. See `docs/KCS_INTEGRATION_EXECUTION_PLAN.md`.
