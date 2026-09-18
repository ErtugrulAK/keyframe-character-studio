# KCS OGraf QA Study — Offline Schema Closure (item 7) and Downstream Folder QA (item 8)

Milestone E of `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`. This document is a **study and plan**: item 7 delivers findings and options only, and neither item is implemented here. Every implementation step below states the approval it needs first.

## 1. Why this milestone exists

- **Item 7 (offline schema closure).** `npm run validate:ograf` validates a manifest against the live EBU OGraf schema closure. If the network or the host is unavailable, validation cannot run at all, and CI does not invoke it — so the deterministic guard the project already pays for is not exercised automatically. The open question was a licensing/size decision before anything is vendored.
- **Item 8 (downstream folder QA automation).** The host format evidence says the import unit is a *folder* containing a manifest-rooted graphic (`docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md:165`), and that no new exporter or fake host wrapper is justified (`:180`). The clean-folder QA copies produced so far were made by hand, so the check is neither repeatable nor reviewable.

## 2. Item 7 — current behaviour (measured, not assumed)

`scripts/validate-ograf-manifest.mjs`:

- Fetches **8** documents at validation time: the OGraf graphics schema plus `lib/action.json`, `gdd/object.json`, `gdd/gdd-types.json`, `gdd/basic-types.json`, `lib/constraints/number.json`, `lib/constraints/boolean.json`, and the JSON Schema 2020-12 meta-schema.
- **Pins every one of them by SHA-256** in `schemaHashes` and throws on an unpinned reference (`Unpinned remote schema reference`) or a digest mismatch (`Schema hash mismatch`). The fail-closed contract is the pin check, and it must not weaken.
- Compiles with Ajv 2020 (`strict: false`) through `loadSchema`, so `$ref` resolution re-enters the same pinned fetch path.

Measured on 2026-09-18 (read-only fetch, hashes compared against the pins in the script):

| Document | Bytes | Pin still matches |
|---|---|---|
| `graphics/schema.json` | 14,553 | yes |
| `gdd/gdd-types.json` | 9,370 | yes |
| `json-schema.org` 2020-12 meta-schema | 2,452 | yes |
| `gdd/basic-types.json` | 2,178 | yes |
| `lib/constraints/number.json` | 1,446 | yes |
| `lib/action.json` | 1,417 | yes |
| `gdd/object.json` | 1,200 | yes |
| `lib/constraints/boolean.json` | 951 | yes |
| **Total** | **33,567 B ≈ 32.8 KiB** | 8/8 |

Licensing (checked, with the caveat that the final call is the user's):

- `ebu/ograf` is **MIT** (`api.github.com/repos/ebu/ograf` → `license.spdx_id = MIT`). Redistribution is permitted with the copyright and permission notice retained.
- The JSON Schema 2020-12 meta-schema comes from `json-schema-org/json-schema-spec`, whose `LICENSE` is a BSD-style "JSON Schema Specification Authors" notice that also requires the notice be retained on redistribution.
- Consequence: vendoring the closure is **legally viable if the vendored files ship with those two notices**. The size cost is ~33 KiB of source text, which is negligible against the 382 kB application chunk.

### 2.1 Options

| # | Option | Effect | Cost / risk | Approval needed |
|---|---|---|---|---|
| 7-A | **Vendor the closure + offline mode** — commit the 8 documents under `fixtures/ograf/schema/` with a `NOTICE.md` carrying both upstream notices, and make the validator resolve pinned URLs from that local map first, fetching only if `--online` is passed | `validate:ograf` runs offline and deterministically; `$ref` resolution stays inside the pinned set; pins keep failing closed on any local edit | ~33 KiB added to the repo; a schema refresh becomes a deliberate, reviewable commit | **User approval** (licensing/redistribution + new committed artifacts) |
| 7-B | **Controlled local cache** — keep fetching, but cache into a gitignored `.cache/ograf-schema/` verified by the same pins | Offline after the first successful run; nothing redistributed | Cache is per-machine, so CI still needs the network or a warm cache; the failure mode returns on a cold runner | User approval (cache location/policy) |
| 7-C | **Status quo** — live-only validation, CI keeps ignoring it | No repo change | The deterministic guard stays unexercised in automation; a network outage looks like a validation failure | none (do nothing) |

**Recommendation: 7-A**, because the closure is tiny, the licences permit it with notices, and it is the only option that makes the guard deterministic in CI. 7-B is the fallback if the user prefers not to redistribute upstream text.

### 2.2 Validation plan for whichever option is approved

1. `npm run validate:ograf` must print the same verdict for `fixtures/ograf/minimal.ograf.json` with the network disabled (`--offline`, or by asserting the local map is used).
2. Negative controls must still fail closed: (a) an unpinned `$ref` in a fixture copy → `Unpinned remote schema reference`; (b) one byte changed in a vendored document → `Schema hash mismatch`; (c) an invalid manifest → the existing `invalid OGraf v1 manifest` path. Each becomes a focused test beside the current validator tests.
3. CI wiring is a **separate** decision: adding `npm run validate:ograf` to `.github/workflows/ci.yml` is a workflow edit and needs its own approval.
4. A refresh procedure (how an upstream schema bump is vendored and re-pinned) must be written down in the same change, because a stale vendored closure would otherwise be invisible.

## 3. Item 8 — current behaviour

- The host import unit is a folder; the canonical KCS package materializer already produces the required layout, and the research doc explicitly says a new exporter or a fake host wrapper is **not** justified (`docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md:165,180`).
- The folder QA copies made earlier (`reports/progress_049.md`) were hand-made: clean copies of the extracted downstream folders, with no orphan diagnostic JSON and no proprietary reference assets.
- On this machine the expected QA roots (`Desktop\kcs-ograf-public-controls-qa`, `Desktop\kcs-ograf-host-compat-qa`, `Desktop\kcs-ograf-downstream-qa`, `Desktop\ograf-graphics`) are **absent**; `Desktop\KCS` exists and holds the user's own archives. Nothing was created, moved, or deleted while checking this.

### 3.1 Plan (implementation needs its own approval)

Branch: `test/ograf-folder-qa-automation` (the name the roadmap table already records).

1. **Generator** — a script that takes a compiled OGraf package (the existing `OGrafGeneratedPackage` from the canonical compiler) and materializes it into a clean folder QA root: manifest-rooted graphic, assets, no diagnostics sidecars, no artefacts from other QA profiles. It must reuse the existing package compiler and path-safety authorities rather than adding a second writer.
2. **Artifact comparison** — a second step that compares the folder copy against the ZIP produced by the same compilation (per-file presence plus content equality), so "the folder is a clean copy of the package" is checked, not asserted.
3. **Host-limited report** — a generated report that states exactly what was verified (folder layout, manifest validity, file parity, hashes) and what was **not** (no real host was executed; the report must name that limitation instead of implying host acceptance).
4. **Optional Playwright smoke** — only if a browser-visible surface changes; the folder QA generation itself is Node-side and does not need the app.

Constraints: no host contract invention, no change to the official `OGraf Package`, `OGraf Single File (Legacy)`, JSON export, or KCS project export, and no writing into `Desktop\KCS` or any user folder without explicit consent (the QA root path is an explicit parameter).

### 3.2 Validation plan

Focused tests for the generator and the comparison (parity pass/fail, missing file, extra file, byte drift), one run against a real exported package on this machine, the full suite, `npm run qa:release`, and an independent review before any merge.

## 4. Out of scope

- No change to fail-closed validation behaviour, no weakening of the SHA-256 pins, no new dependency (Ajv and `ajv-formats` are already present).
- No dependency or workflow edit inside this milestone without its own approval.
- No host contract, host profile, or vendor-format invention; the folder profile stays an evidence-driven QA copy.
- No Milestone F work (Lottie mapping, evaluator profiling, editable KCS import).

## 5. Open decisions this study asks for

1. **Item 7:** approve 7-A (vendor + offline mode with notices) or 7-B (controlled cache), or record 7-C as the decision.
2. **Item 7 (separate):** approve adding `npm run validate:ograf` to CI once the closure is offline.
3. **Item 8:** approve implementing the generator + comparison + host-limited report on `test/ograf-folder-qa-automation`.
4. **Item 8 (separate):** confirm the QA root path policy (where clean folder QA copies may be written).

With no decision, nothing is implemented: this document is the deliverable of Milestone E.
