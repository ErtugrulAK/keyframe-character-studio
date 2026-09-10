# KCS OGraf Package Reference Analysis

## Scope

This analysis compares the read-only local OGraf reference corpus supplied for the milestone with the current KCS OGraf exporter. The reference corpus was not modified, copied, staged, or committed.

## Corpus inventory

The corpus contains 15 flat project directories:

- `Yuri/`
- `weather-current/`
- `v3-toblerone/`
- `sports-scorebug/`
- `score-stats/`
- `ograf.lower-third-3d/`
- `ograf.lower-third/`
- `ograf-logo/`
- `news-breaking/`
- `News Lower Third/`
- `LT_Test-ograf/`
- `lt-simple-lowerthird/`
- `l3rd-name/`
- `grafstage-logo-bug/`
- `AXIOM-News/`

No archive, `package.json`, `node_modules`, or repository build tree is present in the corpus root or project trees.

## Sanitized representative trees

### Minimal single-module packages

```text
ograf-logo/
├── logo.ograf.json
├── graphic.mjs
└── lib/
    └── ograf-logo-app.svg

ograf.lower-third/
├── bv-lt-3d.ograf.json
├── graphic.mjs
├── style.css
└── artwork.svg
```

Classification: manifest and declared main module REQUIRED; CSS/SVG OPTIONAL package resources.

### Multi-module downstream package

```text
weather-current/
├── weather-current.ograf.json
├── graphic.mjs
├── package-view.mjs
├── package-core.mjs
└── style.css
```

Classification: manifest and declared main module REQUIRED; imported helper modules and stylesheet PROJECT-SPECIFIC/GENERATED for the local downstream tool.

### Editor export with assets

```text
AXIOM-News/
├── project-<uuid>.ograf.json
├── main.js
└── assets/
    └── asset-<uuid>.svg

News Lower Third/
├── news-lower-third.ograf.json
├── main.js
├── source/
│   └── news-lower-third.ogeproj.json
└── assets/
    └── asset-<uuid>.ttf
```

Classification: manifest and declared `main.js` REQUIRED; assets referenced by the runtime REQUIRED when used; `source/*.ogeproj.json` PROJECT-SPECIFIC source metadata.

### Generated Grafstage export

```text
v3-toblerone/
├── graphic.ograf.json
├── graphic.mjs
├── project.grafstage.json
└── runtime/
    ├── document-graphic.mjs
    ├── lower-third.mjs
    ├── texture-<hash>.js
    └── licenses/
        ├── OGRAF-LICENSE.txt
        ├── OGRAF-UPSTREAM.json
        └── <dependency notices>
```

Classification: manifest/main REQUIRED; project document, runtime modules, bundles, and licenses GENERATED/VENDOR for Grafstage.

## File classification across references

| Recurring item | Classification | Evidence and limitation |
|---|---|---|
| `*.ograf.json` manifest | REQUIRED | Present in every reference project; filename suffix is normative. |
| Manifest-declared main module | REQUIRED | `graphic.mjs`, `main.js`, and `zd-lowerthird.mjs` variants observed. |
| `graphic.mjs` | COMMON, not invariant | 11 projects use it; manifest `main` is authoritative. |
| `main.js` | PROJECT-SPECIFIC/GENERATED | Observed in three editor-project exports. |
| `style.css` | OPTIONAL | Present in several downstream packages; not required by the EBU schema. |
| `assets/` | OPTIONAL unless referenced | Images/fonts/SVG/other resources are package-local when used. |
| `package-view.mjs`/`package-core.mjs` | PROJECT-SPECIFIC/GENERATED | Repeated in one downstream family, absent elsewhere. |
| `runtime/` and licenses | PROJECT-SPECIFIC/VENDOR | Grafstage-only family. Do not copy into KCS. |
| `source/*.ogeproj.json` | PROJECT-SPECIFIC | Authoring source, not required by OGraf. |
| `project.grafstage.json` | PROJECT-SPECIFIC | Grafstage authoring metadata. |
| archive wrapper directory | UNKNOWN | No reference archives were present. |
| `package.json`/`node_modules` | NOT OBSERVED | Must not be invented for KCS output. |

## Official OGraf requirements

Authoritative sources:

- EBU OGraf specification: <https://ograf.ebu.io/v1/specification/docs/Specification.html>
- EBU graphics schema: `https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json`
- Package structure explanation: <https://streamshapers.com/docs/documentation/ograf/package-structure/>

The EBU specification requires a manifest JSON file, a JavaScript file exporting an OGraf Web Component, and any resources used by that graphic. The manifest filename MUST end with `.ograf.json`; required manifest fields are `$schema`, `id`, `name`, `main`, `supportsRealTime`, and `supportsNonRealTime`. The manifest `main` path is authoritative. If `supportsNonRealTime` is true, `goToTime()` and `setActionsSchedule()` are required. Vendor extensions MUST use a `v_` prefix.

The official specification does not mandate ZIP versus folder delivery, a fixed `assets/` tree, `scene.kcs`, a fixed main filename, or downstream vendor fields.

## Local downstream conventions

The working corpus commonly uses a manifest and main module beside each other. Several packages use `assets/` with UUID-based filenames. Some families include generated helper modules, CSS, source project files, vendor runtime bundles, licenses, and `v_zd` metadata. These are observed conventions, not official OGraf requirements. The corpus has no archive examples, so archive wrapper semantics remain a KCS delivery choice.

## Current KCS export audit

The current KCS chain is:

```text
HeaderBar export menu
→ exportProject()
→ JSON parse to SceneData
→ prepareLegacyOGrafExport()
→ compileOGrafPackage()
→ createOGrafBrowserZip()
→ browser Blob download
```

Canonical authorities retained:

- `exportProject()` for scene serialization.
- `evaluateFrame` and existing OGraf evaluation/rendering modules for runtime behavior.
- `validateSceneForOGraf` for portability diagnostics.
- `packageCompiler.ts` for manifest/runtime/package-file generation.
- `packageWriter.ts` for filesystem materialization.
- `fflate` for browser ZIP generation.

Current generated package files are a manifest named from the sanitized graphic name, `scene.kcs`, the manifest-declared runtime module (`graphic.mjs` by default), and verified binary assets. Existing validation rejects unsupported video/particle/cloner/boolean cases and unverified/external assets under portable export policy. Existing runtime coverage includes shapes, text, animation, masks, Track Matte, images, and fonts where supplied through the asset catalog.

## Gap matrix

| Capability | Reference projects | Current KCS export | Gap | Required change | Confidence |
|---|---|---|---|---|---|
| Manifest suffix and main reference | Universal | Supported | None | Preserve | High |
| Main filename flexibility | `graphic.mjs`, `main.js`, `zd-lowerthird.mjs` | Configurable internally, defaults `graphic.mjs` | UI does not expose choice | Keep deterministic default; manifest remains authority | High |
| Required manifest fields | All manifests | Supported | None | Preserve | High |
| Action durations | Common in richer manifests | Not exposed in current manifest type | Metadata gap | Add optional deterministic action durations from existing runtime contract only if available | Medium |
| Author/description | Common but optional | Description supported, author absent | Optional metadata gap | Add safe optional metadata fields without vendor claims | Medium |
| Rich schema fields | Common | Public fields supported | Some JSON Schema keywords absent | Do not synthesize unsupported bindings; document current public-field scope | High |
| Render requirements | Some references use exact/min/max; many omit | Ideal-only optional output | Variant | Keep opt-in render requirements; do not claim exact unless scene contract supports it | High |
| Asset folder | Several use `assets/asset-<uuid>.<ext>` | Supports caller-supplied `assets/...` paths | Default naming differs | V2 deterministic default uses `assets/images`/`assets/fonts` and manifest/runtime references | High |
| Helper modules/CSS | Family-specific | Runtime is self-contained | No universal gap | Do not add project-specific helpers | High |
| Vendor metadata | `v_zd` in some projects | None | Intentional portability choice | Do not add unverified vendor extension | High |
| ZIP/folder delivery | No archive evidence | Browser ZIP with package-relative files | No official archive contract | V2 ZIP is extraction-equivalent to the evidence-backed root tree | High |
| Legacy export | Existing KCS path | Existing OGraf menu action | Needs distinct UI naming | Preserve as `OGraf Single File (Legacy)` while adding V2 package action | High |
| Path safety | Package resources are relative | Compiler and writer validate paths | Expand browser path validation tests | Keep traversal/absolute-path rejection and deterministic collision suffixes | High |

## KCS implementation choice

V2 is a KCS exporter product version, not a new OGraf schema version. The generated manifest remains OGraf v1 and uses the official schema URL. KCS emits only the minimal evidence-backed package tree it owns: one manifest, one self-contained main module, `scene.kcs` as an internal KCS payload, and verified package-local assets. It does not copy reference-project vendor runtimes, proprietary assets, or downstream-specific `v_zd` fields.
