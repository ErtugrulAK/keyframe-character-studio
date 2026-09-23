# KCS Documentation Index

## Read this first

The current state is written in exactly one place; everything else is a record. Read these, in order:

1. `PROJECT_STATE.md` — current position, validation status and protected boundaries.
2. `NEXT_SESSION.md` — the exact next action and its approval boundary.
3. `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` — the milestone map and which milestone is NEXT.
4. `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md` — the release boundary and the accepted blocker constraints.
5. `docs/KCS_DOCS_CLEANUP_MAP.md` — which document is live, which is historical, and the preservation rules.

`node scripts/check-state-consistency.mjs` is the gate over that set: it fails when a live document contradicts the repository's branch, `main` revision or release tag, when the roadmap and the next action disagree, or when a handoff mirror drifts.

Most recent checkpoint (a historical record, kept unchanged): `docs/checkpoints/2026-09-18-after-lottie-core/`, whose `RESUME_PROMPT.md` was written for the session that followed it.

## Reports

- `reports/README.md` — report navigation and preservation rules.
- `reports/progress_057.md` — protected main integration and release validation.
- `reports/progress_058.md` — post-main cleanup audit and release checkpoint.
- `reports/progress_059.md` — release tag and safe merged branch cleanup result.
- `reports/progress_061.md` — safe Copilot branch cleanup result.
- `reports/progress_062.md` — GitHub presentation import review result.
- `reports/progress_063.md` — GitHub presentation review merge result.
- `reports/progress_064.md` — original presentation branch cleanup result.
- `reports/progress_065.md` — final checkpoint and Work PC sync handoff.
- `reports/progress_066.md` — `without-mask` branch audit and archive classification.
- `reports/progress_067.md` — GitHub Actions / CI audit and no-fix decision.
- `reports/progress_068.md` — Windows path hardening V1 implementation checkpoint.
- `reports/progress_086.md` — Parent-cycle and broadcast-map hardening patch.
- `reports/progress_087.md` — Parent-cycle and broadcast-map hardening merge.
- `reports/progress_088.md` — SourcePath filesystem trust review and blocker history.
- `reports/progress_089.md` — SourcePath filesystem trust merge.
- `reports/progress_090.md` — Mask/matte parity patch.
- `reports/progress_092.md` — Deterministic OGraf fixture/schema gate patch.
- `reports/progress_094.md` — Full OGraf release smoke gate patch.
- `reports/progress_096.md` — Local tooling PATH audit.
- `reports/progress_105.md` — export diagnostics remediation UX.
- `reports/progress_107.md` — track-matte source selection affordance.
- `reports/progress_108_canvas_tangent_authoring.md` — canvas tangent authoring (Milestone A).
- `reports/progress_109_graph_accessibility.md` — Milestone B: graph and keyboard accessibility.
- `reports/progress_110_export_onboarding.md` — Milestone C: first export / onboarding flow.
- `reports/progress_111_state_hygiene_gate.md` — Milestone D item 6: state consistency check.
- `reports/progress_112_dependency_warning_audit.md` — Milestone D item 9: dependency and warning maintenance audit (report only).
- `reports/progress_113_warning_maintenance.md` — Option A warning maintenance and the local SQLite binding repair.
- `reports/progress_114_ograf_qa_study.md` — Milestone E: OGraf offline schema closure study and folder QA plan.
- `reports/progress_115_ograf_offline_schema_closure.md` — Milestone E item 7: vendored offline schema closure.
- `reports/progress_116_ograf_folder_qa.md` — Milestone E item 8: folder QA automation.
- `reports/progress_117_interop_study.md` — Milestone F: Lottie mapping, evaluator profiling and editable KCS import study.
- `reports/progress_118_evaluator_profiling.md` — Milestone F item 11: evaluator profiling harness and baseline.
- `reports/progress_119_kcs_import_boundary.md` — Milestone F item 12: validated KCS import boundary.
- `reports/progress_120_lottie_mapping_design.md` — Milestone F item 10: Lottie import mapping design.
- `reports/progress_121_kcs_import_product_half.md` — Milestone F item 12 product half: compatibility matrix, migration report, autosave boundary.
- `reports/progress_122_ci_hotfix_import_boundary_types.md` — CI hotfix: import-boundary types and the correct type gate.
- `reports/progress_123_lottie_import_core.md` — Milestone F item 10 first slice: Lottie import core.
- `reports/progress_124_checkpoint_after_lottie_core.md` — Checkpoint `2026-09-18-after-lottie-core`: state, tasklist, resume prompt and machine-readable summary.
- `reports/progress_125_lottie_mask_matte_slice.md` — Milestone F item 10 second slice: Lottie layer masks and track mattes.
- `reports/progress_126_lottie_text_image_precomp_slice.md` — Milestone F item 10 third slice: Lottie text, image and precomp layers.
- `reports/progress_127_lottie_import_entry_report_ux.md` — Milestone F item 10 final slice: the Lottie import entry point and its report-before-replace flow.
- `reports/progress_128_unified_import_entry.md` — Milestone F item 12: one import control that dispatches `.kcs`, legacy, OGraf and Lottie by content.
- `reports/progress_129_ograf_editable_import.md` — Milestone F item 12: OGraf package import, decoded under guards into its editable scene.
- `reports/progress_128_unified_import_entry.md` — Milestone F item 12: one import control that dispatches `.kcs`, legacy, OGraf and Lottie by content.
- `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md` — the Lottie import mapping design itself.
- `docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md` — Milestone F study and per-item approval gates.
- `docs/design/KCS_MILESTONE_E_OGRAF_QA_STUDY.md` — Milestone E study and implementation plan.

## Checkpoints

- `docs/checkpoints/2026-09-18-after-lottie-core/README.md` — checkpoint summary: git state, completed work, validation, remaining work, protected state, resume steps.
- `docs/checkpoints/2026-09-18-after-lottie-core/TASKLIST.md` — done / active / next recommended / remaining backlog / approval-gated / do-not-touch.
- `docs/checkpoints/2026-09-18-after-lottie-core/RESUME_PROMPT.md` — copy-paste prompt for the next session (Milestone F item 10 masks + track mattes).
- `docs/checkpoints/2026-09-18-after-lottie-core/STATE.json` — machine-readable checkpoint summary.

`docs/OMP_GLOBAL_TOOLING_STATUS.md` summarizes the secret-free global tooling state. Historical reports remain unchanged and are audit-trail documents, not first-read current state.
- `reports/progress_075.md` — prototype-key security hardening implementation.
- `reports/progress_076.md` — prototype-key merge and post-merge validation.
- `reports/progress_077.md` — security follow-up and release-gate review.
- `reports/progress_078.md` — isolated OGraf materialization content guards branch.
- `reports/progress_079.md` — follow-up security state reconciliation.
- `reports/progress_080.md` — general project health and release-gate review.

## OGraf docs

- `docs/research/KCS_OGRAF_V1_COMPLIANCE_AUDIT.md`
- `docs/research/KCS_OGRAF_PACKAGE_REFERENCE_ANALYSIS.md`
- `docs/research/KCS_DOWNSTREAM_HOST_FORMAT_DIFF.md`
- `docs/design/KCS_OGRAF_PACKAGE_EXPORT_V2_SPEC.md`
- `docs/design/KCS_OGRAF_PUBLIC_CONTROLS_V1_SPEC.md`

## OMP docs

OMP optimization remains on `chore/omp-kcs-config-optimization`:

- `docs/omp/OMP_KCS_CONFIG_AUDIT.md`
- `docs/omp/OMP_KCS_OPTIMIZATION_PLAN.md`
- `docs/omp/OMP_KCS_ROUTING_SMOKE.md`
- `docs/omp/OMP_KCS_EFFECTIVE_USAGE_GUIDE.md`

## External QA

- `C:\Users\senmu\Masaüstü\KCS\kcs-ograf-public-controls-qa`
- `C:\Users\senmu\Masaüstü\KCS\kcs-ograf-host-compat-qa`
- `C:\Users\senmu\Masaüstü\KCS\kcs-ograf-downstream-qa`
- `C:\Users\senmu\Masaüstü\KCS\ograf-graphics` (read-only)

## CI status

- `docs/KCS_CI_STATUS.md` — GitHub Actions inventory, remote status, local reproduction, and diagnosis.
- `reports/progress_067.md` — CI audit result and no-fix decision.
