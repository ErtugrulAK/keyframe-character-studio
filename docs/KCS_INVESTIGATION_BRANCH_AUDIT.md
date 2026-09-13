# KCS Investigation Branch Audit

## Scope and safety boundary

This audit inspected remaining investigation branches without checkout, merge, cherry-pick, reset, rebase, or deletion. No branch was deleted. No branch was merged or pushed. The release tag and `main` history were not changed during inspection.

Baseline: `main@1ad4bd3`, `origin/main@1ad4bd3`, tag `v1.1.0-public-controls` targets `6351d1a`. Divergence is `main-only / branch-only` from `git rev-list --left-right --count main...origin/<branch>`.

GitHub CLI was authenticated and PR status was checked for each investigation branch. No open PRs were found. PR #2 for `copilot/fix-build-lint-test-verification` is CLOSED.

## Branch classification

| Branch | Exists | Divergence | Unique work | Changed-file category | PR status | Classification | Recommended action |
|---|---|---:|---|---|---|---|---|
| `copilot/analyze-repository-improvement-audit` | YES | `204 / 0` | None; tip `fb44f47` is ancestral | None relative to main | No PR found | SAFE TO DELETE AFTER LATER USER APPROVAL | Delete only after confirming no external reference remains. |
| `copilot/fix-gh-actions-workflow-failure` | YES | `177 / 0` | None; tip `b942c7b` is ancestral | None relative to main | No PR found | SAFE TO DELETE AFTER LATER USER APPROVAL | Delete only after confirming no automation reference remains. |
| `copilot/fix-build-lint-test-verification` | YES | `177 / 1` | `94e9e37` — `Initial plan`; empty/no changed files | No file delta identified | PR #2 CLOSED | SAFE TO DELETE AFTER LATER USER APPROVAL | Obsolete closed WIP branch; do not import the empty commit. |
| `docs/github-presentation` | YES | `43 / 3` | `dfabaeb`, `6d86729`, `8540165` — presentation modernization, overhaul, workflow diagrams | Docs/template changes plus four presentation images and `reports/progress_034.md` | No PR found | IMPORT UNIQUE DOCS INTO NEW BRANCH | Preserve the three commits for presentation review; import only after a new branch and explicit approval. |
| `without-mask` | YES | `425 / 1`; no merge base with main | `eb1d9b4` — `chore: add without-mask project variant` | Highly divergent full project variant; includes source, tests, docs, assets, and SQLite data | No PR found | UNKNOWN / NEEDS MANUAL DECISION | Keep/archive for now; inspect ownership and intended lifecycle before any deletion. |
| `chore/omp-kcs-config-optimization` | YES | `18 / 3` | Three unique OMP policy commits | `.omp` policy/config and OMP docs | Not part of investigation PR set | KEEP | Keep separate from the product release line. |

## Branch-specific findings

### `copilot/analyze-repository-improvement-audit`

The remote tip is ancestral to current `main`; it has no branch-only commits or file delta. No PR was found. It is a safe deletion candidate after later approval and external-reference review.

### `copilot/fix-gh-actions-workflow-failure`

The remote tip is ancestral to current `main`; it has no branch-only commits or file delta. No PR was found. It is a safe deletion candidate after later approval and confirmation that no workflow documentation references it.

### `copilot/fix-build-lint-test-verification`

The only branch-only commit is `94e9e37` (`Initial plan`). Inspection found no changed files for that commit. PR #2 is CLOSED. There is no useful implementation to import; classify as safe to delete after approval.

### `docs/github-presentation`

The three branch-only commits are documentation/presentation work. The delta includes `.github` templates, top-level project documentation, four presentation images, and `reports/progress_034.md`. The material may be useful for GitHub presentation, but importing it could overwrite current documentation; review the files on a new branch before cherry-picking.

### `without-mask`

The branch has no merge base with current `main`, is 425 commits behind plus one branch-only tip commit, and represents a full divergent project variant. The unique tip adds the `without-mask` project variant, but the branch’s lifecycle and ownership are not established. Keep/archive pending a manual decision; do not delete based on ancestry alone.

### `chore/omp-kcs-config-optimization`

The branch retains three unique OMP policy commits and remains intentionally separate. Do not merge or delete it in this audit.

## Safe deletion candidates after later approval

- `copilot/analyze-repository-improvement-audit`
- `copilot/fix-gh-actions-workflow-failure`
- `copilot/fix-build-lint-test-verification`

Future commands, not run here:

```bash
git push origin --delete copilot/analyze-repository-improvement-audit
git push origin --delete copilot/fix-gh-actions-workflow-failure
git push origin --delete copilot/fix-build-lint-test-verification
```

## Import candidate

`docs/github-presentation` is the only import candidate. Future workflow, not run here:

```bash
git switch -c review/github-presentation-import main
git cherry-pick dfabaeb 6d86729 8540165
```

Review conflicts and file ownership before any cherry-pick. This audit did not create the branch or cherry-pick commits.

## Keep / manual decision

Keep:

- `main`
- `chore/omp-kcs-config-optimization`

Unknown/manual decision:

- `without-mask`

Investigation branches were otherwise left untouched. OMP routing, `memory.backend: mnemopi`, model roles, provider mappings, and release tag state were preserved.
