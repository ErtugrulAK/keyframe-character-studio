# C2 §14 — UI library evaluation (decision record; nothing installed)

Status: EVALUATED. No dependency was added. Adoption needs separate user approval.

## What the editor already has (current HEAD of this worktree)

| Need | Existing in-repo solution | Where |
|---|---|---|
| Icons | `lucide-react` (only UI dependency besides React) | everywhere |
| Modal dialogs: focus trap, Escape, focus return | `useDialogFocusTrap` + `useDialogFocusRestoration` (6 dialogs) | `src/hooks/useDialogFocusRestoration.ts` |
| Blocking-modal boundary for global keys | `[aria-modal="true"]` contract | `src/utils/modalBoundary.ts` |
| Shortcut registry, platform keys, `aria-keyshortcuts` | one table + formatter | `src/utils/shortcuts.ts` |
| Context menu | shared provider + keyboard (Shift+F10) | `EditorContextMenuContext.tsx` |
| Toolbar roving focus | hand-written (canvas tools) | `AuthoringToolbar.tsx` |
| Tree | hand-written, now WAI-ARIA tree keys (C2-E) | `OutlinerPanel.tsx` / `OutlinerRow.tsx` |
| Sliders, menus, listbox, tabs | 10 hand-written ARIA widgets | Timeline, Inspector |

## Candidates

| Criterion | Radix Primitives | React Aria (Adobe) | Keep the in-repo stack |
|---|---|---|---|
| Styling model | unstyled, CSS-friendly; fits `kcsEditorTheme.css` | unstyled hooks or RAC components; fits too | already themed |
| Dialog / Popover / Menu / Tooltip quality | very good, portals, collision handling | very good, strongest i18n + screen-reader testing | adequate; tooltips are native `title` only |
| Tree / Grid / drag-and-drop | no tree, no DnD | `useTree`, `useDragAndDrop` with keyboard DnD | tree keys done in C2; keyboard DnD via Alt+arrows / Parent field |
| SVG stage, gizmos, timeline lanes | not covered | not covered | must stay custom anyway |
| Bundle impact | per-package (~5–20 kB gz each) | larger (~40–80 kB gz for a useful subset) | 0 |
| Fit with "no second state store / timing loop" | neutral (local UI state only) | neutral | n/a |
| Migration risk | each dialog/menu is re-wired; E2E selectors keep working if roles/labels are kept | same, plus larger API surface | none |
| React 19 support | yes | yes | yes |

## Recommendation

1. Do NOT adopt either library for this continuation. The measured user problems of C2
   (tool ownership, draft undo, mask editing, layer tree, delete warning, right-click) were all
   domain/interaction problems; no library would have solved them, and the high-risk paths
   (stage, timeline, matte) stay custom by contract.
2. The one area where a library would clearly beat the in-repo code is rich **tooltips and
   popovers** (positioning, delay, keyboard reachability — today most hints are `title`
   attributes, which keyboard users never see). If that becomes a priority, adopt **Radix
   Tooltip + Popover only** (small, unstyled), behind the existing tokens, in one reviewed step.
3. If a future milestone needs a large keyboard-accessible drag-and-drop list or grid
   (multi-select reorder, cross-panel drag), evaluate **React Aria `useDragAndDrop`** then,
   with a spike branch and bundle measurement.
4. Keep `lucide-react`. Any new icon need is covered by it.

Risks of adopting now: two dialog/menu systems side by side during migration, focus-trap
behaviour differences against the existing `aria-modal` boundary that the global shortcut
handler reads, and E2E selector churn — none of which buys a measured C2 fix.
