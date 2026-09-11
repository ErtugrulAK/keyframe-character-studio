# KCS Integration Readiness Plan

## Purpose and gate

This document plans integration only. It does not merge branches or modify `main`. No integration action should happen until the user explicitly approves the plan.

## Accepted milestones

- V3.4.1 UI handle correction — `feat/v6-ui-v34-control-cleanup@eba9895`.
- V3.5 UX corrections — `feat/v6-ui-v35-ux-corrections@1ff6c61`.
- V3.6 UI and OGraf Package Export V2 — `feat/v6-ui-v36-ograf-package-v2@de830d6`.
- OGraf V2.1 compliance and import UX — `feat/ograf-v21-spec-compliance@62ad6a7`.
- Host compatibility handoff — `feat/ograf-host-compat-package@c2db6a4`.
- OMP project-local optimization — `chore/omp-kcs-config-optimization@50b42d4`, tooling-only and independent from product code.
- Current-state documentation — `docs/kcs-current-state-consolidation@3ac1765`.

## User host QA evidence

The user tested the target host/downstream application, not KCS Import:

- BASIC: PASS; PLAY moves the text slightly to the right.
- ASSET: PASS; the portable image appears after a short delay.
- COMPOSITING: PASS; a rectangle transitions from red/pink toward white, resembling loading/fade behavior.

The target host accepts the manifest-rooted folder handoff. QA source:

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa`

The official OGraf standard contract remains separate from host compatibility, and no exporter change is justified by these results.

## Branch graph and lineage

Known lineage:

```text
main@8024d4f
└── integration/v6-ui-stable@0289402
    └── feat/v6-ui-v34-control-cleanup@eba9895
        └── feat/v6-ui-v35-ux-corrections@1ff6c61
            └── feat/v6-ui-v36-ograf-package-v2@de830d6
                └── feat/ograf-v21-spec-compliance@62ad6a7
                    └── feat/ograf-host-compat-package@c2db6a4
                        └── docs/kcs-current-state-consolidation@3ac1765
                            └── docs/record-host-qa-pass (current)
```

This is a documented working lineage, not a merge result. Verify ancestry and diffs again immediately before any approved integration operation.

`chore/omp-kcs-config-optimization@50b42d4` is an independent tooling branch. It changes project-local `.omp` policy and must not be treated as product-code integration.

## Candidate order

If the user approves integration, use this order and validate after each logical boundary:

1. Integrate V3.4.1 UI corrections into the selected integration line.
2. Integrate V3.5 UX corrections.
3. Integrate V3.6 UI and OGraf Package Export V2.
4. Integrate OGraf V2.1 compliance and import UX.
5. Integrate host-compatibility documentation/handoff.
6. Integrate current-state documentation as documentation-only history.
7. Keep OMP tooling changes separate unless the user explicitly requests tooling integration.

Prefer fast-forward or cherry-pick only when ancestry inspection proves it is safe. Do not assume branch names imply linear descendants. If a branch is already represented in the selected base, do not duplicate its commits.

## Merge versus cherry-pick guidance

- **Merge:** suitable when preserving a branch's complete ancestry is desired and the target integration branch is intentionally receiving the full line.
- **Cherry-pick:** suitable for isolated, reviewed commits when the target already contains unrelated work or when a narrow delivery is required.
- **Documentation branches:** treat as documentation candidates, not product implementation branches.
- **OMP branch:** keep separate by default because it affects tooling, not runtime product behavior.

No choice is authorized by this document; the user must approve the selected strategy.

## Risks

- `main` is an older baseline at `8024d4f`; it is protected and must remain untouched.
- Branch heads may be non-linear despite similar feature names; verify merge-base and commit ancestry.
- The docs consolidation branch is based on the host-compat branch, so documentation commits may include host-handoff ancestry if merged wholesale.
- The OMP configuration branch is independent and changes project tooling policy rather than product code.
- Historical reports contain pending wording from earlier checkpoints; preserve them and use current-state docs for the later user-provided PASS.
- OGraf standard export, KCS Import, and target host import are distinct contracts; do not conflate them during integration.
- The host QA evidence is external/user-provided; retain the exact observations without inventing screenshot paths.

## Required validation after approved integration

Run the complete relevant validation set after integration:

- `npx tsc --noEmit`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run qa:v6`
- `CI=true npm run test:e2e`
- `node scripts/validate-ograf-manifest.mjs <generated manifests>`
- `git diff --check`
- Manual smoke: target host still imports the manifest-rooted BASIC, COMPOSITING, and ASSET folders.

Also verify `memory.backend: mnemopi`, model mappings, provider selections, global configuration, `.omp/backups/`, and `main` invariants after any approved operation.

## Current recommendation

The repository is ready for an explicit integration decision. Until approval arrives, keep the current branch pushed and clean, do not merge, do not modify `main`, and wait for the user's chosen integration target and strategy.
