# KCS V3.6 + OGraf Package Export V2

## Executive Summary

V3.6 implements the requested UI corrections and documents and hardens the OGraf Package Export V2 contract. The left editor toolbar now has parent-owned full-hide behavior with zero layout footprint and a reachable sibling handle. The hidden Inspector handle remains fully visible at the viewport edge. Trim Path controls use a compact three-column layout with narrow-container fallbacks. The OGraf work inventories the read-only reference corpus, verifies official OGraf requirements, defines a minimal KCS package contract, preserves the existing export path, and adds deterministic asset/path validation.

## User Feedback

Applied:

- Hide the left sidebar completely; do not leave a rail or blank strip.
- Keep the left handle usable at the far-left edge when hidden and at the sidebar edge when shown.
- Keep the hidden Inspector handle visible.
- Keep Trim Path Start, End, and Offset compact in the Inspector.
- Analyze the OGraf reference corpus without modifying it.
- Produce a minimal evidence-backed OGraf package export V2 spec.
- Preserve legacy export behavior and validate a complete synthetic package.

## Subagent Orchestration

Read-only research used the required specialist routes:

- Scout agents covered left-toolbar geometry, right-handle clipping, Trim Path container behavior, OGraf corpus inventory, OGraf file classification, and current exporter gaps.
- A designer-agent performed the final Track A review and reported PASS with no blockers.
- A reviewer-agent performed the final repository audit; its result is recorded in the delivery validation section.
- Implementation was split into UI corrections and OGraf export/compiler work with non-overlapping ownership.

## Track A: UI Corrections

### Left toolbar

`App.tsx` owns `isLeftToolbarVisible`. `LeftToolbar` receives `isHidden`; its internal visibility state and internal toggle were removed. The hide control is now a sibling in `.main-layout`, not a descendant of the dock. Hidden state applies `width`, `min-width`, and `flex-basis` zero, removes padding/borders from child panels, disables pointer and keyboard interaction with `aria-hidden` and `inert`, and leaves no rail footprint.

The sibling handle is positioned at the combined rail/drawer edge while shown and at `left: 0` with no negative translation while hidden. E2E assertions cover physical geometry, stage expansion, inaccessible hidden content, handle reachability, and restoration.

### Inspector handle

The hidden Inspector endpoint changed from a clipped half-outside position to `right: 0` with zero horizontal translation. The hidden control therefore remains fully visible inside the viewport. The Inspector now also exposes `aria-expanded`, `aria-controls`, and `inert` consistently with the left toolbar.

### Trim Path

Trim Path defaults to three equal compact columns. At container widths at or below 300px it falls back to two columns with Offset spanning the row; at or below 250px it uses one column. No domain, serialization, evaluation, or rendering authority changed.

### Browser evidence

Captured under `docs/design/after/v36/`:

- `left-shown.png`
- `left-hidden.png`
- `left-shown-handle.png`
- `right-hidden-handle.png`
- `right-shown.png`
- `trim-path-compact.png`
- `full-editor.png`

Visual verification used the running editor at a 1440x900 viewport; focused E2E coverage also exercises 900px and existing responsive paths. The requested 1920x1080 and 1366x768 browser paths are covered by the existing V6 viewport matrix and were not changed by the layout implementation.

## Track B: OGraf Reference and Package Export V2

### Corpus inventory

The read-only corpus at `C:\Users\ertugrul.ak\Desktop\ograf-graphics` was inspected without modification. Fifteen project folders were identified, with approximately eighty files and no archives or dependency-install tree. All fifteen manifests use the same official manifest shape. Manifest main variants are `graphic.mjs` in eleven projects, `main.js` in three, and `zd-lowerthird.mjs` in one.

Recurring families include minimal manifest-plus-main projects, ZD package bridges, Grafstage runtime/license examples, editor-generated exports, and upstream fixtures. UUID-style asset names recur in reference resources; no reference package establishes a universal archive or helper-folder naming rule.

### Sanitized representative trees

The sanitized trees and classification are recorded in `docs/research/KCS_OGRAF_PACKAGE_REFERENCE_ANALYSIS.md`. They distinguish:

- REQUIRED: manifest and declared main Web Component module.
- OPTIONAL: resources actually referenced by the main module.
- PROJECT-SPECIFIC: styles, helper modules, runtime adapters, licenses, and editor metadata.
- GENERATED: KCS `scene.kcs`, generated wrapper module, and copied resources.
- VENDOR: `v_zd` extension fields, not an official universal requirement.
- UNKNOWN: behavior requiring downstream runtime confirmation.

### Official OGraf requirements

The official OGraf specification was checked directly. The required manifest uses the `.ograf.json` suffix and includes `$schema`, `id`, `name`, `main`, `supportsRealTime`, and `supportsNonRealTime`. The declared JavaScript module must expose an HTMLElement/Web Component. Non-real-time support requires the appropriate scheduling methods. Vendor-specific fields use the `v_` prefix. The specification does not mandate a universal ZIP layout, helper tree, asset naming scheme, or package-manager metadata.

### Current KCS audit and gap matrix

The existing KCS path already compiles a scene, validates the generated module, plans resources, materializes a package tree, and creates a browser ZIP with fflate. V2 therefore extends the existing authorities instead of introducing a parallel exporter. The gap matrix identifies missing explicit UI actions, stricter manifest-main path validation, deterministic repeated-reference handling, collision-safe asset naming, and clearer downstream package evidence. It does not treat optional vendor/runtime trees as required gaps.

### V2 package contract

`docs/design/KCS_OGRAF_PACKAGE_EXPORT_V2_SPEC.md` defines the minimal contract:

```text
<sanitized-graphic-name>-ograf.zip
├── <sanitized-graphic-name>.ograf.json
├── graphic.mjs
├── scene.kcs
└── assets/{images,fonts only when present}
```

All internal references are package-relative. Names are sanitized and collision-safe. No generic `package.json`, `index.html`, helper runtime, vendor directory, or unreferenced resource is invented. Browser output remains a ZIP because the existing downstream path consumes ZIP bytes; the contract is the folder tree represented inside the ZIP.

### Implementation

Header Export now exposes explicit `OGraf Package` and `OGraf Single File (Legacy)` actions while retaining JSON export. Both OGraf actions route through the existing deterministic browser package writer so the established legacy behavior is preserved rather than replaced by an unverified alternate format.

The compiler now rejects unsafe manifest main paths before file generation and normalizes safe package-relative paths. Asset planning deduplicates repeated references to the same source, preserves distinct collisions deterministically with stable hash suffixes, and continues to block missing or external assets when portability is required.

### Assets and fonts

Local image assets are materialized under package-relative paths. Missing and external assets remain blocked under the existing portable-assets policy. Font packaging follows the existing asset catalog authority and is included only when a catalogued local font is present; no synthetic font fallback is introduced.

### Masks, track matte, and animations

The export work does not alter the existing scene compiler, mask renderer, track-matte model, or animation evaluation authority. Those capabilities remain serialized through the existing `scene.kcs` and generated module path. Downstream OGraf runtime compatibility for project-specific mask/track-matte semantics remains a user QA item rather than an invented claim.

### Security and compatibility

Manifest main paths are rejected when absolute, traversal-based, or otherwise unsafe. Asset paths are sanitized and collision-safe. No new dependency was added. Existing JSON export and established package materialization/browser ZIP behavior remain available.

### Generated package validation

The OGraf package tests create complete temporary synthetic packages, materialize manifest, `graphic.mjs`, `scene.kcs`, and local image assets, read the generated files back, verify manifest content, verify generated module content, check deterministic output, test repeated-reference deduplication, test collision suffixes, reject unsafe main paths, and block missing/external assets. Browser tests exercise the `OGraf Package` menu action and ZIP path.

## Verification

Final focused verification after the blocker fixes:

- TypeScript: PASS (`npx tsc --noEmit`).
- Lint: PASS; one pre-existing Fast Refresh warning remains in `src/context/AnimatorContext.tsx`.
- Full Vitest: PASS, 100 files / 1432 tests.
- Production build: PASS; Vite emitted only the existing chunk-size warning.
- V6 QA: PASS, 3 tests.
- Focused Playwright: PASS, 4 tests for left toolbar and Trim Path.
- OGraf browser export E2E: PASS, 1 test.
- Full Playwright: 253 passed, 1 existing flaky Track Matte pixel-parity test in the final run. The same test passed in an isolated no-retry Chromium rerun; no V3.6 UI/OGraf test failed.
- `git diff --check`: PASS; Git reported only normal LF-to-CRLF working-copy warnings.

Final reviewer verdict: PASS/APPROVE with zero blockers. The reviewer recommends future permanent tests for hostile font DOM, configured absolute asset paths, and default asset-tree boundaries; these are non-blocking because source-level and one-off behavior checks passed.

## Files Changed

- `src/App.tsx`
- `src/components/Toolbar/LeftToolbar.tsx`
- `src/components/Toolbar/LeftToolbar.css`
- `src/components/Inspector/PropertyInspector.tsx`
- `src/components/Inspector/PropertyInspector.css`
- `src/components/Header/HeaderBar.tsx`
- `src/ograf/compiler.ts`
- `src/ograf/packageCompiler.ts`
- `src/ograf/types.ts`
- Focused Vitest and Playwright tests for UI and OGraf export
- `docs/research/KCS_OGRAF_PACKAGE_REFERENCE_ANALYSIS.md`
- `docs/design/KCS_OGRAF_PACKAGE_EXPORT_V2_SPEC.md`
- `docs/design/after/v36/*.png`

## DO NOT CHANGE CASUALLY

- Do not modify the read-only OGraf reference corpus.
- Do not reintroduce child-owned left toolbar visibility state.
- Do not move either sibling handle back inside a collapsible dock.
- Do not replace package-relative sanitization or deterministic collision handling with ad hoc filenames.
- Do not add optional vendor/runtime trees as universal OGraf requirements.
- Do not remove the existing JSON or legacy-compatible export action.
- Do not bypass portable asset validation with fallback bytes or arbitrary retries.

## Lessons Learned

- The layout owner must own dock visibility when a dock must relinquish every layout pixel.
- A handle positioned with a negative translation can be clipped by an overflow-hidden layout; endpoint visibility must be asserted by physical geometry.
- Reference corpus frequency is not proof of an official OGraf requirement; official specification evidence and local downstream convention must remain separate.
- Deterministic package paths require both repeated-reference deduplication and explicit collision handling.
