# KCS OGraf v1 Compliance Audit

Audit date: 2026-04-20

## Authoritative sources

- EBU Graphics Specification: https://ograf.ebu.io/v1/specification/docs/Specification.html
- Current manifest schema: https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json
- Current changelog: https://github.com/ebu/ograf/blob/main/CHANGELOG.md
- Official examples: https://github.com/ebu/ograf/tree/main/v1/examples
- OGraf Devtool: https://github.com/SuperFlyTV/ograf-devtool (HEAD `7b29ad9ff45d8ed261afabbf5264eb7221dbfb91`, read-only inspection)
- Devtool validator: https://github.com/SuperFlyTV/ograf/blob/main/client/src/lib/graphic/verify.js
- Simple Rendering System reference named by EBU: https://github.com/ebu/ograf-server

The current published EBU schema was fetched and used by `npm run validate:ograf`. The Devtool is a browser GUI, not a CLI; it accepts an extracted folder through the browser directory picker, not a ZIP directly.

## Normative compliance matrix

| SPEC RULE | MUST/SHOULD/MAY | KCS CURRENT | PASS/GAP | ACTION |
| --- | --- | --- | --- | --- |
| Graphic contains a manifest JSON | MUST | Manifest generated at `<name>.ograf.json` | PASS | Keep package writer and ZIP output. |
| Graphic contains a JavaScript Web Component module referenced by manifest | MUST | `graphic.mjs`, referenced by `main` | PASS | Keep default export runtime. |
| Used resources may be organized in folders | MAY | `assets/images` and `assets/fonts` package-relative paths | PASS | Reject unverified/missing portable resources. |
| Manifest is the representation/entrypoint | SHOULD | Manifest is package root entrypoint | PASS | Keep manifest root and README instructions. |
| Manifest filename ends `.ograf.json` | MUST | Sanitized `<name>.ograf.json` | PASS | Test generated BASIC/COMPOSITING/ASSET manifests. |
| `$schema` equals current EBU schema URL | MUST | Exact `OGRAF_GRAPHICS_SCHEMA_URL` constant | PASS | Validate with live-schema AJV script. |
| `id` is required and contains no `/` | MUST | Canonical sanitizer removes slash and unsafe separators | PASS | Keep explicit stable ID support. |
| `name`, `main`, `supportsRealTime`, `supportsNonRealTime` required | MUST | Always emitted | PASS | Schema validation covers all generated manifests. |
| Vendor fields use `v_` prefix | MUST | KCS emits no vendor fields | PASS | Do not add local/vendor fields without prefix. |
| `version`, `description`, `author`, custom actions, durations, thumbnails | MAY | Version/description supported; others not emitted | PASS | No unsupported metadata invented; document as optional future work. |
| `schema` describes `load`/`updateAction` public data | SHOULD/defined by schema | Public text/image fields become GDD-compatible typed properties | PASS | Keep internal scene state out of public schema. |
| Main exports a class extending `HTMLElement` | MUST | `export default class Graphic extends HTMLElement` | PASS | Devtool-style module audit and runtime tests. |
| `load()` exists, applies initial data, resolves when ready | MUST | Async load applies public data and renders before resolving | PASS | Keep render-before-resolve order. |
| `dispose()` exists and resolves after cleanup | MUST | Async cancellation/reset/clear implementation | PASS | Runtime action tests. |
| `playAction()` exists and returns a Promise/ReturnPayload | MUST | Async implementation returns status/currentStep | PASS | `goto`/`delta` target semantics follow one-step model. |
| `stopAction()` exists and returns a Promise/ReturnPayload | MUST | Async stop transition and status payload | PASS | Keep skipAnimation behavior. |
| `updateAction()` exists and applies partial public data | MUST | Async public-binding update with errors for unknown fields | PASS | Validate public schema/update behavior. |
| `customAction()` exists | MUST | Async explicit 400 for unsupported action | PASS | No custom action is advertised. |
| Action Promise return semantics | MUST | Status payloads use numeric `statusCode`; errors use 4xx | PASS | Existing runtime and Devtool-style tests. |
| Renderer waits for `load()` before actions | MUST for renderer | Devtool/interoperability harness waits for load | PASS | Documented in runtime acceptance steps. |
| `supportsNonRealTime=true` requires `goToTime` and `setActionsSchedule` | MUST if declared | KCS declares `false`; methods are not advertised | PASS | Do not add false capability. |
| One-step model and `stepCount` | Default/semantics | KCS emits `stepCount: 1` | PASS | One-step `playAction` maps first play to step 0 and subsequent/end transition to end. |
| `skipAnimation` on actions | MUST when supplied | Runtime honors play/stop; update is immediate and already resolved; custom unsupported | PASS | Keep explicit tests. |
| `actionDurations` | MAY | Not emitted | PASS | Do not invent durations where runtime timing is dynamic. |
| `customActions` | MAY | Not emitted; customAction returns explicit unsupported status | PASS | Add only with a real KCS action. |
| Resolution/frame-rate render requirements | MAY | Composition width/height/FPS emitted as ideal constraints | PASS | Useful KCS state; no engine/internet claim added. |
| Internet and engine requirements | MAY | Not emitted | PASS | KCS package is not claiming external network/engine requirements. |
| Thumbnails | MAY | Not emitted | PASS | No stable thumbnail resource pipeline currently exists. |
| Current GDD schema references | MUST for schema validity | Live official schema recursively resolves current refs | PASS | `validate:ograf` fetches the current schema rather than a draft snapshot. |

## Manifest schema validation

`scripts/validate-ograf-manifest.mjs` uses AJV 2020 and `ajv-formats`, fetches the current EBU manifest schema and referenced schemas, and validates supplied manifest files. It is exposed as `npm run validate:ograf`.

The generated BASIC, COMPOSITING, and ASSET manifests in `C:\Users\ertugrul.ak\Desktop\kcs-ograf-downstream-qa` all returned `valid OGraf v1 manifest`. Boundary tests cover slash-free IDs, unsafe main paths, reserved package collisions, current schema URL, and malformed public-field definitions. The validator is intentionally live-source based; it does not embed an outdated draft schema.

## Web Component interface audit

Generated `graphic.mjs` contains the default-exported `HTMLElement` subclass and all six required real-time methods: `load`, `dispose`, `playAction`, `stopAction`, `updateAction`, and `customAction`. All action methods are async and return status payloads. `load` applies initial public data before rendering and resolving. Unknown public fields and un-packaged public image values return 400 payloads. `dispose` cancels pending animation, resets the scene, clears DOM output, and resolves. `stopAction` now records an explicit stopped state and suppresses layer output after the end transition.

KCS is a real-time-only graphic. `supportsRealTime` is `true`; `supportsNonRealTime` is `false`. Therefore `goToTime` and `setActionsSchedule` are correctly not implemented or advertised. The generated runtime rejects non-realtime `load` requests instead of falsely accepting them.

## Public data schema and actions

Only explicitly requested public text/image bindings enter `manifest.schema`; internal layer, track, editor, and timing state stays in `scene.kcs`/runtime state. Each public property is a GDD object with `type: string` and optional title/default metadata. Public image properties are narrowed to locally cataloged source values. `updateAction` applies partial data through the same binding map used by `load`.

KCS exposes one step (`stepCount: 1`). `playAction` follows OGraf's one-step model: the initial call reaches step 0, and a subsequent transition or stop reaches the end. `skipAnimation: true` jumps directly to the requested state. No custom action or static duration is advertised because KCS has no corresponding public action contract.

## Resource and font portability

Font workflow classifications:

- Portable local font: a verified `assetCatalog` entry with local `sourcePath` or browser `binaryContent`; packaged under `assets/fonts/...`; generated `@font-face` uses an explicitly resolved package resource URL.
- Non-portable authored system font: no owned bytes; export is blocked with an element-specific message: `Display <name> uses <font>, but KCS has no portable font file for this font. Import/upload the font file or choose a portable font before OGraf export.` No silent replacement occurs.
- Text without an authored font family uses generic `sans-serif`, not a named unbundled host font.
- External web font: not treated as a portable local resource. External resources remain subject to the explicit external-resource policy and are not silently assumed available downstream.
- Legacy font reference: old scenes remain loadable; missing bytes produce the same explicit blocking diagnostic.

`prepareLegacyOGrafExport` preserves caller asset options/catalog entries while adding owned embedded-image bytes. It does not bundle any font binary. Machine-absolute authored asset sources, traversal, drive-relative, duplicate, and missing asset paths fail closed. Image and font defaults use `assets/images` and `assets/fonts`.

The generated runtime escapes authored font family/path values before placing them in a CSS style string. Packaged relative resources resolve through `__OGRAF_BASE_URL__` when supplied, otherwise the host location. Videos remain unsupported by the current KCS OGraf validator and produce explicit diagnostics rather than a false portable claim.

## Reference corpus reclassification

The 15 read-only projects at the supplied reference location were re-checked against the official sources. Their shared spec-compliant core is one `.ograf.json` manifest, its declared main module, and resources actually used by that module. The following are not universal requirements:

- `package-view.mjs`, `package-core.mjs`, `style.css`, and `v_zd` fields: ZD/downstream convention.
- `runtime/` bundles, licenses, and Grafstage adapters: host/runtime-specific convention.
- UUID asset filenames and bundled editor `main.js`: exporter convention.
- README files and thumbnails: documentation/optional metadata.
- Multiple manifests sharing one main module: allowed by the specification, but project-specific.

KCS therefore keeps only the manifest, declared runtime, KCS scene resource, and referenced assets. The corpus never overrides the EBU MUST/SHOULD/MAY rules.

## Devtool validation

The official Devtool repository was inspected at commit `7b29ad9ff45d8ed261afabbf5264eb7221dbfb91`. Its `verify.js` uses the current schema reference chain and checks all six real-time methods, plus non-real-time methods only when the manifest advertises that capability. Its runtime control GUI loads a directory, waits for `load`, and exercises action methods.

The hosted Devtool was opened at `https://ograf-devtool.superfly.tv`. It requires a browser directory picker and does not expose a headless/CLI upload endpoint in the available automation surface. ZIP files must be extracted first. Exact manual validation:

1. Open the hosted Devtool in Chrome or Edge.
2. Choose the folder `C:\Users\ertugrul.ak\Desktop\kcs-ograf-downstream-qa`.
3. Select `basic`, then load `kcs-basic-graphic.ograf.json` or its containing folder.
4. Confirm no manifest/module/resource issues, then run load, play, update, stop, and dispose in the real-time GUI.
5. Repeat with `compositing` and confirm mask/Track Matte animation.
6. Repeat with `asset` and confirm relative image loading.
7. Return exact Devtool issue text and a screenshot if any package is rejected.

Result: package and runtime behavior were validated through live EBU schema validation, Chromium interoperability tests, and generated-module action tests. Hosted Devtool directory selection could not be automated in the headless browser; downstream Devtool import remains USER QA REQUIRED. No Devtool repository or machine configuration was modified.

## Simple Rendering System

The official EBU repository points to `ebu/ograf-server` as the Simple Rendering System reference. No local clone or production connection was made. Existing Chromium materialized-package interoperability covers the meaningful safe local equivalent: manifest load, relative resource resolution, action calls, animation, and disposal. Simple Renderer validation is therefore NOT RUN; no production/on-air system was touched.

## Packages and downstream handoff

Generated outside the repository at:

`C:\Users\ertugrul.ak\Desktop\kcs-ograf-downstream-qa`

Contents include:

- `kcs-basic-graphic-ograf.zip` and extracted `basic/`: shape, text, one-step runtime.
- `kcs-compositing-graphic-ograf.zip` and extracted `compositing/`: shape, alpha Track Matte, runtime.
- `kcs-asset-graphic-ograf.zip` and extracted `asset/`: local image, text, runtime, package-relative asset.
- `font-blocked-diagnostics.json`: explicit Bebas Neue portability block; no font binary was added.
- `README_DOWNSTREAM_QA.txt`: Turkish manual downstream procedure requested for this milestone.

All three generated manifests passed the current live EBU schema validator. Package trees were materialized and ZIP bytes generated from the same compiler plan.

## Known uncertainties

- Hosted Devtool import needs user interaction with a directory picker and remains manual QA.
- The official Simple Rendering System was not run because no safe local automation or production connection was available.
- Vendor fields and host-specific runtime trees in the 15-project corpus remain intentionally outside KCS's official package contract.
- No Bebas Neue or other proprietary font binary was bundled.
