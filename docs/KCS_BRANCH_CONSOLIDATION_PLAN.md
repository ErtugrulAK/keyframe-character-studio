# KCS Branch Consolidation Plan

## Scope

Planning only. No branch merge, branch deletion, reset, force push, or `main` modification is authorized by this document.

## Current candidate line

- `integration/v6-ui-ograf-release-candidate@4e4c269`
- `feat/ograf-public-controls-v1@2a6b5dc`
- `integration/v6-ui-ograf-public-controls-rc@2a6b5dc` — current consolidated integration RC

The integration RC was created from the accepted public-controls tip and contains both required ancestry lines.

## Accepted status

- V3.4.1, V3.5, and V3.6 are included in the release-candidate line.
- OGraf V2.1 is included in the release-candidate line.
- Host compatibility work is included in the release-candidate line.
- Public Controls V1 is PASS after the second target-host QA.
- The OMP tooling branch `chore/omp-kcs-config-optimization@50b42d4` remains separate.

## Recommended strategy

1. Keep `main` untouched until explicit release approval.
2. Treat `integration/v6-ui-ograf-public-controls-rc@2a6b5dc` as the current integration release-candidate tip.
3. Run and record the release validation set on that integration branch.
4. Ask for explicit approval before any `main` merge.
5. Only after `main` approval, merge or fast-forward to `main` safely.
6. Create a release tag or checkpoint only if separately approved.

## Separation rules

- `chore/omp-kcs-config-optimization@50b42d4` stays separate unless the user explicitly requests tooling configuration in the product branch.
- Desktop KCS folder cleanup is local environment hygiene, not product code.
- Historical reports and `.omp/backups/` remain preserved.
- Global OMP configuration, model mappings, and `memory.backend: mnemopi` remain unchanged.

## Current decision point

The integration RC has been created and pushed. Documentation and validation are complete for this checkpoint. No `main` merge is implied; the next action is explicit `main` merge approval only.
