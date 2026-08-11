---
name: kcs-track-matte
description: Use when working on KCS Track Matte (SVG clipPath + mask) — architecture, data model, browser-verified semantics, rules, tests.
version: 5.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, track-matte, svg, clipPath, mask, alpha, luminance, inverted, freeform, strength, gradient]
    related_skills: [kcs-project-context, kcs-constitution, kcs-workflows]
---

# Track Matte (SVG clipPath + mask) — KCS

M11 + M13 + M14 + M15 + M16 + M17 sistemi: bir CharacterPart (target), başka bir part'ın
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
  gradient?: { angle: number };  // M17: linear gradient (paint — ASLA geometry); undefined = yok
}
// CharacterPart.matte?: PartMatte   (SceneLayer.matte?: PartMatte — serialization)
```

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
matte.ts         → buildMattePath(source, worldTransform) → world-space pathD (SINGLE geometry core)
                   buildMatteClipPath (clip wrapper) / buildMatteMaskFromPath (mask data)
                   matteClipPathId: kcs-clip-{sourceId} / matteMaskId: kcs-mask-{src}-{mode}{-inv}{-f{feather}}{-s{strength}}{-g{angle}}
                   gradientId: kcs-mg-{sourceId}-{normalizedAngle}-{mode} / gradientEndpoints (bbox → 2 nokta → applyWorld)
                   resolveMatteMode / isMatteEligible / normalizeFeather / normalizeStrength / normalizeGradientAngle
StagePartLayers  → evaluateFrame sonrası: matteClips + matteMasks Map dedupe → tek <defs>
                   maskPathCache: aynı source'un farklı mask modları 1 buildMattePath paylaşır
                   feather>0 → mask id'ye -f{feather} suffixi (aynı source farklı feather → çakışmaz)
                   strength<1 → mask id'ye -s{strength} suffixi (M16; aynı source farklı strength → çakışmaz)
                   mask content'e fillOpacity (yalnızca strength<1; undefined/1 → attr YOK)
                   gradient → mask id'ye -g{angle} suffixi + <linearGradient> def (M17; userSpaceOnUse,
                   world-space endpoints, alpha/luminance default stops, mode id'de — aynı source+angle
                   farklı mode → ayrı def; mask content fill=url(#kcs-mg-...))
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

Inverted mask region = CANVAS_CENTER ± projectResolution/2 (artboard-clip ile aynı hesap;
StageCanvas'tan prop gelir, default 1920×1080). Pan/zoom path'e GİRMEZ.

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
- Text/image/video matte: DEFER (geometry yok → buildMattePath null → clip/mask yok)
- `isMatteEligible(part)` — source aday filtresi: statik shape VEYA custom_freeform;
  text/image/video/unknown → false

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

- `PartMatte.gradient?: { angle: number }` — LINEAR gradient (MVP: yalnızca
  angle; stops/colors/radial/multi-stop YOK). undefined = legacy (DOM birebir)
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

## Test'ler

- `matte.test.ts` — world-space A/B/C (static/rotated+scaled/parented), animated frame,
  shape kapsamı, deterministic, pure helper'lar (buildMattePath/buildMatteMask/resolve/
  normalizeFeather/normalizeStrength/normalizeGradientAngle/gradientId/matteMaskId/
  isMatteEligible), M15 freeform (parity/edge/transform), M16 strength, M17 gradient
  (normalize/id/stops/geometry parity — gradient paint'tir)
- `matteRender.test.tsx` — render: tek clip/mask def, N target, enabled=false,
  missing source, freeform (M15), mixed modes geometry parity, evenodd alpha-inv,
  feather (filter + stdDeviation + region, dedupe, id collision yok, rotated parity),
  M16 strength (fill-opacity undefined/0.5/0, inverted evenodd, luminance rect+path,
  feather+strength, clip etkisiz, dedupe ayrı -s id), M17 gradient (linearGradient def +
  userSpaceOnUse + stops + fill=url, inverted evenodd tek path, luminance rect+path,
  clip etkisiz, feather/strength bağımsız, freeform pathD değişmez, dedupe -g id)
- `styleMatteSection.test.tsx` — UI: source/mode/inverted/enabled/remove, legacy display,
  FEATHER slider, M15 freeform listede + source swap preservation, M16 STRENGTH slider,
  M17 GRADIENT toggle + ANGLE slider (0-360, clip disabled, normalize-yazım, field preservation)
- `useSerialization.test.ts` — matte round-trip (alpha/luminance/inverted/combined/
  enabled=false/legacy/feather/undefined-key), channels-only policy,
  M15 freeform, M16 strength, M17 gradient (0/45/90/360-raw/malformed/full matte/
  freeform+gradient/channels-only/legacy)
- `e2e/track-matte.spec.ts` — REAL Chromium: 8 DOM + 39 gerçek PIXEL compositing testleri
  (V-A..V-L, V-M1..V-M8, V-S1..V-S8, V-G1..V-G12 — world→screen CTM + PNG decode;
  import→render round-trip pixel parity: V-M7/V-M8, V-S6..V-S8, V-G8)
- Baseline: 518/518 vitest + 47/47 track-matte playwright (M17 kapanışı; full suite'te
  workflow.spec.ts:88 bilinen ÖLÜ container testi fail — b60f1ca sonrası, M17 dışı)

## Deferred (yeni feature kararı gerektirir — M13..M17'de YAPILMADI)

**radial gradient** · custom/multi-stop gradient · **gradient animation** ·
text/image/video matte · nested matte · multi-matte (tip migration gerekir) ·
matte gizmo / geometry editor · outliner matte icon / relationship visualization ·
timeline matte indicator · drag/drop matte assignment ·
**animated strength** (strength channel/animasyon M16 MVP dışı)
