# Progress 127 — Lottie Import Entry Point + Report-Before-Replace UX

## 1. Scope

The last product slice of Milestone F item 10: it exposes the already-built Lottie importer to the
user through one controlled entry point, without touching the importer's own conversion rules.

- A distinct **Import Lottie** control in the header; the existing Import control keeps routing
  `.kcs`, legacy projects, `.ograf.json` and OGraf packages exactly as before.
- The document is parsed **in memory only**; a report is shown **before** anything is applied, with
  blockers and losses separated.
- Cancel is a no-op; only an explicit "Import and replace project" applies the scene, through the
  same project authority the `.kcs` import uses.
- Imported layer types are reconciled onto existing KCS types the editor renders and the OGraf export
  accepts, closing the export gap the earlier slices recorded — without inventing a type or changing
  what a layer draws.

Out of scope by instruction: the item-12 unified import entry beyond what this entry point needs, the
OGraf package import, network or filesystem resolution of external image sources, and every
`package.json`, lockfile, dependency or workflow change.

## 2. Branch

`feat/lottie-import-entry-report-ux`, created from `main` at `5dc1f7b`.

## 3. Existing authorities reused

| Authority | Where | How this slice uses it |
|---|---|---|
| `importLottieDocument(text)` | `src/interop/lottie/mapDocument.ts` | The whole parse; the entry point adds no conversion logic of its own |
| `LottieImportDiagnostic` (code, severity, feature, path, message, action) | `src/interop/lottie/diagnostics.ts` | The report model — the dialog renders it, it does not re-derive it |
| `importProject(jsonString, name)` | `src/hooks/useSerialization.ts` | The apply step: it validates through `validateImportedDocument` and applies through `fromSceneData`, exactly like the existing `.kcs` import — no ad-hoc state setters |
| `useToast` / `showToast(message, type, { title, action })` | `src/hooks/useToast.ts` | Success and refusal feedback, including the first report entry as the next step |
| `sanitizeOGrafDiagnosticText` | `src/ograf/diagnostics.ts` | Every message, path and file name is display-sanitised before it reaches the dialog |
| `ConfirmationDialog` a11y pattern (portal, `role="dialog"`, `aria-modal`, labelled title, Escape, focus trap) | `src/components/Modal/ConfirmationDialog.tsx` | The report dialog follows the same conventions and adds a scrollable, bounded list |
| OGraf `SUPPORTED_LAYER_TYPES` | `src/ograf/validation.ts` | The list the reconciliation targets; the tests assert the imported scene no longer fails on type grounds |

## 4. Entry point

A second header button, `Import Lottie`, with its own file input
(`accept=".json,.lottie.json"`). The existing `Import` control and its routing are untouched — the
new control exists precisely because the old one already means "KCS project or OGraf package".

The file is read as **text** (`FileReader.readAsText`) and handed straight to the importer. No file
path, no URL and no filesystem handle reaches the importer, which is why an external image asset can
only ever be reported.

The existing import input also gained an `aria-label`, so both controls are addressable — by tests
and by assistive technology.

## 5. Report-before-replace behavior

Selecting a file does exactly one thing: `setPendingLottieImport({ fileName, result })`. The dialog
then shows:

- the file name (sanitised) and what would happen ("N layer(s) and M frame(s) would replace the
  current project", or "Nothing was imported. Your current project is unchanged."),
- blocker and warning counts,
- the diagnostics themselves, blockers first, each with its stable code, message, source path and
  the concrete action, capped at 40 entries with a remaining count so a hostile document cannot
  produce an unbounded panel.

`Import and replace project` is disabled while the import is refused or any blocker is present.

## 6. Layer-type reconciliation

The importer no longer emits the generic `custom` family. Each imported layer gets the existing KCS
type that draws what the source layer drew:

| Lottie layer | KCS type | Why it is the same picture |
|---|---|---|
| shape with a path | `custom_freeform` | The freeform renderer draws the imported `BezierPath` |
| shape from `rc` | `custom_rect` | The rect renderer uses the imported width/height and corner radius |
| shape from `el` | `custom_circle` | The circle renderer uses the imported diameter |
| shape with no convertible geometry | `custom_freeform` | It draws nothing, exactly as before |
| solid (`ty: 1`) | `custom_rect` | A solid is a filled rectangle of `sw` × `sh` |
| null (`ty: 3`) | `custom_freeform` | A parenting helper; the freeform renders nothing without a path |
| text (`ty: 5`) | `custom_text` | Unchanged from the previous slice |
| image (`ty: 2`) | `custom_image` | Unchanged from the previous slice |

All eight are in the OGraf export's supported list, so an imported scene no longer fails export
validation *because of the layer type the importer chose*. Constructs that truly cannot be converted
(for example a repeater, a gradient or a precomp) stay diagnostics, and the layer keeps the type of
whatever geometry it did produce.

## 7. Refusal / cancel / apply semantics

- **Refused** (`{ ok: false }`, e.g. malformed JSON): the dialog shows a refusal with the reason and
  the next step, the confirm button is disabled, the project is untouched and no success is shown.
- **Cancel** (button, Escape or a backdrop click): only the pending state is cleared. No project
  mutation, no history entry, no autosave, no toast.
- **Apply**: `importProject(JSON.stringify(scene), name)` — the existing validated path — followed by
  a success toast and, when the report carried warnings, one compact info toast naming the first
  entry's code and action. A refusal from that path (an invalid scene) reports the refusal instead of
  a success.

## 8. Security / privacy boundaries

- No network request and no filesystem access in the flow; the document text is the only input.
- Every value that reaches the UI passes `sanitizeOGrafDiagnosticText`, so a machine path, a
  credential-bearing URL or an embedded payload cannot be rendered verbatim.
- The importer's own protections (size limit, JSON syntax, prototype-key walk, depth-bounded input
  walk) are unchanged and still covered by their tests.

## 9. Tests

| Test | What it pins |
|---|---|
| `src/tests/lottieImportEntry.test.tsx` (new, 8 cases) | The report appears and the project is untouched; cancel is a true no-op; confirm applies through `importProject` with a scene whose layer type is a supported one; a refused document never applies and never reports success; warnings (code + action) are visible before apply; focus starts on Cancel, Tab wraps and Escape cancels; the existing `.kcs` control still imports; the OGraf manifest rejection still fires |
| `src/tests/lottieImport.test.ts` (86 cases, +3) | Every imported layer type is one the editor and the exporter accept; a shape/solid/text/image scene produces no "not supported by OGraf Export" error; a construct that cannot be converted keeps a supported type **and** stays reported |
| `e2e/lottie-import-report.spec.ts` (new) | Real browser: report appears, cancel leaves the seeded project intact, confirm replaces it with the imported layers, and the console stays clean |

## 10. Validation matrix

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| `npx vitest run src/tests/lottieImport.test.ts src/tests/lottieImportEntry.test.tsx` | PASS — 94 cases |
| `npm test` (full Vitest) | PASS — 121 files / 1,830 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 1 real-browser test |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 11. Protected invariants

- The project is only ever replaced by an explicit user action; nothing on the selection path
  mutates state.
- The `.kcs`, legacy, OGraf manifest and OGraf package routings are unchanged.
- No renderer or evaluator change; the reconciled types are types those renderers already handle.
- No `package.json`, lockfile, dependency or workflow change, and no new dependency.
- Tag `v1.1.0-rc.1`, the draft release, npm state, `origin/without-mask`, the OMP configuration and
  the user folders are untouched.

## 12. Residual risks

- **It is still a replace, not a merge.** The dialog says so explicitly, but there is no "add to the
  current project" option; a user who expected a merge loses the current work if they confirm. That
  is the item-12 question, deliberately out of this slice.
- **The report is a list, not a preview.** The user sees what will be lost, not what the result looks
  like; a visual preview before applying is a possible follow-up.
- **Null layers import as invisible freeforms.** They are needed as parents and draw nothing, but a
  user cannot select them on the stage. The outliner still lists them.
- **The import still produces types the OGraf exporter supports, not necessarily what the user
  wanted**: a Lottie rectangle becomes `custom_rect`, so an editor user cannot convert it to a
  freeform path afterwards without re-creating it.
- **Warnings are summarised in one toast.** A long report is visible in the dialog only; there is no
  persisted report log after the dialog closes.

## 13. Next work

Item 12's unified import entry (one control that dispatches `.kcs`, legacy, OGraf and Lottie, with a
shared report surface), then the approval-gated package/dependency follow-ups (Option B, Option C,
the `engines` declaration and the npm-12 `allowScripts` decision).
