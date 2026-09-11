# Next Session Handoff

## Repository and branch

Repository:

`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`

Checkout:

`integration/v6-ui-ograf-release-candidate`

## Guardrails

- Do not touch or merge to `main`.
- Do not reset hard, force push, delete branches, reports, QA folders, or `.omp/backups/`.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml` `memory.backend: mnemopi`.
- Do not change model roles, provider mappings, or global configuration.
- Keep `chore/omp-kcs-config-optimization` separate unless explicitly approved.

## First task

Read `docs/KCS_INTEGRATION_EXECUTION_PLAN.md` and `reports/progress_051.md`. Full automated release-candidate validation is PASS. Perform the manual host smoke with the existing manifest-rooted folders:

1. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\BASIC`
2. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\COMPOSITING`
3. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\ASSET`

## Current host QA

User-provided target-host results remain PASS:

- BASIC: text moves slightly right on PLAY.
- ASSET: portable image appears after a short delay.
- COMPOSITING: rectangle/color transition renders.

The import unit is the manifest-rooted folder. KCS Import is not the host QA surface.

## Approval boundary

After manual release-candidate smoke, ask the user for a release decision. No merge to `main` is allowed without separate explicit approval.
