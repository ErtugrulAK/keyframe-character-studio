# Progress 140 — Task G: the state checker covers the live documents

Branch: `fix/state-consistency-live-docs` (base `main` at `16e1610`).
Finding: **M-05** — live-state documents could contradict each other and the repository while the checker still passed.

## 1. The audit: what each document is

The checker's scope was four documents (`PROJECT_STATE.md`, `NEXT_SESSION.md`, the roadmap, the one-file) plus the handoff bundle. Everything else in the repository was simply never read, which is why six stale documents could sit next to a `PASS`.

| Document | Class | State found |
|---|---|---|
| `PROJECT_STATE.md` | **LIVE** | `main` revision claim pointed at a checkpoint's revision; validation table carried 121 files / 1,836 tests |
| `NEXT_SESSION.md` | **LIVE** | checkout claimed `main` "at or after `12b71a5`"; validation line described a long-merged branch |
| `docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md` | **LIVE** | milestone F still said **NEXT** while its own text recorded items 10, 11 and 12 as complete and merged; the recommended next prompt pointed at finished work |
| `docs/KCS_RELEASE_CANDIDATE_SUMMARY.md` | **LIVE** | validation status carried 101 files / 1,495 tests, and it still claimed offline schema validation "is not claimed" — the offline closure merged long before |
| `docs/README_INDEX.md` | **LIVE** | "Current checkpoint" pointed at a checkpoint's revision as if it were today's |
| `docs/KCS_DOCS_CLEANUP_MAP.md` | **LIVE** | listed the closed-programme documents as "canonical first-read" current state |
| `SESSION.md` | HISTORICAL | claimed a `feat/lottie-import-core` checkout and an open merge decision |
| `docs/KCS_CURRENT_STATE.md` | HISTORICAL | claimed schema validation requires network access |
| `docs/KCS_OPEN_TASKS.md` | HISTORICAL | claimed `main@1ad3f60` and "production release remains HOLD pending Task 8" |
| `docs/KCS_BRANCH_STATUS.md` | HISTORICAL | claimed `main@1ad3f60` and a Task 1–8 chain |
| `reports/**`, `docs/checkpoints/**`, `docs/design/**`, `docs/research/**`, the audit and plan documents | RECORD | the audit trail, unchanged |

**Classification decision.** The four closed-programme documents each describe a programme that is finished (the release-candidate work and its Task 1–8 chain) and each restated the same facts as the live set. Keeping them "live" would mean maintaining a second copy of the current state — the exact drift this task exists to remove — so they are marked as historical records, each carrying a note that names the live set instead. That is the classification the task asked for, not a silent rewrite: the note is at the top of every one of them.

## 2. The checker now has one authority

`LIVE_DOCUMENTS` in `scripts/check-state-consistency.mjs` is the list of documents that describe the current state, and the only ones whose claims are checked. `checkLiveDocuments` fails when one of them is missing, so a rename cannot silently drop coverage. The stale-phrase scan, the roadmap rule, the next-action rule and the mirror rule all read that set (plus the one-file and the bundle).

Two new rules, both scoped to the live documents only:

- **`checkLiveRevisionClaims`** — the checked-out branch and the revision `main` is at. A labelled `Checkout:` claim must name `main` or the branch that is really checked out; `` `main` is at `<sha>` `` must name the current `main`; `` `main` at or after `<sha>` `` must name an ancestor. A past merge — "merged into `main` at `c2dcb22`" — is history about that merge and is deliberately not matched.
- **`checkLiveReleaseClaims`** — a line that ties the release tag (or "tag target") to a revision must tie it to the pinned target. This needs no git facts, so it is caught even in a fixture.

## 3. Reproduction, on identical content

The pre-task tree was extracted with `git archive` and made a throwaway repository, then both versions of the checker ran against it:

| | Old checker | New checker |
|---|---|---|
| Live-document rules | every one passed, including `roadmap status rows … F next` — it accepted "F is NEXT" while the same file recorded item 12 as complete and merged | **`live documents contradict the repository`** — `PROJECT_STATE.md:9 says main is at 47d3368a2b54; NEXT_SESSION.md:5 says main is at or after 12b71a5, which is not an ancestor…` |
| Other failures | only the git facts a throwaway repository cannot have (the RC tag and the three milestone commits) | the same, plus the above |

The same tree, the same facts: the old rules accepted it, the new rules name the contradiction.

## 4. What was reconciled

- **`PROJECT_STATE.md`** — the checkpoint sentence now says the checkpoint records the revision it was written from (`main` stood at `47d3368a2b54…` then) instead of asserting that `main` is there; the validation table is labelled "at the last reconciliation" and its perishable specifics (test count, run id, baseline SHA) were replaced by the current numbers and by the method where a number would go stale within a task.
- **`NEXT_SESSION.md`** — the checkout claim is the ancestor form against the last merged task, the validation line describes the current run, and the first next-scoped item names the roadmap's NEXT milestone.
- **`docs/KCS_GROUPED_ROADMAP_EXECUTION_PLAN.md`** — milestone F is **COMPLETE** (items 10, 11 and 12 are merged) and a new row **G — Post-review correctness follow-up** is **NEXT**, listing each finding's merge commit; the recommended next prompt describes the current work instead of the finished Option B follow-up.
- **`docs/KCS_RELEASE_CANDIDATE_SUMMARY.md`** — the validation section states the method and points at `NEXT_SESSION.md` for the current numbers; the schema constraint now says the closure is offline by default with `--online` as the refresh path.
- **`docs/README_INDEX.md`** and **`docs/KCS_DOCS_CLEANUP_MAP.md`** — the read-first lists name the live set, and the checkpoint sentence is reframed as the most recent historical record.
- **`SESSION.md`, `docs/KCS_CURRENT_STATE.md`, `docs/KCS_OPEN_TASKS.md`, `docs/KCS_BRANCH_STATUS.md`** — a historical-record note at the top of each, naming the live set. Their content is otherwise untouched.

## 5. Validation

| Check | Result |
|---|---|
| `src/tests/stateConsistencyCheck.test.ts` | PASS — 36 tests (6 new: stale checkout, stale `main` revision, an accepted ancestor claim, a stale release candidate, an old revision kept by a historical record, a missing live document) |
| `node scripts/check-state-consistency.mjs` on the real repository | PASS |
| `npm test` | PASS — 126 files / 1,932 tests |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `git diff --check` | clean |

## 6. Self-review (read-only, same model)

- **The rules are narrow on purpose.** Only three claim shapes are checked, and each is one a reader acts on. "Merged into `main` at `<sha>`" is history and is not matched; a wrong match there would have failed the whole live set on legitimate prose, which is how a checker gets switched off.
- **The historical exemption is the document class, not a wording trick.** Records are outside `LIVE_DOCUMENTS`; the existing heading-based exemption still applies inside a live document, and a test pins that an old revision under a historical heading is accepted.
- **What is deliberately *not* checked:** test counts, run ids and other perishable numbers. The checker cannot verify them without running the suite, and asserting prose it cannot check is how a false `PASS` is manufactured. `PROJECT_STATE.md` now labels that table as of the last reconciliation instead.
- **The roadmap gained a row rather than a rewritten history.** F's row keeps every fact it had and only changes its headline status; G records the current programme and the merges it has produced so far.
- **No document was deleted and no historical file was rewritten**, per the repository's preservation rules.

## 7. Not changed

- The release tag, draft release, package metadata and every dependency are untouched.
- The audit trail (`reports/**`) and the checkpoints are byte-for-byte what they were.
