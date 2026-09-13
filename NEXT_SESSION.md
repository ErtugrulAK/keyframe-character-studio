# Next Session Handoff

## Repository and branch

Repository:

`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`

Checkout:

`feat/ograf-public-controls-v1`

Base:

`integration/v6-ui-ograf-release-candidate@4e4c269`

## Guardrails

- Do not touch or merge to `main`.
- Do not reset hard, force push, delete branches, reports, QA folders, or `.omp/backups/`.
- Do not modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/config.yml` `memory.backend: mnemopi`.
- Do not change model roles, provider mappings, or global configuration.
- Keep the release-candidate and OMP tooling branches separate.

## First task

Perform the second manual public-controls host QA using:

1. `C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa\BASIC`
2. `C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa\ASSET`
3. `C:\Users\senmu\Masaüstü\kcs-ograf-public-controls-qa\COMPOSITING`

Follow `README_PUBLIC_CONTROLS_QA_TR.txt`. Record the exact host field, changed value, render result, and any error or screenshot.

## Expected checks

- BASIC: change `Headline`; PLAY keeps the text update and motion.
- ASSET: open `Logo`; switch from `assets/images/logo.png` to `assets/images/logo_alt.svg`; the visible image must change.
- COMPOSITING: change `Content Fill Color` to `#00ff00` and `Content Stroke Color` to `#0000ff`; confirm color changes and preserved animation.

## Approval boundary

After manual QA, request explicit release approval. Do not merge `main` without separate explicit approval.
