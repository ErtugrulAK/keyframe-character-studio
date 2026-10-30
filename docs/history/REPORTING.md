# Recording engineering work

Since 2026-10-31 a milestone's record lives where reviewers already look, not
in a separate report file:

1. **The pull request** carries the full record: the problem, the decision and
   why, what changed, the exact validation commands with their results, known
   limitations and risks. Never claim a check that was not run.
2. **`CHANGELOG.md`** gets the user-facing summary under `## [Unreleased]`.
3. **`ENGINEERING_LOG.md`** (this folder) gets one line under "Since
   2026-10-31": date, pull request, title.

Long working notes, QA evidence, screenshots and handoffs stay outside the
repository (a local research folder); they are not committed.

The 184 numbered `reports/progress_XXX.md` files and the other records written
before this date are indexed in [ENGINEERING_LOG.md](ENGINEERING_LOG.md) and
preserved at the tag `archive/docs-history-2026-10-31`.
