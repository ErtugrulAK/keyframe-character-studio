# KCS Branch Status

Known branch heads are recorded at the time of this documentation update. No merge is implied by this table.

| BRANCH | PURPOSE | BASE | STATUS | LATEST KNOWN COMMIT | MERGE TARGET | RISK | NEXT ACTION |
|---|---|---|---|---|---|---|---|
| `main` | Protected release baseline | — | PROTECTED / UNCHANGED | `8024d4f` | None without explicit approval | High: never modify casually | Preserve |
| `integration/v6-ui-stable` | V6 UI integration baseline | V6 predecessor | COMPLETE BASELINE | `0289402` | `main` only by explicit integration decision | Integration sequencing | Preserve |
| `feat/v6-ui-v34-control-cleanup` | V3.4.1 handle correction | `integration/v6-ui-stable` | COMPLETE | `eba9895` | `integration/v6-ui-stable` | Historical UI branch | Candidate for planned integration |
| `feat/v6-ui-v35-ux-corrections` | V3.5 UX corrections | V3.4 branch line | COMPLETE | `1ff6c61` | `integration/v6-ui-stable` | Historical UI branch | Candidate after V3.4.1 |
| `feat/v6-ui-v36-ograf-package-v2` | V3.6 and OGraf Package V2 | V3.5 branch line | COMPLETE | `de830d6` | `integration/v6-ui-stable` | OGraf/UI integration ordering | Candidate after V3.5 |
| `feat/ograf-v21-spec-compliance` | OGraf V2.1 compliance and import UX | V3.6/OGraf line | COMPLETE | `62ad6a7` | Host compatibility line / explicit integration plan | Manual host evidence boundary resolved | Candidate after V3.6 |
| `feat/ograf-host-compat-package` | Host folder QA handoff | `feat/ograf-v21-spec-compliance` | HOST QA COMPLETE | `c2db6a4` | `feat/ograf-v21-spec-compliance` after approval | Target host result recorded; integration still separate | Candidate after OGraf V2.1 |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | Independent config branch | COMPLETE / TOOLING ONLY | `50b42d4` | Separate decision | Config precedence and global freeze | Keep separate by default |
| `docs/kcs-current-state-consolidation` | Current-state and handoff docs | `feat/ograf-host-compat-package` | COMPLETE | `3ac1765` | Documentation history | Historical wording reconciliation | Preserve |
| `docs/record-host-qa-pass` | Host QA result and integration readiness docs | `docs/kcs-current-state-consolidation` | IN PROGRESS | `3ac1765` before recording commit | Documentation review target | User QA is external evidence | Commit and push docs |

## Integration policy

The recommended product sequence is V3.4.1 → V3.5 → V3.6/OGraf Package V2 → OGraf V2.1/import UX → host-compatibility handoff. The OMP tooling branch is independent and should remain separate unless explicitly approved. The documentation branches record state and should not be treated as product integration candidates.

No integration action should happen until the user explicitly approves the plan. `main` remains untouched.
