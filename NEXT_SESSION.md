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

Perform manual public-controls host QA using:

1. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa\BASIC`
2. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa\ASSET`
3. `C:\Users\ertugrul.ak\Desktop\kcs-ograf-public-controls-qa\COMPOSITING`

Follow `README_PUBLIC_CONTROLS_QA_TR.txt`. Record the exact host field, changed value, render result, and any error or screenshot.

## Expected checks

- BASIC: change `Headline`; PLAY keeps the text update and motion.
- ASSET: inspect `Logo`; switch packaged image choices if more than one is present, otherwise confirm the one default option.
- COMPOSITING: change `Content Fill Color`; confirm color change and preserved animation.

## Approval boundary

After manual QA, request explicit release approval. Do not merge `main` without separate explicit approval.
