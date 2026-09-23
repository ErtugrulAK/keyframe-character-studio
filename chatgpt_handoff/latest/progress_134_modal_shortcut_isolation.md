# Progress 134 — Task A: while a blocking dialog is open, the editor's global commands are inert

Branch: `fix/modal-shortcut-isolation` (base `main` at `1a12d79`).
Finding: **H-01** — an import report could be open while the global editor mutation shortcuts stayed live.

## 1. What was open

`useKeyboardShortcuts` binds the editor's global commands on `window` (`Delete`/`Backspace`,
undo/redo, copy/paste, duplicate, the tool keys and the zoom keys) and only ever skipped them when
an editable element held focus. The blocking dialogs handled `Escape` and `Tab` themselves, but the
report, confirmation and naming dialogs left the rest of the keyboard to the editor.

Consequence: with the Lottie or OGraf import report open, focus on its Cancel button and `Delete`
pressed, the **selected layer of the current project was deleted** while the report stayed open.
The dialog's contract — "nothing is applied until the report is accepted" — was not what the
keyboard did. Reproduced before the change: 16 of the 18 new cases failed.

## 2. Where the boundary lives

There was no modal-state authority to reuse: the dialogs are rendered from `HeaderBar` and
`SequencerTimeline` with local `useState`, and no shared "a dialog is open" flag existed. The
authority they *do* already publish is their own ARIA contract — `role="dialog"` with
`aria-modal="true"` — and that is what the guard reads (`src/utils/modalBoundary.ts`):

```ts
export const BLOCKING_MODAL_SELECTOR = '[aria-modal="true"]';
export const isBlockingModalOpen = (): boolean =>
  typeof document !== 'undefined' && document.querySelector(BLOCKING_MODAL_SELECTOR) !== null;
```

Reading the rendered contract keeps one authority — the dialog itself — and covers dialogs added
later without a second registry that could drift from what is on screen. Popovers that deliberately
leave the editor active (the Inspector's in/out preset cards) declare `role="dialog"` **without**
`aria-modal` and are therefore not matched; a case pins that so the guard cannot silently grow to
swallow them.

## 3. Applied

- `src/utils/modalBoundary.ts` (new): the blocking-dialog contract and the React-free predicate.
- `src/hooks/useKeyboardShortcuts.ts`: the keydown handler returns before any command while a
  blocking dialog is on screen. One central guard, not a per-command special case — the dialog owns
  the whole keyboard, including `Escape`, which each dialog already handles itself.
- `src/components/Modal/NewItemModal.tsx`: it was the one dialog that did not declare the contract
  (`role="dialog"`, `aria-modal`, `aria-labelledby` added), so the guard could not see it, and its
  `Escape` only worked while its input held focus. `Escape` now belongs to the dialog — the same
  pattern `ConfirmationDialog` and `ImportReportDialog` already use — so it works from the buttons
  too, and the input-level handler was removed as redundant.

## 4. Evidence

| Check | Result |
|---|---|
| Reproduction before the change | **16 of 18** new cases fail (all import-report, confirmation-dialog and naming-dialog cases; the Escape case included) |
| After the change | **18 of 18** pass, twice in a row |
| The two cases that pass either way | the non-modal Inspector popover stays inside the editor; an editable element is still ignored |

What the new suite covers (`src/tests/modalShortcutIsolation.test.tsx`, real dialogs, no stand-ins):

- each global command (`Delete`, `Backspace`, undo, redo, both redo chords, copy, paste, duplicate,
  both tool keys, both zoom keys) reaches **no** editor callback and emits no viewport command while
  the import report is open;
- `Escape` cancels the import report and runs no editor command;
- every command works again once the dialog closes, and the dialog leaves nothing behind;
- the confirmation dialog blocks while a *button* holds focus (the original failure shape);
- the naming dialog blocks and still closes on `Escape`;
- the editable-element and non-modal-popover boundaries are unchanged.

## 5. Validation

| Check | Result |
|---|---|
| Focused suite (`src/tests/modalShortcutIsolation.test.tsx`) | PASS — 18 tests |
| `npm test` | PASS — 125 files / 1,874 tests |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | PASS |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 tests |
| `git diff --check` | clean |

## 6. Self-review (read-only, same model)

- **Guard placement.** The check sits before the editable-element check, so the modal boundary is
  the outermost rule; the existing protections are untouched and their test still passes.
- **Keydown cost.** One attribute-selector query per key press. Key events are human-rate, the
  selector matches on a single attribute, and a cached registry would trade this for a second state
  authority that can drift — the wrong trade for this codebase.
- **Whole-handler block, not a mutation list.** Blocking the tool and zoom keys as well is the
  point of `aria-modal`: while the dialog is up the editor is not the active surface. The zoom
  buttons on the canvas toolbar remain available, so no action becomes unreachable.
- **`InteractiveCubicBezierEditor`** already declared `aria-modal` and registered its own
  `window` keydown. It is now guarded like the rest, and because it handles `Escape` itself that
  dialog behaves exactly as before (its focus restoration is unchanged).
- **Not done in this task:** restoring focus to the control that opened the import report or the
  confirmation dialog. Those two dialogs have no previous-focus capture today (only the bezier
  editor has, and it was left alone), and adding one changes focus behaviour beyond H-01's
  command-isolation scope. Recorded as an accessibility follow-up rather than folded in silently.

## 7. Not changed

- No second shortcut system: the editor keeps one global handler with one new guard.
- No change to text-input/contenteditable protection, to the command set, or to any dialog's
  `Tab`/`Escape` contract.
- No dependency, workflow, tag, release or handoff change.
