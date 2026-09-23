# KCS Post-Review Correctness Fix — Task A Final Response (modal / global shortcut isolation)

This file is the OMP final response for this task. It is copied into `chatgpt_handoff/latest/` and included verbatim in `chatgpt_handoff/CHATGPT_UPLOAD_ONEFILE.md`.

## 1) RESULT

- **Status:** merged into `main` by fast-forward (`0c19751`) and pushed; CI green.
- **Report:** `reports/progress_134_modal_shortcut_isolation.md`.
- **Finding closed:** H-01 from the full-project review — a blocking dialog could be open while the editor's global mutation shortcuts stayed live.

## 2) WHAT WAS WRONG

`useKeyboardShortcuts` bound the editor's global commands on `window` (`Delete`/`Backspace`, undo/redo, copy/paste, duplicate, the tool keys and the zoom keys) and only skipped them while an editable element held focus. The dialogs handled `Escape` and `Tab` themselves and left the rest of the keyboard to the editor.

So with the Lottie or OGraf import report open, focus on its Cancel button and `Delete` pressed, **the selected layer of the current project was deleted while the report stayed open** — the dialog's "nothing is applied until you accept" contract was not what the keyboard did.

## 3) WHAT CHANGED

- **`src/utils/modalBoundary.ts` (new).** The blocking-dialog contract: `aria-modal="true"`, read through one React-free predicate. Reading the rendered contract keeps one authority — the dialog itself — and covers dialogs added later without a second registry that could drift from what is on screen.
- **`src/hooks/useKeyboardShortcuts.ts`.** The keydown handler returns before any command while a blocking dialog is on screen. One central guard, not a per-command special case.
- **`src/components/Modal/NewItemModal.tsx`.** It was the one dialog that did not declare the contract, so the guard could not see it, and its `Escape` only worked from its input. It now declares `role="dialog"` / `aria-modal` / `aria-labelledby` and owns `Escape` at the dialog level, the same pattern the other two dialogs already use.

Popovers that deliberately leave the editor active (the Inspector's in/out preset cards) declare `role="dialog"` **without** `aria-modal`, so they are not matched — a case pins that so the guard cannot silently grow to swallow them.

## 4) EVIDENCE

- **Reproduced first:** 16 of the 18 new cases fail without the guard.
- **After the fix:** 18 of 18 pass, twice in a row.
- The two cases that pass either way are the boundaries that must not move: a non-modal Inspector popover stays inside the editor, and an editable element is still ignored.
- The suite drives the **real** dialogs, so the rendered contract is what the guard is measured against, not a stand-in.

## 5) VALIDATION

| Check | Result |
|---|---|
| Focused suite (`src/tests/modalShortcutIsolation.test.tsx`) | PASS — 18 tests |
| `npm test` | PASS — 125 files / 1,876 tests |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run build` | PASS |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 tests |
| `git diff --check` | clean |

## 6) SELF-REVIEW (read-only, same model)

- The guard sits before the editable-element check, so the modal boundary is the outermost rule and the existing protections are untouched.
- One attribute-selector query per key press: key events are human-rate, and a cached registry would trade this for a second state authority that can drift.
- Blocking the tool and zoom keys as well is the point of `aria-modal`: while the dialog is up the editor is not the active surface. The canvas toolbar's zoom buttons remain available, so no action becomes unreachable.
- `InteractiveCubicBezierEditor` already declared `aria-modal` and handles `Escape` itself; it is now guarded like the rest and behaves exactly as before.
- **Not done here:** restoring focus to the control that opened the import report or the confirmation dialog. Those two dialogs have no previous-focus capture today (only the bezier editor has, and it was left alone), and adding one changes focus behaviour beyond this finding's command-isolation scope. Recorded as an accessibility follow-up.

## 7) NEXT

- Task B (import/serialization transaction correctness: H-03, H-04, M-03) is in progress on `fix/import-serialization-transaction-integrity`.
- Every remaining finding from the review (H-02, H-05, H-06, M-01, M-02, M-04, M-05) still has its own task and merge gate.
