# KCS Branch Cleanup Audit

## Scope and safety boundary

Audit performed from clean `main` after fetching and pruning remote refs. No local or remote branch was deleted. This document classifies branches only. Any deletion requires a later explicit approval, confirmation that no open PR or active work depends on the branch, and review of the exact commands below.

Divergence is shown as `main-only / branch-only` commits from `git rev-list --left-right --count main...<branch>`. A branch with `branch-only = 0` has no commits unique to that branch relative to current `main`; it may still be retained for historical or workflow reasons.

Current baseline: `main@717d662`, `origin/main@717d662`. The integrated RC tip `111c101` is an ancestor of `main`.

## Classification

| Branch | Local | Remote | Merged into main | Divergence | Classification | Recommended action |
|---|---:|---:|---|---:|---|---|
| `main` | YES | YES | YES | `0 / 0` | KEEP | Protected release baseline. |
| `chore/omp-kcs-config-optimization` | NO | YES | NO | `16 / 3` | KEEP | Keep separate; unique OMP policy commits and separate scope. |
| `integration/v6-ui-ograf-public-controls-rc` | YES | YES | YES | `1 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Retain until release/tag review is complete; then delete only if no PR or rollback need remains. |
| `feat/ograf-public-controls-v1` | YES | YES | YES | `4 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Source line is integrated; delete only after confirming no active review depends on it. |
| `integration/v6-ui-ograf-release-candidate` | NO | YES | YES | `12 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Old RC baseline; preserve until release checkpoint is accepted. |
| `integration/v6-ui-stable` | NO | YES | YES | `26 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Old integration baseline; delete after confirming no rollback/reference need. |
| `docs/kcs-current-state-consolidation` | NO | YES | YES | `14 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Historical docs branch; no unique commits. |
| `docs/record-host-qa-pass` | NO | YES | YES | `13 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Historical QA docs branch; no unique commits. |
| `feat/ograf-host-compat-package` | NO | YES | YES | `15 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Integrated compatibility work; no unique commits. |
| `feat/ograf-v21-spec-compliance` | NO | YES | YES | `16 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Integrated OGraf compliance work; no unique commits. |
| `feat/v6-motion-core` | NO | YES | YES | `44 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Integrated milestone branch; no unique commits. |
| `feat/v6-ui-v34-control-cleanup` | NO | YES | YES | `23 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Integrated milestone branch; no unique commits. |
| `feat/v6-ui-v35-ux-corrections` | NO | YES | YES | `22 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Integrated milestone branch; no unique commits. |
| `feat/v6-ui-v36-ograf-package-v2` | NO | YES | YES | `21 / 0` | SAFE TO DELETE AFTER USER APPROVAL | Integrated milestone branch; no unique commits. |
| `copilot/analyze-repository-improvement-audit` | NO | YES | YES | `202 / 0` | NEEDS INVESTIGATION | Tip is ancestral, but purpose/open PR status is not established. |
| `copilot/fix-gh-actions-workflow-failure` | NO | YES | YES | `175 / 0` | NEEDS INVESTIGATION | Tip is ancestral; confirm whether the branch is still referenced by automation or an open PR. |
| `copilot/fix-build-lint-test-verification` | NO | YES | NO | `175 / 1` | NEEDS INVESTIGATION | One unique commit remains outside main; inspect commit and PR before any action. |
| `docs/github-presentation` | NO | YES | NO | `41 / 3` | NEEDS INVESTIGATION | Three unique presentation commits remain outside main; inspect before deletion. |
| `without-mask` | NO | YES | NO | `423 / 1` | NEEDS INVESTIGATION | Highly divergent and has one unique commit; do not delete without purpose and ancestry review. |

The remote-tracking pseudo-reference `origin` is not a branch and is excluded from cleanup commands.

## Exact future delete commands

Run only after separate approval and final open-PR/dependency review. Remote branches:

```bash
git push origin --delete integration/v6-ui-ograf-public-controls-rc
git push origin --delete feat/ograf-public-controls-v1
git push origin --delete integration/v6-ui-ograf-release-candidate
git push origin --delete integration/v6-ui-stable
git push origin --delete docs/kcs-current-state-consolidation
git push origin --delete docs/record-host-qa-pass
git push origin --delete feat/ograf-host-compat-package
git push origin --delete feat/ograf-v21-spec-compliance
git push origin --delete feat/v6-motion-core
git push origin --delete feat/v6-ui-v34-control-cleanup
git push origin --delete feat/v6-ui-v35-ux-corrections
git push origin --delete feat/v6-ui-v36-ograf-package-v2
```

Local branches currently present and eligible only after their remote counterparts are intentionally handled:

```bash
git branch -d integration/v6-ui-ograf-public-controls-rc
git branch -d feat/ograf-public-controls-v1
```

No local deletion command is listed for branches that do not exist locally. `main` and `chore/omp-kcs-config-optimization` must not be deleted under this plan.
