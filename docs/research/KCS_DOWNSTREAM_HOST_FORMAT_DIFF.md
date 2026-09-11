# KCS Downstream Host Format Diff

## A. Executive summary

The hosted OGraf Devtool passed the BASIC, COMPOSITING, and ASSET graphics. The standard OGraf package is therefore not known-invalid. The remaining question is the import unit used by the target host application.

The read-only reference corpus and the official Devtool behavior provide high-confidence evidence for a manifest-rooted **folder** import. The host scans a selected directory for `.ograf.json` manifests and resolves each manifest's `main` module and package-relative resources from that manifest's folder. ZIP is transport only and must be extracted before folder selection. KCS Import is a separate KCS-project importer and is not the target host application.

This milestone does not weaken official OGraf compliance or add a guessed descriptor, wrapper directory, or vendor contract. It creates clean folder-based QA copies for host testing while preserving the existing standard OGraf export and legacy single-file export.

## B. Corpus methodology

Read-only sources:

- `C:\Users\ertugrul.ak\Desktop\ograf-graphics` — 15 projects, 16 manifests, approximately 80 files.
- `C:\Users\ertugrul.ak\Desktop\kcs-ograf-downstream-qa` — BASIC, COMPOSITING, and ASSET extracted packages, ZIPs, and handoff metadata.
- Hosted Devtool behavior recorded in `docs/research/KCS_OGRAF_V1_COMPLIANCE_AUDIT.md`.
- KCS compiler and writer authorities under `src/ograf/`.

Representative reference projects analyzed:

- `ograf-logo/` — minimal official package with `logo.ograf.json`, `graphic.mjs`, and `lib/` resource.
- `l3rd-name/` — two manifests over one `graphic.mjs`, proving standard/host variants can coexist.
- `weather-current/` — package-view bridge with `v_zd`, `package-view.mjs`, and `package-core.mjs`.
- `sports-scorebug/` — package-view bridge with host metadata under `v_zd`.
- `score-stats/` — multi-step manifest with `v_zd.form` and `v_zd.viewer`.
- `AXIOM-News/` — editor export with `main.js` and package-relative `assets/`.
- `News Lower Third/` — editor export with `main.js`, `assets/`, and a non-spec source document.
- `LT_Test-ograf/` — non-default `main` filename, proving the manifest is authoritative.
- `v3-toblerone/` — Grafstage adapter with a package-root asset containment guard.

No reference project was modified, copied into the repository, or committed.

## C. Sanitized reference trees

### Minimal official package

```text
ograf-logo/
├── logo.ograf.json
├── graphic.mjs
├── README.md
└── lib/
    └── ograf-logo-app.svg
```

### Package-view bridge

```text
weather-current/
├── weather-current.ograf.json
├── graphic.mjs
├── package-view.mjs
├── package-core.mjs
└── style.css
```

### Editor export

```text
AXIOM-News/
├── project-<uuid>.ograf.json
├── main.js
└── assets/
    └── asset-<uuid>.svg
```

### Source-bearing editor export

```text
News Lower Third/
├── news-lower-third.ograf.json
├── main.js
├── assets/
│   └── asset-<uuid>.ttf
└── source/
    └── news-lower-third.ogeproj.json
```

### Grafstage host package

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
        └── <license files>
```

Observed invariant: the manifest and its declared single-segment `main` file are at the same package root. Sibling modules and resources are resolved relative to that module URL. `main` values observed are `graphic.mjs`, `main.js`, and `zd-lowerthird.mjs`; no project uses a subpath.

## D. KCS package trees

The current extracted KCS QA packages are:

```text
basic/
├── kcs-basic-graphic.ograf.json
├── graphic.mjs
└── scene.kcs

compositing/
├── kcs-compositing-graphic.ograf.json
├── graphic.mjs
└── scene.kcs

asset/
├── kcs-asset-graphic.ograf.json
├── graphic.mjs
├── scene.kcs
└── assets/
    └── images/
        └── logo.png
```

The extracted folders are the authoritative QA artifacts for this milestone. The existing sibling ZIPs are older generated artifacts: their runtime text defaults and scene/manifest fingerprints differ from the extracted folders, and the ASSET ZIP contains an invalid four-byte PNG while the extracted ASSET folder contains the valid local image. They must not be treated as equivalent builds.

The clean host QA copies are generated outside the repository:

```text
C:\Users\ertugrul.ak\Desktop\kcs-ograf-host-compat-qa\
├── README_HOST_COMPAT_QA_TR.txt
├── BASIC/
│   ├── kcs-basic-graphic.ograf.json
│   ├── graphic.mjs
│   └── scene.kcs
├── COMPOSITING/
│   ├── kcs-compositing-graphic.ograf.json
│   ├── graphic.mjs
│   └── scene.kcs
└── ASSET/
    ├── kcs-asset-graphic.ograf.json
    ├── graphic.mjs
    ├── scene.kcs
    └── assets/images/logo.png
```

The host QA root intentionally contains only package folders and the Turkish instructions. The orphaned `font-blocked-diagnostics.json` from the downstream handoff was not copied because a directory-scanning host could misclassify it as an import candidate.

## E. Import-unit conclusion

**High-confidence conclusion: select the manifest-rooted folder.**

Evidence:

1. The official hosted Devtool uses a browser directory picker; ZIP upload is not available in the tested surface.
2. Its loader scans the selected directory for `.ograf.json` files.
3. Reference modules use `import.meta.url` / `import.meta.resolve` for sibling styles, modules, libraries, and assets.
4. Editor bundles rebase `assets/` paths against the module URL.
5. Grafstage runtime explicitly rejects asset URIs escaping the package base.
6. `LT_Test-ograf` proves the loader must read `main` from the manifest rather than assume `graphic.mjs`.
7. The reference corpus contains no package descriptor, build folder, or ZIP convention.

Operational rule: extract a ZIP if necessary, then select the folder containing the `.ograf.json` manifest and its declared `main` file. Do not select a standalone JavaScript file, a KCS project through KCS Import, or a guessed descriptor.

## F. Gap matrix

| ITEM | WORKING PROJECTS | KCS CURRENT | GAP | CONFIDENCE | FIX / VARIANT |
|---|---|---|---|---|---|
| Import unit | Directory containing manifest-rooted graphic; host scans folders | Extracted KCS folders already have this shape; ZIP is only transport | None in folder layout | HIGH | Create clean folder QA copies and document folder selection |
| Manifest location | Root of each graphic folder; free-form `*.ograf.json` filename | Root of each BASIC/COMPOSITING/ASSET folder | None | HIGH | Preserve existing manifest names |
| Entrypoint | Manifest `main`; observed `graphic.mjs`, `main.js`, `zd-lowerthird.mjs` | Manifest `main: graphic.mjs` | None | HIGH | Keep `main` authoritative; no hard-coded host wrapper |
| Resource resolution | `import.meta.url`, `import.meta.resolve`, or package base URL | Generated runtime uses package-relative resource resolution | None for extracted folders | HIGH | Test extracted folders, not stale ZIPs |
| Nested resources | `lib/`, `assets/`, runtime resources beside entrypoint | ASSET uses `assets/images/logo.png`; others need no asset directory | No structural gap | HIGH | Preserve package-relative assets |
| Host descriptor | No `package.json`, `project.json`, or universal descriptor in corpus | No descriptor | No evidence for one | HIGH | Do not invent one |
| Build/dist folder | Not present as an import requirement | Not present | No evidence for one | HIGH | Do not add one |
| Vendor metadata | Optional and always `v_`-prefixed where observed | Standard KCS manifests intentionally have no vendor block | Host-specific contract unknown | MEDIUM | Keep standard manifests unchanged; add no guessed `v_` fields |
| ZIP handling | No reference ZIPs; hosted picker requires folder | Existing ZIPs are transport artifacts and some are stale | Direct ZIP import is unproven and contradicted by picker behavior | HIGH | Extract before host test; no ZIP importer variant |
| Standard vs host profile | `l3rd-name/` demonstrates two manifests over one implementation | One standard KCS manifest per package | No separate host manifest required by evidence | MEDIUM | Keep standard OGraf package; use folder QA profile only |
| Font portability | Editor exports ship owned font bytes under package-relative `assets/` when needed | KCS blocks unowned fonts and does not synthesize bytes | No host-specific font gap proven | HIGH | Preserve existing diagnostics and no fake fonts |
| QA artifact consistency | Reference folders are self-consistent | Current KCS extracted folders and ZIPs differ | Stale ZIP evidence can create a false host failure | HIGH | Test `kcs-ograf-host-compat-qa` folder copies |

## Decision

No new source exporter or fake host wrapper is justified. The required host format is already produced by the canonical KCS package materializer; this milestone creates clean, evidence-driven folder QA variants and precise host test instructions. The official `OGraf Package`, `OGraf Single File (Legacy)`, JSON export, KCS project export, path guards, and portable-font rules remain unchanged.
