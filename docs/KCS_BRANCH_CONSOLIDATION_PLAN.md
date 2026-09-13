# KCS Branch Consolidation Plan

## Scope

Planning only. No branch merge, branch deletion, reset, force push, or `main` modification is authorized by this document.

## Current candidate line

- `integration/v6-ui-ograf-release-candidate@4e4c269`
- `feat/ograf-public-controls-v1` at the latest pushed checkpoint

The feature branch contains the accepted public-controls implementation, automated validation, and reported BASIC/ASSET/COMPOSITING target-host QA PASS.

## Accepted status

- V3.4.1, V3.5, and V3.6 are included in the release-candidate line.
- OGraf V2.1 is included in the release-candidate line.
- Host compatibility work is included in the release-candidate line.
- Public Controls V1 is PASS after the second target-host QA.
- The OMP tooling branch `chore/omp-kcs-config-optimization@50b42d4` remains separate.

## Recommended strategy

1. Keep `main` untouched until explicit release approval.
2. Treat `feat/ograf-public-controls-v1` as the new release-candidate tip after the QA PASS.
3. After approval, create or update a dedicated integration branch, for example:
   `integration/v6-ui-ograf-public-controls-rc`.
4. Merge or fast-forward the public-controls branch into that integration branch.
5. Run the release validation set on the integration branch:
   - `git diff --check`
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `npm run qa:v6`
   - `npm run validate:ograf`
   - Playwright shard strategy if the full aggregate exceeds the command envelope.
6. Ask for explicit approval before any `main` merge.
7. Only after `main` approval, merge or fast-forward to `main` safely.
8. Create a release tag or checkpoint only if separately approved.

## Separation rules

- `chore/omp-kcs-config-optimization@50b42d4` stays separate unless the user explicitly requests tooling configuration in the product branch.
- Desktop KCS folder cleanup is local environment hygiene, not product code.
- Historical reports and `.omp/backups/` remain preserved.
- Global OMP configuration, model mappings, and `memory.backend: mnemopi` remain unchanged.

## Current decision point

Documentation cleanup and the local desktop archive are complete for this checkpoint. The next action is an explicit decision on whether to create/update the integration RC branch. No `main` merge is implied.
