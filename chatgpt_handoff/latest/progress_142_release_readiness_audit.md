# Progress 142 — H1 release readiness audit (read-only)

Milestone H, task H1. **No repository change was made by this audit**; this report is its deliverable.
Audited at `main == origin/main == a9c78e7`, newest `main` CI run `35977973099` (success), working tree
clean, `npm audit` 0 vulnerabilities, `node scripts/check-state-consistency.mjs` PASS.

## 1. Current truth

| Fact | Value |
|---|---|
| `main` / `origin/main` | `a9c78e78b863cc04931a9979bb33d43e63f8048c` (equal) |
| Newest `main` CI | `35977973099` — success (1m48s) |
| Milestones | A–G **COMPLETE**; H (release finalization) **NEXT** |
| Review findings | 11/11 CLOSED (H-01…H-06, M-01…M-05) |
| Task 4 (`engines` + npm-12 `allowScripts`) | MERGED at `1a12d79` |
| Final correctness gate | re-run after the shallow-checkout fix `dcbf9f5` |
| Full suite | 126 files / 1,934 tests |
| Focused A–G regression suites | 389 tests / 10 files |

## 2. Release artefacts

| Artefact | State |
|---|---|
| `v1.1.0-rc.1` | **annotated tag** (object `81d5149`), target commit `46d2a3e59e065816d972dcd56951803951b577f6` — unchanged |
| `v1.1.0-public-controls` | annotated tag → `0a71bd8` — unchanged |
| GitHub release | `v1.1.0-rc.1 — Public Controls / OGraf hardening release candidate`, **Draft**, created 2026-09-15, unchanged |
| `package.json` | `private: true`, `version: 1.1.0-rc.1` — not published to npm |
| npm publish | **NO** |

The tag target is 40 commits behind `main` by design: `main` carries documentation and follow-up work
after the workflow-tested candidate. Nothing in this milestone moves either tag.

## 3. Toolchain and install policy

| Item | Value |
|---|---|
| `engines.node` | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` (the locked toolchain's supported intersection) |
| CI Node | `22` on `ubuntu-latest` |
| Local Node / npm | `v24.18.0` / **npm 12.0.2** |
| `allowScripts` | `{"sqlite3@6.0.1": true}` — a version-pinned approval for npm 12 |
| `npm install-scripts ls` | `{"allowScripts": []}` — nothing blocked or pending |
| `sqlite3` binding | **OK** — a fresh `require` opens an in-memory database and creates a table |

The npm-12 policy is doing what it was added for: the local npm is 12, the install script is approved
by exact version, and the native binding loads.

## 4. What the gates actually cover

| Gate | Runs | Covers |
|---|---|---|
| `.github/workflows/ci.yml` (push to `main`, PRs, manual) | `npm ci`, `validate:ograf`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` | unit/integration tests, lint, the production build, the OGraf fixture gate |
| `.github/workflows/release-smoke.yml` (manual, needs a full candidate SHA) | verifies the resolved checkout, Node 22, `npm ci`, installs Chromium, `npm run qa:release` | the OGraf import/export/runtime smoke in a real browser |
| `npm run qa:release` | 2 Chromium specs: `e2e/ograf-phase2d-interoperability`, `e2e/ograf-editor-export` | OGraf package round-trip and editor export |
| On demand only | `e2e/*.spec.ts` (38 files), `perf` harness, `qa:v6` | Lottie import report, matte pixels, canvas/timeline interaction, profiling |

**Coverage gaps found:**

1. **CI runs no browser test at all.** Every E2E spec — including the Lottie import report and the
   OGraf matte pixel proof added in this follow-up — runs only when someone invokes Playwright. The
   single automated browser gate is the *manual* `release-smoke.yml`, and it runs two of the 38 specs.
2. **No Windows job.** CI is Linux-only (`ubuntu-latest`) while the project is developed on Windows;
   the `engines` range and `.gitattributes` line-ending work are the only guards for that platform.
   Node 24 is covered by the declared range but never executed in CI.
3. **`npx tsc --noEmit` in CI checks no project file** (see §5.1), so the type gate is effectively the
   `npm run build` step that follows it.

## 5. The residual observations, classified

### 5.1 `npx tsc --noEmit` checks zero project files — **SHOULD FIX BEFORE RELEASE**
The CI step named "Run TypeScript Type Check" runs `npx tsc --noEmit`, and the root `tsconfig.json` is
a solution file (`files: []` with references), which that command does not build: `tsc -b --listFiles`
reports 151 source files, `npx tsc --noEmit --listFiles` reports none. **Type coverage is not lost** —
`npm run build` runs `tsc -b` in the same job, so a type error still fails CI — but the step as written
verifies nothing and its green tick is misleading in exactly the evidence a release audit reads. The
fix is a one-line workflow change (`npx tsc -b --pretty false`), which is a workflow edit and therefore
needs approval rather than being applied by this audit.

### 5.2 `SceneLayer.visible` is a constant `true` — **ACCEPTED-DOCUMENTED**
`toSceneData` writes `visible: true` for every layer, and the OGraf evaluation reads it. The editor's
two mutes are different controls: `editVisible` is a canvas-only authoring aid, and `visible` is the
"Broadcast Live Eye" that drives live-director playback — neither is a statement that the layer is
absent from the graphic. The exported document's layer visibility is therefore its own flag, and no
specification says an export must honour the live mute. Recorded as a product question, not a defect.

### 5.3 Unrestricted CORS — **DEFERRED FOLLOW-UP**
`cors()` allows any origin. H-06 closed the *network* exposure by binding loopback by default, and
`docs/API.md` now states that CORS is not access control. The residual vector — a page in a browser on
this machine reaching the loopback API — needs a product decision (an origin allowlist changes
behaviour for any other frontend origin), and the editor itself never calls the API.

### 5.4 `server/db/keyframe_studio.sqlite` is tracked in git — **DEFERRED FOLLOW-UP**
A binary database is part of the repository, so a clone starts from whatever state it holds. It is
outside every release artefact (the package is private and the OGraf exports do not include it), and
removing it needs approval plus an ignore rule.

### 5.5 `vite --host` publishes the dev frontend — **ACCEPTED-DOCUMENTED**
The `dev` script exposes the Vite dev server on the network. It serves a static editor with no data and
is not the API; it is a deliberate development convenience.

### 5.6 No focus restoration when two dialogs close — **DEFERRED FOLLOW-UP**
`ImportReportDialog` and `ConfirmationDialog` do not restore focus to the control that opened them
(only the cubic-bezier editor captures and restores it). An accessibility improvement that was recorded
in Task A and needs its own task; no functional impact.

### 5.7 One unreproduced suite failure during Task B — **ACCEPTED-DOCUMENTED (monitored)**
One full-suite run reported a single failure whose name was lost to a truncated tail; six further full
runs, ten runs of the new integration case and six runs of the state-check suite are clean. No defect
is evidenced. If it recurs, the failure name must be captured before the output is trimmed.

## 6. Verdict

**READY WITH REQUIRED FIXES** — one required item, and it is a clarity fix rather than a product risk:

| # | Item | Why it is required | Type |
|---|---|---|---|
| 1 | The CI "TypeScript Type Check" step verifies nothing | The release evidence contains a green tick that means nothing; the real type gate is the build step | Workflow edit (needs approval) |

**There is no product-correctness or security blocker.** The toolchain installs and runs, the native
binding loads, the OGraf fixture gate and the release smoke pass, the full suite is green, and every
severity-1 finding from the full-project review is closed. H2 may proceed.

The three coverage gaps in §4 are stated so they are not mistaken for coverage: no browser test in CI,
no Windows job, and a manual-only release smoke. They are not required fixes for this release; they are
what the release is *not* proven by.
