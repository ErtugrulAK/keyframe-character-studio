# KCS Branch Status

Known branch heads are recorded from the repository at consolidation time. No merge is implied by this table.

| BRANCH | PURPOSE | BASE | STATUS | LATEST KNOWN COMMIT | MERGE TARGET | RISK | NEXT ACTION |
|---|---|---|---|---|---|---|---|
| `main` | Protected release baseline | — | PROTECTED / UNCHANGED | `8024d4f` | None without explicit approval | High: never modify casually | Preserve |
| `integration/v6-ui-stable` | V6 UI integration baseline | V6 predecessor | COMPLETE BASELINE | `0289402` | `main` only by explicit integration decision | Integration sequencing | Preserve |
| `feat/v6-ui-v34-control-cleanup` | V3.4.1 handle correction | `integration/v6-ui-stable` | COMPLETE | `eba9895` | `integration/v6-ui-stable` | Historical UI branch | No new work |
| `feat/v6-ui-v35-ux-corrections` | V3.5 UX corrections | V3.4 branch line | COMPLETE | `1ff6c61` | `integration/v6-ui-stable` | Historical UI branch | No new work |
| `feat/v6-ui-v36-ograf-package-v2` | V3.6 and OGraf Package V2 | V3.5 branch line | COMPLETE | `de830d6` | `integration/v6-ui-stable` | OGraf/UI integration ordering | No new work |
| `feat/ograf-v21-spec-compliance` | OGraf V2.1 compliance and import UX | V3.6/OGraf line | COMPLETE | `62ad6a7` | Host compatibility line / explicit integration plan | Manual host evidence boundary | Preserve standard contract |
| `feat/ograf-host-compat-package` | Host folder QA handoff | `feat/ograf-v21-spec-compliance` | READY FOR USER QA | `c2db6a4` | `feat/ograf-v21-spec-compliance` after QA decision | Target host behavior not yet recorded | Test BASIC → COMPOSITING → ASSET |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | Independent config branch | COMPLETE | `50b42d4` | Separate review/integration decision | Config precedence and global freeze | Keep `memory.backend: mnemopi` |
| `docs/kcs-current-state-consolidation` | Current-state and handoff docs | `feat/ograf-host-compat-package` | IN PROGRESS | `c2db6a4` before consolidation commit | Documentation review target | Stale-history reconciliation | Commit and push docs |

## Integration policy

Historical branch heads are not proof of merge status. Do not merge or modify `main` from this documentation branch. Resolve host QA first, then make a separate explicit integration decision.
