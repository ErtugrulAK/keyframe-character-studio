# KCS Development Report — OGraf Host Compatibility Package

## Executive Summary

The official hosted OGraf Devtool already passed the BASIC, COMPOSITING, and ASSET packages. This milestone resolved the remaining import-unit question without weakening OGraf compliance: the target host import unit is a manifest-rooted folder, not KCS Import, a standalone JavaScript file, or an invented descriptor.

Clean host QA copies were generated outside the repository at `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa`. The copies contain only the extracted KCS package folders and a Turkish test handoff. ZIPs were not promoted as host variants because the hosted Devtool uses a directory picker and the existing sibling ZIPs are stale relative to the extracted packages.

## Starting state

- Starting branch: `feat/ograf-v21-spec-compliance` at `62ad6a7`.
- New branch: `feat/ograf-host-compat-package`.
- Working tree was clean before branch creation.
- `omp config get memory.backend` returned `mnemopi`.
- `.omp/backups/` remained present and was not deleted.
- `main` remained unchanged.

## Official Devtool and KCS Import context

- Official hosted OGraf Devtool: PASS for BASIC, COMPOSITING, and ASSET.
- The standard OGraf package is therefore not known-invalid.
- The Devtool is the target host surface; KCS Import is a separate KCS project importer.
- The prior KCS Import UX correction remains preserved: `.ograf.json` and `.zip` inputs receive an actionable OGraf message instead of being parsed as KCS SceneData.
- This milestone keeps two concepts separate: the OGraf Standard Package and the host-compatible folder QA profile.

## Reference corpus analysis

Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.

Analyzed representative projects included `ograf-logo`, `l3rd-name`, `weather-current`, `sports-scorebug`, `score-stats`, `AXIOM-News`, `News Lower Third`, `LT_Test-ograf`, and `v3-toblerone`.

Observed evidence:

- 15 project folders and 16 `.ograf.json` manifests.
- Manifest filenames vary, but each manifest is beside its declared `main` module.
- `main` is authoritative and single-segment; observed values include `graphic.mjs`, `main.js`, and `zd-lowerthird.mjs`.
- Sibling modules, styles, libraries, and assets resolve from `import.meta.url`, `import.meta.resolve`, or an equivalent package base.
- Editor exports require package-relative `assets/` resources.
- Grafstage runtime rejects assets escaping the package base.
- No universal `package.json`, `project.json`, build folder, output folder, or ZIP convention exists in the reference corpus.
- Host-specific metadata, when present, is namespaced under `v_` fields.
- `l3rd-name` provides a precedent for separate manifests over one implementation without changing the official runtime contract.

The read-only corpus was not modified, copied into the repository, or committed.

## KCS package inventory

The extracted downstream QA packages are:

```text
basic/        kcs-basic-graphic.ograf.json + graphic.mjs + scene.kcs
compositing/  kcs-compositing-graphic.ograf.json + graphic.mjs + scene.kcs
asset/        kcs-asset-graphic.ograf.json + graphic.mjs + scene.kcs + assets/images/logo.png
```

All three extracted manifests passed the live OGraf schema validator. The extracted folders are the correct QA source for this milestone. The sibling ZIPs are older artifacts: runtime defaults and scene/manifest fingerprints differ from the folders, and the ASSET ZIP contains a four-byte invalid PNG while the extracted ASSET folder contains the valid 68-byte image.

## Format diff and host import-unit conclusion

Full evidence and gap matrix: `docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md`.

Conclusion: **manifest-rooted folder, HIGH confidence**.

The hosted Devtool uses a browser directory picker and scans the selected tree for manifests. ZIP is transport only and must be extracted first. The operator must select the folder containing the `.ograf.json` manifest and its declared `main` file. No descriptor or wrapper-directory variant was invented because the corpus provides no evidence for either.

## Implementation / generated variants

No new source exporter was added. The canonical `src/ograf/packageCompiler.ts` and `src/ograf/packageWriter.ts` already produce the required folder tree, and adding a guessed host wrapper would risk the official contract.

Generated outside the repository:

```text
C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\
├── README_HOST_COMPAT_QA_TR.txt
├── BASIC/
├── COMPOSITING/
└── ASSET/
```

Each package is a clean copy of the corresponding extracted downstream folder. The QA root has no orphan diagnostic JSON and no proprietary reference assets.

## Turkish README

`README_HOST_COMPAT_QA_TR.txt` states:

- “Devtool geçti; bu test host uygulama uyumluluğu içindir.”
- “KCS Import ile test etme; host/downstream app ile test et.”
- The exact BASIC path to try first.
- Folder selection is required; ZIP, descriptor, and standalone manifest selection are not the first test.
- Test order is BASIC → COMPOSITING → ASSET.
- Failure evidence must include selected path, exact error, screenshot, and whether a known-working reference project imports in the same app.

## Tests and verification

- Manifest validation: PASS, 3/3 manifests valid OGraf v1.
- TypeScript: PASS (`npx tsc --noEmit`).
- Lint: PASS; one pre-existing `AnimatorContext.tsx` Fast Refresh warning.
- Vitest: PASS, 100 files / 1,435 tests.
- Build: PASS; existing Vite chunk-size warning only.
- V6 QA: PASS, 3/3 tests.
- Full Playwright: PASS, 254/254 tests.
- `git diff --check`: PASS.

No new permanent test was required: no production source or exporter behavior changed. The generated artifact check and live manifest validation cover the new QA output.

## Reviewer findings

Independent reviewer-agent review: PASS with zero blockers. No source, model mapping, global configuration, main branch, or read-only corpus changes were identified.

## Git summary

- Base: `feat/ograf-v21-spec-compliance` at `62ad6a7`.
- Branch: `feat/ograf-host-compat-package`.
- Tracked changes: `.gitignore`, `docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md`, and this report.
- `.omp/backups/` remains outside Git and is ignored by `.gitignore`.
- The external QA folder is not committed.
- `memory.backend` remains `mnemopi`.
- `main` was not modified.

## User next action

Open the target host/downstream application and select:

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\BASIC`

Select the folder itself. Then test COMPOSITING and ASSET in that order. If the host rejects a package, return the selected path, exact application error, screenshot, and whether a known-working reference project imports in the same application.

## Status

READY FOR HOST-COMPATIBILITY USER QA.
