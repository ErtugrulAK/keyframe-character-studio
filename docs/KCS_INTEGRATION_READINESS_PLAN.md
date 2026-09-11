# KCS Integration Readiness Plan

## Current decision

The accepted product and documentation line has been consolidated into `integration/v6-ui-ograf-release-candidate` from `integration/v6-ui-stable@0289402` through a fast-forward to `docs/record-host-qa-pass@3a7eda3`.

Execution details are recorded in `docs/KCS_INTEGRATION_EXECUTION_PLAN.md`. This is not a merge to `main`; no main integration action is authorized yet.

## Host QA

User-provided target host/downstream QA is PASS:

- BASIC: PLAY moves the text slightly right.
- ASSET: portable image appears after a short delay.
- COMPOSITING: rectangle/color transition renders.

The confirmed import unit is the manifest-rooted folder. KCS Import remains separate.

## Included line

V3.4.1 → V3.5 → V3.6/OGraf Package V2 → OGraf V2.1/import UX → host compatibility → current-state docs → host QA PASS docs.

The OMP tooling branch remains separate because it affects project tooling, not product runtime code.

## Current gate

1. Run full release-candidate validation.
2. Perform manual host smoke using BASIC, COMPOSITING, and ASSET.
3. Review warnings/flakes and `reports/progress_051.md`.
4. Request explicit user release approval.
5. Only then consider a separately approved main integration operation.

## Invariants

- `main` remains untouched.
- `memory.backend: mnemopi` remains unchanged.
- Model/provider mappings and global configuration remain unchanged.
- `.omp/backups/` remains preserved and ignored.
- Historical reports and QA folders remain preserved.
