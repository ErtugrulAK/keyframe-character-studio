# Progress 114 — Milestone E: OGraf Offline Schema Closure Study and Folder QA Plan

## 1. Scope

Milestone E of the grouped roadmap, items 7 and 8, delivered as **study and plan only** (`docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`). No validator, exporter, test, dependency, or workflow change was made. Every implementation step in the study carries the approval it needs.

## 2. Item 7 — offline schema closure (study delivered)

Measured facts about `scripts/validate-ograf-manifest.mjs`:

- It fetches **8** documents (the OGraf graphics schema, six `$ref` targets, and the JSON Schema 2020-12 meta-schema) and pins each by SHA-256, throwing on an unpinned reference or a digest mismatch. That pin check is the fail-closed contract.
- A read-only fetch on 2026-09-18 confirmed **8/8 pins still match** upstream and measured the whole closure at **33,567 bytes (≈32.8 KiB)**.
- Licensing checked: `ebu/ograf` is **MIT**; the JSON Schema meta-schema ships under the BSD-style "JSON Schema Specification Authors" licence (both retrieved from the upstream repositories). Redistribution is therefore viable **if the notices ship with the vendored files**. The final licensing call is the user's.

Options presented: **7-A** vendor the closure plus an offline mode (~33 KiB, deterministic, CI-able), **7-B** a gitignored verified cache (offline after a warm run, cold runners still need the network), **7-C** status quo. The study recommends **7-A** and lists the negative controls that keep validation failing closed (unpinned `$ref`, one-byte drift, invalid manifest), plus the separate CI-wiring decision.

## 3. Item 8 — downstream folder QA automation (plan delivered)

- The host import unit is a folder containing a manifest-rooted graphic, and the research record explicitly rejects a new exporter or fake host wrapper (`docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md:165,180`).
- The earlier clean-folder QA copies were hand-made (`reports/progress_049.md`), so the check is not repeatable.
- On this machine the expected QA roots under `Desktop` (`kcs-ograf-public-controls-qa`, `kcs-ograf-host-compat-qa`, `kcs-ograf-downstream-qa`, `ograf-graphics`) are **absent**; nothing was created, moved, or deleted while checking.

Plan on branch `test/ograf-folder-qa-automation`: a generator that materializes a compiled package into a clean folder QA root through the existing compiler and path-safety authorities, an artifact comparison against the ZIP from the same compilation, and a host-limited report that states what was and was not verified (no real host is executed). Constraints: no host contract invention, no change to the official exports, and no writing into user folders without explicit consent.

## 4. Validation of this deliverable

| Check | Result |
|---|---|
| Study coverage | item 7 (current behaviour, size/licence evidence, three options, negative controls, CI decision) and item 8 (current behaviour, three-step plan, validation, constraints) |
| Evidence basis | live pin/origin check (8/8), byte measurement, upstream licence metadata, desktop QA-root existence check, `reports/progress_049.md`, `reports/progress_080.md`, `reports/progress_104.md`, `docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md` |
| State consistency | `node scripts/check-state-consistency.mjs` PASS after the state-document updates |
| Implementation | **none**, by design: every step needs its own approval |

## 5. Protected invariants

- `scripts/validate-ograf-manifest.mjs`, the pins, `fixtures/**`, `src/**`, `vite.config.ts`, dependencies, `package.json`, `package-lock.json` and the workflows are untouched.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release, npm metadata, `origin/without-mask`, global OMP configuration, `Desktop\KCS` and `Desktop\ograf-graphics` are unchanged; nothing was written to any user folder.
- No release, tag, draft-release, or npm action.

## 6. Open decisions

1. Item 7: 7-A / 7-B / 7-C.
2. Item 7: CI wiring for `validate:ograf` once offline.
3. Item 8: approve the implementation on `test/ograf-folder-qa-automation`.
4. Item 8: the QA root path policy.
