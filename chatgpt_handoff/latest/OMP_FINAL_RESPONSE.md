# KCS Post-Review Correctness Fix — Task G Final Response (live documents and the state checker)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** implemented on `fix/state-consistency-live-docs` (base `main` at `16e1610`); the merge decision is with the user.
- **Report:** `reports/progress_140_state_consistency_live_docs.md`.
- **Finding closed:** M-05 — live-state documents could contradict each other and the repository while the checker still passed.

## 2) THE AUDIT AND THE CLASSIFICATION

The checker read four documents plus the handoff bundle. Everything else was never read, which is why six stale documents sat next to a `PASS`: `PROJECT_STATE.md` put `main` at a checkpoint's revision, `NEXT_SESSION.md` described a long-merged branch, the roadmap said milestone F was **NEXT** while its own text recorded items 10–12 as complete, the release summary still claimed offline schema validation "is not claimed", and the docs index and cleanup map presented the closed-programme documents as current.

Classified: six **live** documents (the four above, the docs index and the cleanup map), four **historical** ones (`SESSION.md`, `docs/KCS_CURRENT_STATE.md`, `docs/KCS_OPEN_TASKS.md`, `docs/KCS_BRANCH_STATUS.md` — each describing a finished programme and restating the live set), and the **record** class (`reports/**`, `docs/checkpoints/**`, the studies, the audit and plan documents).

The four closed-programme documents are marked as historical records with a note naming the live set. Keeping them live would mean maintaining a second copy of the current state — the drift this task exists to remove.

## 3) THE CHECKER NOW HAS ONE AUTHORITY

`LIVE_DOCUMENTS` names the documents that describe the current state; `checkLiveDocuments` fails when one is missing, so a rename cannot silently drop coverage. Two new rules, scoped to that set:

- **`checkLiveRevisionClaims`** — a labelled `Checkout:` claim must name `main` or the branch really checked out; `` `main` is at <sha> `` must name the current `main`; `` `main` at or after <sha> `` must name an ancestor. A past merge ("merged into `main` at `c2dcb22`") is history and is deliberately not matched.
- **`checkLiveReleaseClaims`** — a line tying the release tag or "tag target" to a revision must tie it to the pinned target (no git facts needed, so it works in a fixture).

## 4) REPRODUCTION, ON IDENTICAL CONTENT

The pre-task tree was extracted with `git archive` and made a throwaway repository, then both checker versions ran against it:

- **Old checker:** every live-document rule passed, including `roadmap status rows … F next` — it accepted "F is NEXT" while the same file recorded item 12 as complete and merged.
- **New checker:** additionally reports `live documents contradict the repository — PROJECT_STATE.md:9 says main is at 47d3368a2b54; NEXT_SESSION.md:5 says main is at or after 12b71a5, which is not an ancestor…`

## 5) RECONCILED

`PROJECT_STATE.md` (the checkpoint sentence now quotes the revision it recorded; the validation table is labelled "at the last reconciliation" and its perishable specifics were replaced), `NEXT_SESSION.md` (ancestor-form checkout claim, current validation, the first next-scoped item names the roadmap's NEXT milestone), the roadmap (F is **COMPLETE**, a new row **G — Post-review correctness follow-up** is **NEXT** with each finding's merge commit, and the recommended prompt describes the current work), the release summary (method instead of stored counts; the offline closure is stated correctly), the docs index and the cleanup map (the live set), and the four historical records (a note naming the live set; content otherwise untouched).

## 6) VALIDATION

| Check | Result |
|---|---|
| `src/tests/stateConsistencyCheck.test.ts` | PASS — 36 tests (6 new) |
| `node scripts/check-state-consistency.mjs` on the real repository | PASS — 35 checks |
| `npm test` | PASS — 126 files / 1,932 tests |
| `npm run build` (`tsc -b` + vite) | PASS |
| `npm run lint` | clean |
| `git diff --check` | clean |

## 7) SELF-REVIEW NOTES

- The rules are narrow on purpose: only three claim shapes, each one a reader acts on. A wrong match on "merged into `main` at `<sha>`" would have failed the whole live set on legitimate prose, which is how a checker gets switched off.
- The historical exemption is the document class, not a wording trick, and a test pins that an old revision under a historical heading inside a live document is accepted.
- **Deliberately not checked:** test counts, run ids and other perishable numbers. The checker cannot verify them without running the suite, and asserting prose it cannot check manufactures a false `PASS`.
- The roadmap gained a row rather than a rewritten history: F keeps every fact and only changes its headline status.
- No document was deleted and no historical file was rewritten.

## 8) NEXT

- The final correctness gate on `main`, then the summary that maps every review finding (H-01…M-05) to its status, fix, evidence and tests.
