# Manual QA Round 4 — remediation, part 2 of 3

Branch: `fix/manual-qa-round1-remediation` (existing; PR #9 stays open, not merged).
Base: `origin/main` @ `8e2df61`. Worktree: `keyframe-character-studio-omp-manual-qa-r1`.

Part 1 (already on this branch, not redone): R4-03 + R4-04 (`c9357c3`), R4-07 (`babf9b3`),
R4-14 (`bc49601`), docs mirror (`6c3717f`).

Part 2 scope: R4-15, R4-16, R4-13, R4-09, R4-05, R4-06.

## Result summary

| Finding | Status |
| --- | --- |
| R4-15 FPS/timebase end-to-end (release critical) | **Fixed + contract recorded** |
| R4-16 dev/LAN cache freshness | **Audited; hardened; contract recorded** |
| R4-13 macOS ZIP compatibility | **Audited; structurally verified; one fold fix** |
| R4-06 property tree simplification | **Fixed** |
| R4-09 group selection UX (vector-editor model) | **NOT DONE** — no code change; see "Not done" |
| R4-05 previous/next keyframe semantics (property-level controls) | **NOT DONE** — no code change; see "Not done" |

---

## R4-15 — FPS / TIMEBASE END-TO-END AUDIT (release critical)

### Findings

1. **Playback was cadence-driven, not time-driven.** `usePlayback` advanced at most ONE authored frame per
   `requestAnimationFrame` callback (`if (delta >= 1000 / fps) setCurrentFrame(prev => prev + 1)`). A 120 FPS
   authoring therefore played at half speed on a 60 Hz display (one frame per callback = 60 frames/second), and
   a dropped or throttled callback lost its whole interval. **The monitor's refresh rate changed the authored
   duration** — a release-critical defect.
2. **Project FPS choices/default.** The header offers 24/30/60/120; `usePlayback` defaults to 60 and a new
   template resets to 60. Nothing in the code depends on a specific value, and nothing treats 120 as a redraw
   rate: the 120 FPS option is simply the finest authoring rate offered, and it is the value the old loop
   handled worst (see 1).
3. **Frame ↔ seconds conversion.** `frame / fps` was computed inline in the timeline duration control, the
   duration presets, the keyframe panel and the timecode formatter. There was no named authority, and no guard
   on a document whose FPS cannot carry the mapping (0 / negative / non-finite / fractional).
4. **Sequence duration.** The duration field wrote `round(sec * fps)` and read `frames / fps`, so wall-clock
   duration was preserved across FPS changes — correct, now routed through the named conversion.
5. **Save/load.** `fps` and `totalFrames` are persisted in `SceneData` and restored unchanged; verified by a
   round-trip test (`exportProject()` → restore → `setFps(30)` / `setTotalFrames(60)`), so a reloaded document
   keeps its duration.
6. **Fractional rates.** Unsupported, and documented rather than faked: the Lottie importer rounds `fr` and
   emits `LOTTIE_FRACTIONAL_FPS`; the editor only offers whole rates; the FPS authority refuses a rate that
   cannot carry `seconds = frame / fps`.
7. **OGraf serialization/runtime.** The manifest carries the authored `fps` (`renderRequirements.frameRate.ideal`)
   and the generated runtime advances by ELAPSED TIME (`duration = |targetFrame - startFrame| / fps * 1000` ms,
   `progress = (now - started) / duration` → `_currentFrame = startFrame + (targetFrame - startFrame) * progress`).
   There is no `goToTime` in the runtime; `_animate` is the time-driven entry point and is covered by a test.
8. **Reality-specific timing.** Nothing in KCS assumes the host's timeline FPS. Because the runtime is
   time-driven, a Reality Hub Timeline whose FPS differs from the KCS setting still renders the graphic for its
   authored wall-clock duration; only the graphic's frame count and FPS define that duration. **No KCS setting
   must match a Reality Hub Timeline FPS for timing to be correct.**
9. **GIF export (R4-12, part 3).** Not present in this repository; the mapping it must use is recorded in the
   contract below.

### Change

- `src/utils/timebase.ts` — the named authority and the contract: `seconds = frame / fps`,
  `SUPPORTED_PROJECT_FPS`, `DEFAULT_PROJECT_FPS`, `sanitizeProjectFps`, `frameToSeconds`, `secondsToFrame`.
- `src/hooks/usePlayback.ts` — the loop now integrates elapsed time into a millisecond remainder and steps the
  playhead by `floor(remainder / frameInterval)` whole frames; the remainder carries across callbacks, a
  non-monotonic clock cannot run time backwards, reaching the end stops playback at the end pose (a multi-frame
  callback cannot overshoot it), and a looping animation wraps by `totalFrames + 1` (frame 0 and frame
  `totalFrames` are the same pose). `setFps` sanitizes at the authority.
- `src/components/Timeline/SequencerTimeline.tsx`, `src/components/Inspector/sections/KeyframesTab.tsx` — the
  duration field, the duration presets and the keyframe panel convert through `frameToSeconds` /
  `secondsToFrame`.

### Tests (`src/tests/projectTimebase.test.ts`, 10 tests)

A controllable `requestAnimationFrame` harness drives the REAL hook with explicit timestamps, so the simulated
display refresh rate is a parameter (30/60/120/144 Hz). Probes sit 1 ms past the boundary they assert, because
`1000/fps` has no exact binary representation.

| Assertion | 30 FPS | 60 FPS | 120 FPS |
| --- | --- | --- | --- |
| end frame at t = 2 s (+1 ms), every cadence | 60 | 120 | 240 |
| frame at t = 1 s (+1 ms), every cadence | 30 | 60 | 120 |
| `frameToSeconds(frame, fps)` at the end | 2.000000 | 2.000000 | 2.000000 |
| 120 FPS animation on a 60 Hz cadence at t = 1 s | — | — | 120 (a one-frame-per-callback loop reported 60) |
| single 501 ms stall at 60 FPS | 30 frames recovered, then 60 | | |
| looping 60-frame cycle after 2501 ms at 60 FPS | frame 28, still playing | | |
| OGraf runtime `_animate(60)` at 30 FPS, 144 Hz cadence | frame ≈30 at t = 1 s, exactly 60 at t = 2 s | | |
| save → reload | `fps` 30 and `totalFrames` 60 restored | | |

### FPS/TIMEBASE CONTRACT (literal)

> The ONE mapping between frames and time is `seconds = frame / fps` and `frame = seconds * fps`;
> `src/utils/timebase.ts` is its named authority and every conversion in the editor goes through it.
>
> - The project FPS is an authored **time mapping**, never a redraw budget. Changing it re-maps frames to
>   seconds; it does not change what the viewer sees.
> - The monitor/browser refresh rate has **no** effect on authored duration: playback integrates elapsed
>   wall-clock time and steps the playhead by whole authored frames (`usePlayback`). A dropped or throttled
>   callback recovers its time instead of stretching the animation. 30, 60 and 120 FPS authorings of the same
>   animation reach the same frame at the same instant, and the same midpoint at half the duration.
> - The FPS is a positive **whole** number of frames per second. Fractional rates such as 59.94 are NOT
>   supported and are never faked: the Lottie importer rounds `fr` and reports `LOTTIE_FRACTIONAL_FPS`, and the
>   editor offers 24/30/60/120 with 60 as the new-document default. A document whose FPS cannot carry the
>   mapping (0, negative, non-finite, fractional) keeps the current rate at the FPS authority.
> - Sequence duration: the timeline's duration field and its `1s…10s` presets write `round(seconds * fps)`
>   frames and read `frameToSeconds`, so the seconds the user types are the seconds the animation lasts.
> - Save/load: `fps` and `totalFrames` are persisted and restored unchanged, so a reloaded document keeps its
>   exact duration.
> - OGraf: the package carries the same `fps` on SceneData and asks for it in
>   `renderRequirements.frameRate.ideal`; the generated runtime advances by elapsed time
>   (`|targetFrame - startFrame| / fps * 1000` ms → progress). An exported graphic therefore keeps its
>   wall-clock duration in a host whose own timeline FPS differs — a **Reality Hub Timeline FPS does not have
>   to match the KCS FPS**; only the graphic's frame count and FPS define its duration.
> - Any GIF/video export (round 4, part 3) must map `frameDelayMs = 1000 / fps` per authored frame, for the
>   same reason: frame count × delay = wall-clock duration, independent of the encoding cadence.

---

## R4-16 — DEV / LAN CACHE FRESHNESS AUDIT

### Classification: **persisted user document**, not stale app code

Audited separately, with evidence:

1. **Service worker / PWA registration — none.** No `serviceWorker` registration, no `workbox`, no PWA manifest
   anywhere in `src`, `index.html` or `public/`. The only public assets are `favicon.svg` and `icons.svg`.
2. **Cache Storage — not used.** No `caches.*` call anywhere in the app.
3. **Dev-server headers — correct (measured against a running dev server on an isolated port).**
   - entry document `/` → `200`, `Cache-Control: no-cache`, `ETag` (revalidates on every navigation);
   - `/src/main.tsx`, `/src/index.css` → `Cache-Control: no-cache` + `ETag`;
   - `/favicon.svg` → `Cache-Control: no-cache` + `ETag` + `Last-Modified`;
   - `/node_modules/.vite/deps/react.js` → `Cache-Control: max-age=31536000,immutable` (Vite's dep-optimizer
     cache; its URL carries a content hash and it is re-bundled when a dependency changes).
   Two-marker repro on that server: marker A served, file rewritten to marker B, a fresh navigation returned
   **B**, and a conditional request carrying the OLD ETag answered `200` with the NEW ETag (never a stale 304).
4. **bfcache / session restore — possible but not code staleness.** A long-lived SPA tab keeps the code it
   loaded in memory; a tab restored from bfcache shows that same in-memory app. Nothing in the repository can
   fix an un-reloaded tab, and Vite's own client reconnects/reloads after a server restart.
5. **localStorage / autosave restoring an old DOCUMENT — this is the real explanation.** `useSerialization`
   restores the last autosaved `SceneData` from `localStorage` on boot and writes it back every 10 s; the only
   other key is the custom-preset store. A returning LAN user therefore sees their **previous project** (its
   scene title and its layers) rendered by current source, and that reads as "old content".
6. **Origin server offline — no masquerade.** With no service worker there is no offline shell; an offline
   navigation gets the browser's own error page. Note also that a plain-HTTP LAN origin
   (`http://172.16.0.172:5173`) is **not a secure context**, so `navigator.serviceWorker` and Cache Storage do
   not even exist there — no offline shell can be registered on the reported origin at all.

### Change

- `src/utils/devFreshness.ts` + `src/main.tsx` — a **dev-only** guard (`import.meta.env.DEV`) that retires any
  service-worker registration found on the origin. A retired registration no longer intercepts navigation; its
  caches are left alone because a cache with no controlling worker is never served. The guard is a no-op where
  the API is absent (an insecure LAN origin, jsdom, an older browser).
- `vite.config.ts` — the dev-only `kcs-dev-document-freshness` plugin pins `Cache-Control: no-store` on the
  **entry document only** (`/` and any `.html`). Vite's own HTML handler sets `no-cache` after a
  `configureServer` middleware runs, so the header is pinned at the write. Modules, public assets and
  pre-bundled dependencies keep Vite's own headers, and a production build is untouched.
- Tests (`src/tests/devFreshness.test.ts`, 6 tests): the document pin survives the dev server's later
  `no-cache` write, covers `/` and `.html` and nothing else, is dev-only (`apply: 'serve'`), and the guard
  retires registrations, counts only successful retirements and is a no-op without the API.

### DEV FRESHNESS CONTRACT (literal)

> Stale **app code** must never be the explanation for "the LAN URL shows old content".
>
> - This repository has **no service worker and no PWA manifest**, and the dev server is reached over plain
>   HTTP (`http://172.16.0.172:5173`), which is not a secure context: `navigator.serviceWorker` and Cache
>   Storage do not exist there, so no offline shell can be registered on that origin. The only `localStorage`
>   keys the app writes are the autosave document and the custom presets.
> - A secure dev origin (localhost/HTTPS) is the one place a stale service worker could survive a rewrite of
>   the dev server, so a dev-only guard (`src/utils/devFreshness.ts`, called from `main.tsx`) retires any
>   registration it finds. Retired registrations no longer intercept navigation; their caches are left alone
>   because a cache with no controlling worker is never served.
> - When the dev server is running, a fresh navigation gets current source: Vite answers the entry document and
>   every source module with `Cache-Control: no-cache` + ETag, so content is revalidated rather than reused.
> - The entry **document** additionally answers `Cache-Control: no-store` in dev (the
>   `kcs-dev-document-freshness` plugin), so no intermediary between a LAN browser and the dev server may
>   replay a stored document. It is deliberately narrow: modules, public assets and pre-bundled dependencies
>   keep their own dev caching, and a production build keeps its immutable hashed-asset caching.
> - An offline navigation cannot masquerade as a live instance: with no service worker there is no offline
>   shell.
> - What is NOT stale code: the editor restores the last autosaved **document** from `localStorage` on boot, so
>   a returning LAN user sees their previous project rendered by current source. That is persistence, and it is
>   a separate axis from code freshness.

---

## R4-13 — macOS ZIP COMPATIBILITY AUDIT

### Structural findings (a real export, decoded by a reader written for the test)

The audit does not trust the writer's own library: `src/tests/ografZipPortability.test.ts` walks the ZIP
**central directory** itself (end-of-central-directory record, then every `PK\x01\x02` record and the local
header each one points at).

- **Separators:** every entry name uses `/`; a backslash never appears in the exported archive.
- **Paths:** no leading `/`, no drive letter (`^[A-Za-z]:`), no `.`/`..` segment; every name is a relative
  package path accepted by `isSafePackageRelativePath`.
- **Compression:** method 8 (deflate) for the text entries and 0 (stored) where the writer stores; both are
  universally supported. A foreign entry with any other method is refused on import
  (`OGRAF_PACKAGE_UNSUPPORTED_COMPRESSION`).
- **Local vs central agreement:** every central record's method and name equal the local header's — a mismatch
  is the classic "corrupt archive on another OS" report.
- **CRC-32:** non-zero for every non-empty entry; validated end-to-end by the independent extractors below.
- **End-of-central-directory:** present, and its declared entry count equals the number of records walked.
- **UTF-8 flag (bit 11):** never set, because the exporter cannot emit a non-ASCII entry name (the guard
  rejects `[^\x20-\x7E]`). A foreign archive with a non-ASCII entry is refused with
  `OGRAF_PACKAGE_UNSAFE_PATH` — deterministically refused, never mis-decoded.
- **Case-insensitive collisions:** guarded in the writer (`collisionKey = path.toLowerCase()`) and in the
  importer (`OGRAF_PACKAGE_DUPLICATE_PATH`), so `Assets/Img.png` + `assets/img.png` cannot collapse into one
  file on macOS/Windows.
- **Windows/macOS-safe names:** reserved device names, trailing dots/spaces and `<>:"/\|?*` are refused or
  sanitized; the download name is an ASCII slug.
- **Contents preserved:** `<graphic>.ograf.json`, `graphic.mjs`, `scene.kcs` and every asset (with its exact
  bytes) survive a round trip; the package re-imports (`readOGrafPackage(...).ok === true`).
- **Download MIME:** `new Blob([...], { type: 'application/zip' })` with a `<name>-ograf.zip` file name.

### Cross-extractor evidence (a real export with a space in an asset path and an accented scene title)

`assets/images/my logo.png`, `cafe-demo.ograf.json`, `scene.kcs`, `graphic.mjs`.

| Extractor | Result |
| --- | --- |
| fflate `unzipSync` (the app's own reader) | 4 entries, byte-identical asset, re-import OK |
| Info-ZIP `unzip -t` | `No errors detected in compressed data` (every CRC OK) |
| bsdtar / libarchive 3.8.8 `tar -tvf` + `-xf` | 4 entries listed and extracted, `assets/images/my logo.png` nested correctly |
| Python 3.12 `zipfile` | `testzip()` → `None` (all CRCs valid), method 8, no UTF-8 flag, extraction preserved the nested path |
| PowerShell `Expand-Archive` (.NET `ZipFile`) | 4 files extracted with correct sizes |

### Change

- `src/utils/pathSafety.ts` — `foldDiacritics` (NFKD + combining-mark removal) so an accented title folds to
  its base letters instead of leaving a stray separator. `sanitizeFilenameComponent` deliberately keeps its
  Unicode-preserving NFKC behaviour (a scene export's own file name is the user's).
- `src/ograf/compiler.ts` — `sanitizeOGrafId` folds through `foldDiacritics` (`Café Démo` → `cafe-demo`
  instead of `cafe-de-mo`).
- Tests: `src/tests/ografZipPortability.test.ts` (7 tests).
- **No macOS CI runner exists** (`.github/workflows` runs `ubuntu-latest` only), so no macOS workflow was added:
  that would be disproportionate workflow churn. The ubuntu CI already runs the vitest suite that carries these
  structural assertions.

---

## R4-06 — PROPERTY TREE SIMPLIFICATION

The tree now reads **Position > {X, Y}, Rotation, Scale > {X, Y}, Opacity, Trim Path > {Start, End, Offset}**.
The redundant `Transform` wrapper row is gone from the outliner AND its lane spacer is gone from the lane
column, so the row-for-row alignment contract (R2-09) holds unchanged. `Transform` remains the internal name of
the model; the layer row is the owner. `src/components/Timeline/SequencerTimeline.css` lost the dead
`.ue-transform-header`, `.ue-transform-label` and `.ue-owner-name` rules with it.

Tests updated for the new shape: `timelineKeyframeNavigation.test.tsx` (tree order + no `Transform` row),
`timelineLaneOwnership.test.tsx` (the first header under the layer is Position; the group still names its owner
when its rows are collapsed), `e2e/timeline-workspace.spec.ts` (R2-09 selectors).

---

## NOT DONE in this part (explicit)

- **R4-09 — group selection UX (vector-editor model).** No code change was made. The current model is: a plain
  Select-tool click on a child of an UNSELECTED group selects the child (only a click inside the already
  SELECTED group keeps the group, via the round-1 `isDescendantOf` body-drag path), which is not the required
  Figma-style "first click selects the group". The required change is a selection-target resolver (outermost
  group ancestor) applied in `StageCanvas`'s `onSelect`/`startTranslateDragForPart`, plus an explicit
  drill-in path and tests; it was not started rather than half-wired. The hit-region half of the requirement
  was verified to already hold: parts are hit-tested per child geometry (no aggregate-AABB hit rect exists), so
  an empty gap inside a group's bounding box does not select the group, and the group hit region is the union
  of its children's geometry.
- **R4-05 — previous/next keyframe arrow semantics (property-level controls).** No code change. The per-LAYER
  `[◀][+][▶]` (R3-07) already satisfies the stated 0/1/2+ policy through
  `resolveLayerKeyframeFrames` / `resolveAdjacentKeyframeFrame` — 0 keys → both disabled; 1 key → both
  disabled while the playhead is on it and only the direction that reaches it enabled otherwise (the
  `resolveAdjacentKeyframeFrame` behaviour); 2+ keys → enabled only when a key exists on that side; never
  wraps — but the policy was not pinned by a test, and the property-level `[◀][+][▶]` controls in the expanded
  keyable rows were not added.

Both remain open for part 3.

## Validation run in this part

| Command | Result |
| --- | --- |
| `npx tsc -b --pretty false` | clean |
| `npm run lint` | clean |
| `npm test` | 158 files / 2368 tests passed, 0 failed, 0 skipped |
| focused Vitest (timebase, dev freshness, zip portability, timeline tree/ownership/navigation, pathSafety, ograf package suite) | all passed |
| dev-server header probe (isolated port 5188) + two-marker repro | see R4-16 |
| cross-extractor ZIP audit (fflate / Info-ZIP / bsdtar / Python / .NET) | see R4-13 |
| `npm run build`, `npm run validate:ograf`, `node scripts/check-state-consistency.mjs`, `git diff --check` | see the run log of the commit |
| `PORT=5012 npm run qa:release`, `PORT=5012 npm run qa:v6`, focused Playwright | **not run in this part** |

The user's live QA services were never touched: the dev server on 5173 (pid 50876) and the API on 5000
(pid 18280) stayed up; every probe ran on the isolated 5188 port and was stopped afterwards.
