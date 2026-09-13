# KCS Investigation Branch Audit

## Scope and safety boundary

This audit inspected remaining investigation branches without checkout, merge, cherry-pick, reset, or rebase. The three approved safe Copilot branches were subsequently deleted in a separate cleanup action recorded in `reports/progress_061.md`. No other branch was deleted or modified. The release tag and `main` history were not changed except for docs-only audit commits.

Baseline: `main@373d74b` before cleanup; the cleanup result is recorded in `reports/progress_061.md`. Tag `v1.1.0-public-controls` targets `6351d1a`. Divergence values in the table are pre-deletion measurements.

GitHub CLI was authenticated and PR status was checked for each investigation branch. No open PRs were found. PR #2 for `copilot/fix-build-lint-test-verification` is CLOSED.

## Branch classification

| Branch | Exists | Divergence | Unique work | Changed-file category | PR status | Classification | Recommended action |
|---|---|---:|---|---|---|---|---|
| `copilot/analyze-repository-improvement-audit` | DELETED | `205 / 0` before deletion | None; tip `fb44f47` was ancestral | None relative to main | No PR found | SAFE DELETION COMPLETED | No further action. |
| `copilot/fix-gh-actions-workflow-failure` | DELETED | `178 / 0` before deletion | None; tip `b942c7b` was ancestral | None relative to main | No PR found | SAFE DELETION COMPLETED | No further action. |
| `copilot/fix-build-lint-test-verification` | DELETED | `178 / 1` before deletion | `94e9e37` — `Initial plan`; empty/no changed files | No file delta identified | PR #2 CLOSED | SAFE DELETION COMPLETED | No further action. |
| `docs/github-presentation` | YES | `43 / 3` | `dfabaeb`, `6d86729`, `8540165` — presentation modernization, overhaul, workflow diagrams | Docs/template changes plus four presentation images and `reports/progress_034.md` | No PR found | IMPORT UNIQUE DOCS INTO NEW BRANCH | Preserve the three commits for presentation review; import only after a new branch and explicit approval. |
| `without-mask` | YES | `425 / 1`; no merge base with main | `eb1d9b4` — `chore: add without-mask project variant` | Highly divergent full project variant; includes source, tests, docs, assets, and SQLite data | No PR found | UNKNOWN / NEEDS MANUAL DECISION | Keep/archive for now; inspect ownership and intended lifecycle before any deletion. |
| `chore/omp-kcs-config-optimization` | YES | `18 / 3` | Three unique OMP policy commits | `.omp` policy/config and OMP docs | Not part of investigation PR set | KEEP | Keep separate from the product release line. |

## Branch-specific findings

### Deleted safe Copilot branches

The three safe Copilot branches were re-verified and deleted after explicit approval. Their deletion is recorded in `reports/progress_061.md`.

### `docs/github-presentation`

The three branch-only commits are documentation/presentation work. The delta includes `.github` templates, top-level project documentation, four presentation images, and `reports/progress_034.md`. The material may be useful for GitHub presentation, but importing it could overwrite current documentation; review the files on a new branch before cherry-picking.

### `without-mask`

The branch has no merge base with current `main`, is 425 commits behind plus one branch-only tip commit, and represents a full divergent project variant. The unique tip adds the `without-mask` project variant, but the branch’s lifecycle and ownership are not established. Keep/archive pending a manual decision; do not delete based on ancestry alone.

### `chore/omp-kcs-config-optimization`

The branch retains three unique OMP policy commits and remains intentionally separate. Do not merge or delete it in this audit.

## Safe deletion result

The three approved safe Copilot branches were deleted. No further deletion commands are pending for these branches.

## Import and cleanup result

`review/github-presentation-import` was merged into `main`, and the original `docs/github-presentation` branch was deleted after verifying the imported assets and review documentation on `main`. `without-mask` and `chore/omp-kcs-config-optimization` remain untouched. See `reports/progress_064.md`.

## Keep / manual decision

Keep:

- `main`
- `chore/omp-kcs-config-optimization`

Unknown/manual decision:

- `without-mask`

Investigation branches were otherwise left untouched. OMP routing, `memory.backend: mnemopi`, model roles, provider mappings, and release tag state were preserved.
