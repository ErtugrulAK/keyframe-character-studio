# KCS authoring-UX branch — Boolean E2E locators aligned — 2026-10-11

## Latest action

The 11 inherited Chromium failures on `fix/authoring-ux-transform-toolbar` are
closed by aligning the E2E locators with the accessible-name contract that
`dea88ab` introduced. E2E spec files only; no application source changed.

| Field | Value |
|---|---|
| Branch | `fix/authoring-ux-transform-toolbar` |
| Base of this work | `dea88ab` (`feat: improve authoring controls and selection visibility`) |
| Commit | `f13fed0bed96280c10f3430595afd787d42d5aaa` — `test: align boolean e2e locators with accessible names` |
| Changed files | `e2e/boolean-text-operands.spec.ts`, `e2e/editor-interaction.spec.ts`, `e2e/v51-manual-qa.spec.ts` |
| Application source | unchanged — `git diff dea88ab -- src/` is empty |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-authoring-ux` |
| Focused specs | 11 failures → 20 passed |
| Full Chromium suite | 268 passed with `--retries=0` |
| Pull request | #4, updated in place; nothing was merged |
| PR CI | run `38143843474` for `f13fed0` — success (every step green) |

`dea88ab` gave the four Boolean buttons an explicit
`aria-label={`Create ${operation} Boolean`}` while adding their icons. Because an
`aria-label` overrides text content, their accessible names became
`Create union Boolean`, `Create subtract Boolean`, `Create intersect Boolean` and
`Create exclude Boolean` — the operation token stays lowercase; only the visible
caption is capitalised. Eleven assertions still queried the old visible-text names,
so the locator never resolved and the click timed out after 30 s; no Boolean
operation was ever dispatched.

## What the fix is, and what it is not

The affected specs now build the exact accessible name once (`Create <operation>
Boolean`, `exact: true`) through a single helper in
`e2e/boolean-text-operands.spec.ts`, and the two other specs use the same exact
form. No regex or text fallback was introduced, every locator still matches the
real button by exact accessible name, and no accessibility assertion was removed:
each test still dispatches a real Boolean operation through the UI and then asserts
the persisted group, its operands, its contours, and the dissolve/undo behaviour.

## Evidence

- Before (`CI=1 PORT=5002`, pre-fix tree, the three specs, `--retries=0`):
  **11 failed, 9 passed**. Every failure was
  `Error: locator.click: Test timeout of 30000ms exceeded.` followed by
  `waiting for getByRole('button', { name: '<old name>', exact: true })` for
  `Union`, `Subtract` or `Intersect` — nothing else appeared in the run.
- After (same command, post-fix tree): **20 passed (13.2s)**.
- Full Chromium suite (`CI=1 PORT=5002 npx playwright test --retries=0`):
  **268 passed (2.0m)**, no skips, no expected failures.
- Local gate for `f13fed0`: `npx tsc -b --pretty false`, `npm run lint`,
  `npm test` (138 files / 2094 tests), `npm run build`, `npm run validate:ograf`,
  `npm run qa:release` and `npm run qa:v6` (both `PORT=5002`), `npm run check`,
  `node scripts/check-state-consistency.mjs` (PASS, 38 checks),
  `npm audit --audit-level=low` (0 vulnerabilities) and `git diff --check` (empty)
  all passed.
- Isolation: the browser runs used `127.0.0.1:5188` (vite) and `127.0.0.1:5002`
  (API) from this worktree only. The user's live services on `0.0.0.0:5173`
  (vite, this worktree) and `127.0.0.1:5000` (API) were never bound by a test
  process and were never restarted; both still answer, and
  `http://localhost:5173/` returns 200 from the same worktree-served process.

## Boundaries

Nothing was merged, rebased, force-pushed, tagged or published; there is no version
bump and no new pull request. The stable repository
`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio`, the camera-invariance
worktree and the runtime-parity worktree were read-only and are unchanged. CI does
not run the Chromium suite or the state consistency check, so those results are
local results for `f13fed0`. The full detail is in
`progress_159_boolean_e2e_locator_alignment.md`.
