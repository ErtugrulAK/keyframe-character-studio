# Progress 120 — Lottie Import Mapping Design (Milestone F, item 10)

## 1. Scope

Delivers the approved item-10 design scope: `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`. It is a **design document only** — no importer, no dependency, no runtime change. Implementation needs the design approval this document asks for, per the roadmap's interchange gate.

## 2. Branch

- Delivered in the same stacked Milestone F branch as items 11 and 12 (`fix/kcs-import-boundary-hardening`), so the Milestone F documentation merges as one unit; the design itself is self-contained and reviewers may take it independently.

## 3. What the design fixes

- **Three mapping kinds, no fourth option:** *lossless*, *lossy with report*, *unsupported, preserved*. A construct never becomes lossless by silence: anything dropped or approximated is at least reported.
- **Document, layer, shape, mask and matte mapping tables** — every canonical KCS field is tied to the Lottie construct that feeds it (`ks` transform, `sh`/`rc`/`el`/`sr`/`gr`/`fl`/`st`/`tm`/`mm`, `masksProperties`, `tt`/`td`, `parent`, `ip`/`op`, `st`), with precomps, effects, expressions, 3D/cameras, skew, auto-orient and repeaters marked *unsupported, preserved* for the first cut.
- **Temporal and easing conversion rules** — the document-level frame shift, the `fr` → `fps` rounding, and the segment-to-keyframe handle split: Lottie's `i`/`o` describe the segment, KCS's `bezierIn`/`bezierOut` describe the keyframe, so `keyframe[i].bezierOut ← o` and `keyframe[i+1].bezierIn ← i`; `h: 1` maps to the `hold` easing. Roving and expression-driven segments become `linear` **and** a report entry — never a silent approximation.
- **First-cut import limits** (masks per layer 8, keyframes per channel 512, hierarchy depth 32, path vertices 4096), each reported rather than silently reduced.
- **One diagnostics contract** reusing the existing export-diagnostic shape, with stable codes, the source document path (`layers[3].shapes[1].ef[0]`) and an actionable next step, shown **before** the import replaces the user's work.
- **Validation plan** — per-construct golden fixtures, round-trip fixtures for the lossless subset, limit tests, negative fixtures (cyclic parent, self-referencing matte, missing asset, unknown mask mode) that must report and continue rather than throw, and a UI smoke.

## 4. Validation of this deliverable

| Check | Result |
|---|---|
| Design covers the approved scope | yes — mapping tables, loss taxonomy, temporal rules, limits, diagnostics, validation plan |
| Claims about the canonical model are accurate | every referenced type and field exists at this revision (`BezierPath` v1, `TemporalHandle`, `LayerMask`, `TrackMatteV2`, `PropertyKeyframe.bezierIn/bezierOut`, `hold`, `applyEasing`, `maskPathChannels`, the path-safety authority) |
| Implementation | **none**, by design |
| Repository changes | documentation only |
| State consistency | `node scripts/check-state-consistency.mjs` PASS after the updates |

## 5. Protected invariants

- No source, test, script, dependency, `package.json`, lockfile or workflow change; the canonical model, channel semantics, OGraf package format and export paths are untouched.
- `docs/interop/V6_LOTTIE_MAPPING.md` remains the authority for the interop principle; this design does not contradict it and does not need to change it.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, OMP configuration and user folders are unchanged.

## 6. Open questions for the user

1. Precomps: confirm *unsupported, preserved* in the first cut (flattening would change timing).
2. Layer in/out (`ip`/`op`): confirm *reported, not converted*.
3. Limit defaults: confirm the numbers in the design, or set your own.
4. Report surface: confirm the report appears before replacement (recommended).
