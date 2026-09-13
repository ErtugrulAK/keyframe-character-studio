# KCS Branch Status

Public-controls work is integrated into `main@6351d1a` (with RC tip `111c101` in its ancestry). Audited safe merged branches were deleted after verification. The OMP tooling branch remains separate.

| BRANCH | PURPOSE | STATUS | LATEST KNOWN COMMIT | NEXT ACTION |
|---|---|---|---|---|
| `main` | Protected product baseline | INTEGRATED / RELEASE-TAGGED | `6351d1a` | Final two-PC sync audit |
| `chore/omp-kcs-config-optimization` | Project-local OMP policy | SEPARATE / COMPLETE | `50b42d4` | Keep separate |
| `copilot/analyze-repository-improvement-audit` | Repository audit | NEEDS INVESTIGATION / PRESERVED | — | Investigate only if needed |
| `copilot/fix-gh-actions-workflow-failure` | Workflow repair | NEEDS INVESTIGATION / PRESERVED | — | Investigate only if needed |
| `copilot/fix-build-lint-test-verification` | Verification work | NEEDS INVESTIGATION / PRESERVED | — | Inspect unique commit before action |
| `docs/github-presentation` | Presentation docs | NEEDS INVESTIGATION / PRESERVED | — | Inspect unique commits before action |
| `without-mask` | Divergent historical line | NEEDS INVESTIGATION / PRESERVED | — | Do not delete without review |

## Public-controls scope

- Text fields are generated for visible text layers, with explicit `headline` compatibility.
- Image fields use package-relative enum/default paths and runtime safe-value checks; ASSET QA includes default and alternate resources.
- Fill/stroke fields use deterministic IDs, `format: color`, and OGraf `color-rrggbb` schema metadata.
- Matte-source helper layers are excluded.

## Protected invariants

`main` is release-tagged at `6351d1a` as `v1.1.0-public-controls`. `memory.backend: mnemopi`, model/provider mappings, global OMP configuration, `.omp/backups/`, old QA folders, and the read-only corpus remain unchanged. No investigation branch was deleted.
