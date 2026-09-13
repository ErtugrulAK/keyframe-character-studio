# Desktop KCS Folder Inventory

Inventory root: `C:\Users\senmu\Masaüstü\KCS`

Inventory scope: read-only audit before cleanup. No files were moved or deleted during inventory.

## Summary

- Top-level folders: 5.
- Directories: 54.
- Files: 138.
- No repository checkout was found inside the inventory root.
- No screenshots, report files, secrets, or obvious cache/log directories were found by name.
- The `ograf-graphics` folder is a copied graphics corpus and remains protected from cleanup.

## File counts by extension

| Extension | Count |
|---|---:|
| `.mjs` | 35 |
| `.json` | 34 |
| `.txt` | 20 |
| `.js` | 12 |
| `.kcs` | 12 |
| `.css` | 8 |
| `.png` | 5 |
| `.svg` | 5 |
| `.md` | 2 |
| `.zip` | 3 |
| `.ttf` | 1 |
| no extension | 1 |
| **Total** | **138** |

## Folder tree summary

- `kcs-ograf-public-controls-qa/`
  - Current public-controls downstream package root.
  - `BASIC/`, `ASSET/`, and `COMPOSITING/` manifest-rooted import units.
  - Turkish QA instructions.
  - ASSET contains both packaged image choices.
- `kcs-ograf-public-controls-qa.before-fix-20260913-152710/`
  - Pre-fix generated public-controls backup.
  - Same BASIC and COMPOSITING runtime payloads as the current folder; ASSET lacks the post-fix alternate-image behavior.
- `kcs-ograf-host-compat-qa/`
  - Earlier host-compatibility QA package set with BASIC, ASSET, and COMPOSITING units.
- `kcs-ograf-downstream-qa/`
  - Earlier downstream QA package set with extracted folders, three ZIPs, README, and `font-blocked-diagnostics.json`.
- `ograf-graphics/`
  - Multi-project copied OGraf graphics corpus with runtime bundles, source files, assets, fonts, and licenses.
  - It contains 13 visible project directories in the top-level tree and is not a generated duplicate of the public-controls QA set.

## Large files

Largest observed files:

1. `ograf-graphics/grafstage-logo-bug/runtime/texture-Hrifks8d.js` — 857,804 bytes.
2. `ograf-graphics/v3-toblerone/runtime/texture-DbP1huqF.js` — 827,561 bytes.
3. `ograf-graphics/Yuri/main.js` — 696,340 bytes.
4. `ograf-graphics/grafstage-logo-bug/runtime/three.webgpu-DaP15wGy.js` — 693,844 bytes.
5. `ograf-graphics/grafstage-logo-bug/runtime/document-graphic.mjs` — 524,322 bytes.
6. `ograf-graphics/v3-toblerone/runtime/document-graphic.mjs` — 523,164 bytes.

These are runtime assets, not safe cleanup candidates.

## Duplicate-looking content

Exact-content duplicate groups were found across generated QA and corpus folders. Examples:

- `kcs-ograf-public-controls-qa.before-fix-20260913-152710/BASIC/scene.kcs` and current `BASIC/scene.kcs`.
- Pre-fix/current BASIC and COMPOSITING `graphic.mjs` files.
- Downstream and host-compat BASIC/ASSET/COMPOSITING runtime and manifest files.
- Shared `assets/images/logo.png` across downstream, host-compat, current, and pre-fix public-controls folders.
- Repeated third-party license files under two corpus projects.

The duplicate bytes are generated or shared assets, but their containing folders are separate QA evidence sets. Only the explicitly named pre-fix public-controls folder has high-confidence stale-backup status.

## ZIPs, prompts, copied docs, screenshots, and reports

- ZIPs: three downstream packages under `kcs-ograf-downstream-qa/`.
- Prompt/instruction text: four QA README/TXT files; no standalone prompt transcript file was found.
- Markdown: two project READMEs under `ograf-graphics/l3rd-name/` and `ograf-graphics/ograf-logo/`.
- Screenshots: none found by extension/name in this folder.
- Reports: no report file found by extension/name; repo reports remain the audit trail.
- Diagnostics: `kcs-ograf-downstream-qa/font-blocked-diagnostics.json` is unique evidence and must be preserved.

## Git and reproducibility

- The desktop folder itself is not a Git checkout and is not represented as one tracked directory.
- Public-controls source, compiler logic, validation scripts, and historical reports are represented in the repository. The current public-controls QA package can be reproduced with the repository generation scripts.
- The downstream ZIPs and extracted QA folders are generated artifacts; their source decisions are represented in repository reports and scripts, but exact file bytes are local evidence.
- `ograf-graphics` is a copied read-only corpus and is not reproducible from this repository. Preserve it without modification.

## Classification

### KEEP

- `kcs-ograf-public-controls-qa/` — current QA folder; user confirmed BASIC, ASSET, and COMPOSITING PASS.
- `kcs-ograf-host-compat-qa/` — prior host compatibility evidence; not replaced by the public-controls pass.
- `kcs-ograf-downstream-qa/` — unique downstream ZIP and font-blocked diagnostic evidence.
- `ograf-graphics/` — protected copied corpus, runtime assets, and licenses.
- All unique assets, fonts, and evidence files inside the above folders.

### ARCHIVE

- `kcs-ograf-public-controls-qa.before-fix-20260913-152710/` — stale pre-fix generated backup. It will be moved, not permanently deleted, preserving its relative folder and contents.

### DELETE CANDIDATE

- No permanent-delete candidate approved. Exact duplicates inside retained QA folders are not removed because their folder context is evidence.

### DO NOT TOUCH

- `ograf-graphics/`.
- Host-compat and downstream folders until a separate retention decision is made.
- Configuration backups, secrets, or any item whose provenance is uncertain.
