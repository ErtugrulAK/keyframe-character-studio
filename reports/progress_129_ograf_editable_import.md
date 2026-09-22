# Progress 129 — OGraf Package / Editable Import

## 1. Scope

An OGraf **package** (`.zip`/`.ograf`) can now be imported as an editable KCS document. The package
already carries `scene.kcs` — the canonical scene the exporter wrote — so the slice decodes the
archive under explicit guards and hands that scene to the existing validated import path; nothing is
reconstructed and nothing is invented.

A bare `.ograf.json` manifest stays refused: it carries no scene, so an editable import from it would
need a different (and currently undefined) product decision. Its message now points at the package.

Out of scope by instruction: dependency changes, `package.json`/lockfile/workflow edits, release
actions.

## 2. Branch

`feat/ograf-editable-import`, created from `main` at `7904037`.

## 3. Existing authorities reused

| Authority | Where | How this slice uses it |
|---|---|---|
| The exported package layout (`scene.kcs` beside the manifest) | `src/ograf/packageCompiler.ts` | The reader looks for that one member instead of inventing a format |
| `unzipSync` | `fflate` (already a dependency) | Decodes the archive; no new dependency |
| `normalizePackagePath`, `isSafePackageRelativePath`, `isReservedWindowsName`, `hasCaseInsensitiveCollision`, `isPrototypeSensitiveKey` | `src/utils/pathSafety.ts` | Every entry path is normalised and checked; the manifest is walked for reserved keys |
| `validateImportedDocument` + `importProject` | `src/utils/importValidation.ts`, `src/hooks/useSerialization.ts` | The decoded `scene.kcs` goes through the same boundary and apply path as a `.kcs` file |
| `ImportReportDialog` | `src/components/Modal/ImportReportDialog.tsx` | The same report surface the Lottie import uses; its diagnostic prop is now the shared structural shape |
| `describeOGrafValueForDiagnostics`-style messages | — | Messages name what is wrong; no raw archive bytes or machine paths are rendered |

## 4. The reader (`src/ograf/packageImport.ts`)

`readOGrafPackage(bytes)` fails closed on the first problem and returns the scene text plus a report:

| Check | Code |
|---|---|
| Empty file, not a zip, no files | `OGRAF_PACKAGE_UNREADABLE` |
| Archive above 64 MB | `OGRAF_PACKAGE_TOO_LARGE` |
| More than 512 entries | `OGRAF_PACKAGE_TOO_MANY_ENTRIES` |
| One entry above the 32 MB scene limit (filtered before decompression) | `OGRAF_PACKAGE_ENTRY_TOO_LARGE` |
| Traversal, absolute or reserved path | `OGRAF_PACKAGE_UNSAFE_PATH` |
| Two paths differing only by case | `OGRAF_PACKAGE_DUPLICATE_PATH` |
| A reserved key in the manifest | `OGRAF_PACKAGE_UNSAFE_KEY` |
| No `scene.kcs`, or an empty/oversized scene | `OGRAF_PACKAGE_MISSING_SCENE` / `OGRAF_PACKAGE_TOO_LARGE` |
| Unreadable manifest (warning, the scene still imports) | `OGRAF_PACKAGE_UNREADABLE_MANIFEST` |
| Assets are not imported (warning) | `OGRAF_PACKAGE_ASSETS_OMITTED` |

An oversized entry is **refused**, not silently dropped: the filter stops it before decompression and
the drop is reported.

## 5. Entry point and flow

The unified import control already classifies `.zip`/`.ograf` as a package; it now reads those bytes
and opens the shared report titled **"OGraf package import report"**:

1. Selecting a package reads it as bytes and decodes it in memory — the project is untouched.
2. A readable package reports its scene (and its warnings) before anything is applied.
3. **Cancel** (button, Escape, backdrop) clears the pending import only: no mutation, no history, no
   autosave, no toast.
4. **Import and replace project** applies the scene through `importProject` — the same validated path
   the `.kcs` import uses — then shows the success toast and, when the report carried warnings, one
   compact info toast.
5. A refused package (unreadable, unsafe, no scene) shows the same dialog with the refusal and a
   disabled confirm, so it can never apply or report success.

## 6. Cancel / apply / refusal semantics

- Cancel is a true no-op, identical to the Lottie import.
- Apply re-validates the scene through the boundary (the package text is untrusted input) and never
  partially applies.
- A refusal from either the reader or the project authority reports the refusal, never a success.

## 7. Security / privacy boundaries

- No filesystem or network access: the archive is decoded in memory from bytes the user selected.
- Entry count, entry size and total size are bounded before decompression.
- Package paths go through the existing path-safety authority; traversal, absolute and reserved names
  are refused.
- Prototype-sensitive keys in the manifest are refused.
- The rendered report carries only the reader's own messages and the archive's entry names, all
  display-sanitised.

## 8. Tests

| Test | What it pins |
|---|---|
| `src/tests/ografPackageImport.test.ts` (new, 6 cases) | A real package imports its `scene.kcs` and its manifest name; missing scene, empty file and non-archive are refused; traversal, absolute, reserved and case-collision paths are refused; a prototype key in the manifest is refused; the archive and entry limits are enforced (and an oversized entry is reported, not dropped); an unreadable manifest is a warning, not a failure |
| `src/tests/lottieImportEntry.test.tsx` (16 cases) | Package report appears without mutating, cancel is a no-op, confirm applies through `importProject` with the manifest name, a project-authority refusal never reports success — plus the existing single-control cases |
| `src/tests/ografBrowserZip.test.tsx` (18 cases) | The manifest message now points at the package, and an unreadable package opens a refusal report instead of a blanket toast |
| `e2e/lottie-import-report.spec.ts` (3 browser tests) | The package flow end to end: report, cancel keeps the seeded project, confirm replaces it with the package scene |

## 9. Validation matrix

| Check | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | PASS |
| focused suites (package import, dispatch, entry, lottie, ograf zip) | PASS — 132 cases |
| `npm test` (full Vitest) | PASS — 123 files / 1,850 tests |
| `npm run lint` | clean |
| `npm run validate:ograf` | PASS |
| `npm run qa:release` | PASS — 2 Chromium smoke tests |
| `npx playwright test e2e/lottie-import-report.spec.ts` | PASS — 3 real-browser tests |
| `node scripts/check-state-consistency.mjs` | PASS |
| `git diff --check` | clean |

## 10. Protected invariants

- The validated boundary remains the only path from text to a project.
- `.kcs`, legacy, Lottie and bare OGraf manifest behaviour is unchanged apart from the manifest
  message that now names the package route.
- No dependency was added (`fflate` was already present) and no `package.json`, lockfile or workflow
  file changed.
- Cancel keeps its zero-mutation guarantee for every report-driven import.

## 11. Residual risks

- **Assets and fonts are not reconstructed.** The package may carry images and fonts; only the scene
  imports, and the report says so. A graphic that relied on packaged images imports with the layers
  and loses their sources — re-linking them is manual until an asset slice exists.
- **Round-trip is scene-level, not byte-level.** Exporting the imported scene again will produce a new
  package (new ids, new asset paths) rather than the original bytes; nothing claims otherwise.
- **The manifest's public controls are not imported.** They are runtime/OGraf concepts; the editable
  document keeps the scene only.
- **`.ograf.json` on its own stays refused**, which is a product boundary, not a limitation of the
  reader.
- The reader trusts the zip's declared entry sizes for the pre-decompression filter, which is the
  standard mitigation; a crafted archive that lies about a size can still allocate up to the entry
  limit, which is why the total and entry bounds exist.

## 12. Next work

The approval-gated package/toolchain follow-ups (Option B dependency maintenance, the `engines` and
npm-12 `allowScripts` decision, Option C major toolchain upgrades) — each behind its own explicit
approval, then the final documentation reconciliation and the release-readiness audit.
