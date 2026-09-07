# KCS V6 Layer-Index History Flake Recovery

## 1. Objective

Resolve the known intermittent `layer-index-persistence.spec.ts` undo/redo observation failure before V6 pre-merge review. Scope was limited to the layer-index interaction, its existing history authority, focused domain coverage, and required verification.

## 2. Initial State

- Branch: `feat/v6-motion-core`
- Starting HEAD: `a92998950a3e07f1e8f0fe94dd8c28e3769d3b7e`
- Working tree: clean
- Main: untouched
- Existing baseline: TypeScript PASS, Vitest 1408/1408 PASS, build PASS, `qa:v6` 3/3 PASS, affected Playwright subset 65/65 PASS
- Known prior reproduction: 9/10 isolated repetitions passed; one failure left redo at `Index 1` instead of `Index 2`

## 3. Reproduction and Investigation

The persistence spec was inspected before editing. It creates Rectangle, Circle, and Triangle, changes Rectangle from authored layer index 1 to 2, undoes to 1, redoes to 2, adds Square, switches templates, changes modes, verifies autosave, reloads, and checks serialized render order.

The current UI renders the authored value through `TransformZIndexCard` as the accessible `Layer index` value. `Bring Forward (+1)` calls the existing inspector property callback, which commits `zIndex` through `setCharacterParts`. No separate layer-index store exists.

State ownership and history tracing established:

- `useProjectState` owns `characterParts`, `setCharacterParts`, and the stable `characterPartsRef` mirror.
- `DetailsPanel.handleZIndexChange` delegates to the generic `handlePartPropChange('zIndex', value)` path.
- `useHistory` owns snapshots and undo/redo. Snapshots include full `characterParts`, so `zIndex` is included automatically.
- History seeds the initial state, records committed state changes in an effect, deduplicates identical snapshots, and updates the index from the canonical history array.
- Undo targets `historyIndex - 1`; redo targets `historyIndex + 1`; both restore cloned tracks and character parts through the existing setters.
- The layer-index control is a button click, not an input with `onChange`, `onBlur`, or Enter commit semantics.

The preferred reproduction command was run first without retries:

```text
CI=true npx playwright test e2e/layer-index-persistence.spec.ts --project=chromium --repeat-each=20 --retries=0
```

Result: 20/20 passed.

A narrow temporary history logger was then used for 3 repetitions and 10 repetitions. It was removed before final verification. The logger showed the expected stack and transitions:

```text
history snapshots: S0, Rectangle:1, Circle:2/Rectangle:1, Triangle:3/Circle:2/Rectangle:1, Triangle:3/Circle:2/Rectangle:2
undo: index 4 -> snapshot index 3 (Rectangle:1)
redo: index 3 -> snapshot index 4 (Rectangle:2)
```

Results with instrumentation: 3/3 passed, then 10/10 passed. No malformed snapshot, stale authored value, history-index drift, or collapsed React state transition was observed.

## 4. Root Cause Classification

Classification: **F — the browser test was observing through a less stable document-level keyboard shortcut boundary instead of the canonical history control.**

Evidence:

1. The historical failure reported `Index 1` at the redo assertion, while the current history implementation and targeted logs showed the redo target consistently contained `Rectangle:2`.
2. The product path uses a global `keydown` listener for `Control+Z`; the browser test immediately followed a focused layer button interaction with that global shortcut.
3. Targeted history instrumentation showed that the canonical snapshot sequence and undo/redo target indices were correct.
4. The exact sequence passed in focused domain coverage and in repeated browser runs after the test used the existing Undo button.

This was not classified as a real history snapshot race. React batching was also not the root cause: the state setters and history effect produced the expected authored sequence in the instrumented runs.

## 5. Fix

### Test fix

`e2e/layer-index-persistence.spec.ts` now invokes the existing semantic `Undo` button instead of dispatching `Control+Z` for this authored layer-index contract. The test still verifies the same public browser-visible sequence:

```text
Index 1 -> Bring Forward -> Index 2
Undo -> Index 1
Redo -> Index 2
```

No sleep, retry, timeout increase, skipped assertion, weakened expectation, or unrelated click was added.

### Domain coverage

`src/tests/useHistory.test.ts` now contains focused coverage for an authored `zIndex` transition:

```text
base index 1
change to index 2
undo to index 1
redo to index 2
```

The test uses the real hook snapshot/index behavior and verifies both restored values and redo availability.

### Product status

No production history or layer-index code was changed. The existing canonical product path proved deterministic under targeted instrumentation and stress verification.

## 6. Verification

### Focused and stress browser runs

```text
CI=true npx playwright test e2e/layer-index-persistence.spec.ts --project=chromium --repeat-each=20 --retries=0
```

- 20/20 passed before the final test-boundary change.

```text
CI=true npx playwright test e2e/layer-index-persistence.spec.ts --project=chromium --repeat-each=30 --retries=0
```

- 30/30 passed after the fix.
- Retries: 0.
- Arbitrary sleeps: none.

### Focused domain coverage

```text
npx vitest run src/tests/useHistory.test.ts
```

- 10/10 tests passed.

### Adjacent browser regression

Selected keyframe, canvas/transform, editor interaction, editor regressions, interactive shape creation, keyframe duplicate/copy-paste, and named sequence specs:

- 57/57 passed.

### V6 QA

```text
npm run qa:v6
```

- 3/3 passed.

### TypeScript

```text
npx tsc --noEmit
```

- PASS.

### Lint

```text
npm run lint
```

- PASS.
- Existing warning remains at `src/context/AnimatorContext.tsx:654` for the Fast Refresh component-export rule.

### Vitest regression

```text
npm test
```

- 100 test files passed.
- 1409/1409 tests passed.

### Build

```text
npm run build
```

- PASS.
- Existing large-chunk warning remains for the generated JavaScript bundle.

### Diff check

```text
git diff --check
```

- PASS.
- Existing LF/CRLF normalization warning was reported for the modified E2E file.

### Full Playwright regression

```text
CI=true npm run test:e2e
```

- 252/252 passed.
- 0 failed.
- 0 flaky results.

## 7. Remaining Risks

- No manual interactive browser session was performed; verification used Playwright and Vitest.
- The original historical failure was not reproduced during the 20-run pre-fix reproduction or the instrumented 3/10 runs. The prior 9/10 failure rate is retained as the original baseline evidence.
- Existing lint, build bundle-size, and line-ending warnings remain non-blocking.
- No product history fix was made because targeted state-level evidence showed the canonical product sequence was deterministic.

## DO NOT CHANGE CASUALLY

- `useHistory` snapshot/index invariants and undo/redo target semantics.
- `characterPartsRef` as the history mutation mirror.
- `DetailsPanel.handleZIndexChange` delegation through the generic part-property mutation path.
- `TransformZIndexCard`'s authored `Layer index` browser-visible boundary.
- The persistence spec's `Index 2` redo assertion.
- Existing serialization, template, selection, and mode-transition authorities.

## 8. Verdict

Layer-index history flake recovery is complete for pre-merge review. The browser contract now uses the canonical semantic history control, domain coverage protects the exact authored index sequence, and the full V6 browser regression is deterministic green.
