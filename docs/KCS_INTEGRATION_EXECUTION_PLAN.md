# KCS Integration Execution Plan

## Decision

Release candidate branch: `integration/v6-ui-ograf-release-candidate`.

Base: `integration/v6-ui-stable@0289402`.

Strategy used: **fast-forward the complete linear descendant** `docs/record-host-qa-pass@3a7eda3` into the new release-candidate branch. No cherry-picks, conflict resolutions, or duplicate merges were required.

`main` remains untouched at `8024d4f`.

## Ancestry audit

The accepted product and documentation line is linear:

```text
integration/v6-ui-stable@0289402
  -> feat/v6-ui-v34-control-cleanup@eba9895
  -> feat/v6-ui-v35-ux-corrections@1ff6c61
  -> feat/v6-ui-v36-ograf-package-v2@de830d6
  -> feat/ograf-v21-spec-compliance@62ad6a7
  -> feat/ograf-host-compat-package@c2db6a4
  -> docs/kcs-current-state-consolidation@3ac1765
  -> docs/record-host-qa-pass@3a7eda3
```

`git merge-base --is-ancestor` passed for every adjacent pair. `git cherry -v integration/v6-ui-stable docs/record-host-qa-pass` showed the accepted commits as new relative to the integration base. The release candidate therefore receives the full product/docs line by one fast-forward operation.

The branch delta contains the expected UI, OGraf, tests, reports, research/design evidence, and current-state docs. No separate product branch was duplicated.

## Included branches and milestones

- `feat/v6-ui-v34-control-cleanup@eba9895` — V3.4.1 sidebar handle correction.
- `feat/v6-ui-v35-ux-corrections@1ff6c61` — V3.5 UX corrections.
- `feat/v6-ui-v36-ograf-package-v2@de830d6` — V3.6 UI and OGraf Package Export V2.
- `feat/ograf-v21-spec-compliance@62ad6a7` — OGraf V2.1 compliance and import UX.
- `feat/ograf-host-compat-package@c2db6a4` — host format diff and QA handoff.
- `docs/kcs-current-state-consolidation@3ac1765` — current-state documentation.
- `docs/record-host-qa-pass@3a7eda3` — user host QA PASS and integration readiness docs.

## Intentionally separate branch

`chore/omp-kcs-config-optimization@50b42d4` remains separate. It is independent project tooling/configuration, not product runtime code. Its user-approved invariants remain:

- `memory.backend: mnemopi`.
- Model/provider mappings unchanged.
- Global OMP config unchanged.
- `.omp/backups/` preserved and ignored.

No OMP branch commit was merged into the product release candidate.

## Conflict summary

No conflicts occurred. The accepted branch line fast-forwarded from the integration base. Source files were not manually rewritten during consolidation.

## Post-integration checks

Required validation on this release candidate:

- `git diff --check`
- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run qa:v6`
- `CI=true npm run test:e2e`
- `node scripts/validate-ograf-manifest.mjs` against the generated QA manifests
- Manual target-host smoke using BASIC, COMPOSITING, and ASSET manifest-rooted folders

If a known Track Matte pixel-parity flake appears, rerun that exact test once in isolation and record both outcomes. Do not weaken tests or hide failures.

## Approval boundary

This branch is a release candidate, not a main merge. Manual release-candidate QA and explicit user approval are required before any `main` integration decision.
