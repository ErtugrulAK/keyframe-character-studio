# KCS Markdown Cleanup Audit

## Scope and safety boundary

This is an inventory and organization plan only. No historical report was deleted, merged, or moved. Tracked files remain in place. Any future move to `reports/archive/` requires link-impact review and explicit approval.

## Inventory

Git-tracked markdown inventory from the repository root:

- Root-level markdown: 9 files.
- `docs/` markdown, including subdirectories: 41 files.
- `reports/` markdown: 61 files before this audit; 63 after adding `progress_058.md` and `README.md`.
- All tracked markdown: 161 before this audit; 165 after these four new audit/checkpoint files are included.
- Accessible desktop KCS markdown copies: 2 README files under `C:\Users\senmu\Masaüstü\KCS`; these are external copies, not repository source of truth.

## Classification and action

| Collection | Classification | Action |
|---|---|---|
| `PROJECT_STATE.md`, `SESSION.md`, `NEXT_SESSION.md` | FIRST READ / CURRENT AUTHORITY | Keep current and linked from `docs/README_INDEX.md`. |
| `docs/KCS_CURRENT_STATE.md`, `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`, `docs/KCS_BRANCH_STATUS.md`, `docs/KCS_OPEN_TASKS.md` | CURRENT AUTHORITY | Keep as maintained summaries; do not duplicate them in reports. |
| `docs/README_INDEX.md` | FIRST READ / NAVIGATION | Keep as the entry point and link current audits. |
| `reports/progress_001.md` through `reports/progress_058.md` | HISTORICAL AUDIT TRAIL | Keep all files. Do not merge or delete. |
| `reports/README.md` | FIRST READ / REPORT NAVIGATION | Keep as the report collection guide. |
| `docs/design/` | SPEC / DESIGN | Keep; specifications are not progress reports. Archive only after link-impact review and approval. |
| `docs/research/` | RESEARCH | Keep as evidence and compatibility history. |
| `docs/adr/` and `docs/interop/` | SPEC / DESIGN | Keep as architectural and interoperability records. |
| `docs/omp/` | CURRENT OMP TOOLING DOCUMENTATION | Keep separate from the product release line; do not merge or archive with KCS product reports. |
| `wiki/` and `skills/` | RESEARCH / PROJECT KNOWLEDGE | Keep; not part of the progress-report cleanup. |
| `.hermes/desktop-attachments/` and desktop KCS copies | GENERATED / EXTERNAL COPY | Do not modify in this run. Archive externally only if separately approved; never delete as part of repository cleanup. |

## First-read order

Use `docs/README_INDEX.md` first. It links the root current-state documents, current technical/release/branch summaries, open decisions, the latest progress reports, and these cleanup audits. Older reports remain available for audit history but are not first-read documents.

## Safe future archive proposal

Only after link-impact review and explicit approval, older reports may be moved to `reports/archive/` as a path-preserving historical collection. This run intentionally does not move tracked files because existing links and external handoffs must be checked first. The conservative recommendation is to keep the current flat chronological report directory until a link map exists.

## Release tag proposal

Recommended tag: `v1.1.0-public-controls`.

Alternative: `v6-ui-ograf-public-controls`.

Create and push only after separate approval, pointing at the approved current `main` HEAD:

```bash
git tag -a v1.1.0-public-controls -m "Public Controls V1 release checkpoint"
git push origin v1.1.0-public-controls
```
