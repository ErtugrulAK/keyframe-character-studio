# Progress 159 — Boolean E2E locators aligned with the accessible-name contract

Task: clear the 11 inherited Chromium failures on the authoring-UX branch
`fix/authoring-ux-transform-toolbar`. E2E locators only; the application source is
untouched.

| Field | Value |
|---|---|
| Branch | `fix/authoring-ux-transform-toolbar` |
| Base of this work | `dea88ab` (`feat: improve authoring controls and selection visibility`) |
| Commit | `f13fed0` — `test: align boolean e2e locators with accessible names` |
| Changed files | `e2e/boolean-text-operands.spec.ts`, `e2e/editor-interaction.spec.ts`, `e2e/v51-manual-qa.spec.ts` |
| Application source | unchanged — `git diff dea88ab -- src/` is empty |
| Worktree | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio-omp-authoring-ux` |
| Pull request | #4 (existing, updated — no duplicate opened, nothing merged) |

## Regression cause

`dea88ab` gave the four Boolean buttons an explicit accessible name while adding
their icons:

```tsx
title={`Create ${operation} Boolean`}
aria-label={`Create ${operation} Boolean`}
```

`operation` comes from `(['union', 'subtract', 'intersect', 'exclude'] as const)`,
so the accessible name is `Create union Boolean` (the operation token stays
lowercase; only the visible `<span>` caption is capitalised). An `aria-label`
overrides the element's text content in accessible-name computation, so the old
visible-text names (`Union`, `Intersect`, `Subtract`, `Exclude`) no longer exist
for `getByRole('button', { name, exact: true })`. The sibling slice spec that
changed in the same commit (`e2e/authoring-ux-slice1.spec.ts`) already asserted the
new contract — `Create ${operation} Boolean` with the lowercase token — and stayed
green, which is what identified the 11 stale call sites as the only defect.

## The 11 inherited failures (before)

Reproduced first, on the isolated ports (`CI=1 PORT=5002`), with the pre-fix
working tree:

```
CI=1 PORT=5002 npx playwright test e2e/boolean-text-operands.spec.ts \
  e2e/editor-interaction.spec.ts e2e/v51-manual-qa.spec.ts --retries=0
→ 11 failed, 9 passed (4.6m)
```

Every failing case was the same exact-accessible-name mismatch, and nothing else:

| # | Spec | Failing locator (verbatim from the run log) |
|---|---|---|
| 1 | `boolean-text-operands.spec.ts:71` a text layer and a shape combine with the letters traced, counters included | `waiting for getByRole('button', { name: 'Intersect', exact: true })` |
| 2 | `boolean-text-operands.spec.ts:116` a text layer and a shape can be subtracted, and the operands stay editable | `waiting for getByRole('button', { name: 'Subtract', exact: true })` |
| 3 | `boolean-text-operands.spec.ts:158` a Outfit text traces into a Boolean group | `waiting for getByRole('button', { name: 'Intersect', exact: true })` |
| 4 | `boolean-text-operands.spec.ts:158` a quoted Playfair Display text traces into a Boolean group | `waiting for getByRole('button', { name: 'Intersect', exact: true })` |
| 5 | `boolean-text-operands.spec.ts:158` a fallback-list Playfair Display text traces into a Boolean group | `waiting for getByRole('button', { name: 'Intersect', exact: true })` |
| 6 | `boolean-text-operands.spec.ts:158` a quoted JetBrains Mono text traces into a Boolean group | `waiting for getByRole('button', { name: 'Intersect', exact: true })` |
| 7 | `boolean-text-operands.spec.ts:184` an untraceable text operand refuses the Boolean instead of changing it | `waiting for getByRole('button', { name: 'Subtract', exact: true })` |
| 8 | `boolean-text-operands.spec.ts:211` text combines with a freeform and with another text | `waiting for getByRole('button', { name: 'Union', exact: true })` |
| 9 | `boolean-text-operands.spec.ts:240` a three-operand Subtract keeps every operand | `waiting for getByRole('button', { name: 'Subtract', exact: true })` |
| 10 | `editor-interaction.spec.ts:164` Boolean parent deletion cascades owned operands and restores through undo/redo | `waiting for getByRole('button', { name: 'Union', exact: true })` |
| 11 | `v51-manual-qa.spec.ts:50` supports Boolean creation, hierarchy, operand inspection, and dissolve preservation | `waiting for getByRole('button', { name: 'Union', exact: true })` |

Each failure was `Test timeout of 30000ms exceeded.` on `locator.click`, e.g.:

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Intersect', exact: true })
```

No assertion, geometry or dispatch failure appeared in the run: the locator never
resolved, so the Boolean operation was never dispatched.

## Fix — locators only

`e2e/boolean-text-operands.spec.ts` now names the operation token once and builds the
exact accessible name from it, so the helper and the two standalone call sites
cannot drift apart again:

```ts
type BooleanOperation = 'union' | 'subtract' | 'intersect' | 'exclude';

async function clickBoolean(page: Page, operation: BooleanOperation): Promise<void> {
  await page.getByRole('button', { name: `Create ${operation} Boolean`, exact: true }).click();
}
```

`combine()` takes the lowercase operation and delegates to `clickBoolean()`; the
five `combine(...)` call sites and the two standalone clicks use it.
`e2e/editor-interaction.spec.ts` and `e2e/v51-manual-qa.spec.ts` use
`getByRole('button', { name: 'Create union Boolean', exact: true })` with a comment
naming the contract.

Nothing was weakened: every locator is still an exact accessible-name match on the
real button, no regex or text fallback was introduced, and no accessibility
assertion was removed — the tests still dispatch a real Boolean operation through
the UI and then assert the persisted group, its operands, its contours and the
dissolve/undo behaviour.

## Result after the fix

```
CI=1 PORT=5002 npx playwright test e2e/boolean-text-operands.spec.ts \
  e2e/editor-interaction.spec.ts e2e/v51-manual-qa.spec.ts --retries=0
→ 20 passed (13.2s)
```

All 11 previously failing cases pass; the 9 that were already green stay green.

Full Chromium suite, `--retries=0`, no skips and no expected failures:

```
CI=1 PORT=5002 npx playwright test --retries=0
→ 268 passed (2.0m)
```

## Validation matrix

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | exit 0 |
| `npm run lint` (`oxlint`) | exit 0 |
| `npm test` (`vitest run`) | 138 files / 2094 tests passed |
| `npm run build` (`tsc -b` + `vite build`) | exit 0, 2036 modules |
| `npm run validate:ograf` | valid OGraf v1 manifest |
| `npm run qa:release` (`PORT=5002`, gate UI 5189) | release gate passed, 2 Chromium tests |
| `npm run qa:v6` (`PORT=5002`, gate UI 5187) | 3 Chromium tests passed |
| `npm run check` | exit 0 |
| `node scripts/check-state-consistency.mjs` | PASS, 38 checks |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | empty |
| Full Chromium suite (`CI=1 PORT=5002`, `--retries=0`) | 268 passed |

## Isolation and preview evidence

Browser tests ran only on the isolated ports from this worktree. Process command
lines captured while the full suite was running:

- `concurrently "node server/index.js" "vite --host 127.0.0.1 --port 5188"` from
  `...\keyframe-character-studio-omp-authoring-ux\node_modules\.bin\..\concurrently\dist\bin\index.js`
- `...\node_modules\.bin\..\vite\bin\vite.js --host 127.0.0.1 --port 5188`
- `node server/index.js` on `127.0.0.1:5002`
- `...\node_modules\.bin\..\@playwright\test\cli.js test --retries=0`

The port owners during the run were `127.0.0.1:5188` and `127.0.0.1:5002`. The
user's live services were a separate pair of processes that the run never touched:
`0.0.0.0:5173` (vite, same worktree, PID 33028) and `127.0.0.1:5000` (API, PID
24896). No test process bound 5173 or 5000, and neither was stopped or restarted.

`http://localhost:5173/` still returned **200** and is still served by the vite
process whose command line resolves into this worktree
(`...\keyframe-character-studio-omp-authoring-ux\node_modules\.bin\..\vite\bin\vite.js`).
`http://127.0.0.1:5000/api/health` returned **200** with
`{"status":"online","service":"Keyframe Studio API","database":"SQLite (Embedded Local DB)",...}`.

The change is test-only: `git diff dea88ab -- src/` is empty, so the running
preview serves byte-identical application source to `dea88ab`.

## Branch, commits and CI

- Commit `f13fed0bed96280c10f3430595afd787d42d5aaa` on
  `fix/authoring-ux-transform-toolbar`, pushed with a normal
  `git push origin HEAD:refs/heads/fix/authoring-ux-transform-toolbar`
  (`dea88ab..f13fed0`); no force push, no rebase, no tag, no version bump.
- PR #4 (`https://github.com/ErtugrulAK/keyframe-character-studio/pull/4`) was
  updated in place; no duplicate PR was opened and nothing was merged.
- CI run `38143843474` is the `pull_request` run for `f13fed0`: **success**
  (`CI Pipeline` → `Build, Lint & Test Verification`, 2026-10-11T13:36:24Z →
  13:37:47Z, every step green).

## Limitations

- Only the three affected specs were reproduced at first; the rest of the suite was
  validated after the fix, once, with `--retries=0`.
- The regression was visible only in the real browser: the affected specs run
  against Chromium, and the Vitest suite never queries these buttons by accessible
  name, so it stayed green throughout.
- CI does not run the Chromium suite or the state consistency check; the full-suite
  and state-check results above are local results for `f13fed0`.
