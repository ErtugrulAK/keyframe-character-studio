KCS RESUME FROM CHECKPOINT — 2026-09-18 AFTER LOTTIE CORE

CONTEXT
You are resuming the Keyframe Character Studio repository at
C:\Users\ertugrul.ak\Desktop\keyframe-character-studio from checkpoint
docs/checkpoints/2026-09-18-after-lottie-core/.

The checkpoint base is `main` at 47d3368a2b54a32f812a041feb158ac82b20cf87, which equalled
`origin/main` when the checkpoint was written. The last completed task is Milestone F item 10 first
slice — the Lottie import core — merged at ff32d6c (branch `feat/lottie-import-core` at f76ae6a,
kept as the review artefact). The importer has no UI entry point yet: it returns a scene plus a loss
report, and nothing in the editor calls it.

GOAL OF THIS RUN
Milestone F Item 10 — masks + track matte slice.

RECOMMENDED BRANCH
feat/lottie-mask-matte-slice, created from `main` at or after 47d3368.

SCOPE
- In scope: extend `src/interop/lottie/**` so Lottie masks (`masksProperties`, `hasMask`) and track
  mattes (`tt`, `td`) are either converted through the existing KCS mask/matte authority — the same
  authority the editor and the renderer already use, no parallel model — or reported through the
  existing loss-report contract with a stable code, a source path, a message and a concrete action.
  Restore the design's mask limit that the first slice deliberately left out of
  `LOTTIE_IMPORT_LIMITS`, and cover the new behaviour with contract tests in
  `src/tests/lottieImport.test.ts` or a sibling test file.
- Out of scope unless separately approved: any UI or import entry point, the report-before-replace
  UX, text/image/precomp conversion, evaluator or renderer changes, new dependencies, and any
  `package.json`, lockfile or workflow change.

WORKFLOW
1. Preflight (all gates must pass, otherwise STOP and report):
   - `git status --short --branch` — the working tree must be clean before any work starts.
   - `git fetch origin --prune`
   - `git switch main`
   - `git pull --ff-only origin main` — if the pull cannot be fast-forward-only, STOP.
   - `git rev-parse HEAD` must equal `git rev-parse origin/main`; if not, STOP and report both SHAs.
   - `git rev-parse "v1.1.0-rc.1^{commit}"` must be 46d2a3e59e065816d972dcd56951803951b577f6;
     if not, STOP.
   - `node scripts/check-state-consistency.mjs` must PASS; if it fails, STOP and report.
   - `gh run list --branch main --limit 10` — the newest `main` run must be a success; if it failed,
     inspect the log and STOP before editing anything.
2. Read `docs/design/KCS_LOTTIE_IMPORT_MAPPING.md`, `reports/progress_123_lottie_import_core.md`
   and the existing `src/interop/lottie/**` sources before proposing anything.
3. Plan the change (files, the mask/matte authority it reuses, the report codes it adds, the tests),
   state it, and wait for explicit approval before writing code.
4. Create the branch, implement only the approved scope, then run the full validation set:
   `npm run build`, `npx vitest run src/tests/lottieImport.test.ts` (or the new sibling test),
   `npm test`, `npm run lint`, `npm run validate:ograf`, `npm run qa:release`,
   `node scripts/check-state-consistency.mjs`, `git diff --check`.
5. Run one independent read-only review of the branch and record its verdict (READY / READY WITH
   WARNINGS / BLOCKED). Close every blocking finding before requesting the merge decision.
6. Ask the user for the merge decision. Do not merge, push or delete anything on your own.

GUARDRAILS
- No force push. No `reset --hard`. No rebase. No history rewrite.
- No tag create/move/delete. No release publish or finalize. No npm publish.
- No branch deletion.
- No normal (non-fast-forward) merge unless the user explicitly approves it; prefer `--ff-only`.
- Do not touch `origin/without-mask`.
- Do not change global OMP configuration: model roles, provider mappings, `memory.backend`
  (`mnemopi`) and `task.maxConcurrency` (8) stay as they are.
- Do not modify, copy into, or delete anything under `C:\Users\ertugrul.ak\Desktop\KCS`, and do not
  modify `C:\Users\ertugrul.ak\Desktop\ograf-graphics`.
- Never print, copy or commit secrets, tokens or API keys.
- Do not edit `package.json`, lockfiles or `.github/workflows/**` without explicit approval.
- Do not copy source or test files into `chatgpt_handoff/latest/`.
- Keep repository code, tests, documentation and commit messages in English; speak to the user in
  Turkish.

DONE WHEN
- The mask + track matte slice is implemented on the approved branch, every mask/matte construct is
  either converted through the existing authority or reported, the validation set is green, an
  independent review has returned READY or READY WITH WARNINGS with all blocking findings closed,
  and the merge decision has been put to the user.

START
Begin with the preflight in step 1 and report each gate result before touching any file.
