# OGraf ecosystem review

Date: 2026-11-03. Scope: how OGraf graphics are specified, rendered and authored outside KCS, what that means for the KCS export, and what is worth doing next.

## Sources

| Source | Pinned | License | Used for |
|---|---|---|---|
| [ograf.ebu.io](https://ograf.ebu.io/), [ebu/ograf](https://github.com/ebu/ograf) | f89f789 (2026-10-29) | MIT | The normative v1 specification, TypeScript definitions, example graphics, the demo renderer |
| [Eyevinn/ograf-editor](https://github.com/Eyevinn/ograf-editor) | 616841b (2026-06-11) | MIT | A browser editor's model and test list |
| [nytamin/ograf-graphics](https://github.com/nytamin/ograf-graphics) | 74c8eb8 (2026-10-26) | MIT | Authoring rules for OGraf graphics, sample packages |
| [ficosta/ograf](https://github.com/ficosta/ograf) | 68009e9 (2026-10-31) | PolyForm Internal Use (parts MIT/CC-BY) | Concepts only; no code read for reuse |
| [zerodensity/ograf-studio](https://github.com/zerodensity/ograf-studio) | 78ce331 (2026-10-02) | AGPL-3.0-only | Concepts only (user guide); no code, text or fixtures copied |

## How a renderer drives a graphic

From the specification and EBU's demo renderer (`website/js/demo-player.js`):

1. The renderer imports `main`, defines the custom element itself, sizes the element to its output and appends it.
2. It calls `load({ data, renderType, renderCharacteristics })` and waits for the promise. `renderCharacteristics.resolution` is the output size.
3. It then calls `playAction` / `updateAction` / `stopAction` / `customAction` at any time, also before an earlier promise resolved.
4. On removal it calls `dispose()`.

A **non-real-time** renderer (for example a video export) instead calls `setActionsSchedule({ schedule })` once and then `goToTime({ timestamp })` for every output frame. A graphic declares this with `supportsNonRealTime: true`.

Authoring rules collected in nytamin/ograf-graphics (`instructions/agent-instructions.md`), which match the spec's intent:

- A graphic paints **nothing** before the first `playAction`.
- Positions and sizes scale with the renderer's output instead of assuming fixed pixels.
- Every method is implemented, including `goToTime()` and `setActionsSchedule()`.
- The schema uses GDD types where possible.

## What the KCS export did, and what changed

| Area | Before | Now (branch `feat/ograf-renderer-compat`) | Evidence |
|---|---|---|---|
| Paint before play | `load()` drew frame 0 | Nothing is painted until `playAction` | `ografRendererContract.test.ts` |
| Output size | Fixed `width=1920 height=1080` SVG: a 1280x720 renderer cropped the graphic | The SVG fills the renderer-sized element; the viewBox keeps the aspect | Headless Chromium at 1280x720: SVG 1280x720, whole scene visible (was 1920x1080, cropped) |
| Replay | A play after a stop showed the last frame instead of playing in | Plays in again from frame 0 | Contract test (animation held at its first tick) |
| Non-real-time | `load({ renderType: 'non-realtime' })` refused | `setActionsSchedule()` + `goToTime()`; the manifest declares `supportsNonRealTime: true` | Contract tests: before play, mid-play, held, stop, seek backwards |
| Fonts | `@font-face` re-declared in every frame; `load()` did not wait for fonts | One style element; `load()` waits (at most 3 s) for the packaged faces | Contract test (style node identity) |
| Action durations | Not declared | `actionDurations` for play (timeline length), stop and update (0) | `ografExport.test.ts` |
| Thumbnail | None (renderers listed "No thumbnail") | 320 px PNG of the on-air frame, listed in `thumbnails` | E2E `ograf-editor-export.spec.ts` (real PNG 320x180) |
| Mask cost | Full-scene mask regions (30 fps / 2 fps on masked scenes) | Regions bounded (60 fps) | PR #88 |
| Package name | `<name>-ograf.zip` (folder not listed by Reality Hub) | `<name>.ograf.zip` | PR #88 |

### The Reality Hub "ghosting"

The screen recording of 2026-11-03 showed two copies of the graphic during a re-take: one at the end pose and a faded one at the start pose. KCS's runtime painted frame 0 as soon as `load()` ran. A renderer that loads the next instance while the previous one is still on air shows both. The new runtime paints nothing before `playAction`, which removes that cause.

Whether Reality Hub also cross-fades instances on a re-take is **UNVERIFIED**; QA round 3 item 9 separates the two cases.

## Directions, in suggested order

1. **Track Matte feather, strength and gradient in the runtime.** The editor draws them; the export refuses them with a diagnostic. The mask pipeline already has blur and opacity, so feather and strength are the smaller half; gradients need world-space gradient definitions.
2. **Text that fits its box** (needs a product decision, see the QA notes of 2026-11-03):
   - a `maxLength` on public text fields in the schema;
   - a box width on the text layer, with shrink-to-fit down to a minimum size;
   - then an ellipsis, or a second line.
3. **GDD types for every public field.** Text has `single-line`/`multi-line`, colours have `color-rrggbb`; images could declare `file-path/image-path` so controllers show a file picker.
4. **`hidden` on schema properties** that should not name the graphic in playout lists (spec: optional `hidden: true`).
5. **Multi-step graphics** (`stepCount > 1`): map KCS named sequences or timeline markers to OGraf steps, so an operator can step a graphic through states (for example in → highlight → out).
6. **Custom actions** for named sequences that are not steps.
7. **Test in more renderers.** The OGraf DevTool can now render KCS packages non-real-time and export video. Other OGraf-capable renderers (for example SPX, CasparCG with an OGraf host) are **UNVERIFIED** and should be checked against the same packages.

## Not adopted

- OGraf Studio's shader fills, procedural patterns and runtime collections: outside KCS's product boundary for now.
- Code from ficosta/ograf and OGraf Studio: their licenses do not allow reuse.
