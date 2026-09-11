# KCS Current State

## Executive summary

KCS has completed the V3.4.1, V3.5, and V3.6 UI milestones, OGraf V2.1 compliance, OGraf import UX classification, and the host-compatibility QA handoff. The official hosted OGraf Devtool PASS for BASIC, COMPOSITING, and ASSET is current milestone context. The remaining external check is user testing in the real target host/downstream application.

The project remains intentionally conservative: official OGraf standard export is separate from host QA, KCS Import is not an OGraf package importer, global OMP configuration is unchanged, model mappings are frozen, and project memory remains `mnemopi`.

## UI milestones

### V3.4.1

Branch `feat/v6-ui-v34-control-cleanup`, known head `eba9895`. Finalized shared left/right sidebar handle geometry, mirrored Chevron icons, edge positioning, focus behavior, and real-browser parity. Main remained untouched.

### V3.5

Branch `feat/v6-ui-v35-ux-corrections`, known head `1ff6c61`. Delivered pan-only Reset View, in-flow sidebar collapse, Free Draw Enter finalization, inspector and text/effects cleanup, shared neutral shape icons, semantic dark-editor tokens, and compact Trim Path controls. Functional animation, serialization, evaluation, and timing authorities were preserved.

### V3.6

Branch `feat/v6-ui-v36-ograf-package-v2`, known head `de830d6`. Completed the V3.6 UI corrections and OGraf Package Export V2 contract. Existing package compiler, writer, ZIP, and legacy export authorities remain canonical.

## OGraf milestones

### V2 / Package Export V2

The package contract is a minimal manifest-rooted tree: `.ograf.json` manifest, declared `graphic.mjs`, `scene.kcs`, and referenced `assets/` resources only. Paths are package-relative, sanitized, deterministic, and guarded against traversal and external resources.

### V2.1 compliance

Branch `feat/ograf-v21-spec-compliance` at `62ad6a7`. Live EBU schema validation, runtime action compliance, strict package paths, asset catalog preservation, font portability diagnostics, and downstream BASIC/COMPOSITING/ASSET outputs are complete.

### Import UX

Report `progress_048.md` records the compatible KCS Import behavior: OGraf manifest/package inputs receive an actionable explanation instead of being parsed as KCS SceneData. `.kcs` and existing KCS JSON imports remain unchanged. Full OGraf package-to-editable-KCS conversion is not implemented.

### Host compatibility

Branch `feat/ograf-host-compat-package` at `c2db6a4`. Corpus evidence and hosted Devtool behavior establish the manifest-rooted folder as the import unit. Host QA copies are at `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa` with BASIC, COMPOSITING, and ASSET folders. The target host application result remains user QA pending.

## OMP configuration optimization

Branch `chore/omp-kcs-config-optimization` at `50b42d4`. Project-local task routing, isolation, concurrency limits, compaction, branch summaries, and destructive-command deny rules are documented and committed. The global config and model/provider mappings were not changed. `memory.backend: mnemopi` is an intentional user-approved setting and must remain enabled. `.omp/backups/` is preserved and ignored.

## Current QA folders

- Host QA: `C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa`
  - `BASIC/`
  - `COMPOSITING/`
  - `ASSET/`
  - `README_HOST_COMPAT_QA_TR.txt`
- Downstream reference handoff: `C:\Users\ertugrul.ak\Desktop\kcs-ograf-downstream-qa`
- Read-only corpus: `C:\Users\ertugrul.ak\Desktop\ograf-graphics`

Select the individual host QA package folder, beginning with BASIC. Do not use KCS Import.

## Current known limitations

- Real target host/downstream app QA has not been recorded in this repository.
- OGraf Package → editable KCS import is intentionally not started.
- Native hosted Devtool picker automation is not a CLI/headless workflow; prior reports preserve that limitation.
- Windows case/device-name hardening remains technical debt.
- Unowned system fonts remain blocked when portable font bytes are unavailable; no fake font is bundled.
- The official Simple Rendering System was not run.

## Open tasklist

See `docs/KCS_OPEN_TASKS.md`. P0 is external host QA. No new implementation should begin before that result is known.

## Recommended next order

1. User tests BASIC in the target host/downstream app.
2. User tests COMPOSITING, then ASSET.
3. Record exact failures and reference-project comparison if any package is rejected.
4. Decide whether host compatibility is complete or requires evidence-backed investigation.
5. Only after explicit approval, plan branch consolidation and the separate editable OGraf import design.
6. Handle non-blocking Windows hardening, font UX, and release checkpoint work afterward.
