# Progress 128 — Unified Import Entry (Milestone F item 12)

## 1. Scope

One controlled user-facing import entry replaces the fragmented ones. The header now offers a single
**Import** control that decides from the file's **content** what it is and routes it to the importer
that owns that kind:

| Kind | Route | Behaviour |
|---|---|---|
| `.kcs` scene | `importProject` (the validated boundary) | Unchanged: applied immediately, warnings shown as an info toast |
| Legacy project | `importProject` | Unchanged: applied immediately with the `KCS_IMPORT_LEGACY_MIGRATED` warning |
| Lottie (`.json`/`.lottie.json`) | `importLottieDocument` + report dialog | Report before replace; cancel is a no-op |
| OGraf manifest (`.ograf.json` or an OGraf `$schema`) | existing rejection message | Unchanged |
| OGraf package (`.zip`/`.ograf`) | existing rejection message | Unchanged — package import is item 12's later slice |
| Anything else | `importProject` (its own refusal) | Unchanged refusal message |

Out of scope by instruction: new OGraf editable-import conversion, package/lockfile/workflow edits and
new dependencies.

## 2. Branch

`feat/unified-import-entry`, created from `main` at `81b87a3`.

## 3. Existing authorities reused

| Authority | Where | How this slice uses it |
|---|---|---|
| `validateImportedDocument` (the validated import boundary) | `src/utils/importValidation.ts` | The scene/legacy decision comes from its `document.kind`; no second classifier for KCS shapes exists |
| `importProject` | `src/hooks/useSerialization.ts` | Still the only apply path for project documents; it validates first and never partially applies |
| `importLottieDocument` | `src/interop/lottie/mapDocument.ts` | The Lottie parse, unchanged |
| `ImportReportDialog` (was `LottieImportReportDialog`) | `src/components/Modal/ImportReportDialog.tsx` | Generalised with a `title` prop so the next slice (OGraf package import) reuses the same surface; its a11y, sanitiser, blocker-first order and 40-entry cap are unchanged |
| `useToast`, `sanitizeOGrafDiagnosticText` | existing | Unchanged feedback and display safety |

## 4. Entry point

One button and one file input in the header:

- `Import` — "Import a KCS project, a legacy project, an OGraf manifest or a Lottie animation".
- `accept=".json,.kcs,.lottie.json,.ograf.json,.zip,.ograf"`, with an `aria-label` naming all kinds.

The previous separate `Import Lottie` button and input are gone; the old routing (OGraf rejection
included) is preserved inside the single handler.

## 5. Dispatch

`src/utils/importDispatch.ts` — `classifyImport(fileName, text)`:

- A package form (`.zip`/`.ograf`) is decided by name because it is a binary archive that is never
  read as text.
- An OGraf manifest is recognised by its `.ograf.json` name **or** an OGraf `$schema` marker, which
  keeps the previous behaviour for manifests whose schema URL has no `/ograf/` segment.
- Everything else is decided by content: `validateImportedDocument` first (scene vs legacy), then a
  Lottie check (`v` string + `layers` array + a timing field, and not an OGraf manifest). The Lottie
  check is skipped for documents above the boundary's 32 MB limit.
- A file that fits nothing is `unknown` and is handed to `importProject`, which refuses it with its
  own diagnostic — the existing behaviour, unchanged.

Because the content decides, a document renamed `.kcs` still imports as what it holds, and a `.json`
that is really an OGraf manifest is still refused with the OGraf message.

## 6. Report / cancel / apply semantics

- Lottie: selecting the file parses it in memory and opens the report; **Cancel** (button, Escape or
  backdrop) clears the pending state only — no project mutation, no history entry, no autosave, no
  toast; **Import and replace project** applies through `importProject`.
- KCS/legacy/unknown: unchanged immediate behaviour (validate → apply → toast).
- A refusal from either side never reports success.

## 7. Security / privacy boundaries

- No network or filesystem access: the document text is the only input, and an external image source
  is still only reported by the Lottie importer.
- Every rendered value in the report passes the display sanitiser.
- The boundary's protections (size limit, JSON syntax, prototype-key walk, layer-count limit) are
  unchanged, and the dispatcher adds no parsing of its own beyond a bounded Lottie shape check.

## 8. Tests

| Test | What it pins |
|---|---|
| `src/tests/importDispatch.test.ts` (new, 4 cases) | The classification matrix for every kind; content beats extension (a `.kcs` holding Lottie, a `.lottie.json` holding a scene); unclassifiable input, a Lottie-shaped object without timing, and a prototype-key document are all `unknown` |
| `src/tests/lottieImportEntry.test.tsx` (13 cases) | The single control drives the Lottie report, the KCS import, the OGraf rejection and the unclassifiable refusal; cancel is a no-op; a refusal dialog appears for a Lottie the importer rejects and its confirm is disabled; focus/Tab/Escape; sanitisation and the 40-entry cap |
| `e2e/lottie-import-report.spec.ts` (2 browser tests) | A `.kcs` project imports through the same control and a refused file changes nothing; the Lottie report flow still cancels and applies |
| `src/tests/ografBrowserZip.test.tsx` | The pre-existing OGraf manifest/package messages still fire (unchanged test) |

## 9. Validation matrix

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| focused suites (`importDispatch`, `lottieImportEntry`, `lottieImport`) | PASS — 105 cases |
| `npm test` (full Vitest) | PASS — 122 files / 1,841 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 2 real-browser tests |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 10. Protected invariants

- The validated import boundary remains the only path that turns text into a project.
- No change to `.kcs`, legacy, OGraf manifest or OGraf package outcomes.
- No renderer/evaluator change, no dependency, no `package.json`, lockfile or workflow change.
- Cancel still guarantees zero mutation for the report-driven import.

## 11. Residual risks

- **Unknown files now take the project path.** A malformed Lottie file can no longer open the Lottie
  report; it is refused with the project boundary's "not valid JSON" message. That is honest (nothing
  can be classified), but a user who renamed a Lottie file to something unrecognisable sees the
  project message instead of a Lottie one.
- **One control means one affordance.** The button no longer says "Lottie"; a user looking for a
  Lottie-specific entry point has to read the tooltip. The accepted kinds are named there and in the
  input's label.
- **OGraf packages are still refused**, by design: their import is the next slice, and the shared
  report dialog is ready for it.
- The dispatcher parses the text once more for the Lottie shape check; the size guard keeps that
  bounded, and the Lottie importer parses it again on accept.

## 12. Next work

OGraf package/editable import expansion on its own branch (Task 2 of the current orchestrator run),
reusing `ImportReportDialog` and the same validated apply path.
