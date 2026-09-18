# KCS Milestone E — OGraf QA Study Final Response (Schema Closure + Folder QA)

This file is the OMP final response for the Milestone E study task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** Milestone E items 7 and 8 are delivered as **study and plan only** — `docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md`, with the task record in `reports/progress_114_ograf_qa_study.md`. Implementation of either item needs its own approval; nothing is implemented.
- Milestone D is complete in `main` (`3923141`): item 6 (state check) plus item 9 (audit, Option A warning maintenance and the local SQLite repair) are merged with green CI run `35322372675`.
- Branch `docs/milestone-e-ograf-qa-study` sits on that `main`; the study document is subject to the user merge decision.

## 2) ITEM 7 — WHAT THE STUDY FOUND

- `scripts/validate-ograf-manifest.mjs` fetches **8** documents (OGraf graphics schema + six `$ref` targets + the JSON Schema 2020-12 meta-schema) and pins each by **SHA-256**, throwing on an unpinned reference or a digest mismatch. That pin check is the fail-closed contract and the study keeps it.
- Read-only verification on 2026-09-18: **8/8 pins still match** upstream; the whole closure is **33,567 bytes (≈32.8 KiB)**.
- Licensing checked at the source: `ebu/ograf` is **MIT**; the JSON Schema meta-schema ships under the BSD-style "JSON Schema Specification Authors" notice. Redistribution is viable **with the notices retained**; the final licensing call is the user's.
- Options: **7-A** vendor the closure + an offline mode (deterministic, ~33 KiB, makes CI meaningful), **7-B** a gitignored verified cache (offline after a warm run; cold runners still need the network), **7-C** status quo. The study recommends **7-A** and specifies the negative controls (unpinned `$ref`, one-byte drift, invalid manifest) that must keep failing closed.
- CI wiring for `validate:ograf` is a **separate** approval, because it edits a workflow.

## 3) ITEM 8 — WHAT THE PLAN PROPOSES

- The host import unit is a folder containing a manifest-rooted graphic, and the research record rejects a new exporter or fake host wrapper (`docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md:165,180`); the earlier clean-folder QA copies were hand-made (`reports/progress_049.md`).
- Plan on `test/ograf-folder-qa-automation`: (1) a generator that materializes a compiled package into a clean folder QA root through the existing compiler and path-safety authorities, (2) an artifact comparison against the ZIP from the same compilation, (3) a **host-limited report** that states what was verified and that no real host was executed.
- Constraints: no host contract invention, no change to the official exports, no writing into user folders without consent. On this machine the expected QA roots under `Desktop` are absent; nothing was created or moved while checking.

## 4) VALIDATION

| Check | Result |
|---|---|
| Study coverage | item 7 and item 8 both: current behaviour, measured evidence, options/plan, constraints, validation, approval gates |
| Evidence basis | live pin check 8/8, byte measurement, upstream licence metadata, desktop QA-root existence check, `reports/progress_049.md`, `reports/progress_080.md`, `reports/progress_104.md`, `docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md` |
| `node scripts/check-state-consistency.mjs` | PASS |
| Repository changes | documentation only (`docs/design/**`, `reports/**`, roadmap, state docs, handoff) — no source, test, dependency or workflow change |

## 5) REVIEW AND SAFETY

- The study document goes through the same independent read-only review gate before any merge.
- Tag `v1.1.0-rc.1` (`46d2a3e…`), the draft release and npm metadata are unchanged; `package.json`, `package-lock.json` and the workflows are untouched; `Desktop\KCS` and `Desktop\ograf-graphics` were not modified.

## 6) NEXT — FOUR DECISIONS

1. Item 7: **7-A** (vendor + offline) or **7-B** (verified cache), or record **7-C**.
2. Item 7: approve **CI wiring** for `validate:ograf` once it can run offline.
3. Item 8: approve implementing the generator + comparison + host-limited report on `test/ograf-folder-qa-automation`.
4. Item 8: confirm the **QA root path policy**.

With no decision, nothing is implemented and this study remains the Milestone E deliverable.
