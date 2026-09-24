# Progress 149 — final cleanup of the stale jsdom claims

Documentation and handoff only. No source, test, package, lockfile or workflow file was touched, no
release action was taken, and Milestone H was not reopened.

## 1. Precheck (read-only)

| Fact | Value |
|---|---|
| `git status --short --branch` | `## main...origin/main` — clean |
| `git rev-parse HEAD` / `main` / `origin/main` | `5ad9e04` — all three equal |
| Latest `main` CI | `36014071780` — success |
| `node scripts/check-state-consistency.mjs` | PASS — 47 checks |
| `git diff --check` | clean |

## 2. The stale sentences, and what each now says

Four live documents still carried the Option B-era conclusion, which the jsdom bump later overturned:
that `jsdom` had been applied, measured and reverted and therefore remained deferred alongside
`oxlint` 1.85.

| File | Stale text | Now |
|---|---|---|
| `CHANGELOG.md` | "the linter and jsdom keep their previously verified versions because the newer ones need work of their own (33 new lint rules; with jsdom 30.1 any `URL.createObjectURL` call on a Blob throws, which fails the export-download test)" | the linter kept its version in that refresh and `jsdom` stayed at 30.0.1 **in that refresh**; `jsdom` was taken to 30.1.1 later, with the test-environment object-URL shim described in the entry above it, and the `oxlint` 1.85 bump remains deferred |
| `NEXT_SESSION.md` (Milestone D item 9) | "the two minor bumps that were applied, measured and reverted (`oxlint` 1.85 …, `jsdom` 30.1 whose `URL.createObjectURL` throws for a Blob)" | the `oxlint` bump was applied, measured and reverted and **stays deferred**; the `jsdom` bump was reverted at that time too and **was taken later at `c1431db`** |
| `PROJECT_STATE.md` (approval gate) | "Option C and the two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x)" | Option C, deferred by decision, and the deferred `oxlint` 1.85 bump; `jsdom` 30.1.1 is closed at `c1431db` |
| `PROJECT_STATE.md` (item 9) | "the `engines` declaration, the npm-12 `allowScripts` pin, and the two minor bumps that were applied, measured and reverted (… `jsdom` 30.1 …)" | `engines`/`allowScripts` answered and merged at `1a12d79`; `oxlint` 1.85 deferred; `jsdom` 30.1 bump reverted then, taken later at `c1431db` |
| `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` (item 9) | "Option C and the two deferred minor bumps (`oxlint` 1.85, `jsdom` 30.1.x) stay approval-gated" | Option C and the deferred `oxlint` 1.85 bump stay approval-gated; `jsdom` 30.1.1 is closed at `c1431db` |

A second pass tightened one more sentence (`PROJECT_STATE.md`: "`jsdom` 30.1 was later taken" → "`jsdom`
30.1.1 was taken") so the version in the claim matches the version in the lockfile.

**Not changed:** every historical report keeps its intermediate facts — `progress_130` and the other
Option B records are the audit trail of a decision that was correct when it was made, and rewriting them
would falsify the record. The stale text was only in *live* documents, which is where it mattered.

## 3. Targeted audit after the patch

| Search | Result |
|---|---|
| `two deferred minor` / `two minor bumps` | no match in any live document |
| `jsdom.*defer`, `jsdom.*revert`, `jsdom.*keep.*version` | only the corrected sentences, which now state the bump was taken at `c1431db` |
| `oxlint` + `jsdom` on one line | only lines that state `oxlint` deferred **and** `jsdom` closed |
| `jsdom` 30.1.x | `PROJECT_STATE.md`'s "**`jsdom` 30.1.x: closed**" bullet and the roadmap's held-state prompt, both correct |

The truth set the audit confirms: `jsdom` 30.1.1 **taken/closed** at `c1431db`; `oxlint` 1.85 **deferred**;
Option C **deferred by decision**; `engines`/`allowScripts` **closed** at `1a12d79`; **H7 = HOLD**; and the
release artefacts unchanged.

## 4. Handoff rebuild

`chatgpt_handoff/latest/` was cleaned and rebuilt for this state: the four mirrored documents re-copied,
this report added to the Milestone H record set, and `OMP_FINAL_RESPONSE.md`, `manifest.txt` and
`README.md` updated. `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md` was regenerated from `latest/` — no
section was appended to the previous file.

## 5. Validation

| Check | Result |
|---|---|
| `node scripts/check-state-consistency.mjs` | **PASS** (bundle mirrors, live documents, roadmap rows, the tag/revision rule, the one-file staleness and secret scans) |
| `git diff --check` | clean |
| Changed paths | documents only — no `src/`, `server/`, `perf/`, `e2e/`, `scripts/`, `package.json`, `package-lock.json` or `.github/workflows/` |

**Stop point:** the patch awaits the approval gate for merging `docs/final-jsdom-state-cleanup` into
`main` (fast-forward only). No merge was performed, H7 was not reopened, and nothing was released.
