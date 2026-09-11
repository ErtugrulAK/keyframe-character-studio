# Next Session Handoff

## Repository and branch

Repository:

`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`

Checkout:

`docs/kcs-current-state-consolidation`

This branch is documentation-only and must not be replaced with `main`.

## Guardrails

- Do not touch `main`.
- Do not delete or rewrite old reports.
- Do not modify the read-only corpus at `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Keep `.omp/backups/` present and ignored.
- Keep `.omp/config.yml` `memory.backend: mnemopi`.
- Do not change model roles, provider mappings, or global configuration.
- Do not start OGraf host implementation before the host QA result is known.

## First task

If the user has already tested the host QA folder, collect and classify the BASIC, COMPOSITING, and ASSET results. If the result is unknown, ask the user to test the BASIC folder first:

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\BASIC`

The user must select the folder itself in the target host/downstream app, not KCS Import, not a standalone manifest, and not a ZIP.

## Exact question when the result is unknown

“Target host uygulamasında şu klasörü seçerek BASIC testini yaptın mı: `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\BASIC`? Sonuç PASS/FAIL nedir? FAIL ise seçilen tam yolu, uygulamanın verdiği tam hata metnini, ekran görüntüsünü ve aynı uygulamada bilinen çalışan `ograf-graphics` referans projesinin import olup olmadığını paylaş.”

## Decision boundary

- All three pass: plan branch consolidation/integration only after explicit approval.
- Any failure: preserve the exact evidence and investigate the host contract without weakening official OGraf compliance.
- No result: remain in QA handoff; do not add a guessed exporter or wrapper format.
