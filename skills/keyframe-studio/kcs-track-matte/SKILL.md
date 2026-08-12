---
name: kcs-track-matte
description: Use when working on KCS Track Matte (SVG clipPath + mask) — architecture, data model, browser-verified semantics, rules, tests.
version: 7.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, track-matte, svg, clipPath, mask, alpha, luminance, inverted, freeform, strength, gradient, text-matte, multi-stop]
    related_skills: [kcs-project-context, kcs-constitution, kcs-workflows]
---

# Track Matte (SVG clipPath + mask) — KCS

M11 + M13 + M14 + M15 + M16 + M17 + M18 + M19 sistemi: bir CharacterPart (target), başka bir part'ın
(source) evaluated world geometrisiyle kırpılır. Canvas 2D / PixiJS / Fabric.js YOK —
yalnızca SVG.

## Data model

```ts
// animator.ts
interface PartMatte {
  sourcePartId: string;
  mode?: 'clip' | 'alpha' | 'luminance';  // absent → 'clip' (legacy, runtime-resolved)
  inverted?: boolean;
  enabled?: boolean;
  feather?: number;   // M14: world-space px soft edge; undefined/0 → keskin
  strength?: number;  // M16: 0-1 matte gücü; undefined/1 = tam (legacy); 0 GEÇERLİ
  gradient?: { angle: number; stops?: MatteGradientStop[] };  // M17+M19: linear gradient (paint — ASLA geometry); stops yok = legacy 2-stop; undefined = yok
}
// CharacterPart.matte?: PartMatte   (SceneLayer.matte?: PartMatte — serialization)
```

- M19: `stops` = STATIC PAINT verisi (asla channel/keyframe/animation — M8 korunur);
  yoksa → legacy default 2-stop (byte-for-byte); malformed → `normalizeGradientStops`
  deterministic fallback (sıralama/clamp/default)
- M18: text source için `PartMatte`'e YENİ alan EKLEMEZ — text content/font bilgileri
  runtime'da source CharacterPart'tan okunur (`sourcePartId` tek persistent bağlantı)
- `enabled !== false` → aktif; `mode` yok → `resolveMatteMode` ile 'clip'
- Serialization migration YOK — legacy `{sourcePartId}` import'ta yeniden yazılmaz
- Source kendi channel'larıyla animasyonlu (yeni matte channel YOK — asla ekleme)
- `feather` yalnızca alpha/luminance mask pipeline'ında uygulanır; clip → clipPath (blur yok)
- `strength` yalnızca mask pipeline'ında fill-opacity olarak uygulanır; clip → etkisiz
  (UI disabled); undefined/1 = canonical (DOM byte-for-byte legacy); 0 = matte kapalı
- `gradient` (M17) yalnızca mask pipeline'ında paint olarak uygulanır; clip → etkisiz;
  alpha = white→transparent, luminance = white→black; angle source-local, world-space
  userSpaceOnUse endpoints (source transform'uyla taşınır); M8: channel/keyframe YOK

## Mimari (tek kaynaklar)

```
shapeGeometry.ts → local geometry (10 statik shape) — TEK kaynak; renderer + matte ortak
matte.ts         → buildMattePath(source, worldTransform) → world-space pathD (SINGLE geometry core;
                   text source için NULL — text geometry ÜRETMEZ)
                   buildMatteClipPath (clip wrapper) / buildMatteMaskFromPath (mask data)
                   matteClipPathId: kcs-clip-{sourceId} / matteMaskId: kcs-mask-{src}-{mode}{-inv}{-f{feather}}{-s{strength}}{-g{angle}}
                   gradientId: kcs-mg-{sourceId}-{normalizedAngle}-{mode} / gradientEndpoints (bbox → 2 nokta → applyWorld)
                   M18: textMaskContent (source → render descriptor), buildMatteTextMask (pathD null + text),
                   worldToLocal (applyWorld inverse), gradientEndpointsLocal (world→local — text gradient def'leri)
                   M19: normalizeGradientStops (tek normalization authority — sort/clamp/default),
                   canonicalStopsKey + gradientStopsHash (deterministic FNV-1a),
                   matteMaskGradientSuffix (-g{angle}[-s{hash}] — stops identity mask id'sinde)
                   resolveMatteMode / isMatteEligible / normalizeFeather / normalizeStrength / normalizeGradientAngle
StagePartLayers  → evaluateFrame sonrası: matteClips + matteMasks Map dedupe → tek <defs>
                   maskPathCache: aynı source'un farklı mask modları 1 buildMattePath paylaşır
                   M18: text source → buildMattePath ÇAĞRILMAZ; mask content = <g transform=bake><text>
                   (bake: translate(CX+tx,CY+ty) rotate(r) scale(sx,sy) — evaluated world her frame; stale yok);
                   text transform'ları textTransforms Map (maskId → world) render-data (persist edilmez)
                   feather>0 → mask id'ye -f{feather} suffixi (aynı source farklı feather → çakışmaz)
                   strength<1 → mask id'ye -s{strength} suffixi (M16; aynı source farklı strength → çakışmaz)
                   mask content'e fillOpacity (yalnızca strength<1; undefined/1 → attr YOK)
                   gradient → mask id'ye -g{angle} suffixi + <linearGradient> def (M17; userSpaceOnUse,
                   world-space endpoints, alpha/luminance default stops, mode id'de — aynı source+angle
                   farklı mode → ayrı def; mask content fill=url(#kcs-mg-...))
                   M18 text gradient: def endpoints LOKAL (gradientEndpointsLocal); inverted text → def
                   key/stops STRUCTURE (luminance) — alpha+inverted+text çakışmaz
                   feather filter: feGaussianBlur stdDeviation=feather/2, filterUnits=userSpaceOnUse,
                   geniş region (artboard ± feather — blur kırpılmaz); yalnızca MASK'lara
PartRenderer     → clip/mask TRANSFORM'SIZ OUTER <g>'de; transform/opacity/events INNER <g>'de
                   (M13 2E fix: userSpaceOnUse defs, transform'lu g'de referans edilince
                    target'ın LOCAL uzayında çözülür — outer g dünya uzayını garanti eder)
validateScene    → MATTE_MISSING_SOURCE (recoverable)
useSerialization → layers[].matte pass-through (M8 channels-only policy DEĞİŞMEZ)
StyleMatteSection→ Inspector: source seçici + Mode select + Inverted toggle + FEATHER slider
                   (0-100, clip modunda DISABLED — renderer clip feather desteklemez) + Enabled + Remove
```

## Rendering (browser-verified)

| Mode | Inverted | SVG yapısı |
|------|----------|-----------|
| clip | hayır | `<clipPath clipPathUnits="userSpaceOnUse"><path d={worldPathD}/>` |
| alpha | hayır | `<mask maskUnits maskContentUnits="userSpaceOnUse" mask-type="alpha"><path fill="white"/>` |
| alpha | EVET | `<mask ... mask-type="alpha"><path d={regionContour + ' ' + pathD} fill-rule="evenodd" fill="white"/>` |
| luminance | hayır | `<mask ... mask-type="luminance"><path fill={sourceFillColor}/>` |
| luminance | EVET | `<mask ... mask-type="luminance"><rect region fill="white"/><path d={pathD} fill="black"/>` |
| text (M18) | hayır | `<mask ... mask-type={mode}><g transform={bake}><text x=0 y=0 text-anchor=middle dominant-baseline=middle fill="white"/>` |
| text (M18) | EVET | `<mask ... mask-type="luminance"><rect region fill="white"/><g transform={bake}><text ... fill="black"/>` — her durumda luminance yapısı (4A kararı) |

Inverted mask region = CANVAS_CENTER ± projectResolution/2 (artboard-clip ile aynı hesap;
StageCanvas'tan prop gelir, default 1920×1080). Pan/zoom path'e GİRMEZ.

M18 text satırları: `bake` = `translate(CX + tx, CY + ty) rotate(r) scale(sx, sy)` — evaluated
world transform her frame (stale YOK); text mask'te pathD YOK (path elemanı ÜRETİLMEZ).

## M14 — Feather (browser pixel-verified)

- `PartMatte.feather` = world-space px; undefined/0 → M13 keskin kenar (DOM birebir);
  >0 → `<filter id="kcs-matte-feather-{maskId}">` + `feGaussianBlur stdDeviation=feather/2`
- Feather YALNIZCA mask modlarında: alpha/luminance, inverted dahil. CLIP modunda
  renderer feather'a BAKMAZ (clipPath blur alamaz) → UI slider clip modunda disabled.
- Filter `filterUnits="userSpaceOnUse"` + geniş region (artboard ± feather) — dar region
  blur'u kırpar (spike'landı).
- Aynı source'a farklı feather değerleri → deterministik ayrı mask/filter id
  (`-f6` / `-f12`); aynı (source, mode, inverted, feather) → tek mask + tek filter dedupe.
- Alpha inverted + feather: evenodd tek path'e filter uygulanır (delik korunur — V-K).
- Luminance inverted + feather: region rect FİLTRESİZ, siyah geometry path filtrelenir (V-D).
- `mask-type` her zaman explicit (`alpha`/`luminance`); normalizeFeather: negatif/NaN/Inf → 0.
- Source opacity matte strength'e BAĞLANMAZ (visual opacity ile matte bağımsız).

## Browser pitfall'ları (pixel-verified — Chromium)

- `userSpaceOnUse` defs, TRANSFORM'LU target g'de referans edilince target'ın LOCAL
  uzayında çözülür → world-space path yanlış konumlanır. Çözüm: clip/mask'i
  transform'suz OUTER `<g>`'de tut (M13 2E coordinate fix).
- ALPHA mask'ta region rect + ikinci eleman birlikteyken ikinci eleman YOK sayılır
  (fill'ten bağımsız: transparent/rgba/hex8/fill-opacity hepsi FAILED). Çözüm:
  inverted alpha → TEK evenodd path (region konturu + matte konturu) — pixel kanıtı.
- Luminance mask'ta iki eleman (rect + path) DOĞRU çalışır (V-D/V-F PASS).
- maskContentUnits="userSpaceOnUse" her mask'ta açıkça belirtilir.

## Kurallar

- `sourcePartId` otomatik remap YOK (copy/duplicate'ta aynen taşınır — bilinçli)
- Matte ≠ parent-child: parentId sistemine DOKUNMAZ; source normal render edilir
  (opacity/visible/zIndex clip geometrisini etkilemez)
- Missing source → clip/mask yok + recoverable uyarı; asla crash
- Geometry ASLA hardcode etme — statik shape'ler hep shapeGeometry → buildMattePath;
  freeform (M15) aynı kurala tabi: `CharacterPart.points` renderer'ın
  `buildFreeformPath` kaynağıyla AYNIDIR (ikinci geometry sistemi yok)
- CANVAS_CENTER constants.ts'ten (tek sabit); viewport pan/zoom path'e GİRMEZ
- Text (M18) mask CONTENT ELEMENT'tir — ikinci geometry sistemi DEĞİLDİR; image/video
  matte hâlâ DEFER (geometry yok → buildMattePath null → clip/mask yok)
- `isMatteEligible(part)` — source aday filtresi: statik shape VEYA custom_freeform
  VEYA custom_text (M18); image/video/cloner/particle/unknown → false

## M15 — Freeform Track Matte

- `custom_freeform` artık matte source OLABİLİR (3B): `buildMattePath` freeform dalı =
  `CharacterPart.points` → `applyWorld` per nokta → world-space polygon pathD
  (static polygon branch ile birebir math — geometry parity testli)
- Renderer'ın çizdiği `buildFreeformPath(points)` ile matte'in kullandığı points
  AYNI dizidir (tek kaynak); static shape zinciri değişmedi
- clip / alpha / luminance / inverted / feather — hepsi freeform source ile çalışır
  (V-M1..V-M6 pixel-verified); rotated/scaled + animated source destekli (V-M5/V-M6)
- Edge: points yok/boş/<2/non-array → null (güvenli); self-intersecting → crash yok
- Serialization: points + matte pass-through ile kayıpsız round-trip (V-M7/V-M8:
  gerçek import→render sonrası pixel birebir)
- UI (3D): `StyleMatteSection` `isMatteEligible` kullanır → freeform listede;
  source swap `{ ...matte, sourcePartId }` — mode/inverted/enabled/feather korunur

## M16 — Matte Strength / Opacity

- `PartMatte.strength?: number` (0-1): matte etkisinin gücü — mask content'e
  `fill-opacity` olarak uygulanır (yalnızca alpha/luminance mask pipeline'ı)
- `normalizeStrength`: undefined/NaN/±Inf/negatif/>1 → 1 (legacy tam güç);
  **0 GEÇERLİ** (matte kapalı) — `|| 1` KULLANMA
- `undefined`/`1` = canonical: DOM byte-for-byte legacy (fill-opacity attr YOK,
  mask id suffixi YOK); `0.5` → `fill-opacity="0.5"` + id `-s0.5`
- Dedupe: aynı (source, mode, inverted, feather) farklı strength → ayrı mask id
  (`-s{strength}` suffixi — çakışma yok); strength undefined/1 → canonical id
- Clip modunda ETKİSİZ (clipPath opacity alamaz) → UI'da disabled (feather gibi)
- inverted alpha (evenodd) + inverted luminance: strength tüm mask içeriğine
  uygulanır (evenodd path / white rect + black path); geometry değişmez
- feather + strength birlikte: filter/stdDeviation/region DEĞİŞMEZ (strength
  feather ile çarpılmaz); ikisi bağımsız mask parametreleri
- Geometry DEĞİLDİR, transform DEĞİLDİR, channel DEĞİLDİR — M8 korunur,
  animasyon MVP kapsamı dışında (deferred)
- Serialization: pass-through (strength 0/0.5/1 + undefined korunur; 0 falsy
  olmasına rağmen kaybolmaz); import→render pixel parity (V-S6..V-S8)

## M17 — Gradient Track Matte

- `PartMatte.gradient?: { angle: number }` — LINEAR gradient (M17 MVP: yalnızca
  angle; M19 ile `stops` eklendi). undefined = legacy (DOM birebir)
- `normalizeGradientAngle`: undefined → undefined (gradient yok — 0'a çevrilmez);
  NaN/±Inf → 0; finite → `((v % 360) + 360) % 360` (360 ≡ 0, -315 ≡ 45)
- PAINT'tir, ASLA geometry değildir: `buildMattePath` tek geometry kaynağı;
  `gradientEndpoints` = source'un LOKAL bbox'ından (shapeGeometry points /
  freeform points — aynı kaynak) angle boyunca 2 nokta → `applyWorld` ile world
  → `userSpaceOnUse` `<linearGradient x1/y1/x2/y2>` — gradient source'la
  taşınır/döner/ölçeklenir/flip olur (parent + animasyon dahil)
- Mask content `fill="url(#kcs-mg-{sourceId}-{normalizedAngle}-{mode})"`
  (mode id'de: alpha/luminance farklı default stops); mask id `-g{angle}` suffixi
- alpha stops: white→transparent; luminance stops: white→black (grayscale)
- inverted alpha: TEK evenodd path + gradient fill (M13 yapısı bozulmaz);
  inverted luminance: rect gradient fill + siyah kontur (M13 yapısı korunur)
- clip modunda ETKİSİZ (clipPath paint kullanamaz) → UI disabled
- feather + strength bağımsız: blur fill'den sonra; fill-opacity global çarpan
  (gradient × strength — gradient RENORMALIZE edilmez; stdDeviation değişmez)
- Source animasyonu destekli (endpoints her frame evaluated transform'dan —
  stale yok); gradient parametreleri STATİK (M8: channel/keyframe YOK)
- Serialization: pass-through (`layers[].matte.gradient`; undefined → key yok;
  import→render pixel parity — V-G8)

## M18 — Text Track Matte

- `custom_text` artık matte source OLABİLİR (`isMatteEligible(custom_text) === true`).
  Text mask'ta pathD YOK: `buildMattePath` text için **null** kalır (text geometry
  ÜRETİLMEZ) — mask CONTENT ELEMENT'i `<text>`'tir. İkinci geometry sistemi YOK.
- Mask content: `<g transform="translate(CX+tx, CY+ty) rotate(r) scale(sx,sy)"><text
  x=0 y=0 text-anchor=middle dominant-baseline=middle fontSize fontWeight
  fontFamily>{content}</text></g>` — content/font'lar SOURCE'tan runtime'da okunur
  (parity: `textValue||'TEXT'`, `fontSize||24`, `fontWeight:'bold'`,
  `fontFamily||'Outfit'`); transform bake evaluated world'dan HER FRAME (stale YOK —
  V-T11).
- `worldToLocal` = applyWorld inverse (`p_local = R⁻¹·(p_world − (CX+t)) / scale`);
  negatif scale destekli; zero-scale → 1 (deterministik, NaN/Inf yok).
- **inverted + text → HER DURUMDA luminance yapısı** (4A pixel kararı: Chromium
  alpha mask ikinci elementi ignore ediyor — ink=255 outside=255): white region
  rect + siyah text; `mask-type="luminance"`; `mask.fill` = white (normal) / black
  (inverted).
- Gradient (M17 sistemi korunur): text source'ta def endpoint'leri LOKAL
  (`gradientEndpointsLocal` = world endpoint → worldToLocal; text'in geometry bbox'ı
  yok → kanonik default local box 200×60). Inverted text'te def key/stops STRUCTURE
  (luminance) — alpha+inverted+text gradient id çakışması olmaz.
- Feather/strength: mevcut pipeline birebir (filter=featherUrl, fill-opacity=strength;
  text content'te uygulanır).
- CLIP: text source + clip desteklenmez (buildMattePath null → clip oluşmaz);
  UI'da Clip option disabled (`sourceIsText` derive) + non-blocking not.
- Dedupe: aynı (source, mode, inverted, feather, strength, gradient) → tek mask def +
  N referans (V-T12).
- Serialization: yalnızca `sourcePartId` persistent; text content/font render-data
  matte JSON'una YAZILMAZ; `useSerialization.ts` DEĞİŞMEDEN pass-through çalışır.
- M8: text matte channel/keyframe DEĞİLDİR; bağımsız text matte animasyonu yok
  (source kendi transform channel'larıyla animasyonlu — V-T11).
- Font determinizm (test stratejisi): `document.fonts.ready` + `fonts.check`;
  pixel testlerde deterministic sistem fontu (Arial) + solid crossbar glif modeli
  ("HHH") — glif delikleri/kenar yumuşatmasına bağımlı probe YOK.
- Text stagger/tspan animasyonu MVP DIŞIDIR (deferred).

## M19 — Custom / Multi-stop Gradient

- `gradient.stops?: MatteGradientStop[]` ({ offset 0-1, color, opacity 0-1 }) — custom
  multi-stop LINEAR gradient (UI MVP: 2-4 stop). STATIC PAINT verisi: asla channel /
  keyframe / animation (M8 korunur — stops animasyonlu DEĞİLDİR).
- `normalizeGradientStops(stops, mode)` — TEK normalization authority: offset/opacity
  clamp [0,1] (malformed → 0/1), color non-empty string (malformed → 'white'), non-object
  entry'ler DROPPED, **stabil sıralama** (eşit offset'ler girdi sırasını korur — Chromium
  document order işler), <2 geçerli stop → `getDefaultGradientStops(mode)` (legacy parity).
- `canonicalStopsKey` + `gradientStopsHash` — deterministic FNV-1a (32-bit hex, 8 karakter);
  aynı normalize set → aynı hash; farklı set → farklı hash; insertion-order bağımsız;
  random/time/address YOK.
- Identity: def `kcs-mg-{src}-{angle}-s{hash}-{structure}`; mask `-g{angle}-s{hash}`
  (`matteMaskGradientSuffix`) — aynı source+angle FARKLI stops → farklı def + farklı mask
  (collision YOK — 5A spike kanıtı: duplicate id'lerde Chromium İLK def'i kullanır);
  aynı normalize set (farklı girdi sırası) → TEK def + TEK mask (dedupe).
- Legacy: `{angle}` stops'suz → byte-for-byte legacy id + default 2-stop render;
  serialization stops UYDURMAZ; ilk UI stop edit'inde stops materialize olur.
- Render: mevcut `g.stops.map` — normalize stops `stop offset/color/opacity` olarak def'e;
  feather/strength/inverted/rotation/scale hepsi multi-stop ile çalışır (V-H3..V-H12).
- UI (StyleMatteSection): STOPS editörü — Add (en büyük boşluğun midpoint'i, sol stop'tan
  miras; max 4), Remove (min 2'de disabled), color (native), offset (0-1), opacity (0-1);
  local state YOK; legacy `{angle}` dokunulmadan gösterilir.
- **INVERTED TEXT koordinat kontratı (5E blocker fix — pixel kanıtlı)**: inverted text'te
  gradient'in TEK tüketicisi WORLD-space region rect'tir (text SİYAH — 4A kararı). Bu yüzden:
  - inverted text def endpoint'leri **WORLD** (`gradientEndpoints` — text box ±100 → applyWorld)
  - inverted text def identity: `-luminance-inv` (non-inverted luminance TEXT def'i LOKAL —
    `-luminance` — asla çakışmaz)
  - inverted text content: **düz siyah** (fill="black", asla url())
  - non-inverted text: **LOKAL** endpoint'ler + text fill=url (4A kararı korunur)
- Serialization: `gradient.stops` pass-through (exact round-trip); malformed stops
  serializer tarafından DEĞİŞTİRİLMEZ (persistent data korunur, normalize render'da);
  runtime veri persist edilmez; import/reload pixel parity EXACT (V-H12).

## Test'ler

- `matte.test.ts` — world-space A/B/C (static/rotated+scaled/parented), animated frame,
  shape kapsamı, deterministic, pure helper'lar (buildMattePath/buildMatteMask/resolve/
  normalizeFeather/normalizeStrength/normalizeGradientAngle/gradientId/matteMaskId/
  isMatteEligible), M15 freeform (parity/edge/transform), M16 strength, M17 gradient
  (normalize/id/stops/geometry parity — gradient paint'tir), M18 text
  (isMatteEligible(custom_text), textMaskContent descriptor, buildMatteTextMask,
  worldToLocal inverse — identity/rotation/scale/neg-scale/zero-scale/round-trip,
  gradientEndpointsLocal, buildMattePath(text) → null, M8: channel yok),
  M19 stops (defaults, normalization/sort/clamp/duplicate-offset/salvage/drop,
  canonical key, FNV-1a determinizm, legacy id byte-for-byte, stops-aware id,
  farklı stops farklı id, malformed stabil, M8)
- `matteRender.test.tsx` — render: tek clip/mask def, N target, enabled=false,
  missing source, freeform (M15), mixed modes geometry parity, evenodd alpha-inv,
  feather (filter + stdDeviation + region, dedupe, id collision yok, rotated parity),
  M16 strength (fill-opacity undefined/0.5/0, inverted evenodd, luminance rect+path,
  feather+strength, clip etkisiz, dedupe ayrı -s id), M17 gradient (linearGradient def +
  userSpaceOnUse + stops + fill=url, inverted evenodd tek path, luminance rect+path,
  clip etkisiz, feather/strength bağımsız, freeform pathD değişmez, dedupe -g id),
  M18 text (A: text content/font/attrs + bake transform, B: luminance, C: inverted
  luminance yapısı — white rect + black text, D: gradient fill=url + lokal endpoint,
  E: feather filter, F: fill-opacity strength, G: rotation/scale bake, H: dedupe 1 def +
  2 ref, I: text+clip → clip/mask YOK)
- `styleMatteSection.test.tsx` — UI: source/mode/inverted/enabled/remove, legacy display,
  FEATHER slider, M15 freeform listede + source swap preservation, M16 STRENGTH slider,
  M17 GRADIENT toggle + ANGLE slider (0-360, clip disabled, normalize-yazım, field
  preservation), M18 text UI policy (text listede, text+clip → option disabled + not,
  text+inverted normal checkbox, text+gradient/feather/strength enabled + preservation,
  source switching text↔shape field preservation, missing text source güvenli)
- `useSerialization.test.ts` — matte round-trip (alpha/luminance/inverted/combined/
  enabled=false/legacy/feather/undefined-key), channels-only policy,
  M15 freeform, M16 strength, M17 gradient (0/45/90/360-raw/malformed/full matte/
  freeform+gradient/channels-only/legacy), M18 text (7 alanlı round-trip, runtime text
  data matte JSON'una GİRMEZ, gradient absent→absent, 360 canonical, malformed safe,
  M8: channel/keyframe yok, shape backward-compat)
- `e2e/track-matte.spec.ts` — REAL Chromium: DOM + gerçek PIXEL compositing testleri
  (V-A..V-L, V-M1..V-M8, V-S1..V-S8, V-G1..V-G12, M18 V-T1..V-T17, M19 V-H1..V-H12 —
  world→screen CTM + PNG decode; import→render round-trip pixel parity: V-M7/V-M8,
  V-S6..V-S8, V-G8, V-T17, V-H12)
- Baseline: 599/599 vitest + 76/76 track-matte playwright (M19 kapanışı; full suite'te
  workflow.spec.ts:88 bilinen ÖLÜ container testi fail — b60f1ca sonrası, M19 dışı)

## Deferred (yeni feature kararı gerektirir — M13..M19'da YAPILMADI)

**radial gradient** · **gradient presets** · **gradient animation** ·
image/video matte · nested matte · multi-matte (tip migration gerekir) ·
matte gizmo / geometry editor · outliner matte icon / relationship visualization ·
timeline matte indicator · drag/drop matte assignment ·
**animated strength** (strength channel/animasyon M16 MVP dışı) ·
**text stagger / tspan animasyonu** (M18 MVP dışı)
