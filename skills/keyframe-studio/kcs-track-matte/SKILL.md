---
name: kcs-track-matte
description: Use when working on KCS Track Matte (SVG clipPath + mask) and animation presets/transfer/timeline (M23-29) — architecture, data model, browser-verified semantics, rules, tests.
version: 17.0.0
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

## M20 — Radial Gradient

- `gradient.type?: 'linear' | 'radial'` — additive discriminator. **Missing/undefined type =
  LINEAR** (legacy `{ angle: 45 }` byte-for-byte geçerli — migration/rewrite YOK; render
  normalize edebilir ama serialization legacy veriyi DEĞİŞTİRMEZ). `normalizeGradientType`
  TEK authority: undefined/'linear'/malformed → linear, 'radial' → radial, idempotent.
- **Derived geometry — asla persist edilmez**: center/radius source bounds + evaluated
  transform'dan türetilir (`radialGradientGeometry(sourcePart, world, local)`). Persisted
  data'da cx/cy/radius/rX/rY YOK (serialization testli). "Gradient geometry is derived from
  source bounds/transform; only paint parameters are persisted."
- **Radius kuralı (6A/6B)**: TEK scalar r = bbox bounding circle `sqrt(w²+h²)/2`
  (`sourceLocalPoints` — gradientEndpoints ile AYNI nokta kaynağı; ikinci bbox sistemi YOK).
  WORLD'de `× max(|scaleX|, |scaleY|)` — non-uniform scale rX/rY GEREKTİRMEZ (6A pixel
  kanıtı: world daire elips olmaz, source'u sufficient-covers). Rotation center'ı taşır
  (applyWorld), scalar radius'u DEĞİŞTİRMEZ. Negatif scale → |magnitude|; zero scale → 1
  (worldToLocal konvansiyonu).
- **Koordinat kontratı (4A/5E/6A — ayrı kurallar, genelleştirme YOK)**:
  - shape/freeform: **WORLD** (center applyWorld + max-scale radius)
  - non-inverted text: **LOCAL** (0,0 + kanonik ±100×±30 kutu radius 104.4 — text elemanı
    def'i kendi uzayında çözer)
  - inverted text: **WORLD** (white region rect tüketir) + text düz SİYAH + `-luminance-inv`
    identity (non-inverted text def'i ile asla çakışmaz)
- Render: `<radialGradient id gradientUnits="userSpaceOnUse" cx cy r>` — mevcut M19 tek-pass
  Map-dedupe sistemine minimal branch (discriminated union def değeri; linear birebir korunur).
  Stops %100 M19 reuse (normalizeGradientStops/canonicalStopsKey/gradientStopsHash — ikinci
  sistem YOK). Radial dışı (r ötesi) = SON stop (6A kontratı — linear before-start = İLK
  stop'tan farklıdır).
- Identity: def `kcs-mg-{src}-radial[-s{hash}]-{structure}`; mask suffix `-radial[-s{hash}]`
  (`matteMaskGradientSuffix` — TEK kaynak, def+mask aynı identity). Linear `kcs-mg-{src}-{angle}`
  DEĞİŞMEDİ. `-radial` discriminator → linear/radial asla collision (aynı source+stops'ta
  ayrı def'ler — R-V21). Aynı normalize stops → TEK def (dedupe); farklı stops → ayrı def.
- Feather/strength: DEĞİŞMEDİ — stdDeviation formülü, filter identity, fill-opacity;
  radial radius feather ile ÇARPILMAZ, stops strength ile renormalize EDİLMEZ.
- **Animasyonlu source**: radial geometry her frame'de EVALUATED transform'dan yeniden
  hesaplanır (translate → center takip; scale → radius takip; stale def/geometri YOK —
  R-V17/R-V18). Yeni RAF/state YOK.
- UI (StyleMatteSection): TYPE [Linear | Radial] select — radial'de ANGLE GİZLİ (otomatik
  geometri — redundant radial angle UI yok; stored angle inert kalır, Linear'a dönüşte
  korunur). Linear'a dönüş type alanını OMIT eder (canonical legacy form). M19 stop editörü
  birebir (ikinci editör YOK). Field preservation: type switch'te sourcePartId/mode/inverted/
  enabled/feather/strength/stops korunur. Local state YOK.
- Serialization: `gradient.type` + `stops` pass-through (EXACT round-trip); derived geometry
  serialize edilmez; malformed type pass-through (render normalize — kontrat).
- **Bilinen parity limitation (M19/M20 ortak — M20 kaynaklı regression DEĞİL)**: gradient'li
  INVERTED TEXT'te (linear'de de, radial'de de) siyah text DELİK üretmez (gradient'siz
  inverted text delik üretir — V-T3). Doğrulanmış davranış: text siyah + world region rect
  gradient tüketir + dış alan görünür/ramp'li. V-H8 (M19) yalnızca dış alanı test etti.
  R-V10 bu gerçek davranışı pin'ler (hole iddia ETMEZ).

## M21 — Image Matte

- `custom_image` part'ları matte source olabilir (`isMatteEligible(custom_image) → true` —
  tek authority; video/cloner/particle hâlâ ineligible). Persistent model DEĞİŞMEDİ:
  `matte.sourcePartId` tek kalıcı ilişki; image href/boyutlar source part'tan runtime'da
  okunur (`imageMaskContent` — `imageUrl || innerMediaUrl` tek URL authority, MediaPartRenderer parity).
- Image = **content element** (M18 text gibi): mask içinde transform-baked `<image>`
  (`<g transform><image href .../></g>`); buildMattePath(image) → **null** — path geometry
  ÜRETİLMEZ; ikinci geometry sistemi yok. Bounds: layout box (width×height, merkez 0,0 —
  `normalizeMediaDimension` malformed → 180×120 default) → M20 gradient geometrisinin kaynağı.
- **Image inverted KONTRATI (7A pixel kanıtlı):** image text gibi SİYAH repaint edilemez —
  `fill="black"` ASLA; inverted image = luminance yapısı (white region rect + gerçek image,
  mask-type luminance): **parlak image pikselleri görünür kalır, koyu pikseller delik açar.**
- **Image strength KONTRATI (7A):** `<image>` üzerinde `fill-opacity` INERT — strength
  `opacity={mask.strength}` olarak render edilir (shape/freeform/text fill-opacity yolu
  DEĞİŞMEDİ — "tüm strength fill-opacity'dir" diye genelleme YAPILMAZ).
- **Image + gradient = NESTED-MASK MULTIPLICATION (7A kanıtlı):** `<image>` fill tüketmez —
  `<image fill="url(...)">` ASLA. Final mask: `<g mask="url(#kcs-mask-{src}-img)"><rect fill="url(#grad)"/></g>`
  (imageContentMasks Map — deterministic `kcs-mask-{src}-img` content mask; final mask × content
  mask = image_alpha/luminance × gradient_alpha). Linear/radial/multi-stop sistemi M19/M20'den
  birebir reuse. Image gradient geometry WORLD (rect consumer).
- Feather/strength/dedupe/identity: mevcut sistemler birebir; transform animasyonu mevcut
  evaluated source transform pipeline'ından (yeni motor yok, M8 SAFE).
- Image + Clip: **UNSUPPORTED** (path geometry yok) — UI'da Clip disabled + uyarı; legacy
  image+clip güvenli (renderer clipPath ÜRETMEZ); buildMatteClipPath(image) → null.
- Runtime descriptor (href/width/height/preserveAspectRatio) ASLA persist edilmez —
  useSerialization.ts değişmedi; cx/cy/radius/rX/rY asla persist edilmez.

## M22 — Matte Relationship UX + Integrity

- **Outliner relationship visibility (8A):** katman listesinde her matte'li part'ın row'u
  küçük bir indicator taşır — VALID: Scissors ikonu + **source CharacterPart.name**
  (track.name ASLA — cross-machine import isim düzeltmesi korunur); MISSING: AlertTriangle
  + "Missing" + `aria-label/title` ("Matte source: X" / "Missing matte source (id)").
  UI-ONLY: sourcePartId + characterParts'tan render anında derive — yerel relationship
  state/cache/mirror YOK, ikinci relationship modeli YOK.
- **Matte cycle / self-reference validation (8B):** validateCritical'e `MATTE_CYCLE`
  (recoverable) eklendi — parent-cycle chain-walk deseni birebir. Self-reference (A→A,
  1 düğümlü cycle) dahil: A→B/B→A, A→B→C→A ve daha uzun cycle'lar tespit edilir.
  **Disabled matte kontratı:** `matte.enabled === false` → runtime ilişki İNACTIVE →
  cycle graph'a DAHİL EDİLMEZ (StagePartLayers semantiği). **Missing vs cycle ayrımı:**
  A→ghost `MATTE_MISSING_SOURCE` olarak kalır, cycle SAYILMAZ; cycle de missing'e
  dönüşmez. Asiklik zincirler (A→B→C→nothing) VALID — false positive YOK.
- **Self-reference savunması:** UI source selector zaten kendini hariç tutuyor (normal
  kullanıcı UI'dan self-ref oluşturamaz — E2E kanıtlı); 8B validation imported/malformed
  scene'ler için defense-in-depth. Issue sıralaması deterministik (layer sırası).
- **UI/validation ayrımı:** Outliner = görünürlük (edit yok); Inspector = düzenleme.
  Drag/drop ve timeline matte indicator EKLENMEDİ (deferred).
- **Kapsam:** M22 renderer/geometry/serialization DEĞİŞTİRMEZ — SVG rendering, matte/
  gradient rendering, animasyon evaluation, serialization schema byte-for-byte korunur.
  M8 SAFE (TrackChannel/keyframe/playback/animasyon parametresi yok). E2E:
  `e2e/m22-matte-relationship.spec.ts` (E2E-1..E2E-10, 10/10 ×2 deterministik).

## M23 — Basic IN/OUT Preset UX

- **Mevcut procedural engine'i kullanıcıya açar** (YENİ engine YOK, keyframe üretimi YOK, ikinci
  animation sistemi YOK — Option B): Inspector Transform tab'ında kompakt **ANIMATION IN / OUT**
  kartı (`TransformInOutPresetCard`) — IN/OUT preset select (None/Fade/Slide Left/Right/Up/Down/
  Pop/Spin) + duration (frame, SmartNumberInput + deferCommit — BUG 2 güvenliği miras).
  Seçim → `CharacterPart.inAnimPreset/outAnimPreset/inAnimDuration/outAnimDuration` →
  mevcut `computeProceduralDelta`/`applyEditPreset` → SVG renderer.
- **Kontratlar:** duration frame cinsinden, IN/OUT bağımsız (cross-field leak yok); blank/invalid
  ara girdi part verisini bozmaz; değerler doğrudan part'tan derive (local state mirror YOK);
  her kontrol tek `onPartPropChange` → mevcut history (Ctrl+Z geri getirir — yeni history yok).
- **Serialization DEĞİŞMEDİ:** inAnimPreset/outAnimPreset/inAnimDuration/outAnimDuration zaten
  persist — save/reload parity E2E kanıtlı. **Broadcast uyumu:** aynı alanlar broadcast state
  makinesi tarafından tüketilir; Inspector setCurrentFrame/setIsPlaying ÇAĞIRMAZ (d7324ad
  edit/broadcast ayrımı korunur).
- **custom_timeline:** internal/advanced — builtin seçicide GÖSTERİLMEZ; mevcut değerler korunur
  (UI render'ı rewrite etmez). M8 SAFE: TrackChannel/keyframe/playback değişmedi; evaluateFrame/
  proceduralAnimation/usePlayback/useBroadcast/useSerialization **dokunulmadı**.
- **Test dersi (bug değil):** frame 0'daki IN preset bilinçli olarak part'ı görünmez yapabilir
  (opacity 0 → renderer invisible part'ı atlar) — browser testleri aktif frame'de (örn. frame 1)
  ölçer; DOM transform attr'ı yerine runtime state/UI derive doğrulanır.
- E2E: `e2e/m23-in-out-presets.spec.ts` (E2E-1..E2E-15, 15/15 ×2 deterministik).

## M24 — Builtin Combination Presets

- **Mevcut `applyBuiltin` switch'ine 3 YENİ case** (Option A — string ID modeli; production'daki tek
  animasyon değişikliği): `slide-scale-left`, `slide-scale-right`, `soft-pop`. Zincir: preset →
  `computeProceduralDelta` → `applyEditPreset`/`applyPreset` → `applyBuiltin` → DeltaResult →
  evaluateFrame merge → SVG render. evaluateFrame/playback/broadcast/serialization/renderer/geometry
  **DEĞİŞMEDİ**.
- **Bilinçli duplicate yok (discovery bulgusu):** mevcut builtin'lerin HEPSİ opacity=eased içerir —
  Fade+Slide ≡ slide, Fade+Scale ≡ pop, Pop+Fade ≡ pop → bu ID'ler KASITLI eklenmedi (eksik feature
  değil, scope kararı). UI'da `fade-slide-left`/`fade-scale`/`pop-fade` YOK (E2E-14 kanıtı).
- **Semantics:** slide-scale-* mevcut slide yön konvansiyonunu reuse eder (x=±300·(1-eased)·sign) +
  scaleX/Y=eased + opacity=eased; soft-pop scale 0.85+0.15·eased (fizik simülasyonu DEĞİL — aynı
  cubic easing); aynı ID hem IN hem OUT (mode yalnızca sign + eased seçer — ayrı "-out" ID YOK).
- **Kontratlar:** keyframe ÜRETMEZ (E2E-9: channel count 0→0) — Option A (preset → runtime delta);
  serialization schema yok (ID mevcut inAnimPreset/outAnimPreset string alanında — useSerialization
  değişmedi); broadcast aynı alanlar üzerinden otomatik (applyPreset → applyBuiltin); undo mevcut
  onPartPropChange/atomic history; custom_timeline gizli + render'da rewrite edilmez.
- **UI:** M23 kartında option listesi `<optgroup label="Basic">` (8 builtin aynı) + `<optgroup
  label="Combinations">` (Slide + Scale Left/Right, Soft Pop) — yeni panel/editor/builder YOK.
- E2E: `e2e/m24-combination-presets.spec.ts` (E2E-1..E2E-17, 17/17 ×2 deterministik).

## M25 — User-Saved Animation Presets (25A-25F)

Kullanıcı artık bir IN/OUT animasyonunu kaydedip (`Save Current as Preset`), Custom optgroup'tan
başka part'a uygulayıp, reload sonrası kullanıp silebilir.

### Pipeline (mevcut altyapı — İKİNCİ ENGINE YOK)

- SAVE: Inspector kartı → `usePresets.savePreset(...)` → `keyframe_custom_motion_presets` (localStorage)
- APPLY: custom preset ID → `CharacterPart.inAnimPreset/outAnimPreset` → `computeProceduralDelta` →
  `applyEditPreset`/`applyPreset` → custom lookup → `sampleCustomPreset` → DeltaResult → mevcut render

### 25B gerçek bugfix

- Önce: `applyPreset` custom preset çözüyordu; `applyEditPreset` customPresets ALMIYORDU → custom
  preset broadcast'te çalışıyor, **edit-mode preview'da çalışmıyordu** (delta yok; kanıt: x=0 beklenen -150).
- Fix: `applyEditPreset(id, progress, mode, presets)` → `applyPreset`'e delege eder (aynı
  lookup/scope/clamp/sampler zinciri); call site'lar mevcut `customPresets`'i geçirir. Yeni engine
  değil — mevcut runtime hattının eksik bağlantısı.

### CustomMotionPreset model (kodda doğrulanmış)

`id, name, type: 'in'|'out'|'stunt', durationFrames, keyframes[]` (+ opsiyonel `scope`/`maskShape`/
`showInDirector` — mevcut alanlar). Keyframe: `progress, deltaX, deltaY, rotation, scaleX, scaleY,
opacity, easing?` — `sampleCustomPreset` linear interpoler (easing veri olarak korunur).

### Builtin → Custom dönüşümü

`src/utils/presetConversion.ts`: builtin animasyon mevcut public runtime üzerinden deterministik
noktalarda (0/0.25/0.5/0.75/1) örneklenir → `CustomMotionPresetKeyframe[]`. Kaydedilen preset
builtin ID'den BAĞIMSIZ (runtime'ta id referansı yok); sonra builtin/part değişse bile kayıtlı
custom mutasyona uğramaz. Representative builtin-vs-custom eşleşmesi test'li (progress 0/0.5/1 exact).

### Custom filtering kontratı (M25 regression dersi)

Custom optgroup **YALNIZCA user-created preset'leri** içerir. `DEFAULT_INITIAL_PRESETS` (localStorage
boşken seed — `preset_1` "Pink Slide Down" vb.) user preset DEĞİLDİR: Custom'da gösterilmez, Delete
kontrolü almaz, select'te safe 'none' fallback gösterir; runtime/broadcast için mevcut davranış
aynen korunur (seed mekanizmasına dokunulmadı). Kart: `customPresets.filter(p => p.type === 'in' &&
!DEFAULT_INITIAL_PRESETS.some(d => d.id === p.id))` — 25A collision guard kullanıcı id ≠ default id
garantisi verir, id eşitliğiyle dışlama güvenlidir. (Bu ayrım unutulursa M24 E2E-17 kırılır.)

### IN/OUT

IN select → `type:'in'` custom'lar; OUT select → `type:'out'`; mevcut type modeli — yeni tip sistemi
yok. `custom_timeline` gizli/internal kalır (M23 politikası).

### Save/Delete — history ayrımı

- SAVE/DELETE = **library yönetimi** → useHistory YOK, character edit değil; delete missing id
  güvenli; builtin/default'lar korunur.
- APPLY = **normal character edit** → mevcut `onPartPropChange` → history/undo (Ctrl+Z geri alır).

### Delete referenced preset (doğrulanmış davranış)

Part silinmiş custom id'yi referans ediyorsa: stored part referansı korunur, UI display-only 'none'
fallback gösterir, runtime bilinmeyen id'yi güvenli ele alır (opacity 1), crash yok. Part sessizce
yeniden yazılmaz.

### Persistence / serialization

Custom kütüphane `keyframe_custom_motion_presets`'te — **AnimationProject'ta DEĞİL**;
`useSerialization.ts` değişmedi; scene JSON preset kütüphanesi içermez.

### Broadcast

Custom IN/OUT ID'leri broadcast'te çalışır çünkü mevcut `applyPreset` zaten `customPresets`
çözüyor — yeni broadcast state machine yok; edit/broadcast ayrımı korunur.

### M8

M25: yeni TrackChannel YOK, yeni timeline keyframe YOK, playback sistemi YOK, evaluateFrame redesign
YOK. Custom preset keyframe'leri `Track.channels` ile KARIŞTIRILMAMALI — preset-kütüphane verisi,
mevcut procedural sampler tüketir.

### Geometry / Matte

M25: buildMattePath/shapeGeometry/matte/StagePartLayers/PartRenderer DEĞİŞMEDİ; geometry sistemi
eklenmedi.

## M26 — Copy / Paste Animation onto Existing Part + Clear Animation (26A-26E)

Kullanıcı bir part'ın tam animasyonunu (timeline channel keyframe'leri + legacy keyframes + IN/OUT preset'leri + duration'lar) başka bir MEVCUT part'a aktarabilir ve tüm animation ayarlarını tek tıkla temizleyebilir.

### Pipeline

```
SOURCE PART
  → Copy Animation (mevcut copySelectedPart — clipboard payload part+track)
TARGET PART
  → Paste Animation → pasteAnimationOntoSelected(targetPartId)
  → cloneAnimationOntoTarget(sourceTrack, sourcePart, targetPartId, targetTrack)
  → fresh keyframe IDs + hedef track / animation fields
  → mevcut scene state (setTracks + setCharacterParts)
```

İKİNCİ clipboard sistemi YOKTUR. Mevcut `Copy Part → Paste Part` (yeni part) AYNEN korunur.

### Aktarılanlar (yalnızca)

- `Track.channels` (PropertyKeyframe[] — frame/value/easing/templateId/bezierControlPoints birebir)
- legacy `Track.keyframes`
- `CharacterPart.inAnimPreset` / `outAnimPreset` / `inAnimDuration` / `outAnimDuration`

### Korunanlar (hedef)

id · name · baseTransform · parentId · zIndex · visibility · locked · matte (M22 ilişkisi) · geometry/media/text. **Paste = Copy Part DEĞİL.** Hedef track varSA: track id + metadata korunur (yalnızca animation data değişir); hedef track YOKSA: mevcut track factory convention'larıyla oluşturulur (`partId = targetPartId`).

### ID Remapping

Kaynak keyframe id'leri ASLA yeniden kullanılmaz — PropertyKeyframe (`pkf_<ch>`) ve legacy Keyframe (`kf`) için fresh id üretilir; tekrarlı paste'ler disjoint id'ler üretir (E2E kanıtlı). Nested veri (transform objesi, bezier array) deep-clone edilir — hedef kaynakla referans paylaşmaz.

### History

Paste + Clear: `startBatchInteraction()` → `setTracks` + `setCharacterParts` → `endBatchInteraction()` — mevcut batch pattern (useHistory) → **TEK logical undo** (Ctrl+Z hepsini geri alır). Yeni history sistemi yok.

### Clear Animation

IN/OUT preset = `none` · **duration policy A: 30'a reset** (M23 duration default'uyla tutarlı — yeni default icat edilmez) · channels = `makeEmptyChannels()` + keyframes `[]` (track kimliği korunur, boş track kaldırılmaz). matte/transform/identity korunur; custom preset kütüphanesi SİLİNMEZ.

### Custom Preset References

Kaynak bir M25 custom preset id'sine referans veriyorsa hedef AYNI id'yi referans eder — kütüphane nesnesi çoğaltılmaz (library count değişmez — E2E). Silinen id → M25 safe-fallback geçerli.

### Broadcast / Serialization / M8

Broadcast değişmedi (aktarılan alanlar zaten mevcut pipeline'ın tükettiği alanlar — E2E: pasted animation Sequence'te oynar). Serialization değişmedi (animation data zaten Track/CharacterPart scene state'inde; custom preset kütüphanesi AnimationProject'ta DEĞİL). M8 SAFE: yeni TrackChannel/evaluateFrame/playback/engine YOK — mevcut Track.channels/keyframes kopyalanır.

### Multi-select Policy

Inspector paste YALNIZCA primary `selectedPartId`'yi hedefler — multi-select paste DEĞİL (26B'de bilinçli MVP).

### UI (Inspector — ANIMATION IN/OUT kartı)

`Copy Animation` (title: "Copy animation from this element") · `Paste Animation` (title: "Paste animation onto selected element"; disabled: clipboard yok VEYA source===target) · `Clear Animation` (title: "Clear animation (IN/OUT presets, durations and keyframes)"). Yeni panel yok; timeline copy/paste UI yok (deferred).

### Test'ler (M26)

- Pure: `src/tests/animationTransfer.test.ts` (16 — clone/fresh id/izolasyon/schema)
- UI: `src/tests/transformAnimationActions.test.tsx` (11 — buton render/disable/callback/aria)
- E2E: `e2e/m26-copy-paste-animation.spec.ts` (13 ×2 deterministik — identity, transfer, undo, clear, copy-part regression, multi-select, broadcast, reload)
- Vitest: 906/906 (M26 sonrası)

### Deferred (M26 sonrası)

Timeline keyframe copy/paste/duplicate · multi-select paste · preset export/import/rename/categories/search/preview · animation delay/offset · wipe/matte reveal/multi-matte/nested/video matte · gradient animation · animated strength · text stagger · matte gizmo · spring physics · 3D · motion blur · advanced compositor.

## M27 — Timeline Keyframe Frame-Group Duplicate (27A-27E)

Kullanıcı timeline'da bir keyframe'e sağ tıklayıp **Duplicate Keyframes** seçince, o frame'deki TÜM frame-group (aynı frame'deki tüm channel PropertyKeyframe'leri + varsa legacy composite keyframe) **frame+1**'e kopyalanır. Kaynak frame aynen kalır.

### Kontrat

- **Frame-group:** yalnızca tıklanan channel değil — aynı frame'deki TÜM channel'lar + legacy kf birlikte klonlanır (M6/BUG 1 frame-group semantiği)
- **Offset:** sabit `+1` — custom offset/playhead paste/repeat/timeline uzatma YOK
- **Collision:** hedef frame'de HERHANGİ bir ilgili kf varsa → **safe no-op** (kısmi overwrite/merge/destroy yok; gerekçe: `addPropertyKeyframeMutator` frame-collision semantiği — M27 en güvenli davranışı seçer)
- **Boundary:** `sourceFrame == totalFrames` → no-op (wrapping/timeline uzatma yok)
- **ID:** fresh `generateId('pkf_${ch}')` / `generateId('kf')` — kaynak id'ler asla reuse edilmez; tekrarlı duplicate'ler disjoint
- **Deep clone:** value/easing/templateId/bezierControlPoints birebir; nested (bezier, legacy transform) deep-clone; kaynak track MUTASYONSUZ
- **History:** başarılı duplicate = `startBatchInteraction/endBatchInteraction` ile TEK logical undo (tek Ctrl+Z tüm frame-group'u geri alır)
- **Track/metadata:** yalnızca seçili track değişir; id/partId/name/color/visible/locked/expanded korunur; diğer track'ler dokunulmaz

### Mimari

```
TrackLane context menu (sağ-tık → Duplicate Keyframes / Delete Keyframe)
  → AnimatorContext.duplicateKeyframeGroup(trackId, frame)  (minimal bridge)
  → duplicateKeyframeGroup(track, frame, 1, totalFrames)    (27A pure helper — TEK clone mantığı)
  → setTracks + batch history (tek undo)
```

### UI

Mevcut TrackLane keyframe context menu: **Duplicate Keyframes** + **Delete Keyframe** (mevcut direkt sağ-tık delete, menü yüzeyine taşındı — delete semantiği DEĞİŞMEDİ; click-outside kapatma; `role="menu"`/`role="menuitem"` + aria-label + title). Yeni panel/toolbar/modal/klavye kısayolu YOK — **Ctrl+D hâlâ duplicateSelectedPart** (part düzeyi). Drag/seçim davranışı değişmedi.

### Test'ler (M27)

- Pure: `src/tests/keyframeDuplicate.test.ts` (22 — clone/fresh id/collision/boundary/izolasyon/determinizm)
- UI: `src/tests/trackLane.test.tsx` (+11 — menü aç/kapat/aria/targets/tek track/selection korunumu; mevcut 9 test menü akışına güncellendi, delete davranışı korundu)
- E2E: `e2e/m27-keyframe-duplicate.spec.ts` (11 ×3 + fresh — tek kf, frame-group, değer/easing/template/bezier, legacy, fresh id, collision, boundary, undo, delete regression, repeated, metadata, multi-select, drag, accessibility, Ctrl+D)
- Vitest: 939/939 (M27 sonrası) · keyframe-drag 1/1

### Legacy Import Note (dürüst)

Mevcut import/reload path'leri legacy composite keyframe'leri normalize edip düşürebilir (M26'dan beri gözlemlenen davranış — M27 regression DEĞİL). M27 legacy duplicate pure unit'te kanıtlı (27A test 8-10); E2E imported legacy verisi, app import'u normalize ediyorsa otoriter değildir.

### Deferred Roadmap (M27 sonrası)

- **A — NEXT/ACTIVE:** keyframe copy/paste (duplicate ≠ copy/paste — ayrı özellik) · keyframe değer düzenleme UX · custom preset export/import
- **B — NICE TO HAVE:** repeat/pattern offset · easing quick controls · mirror/reverse iyileştirmeleri
- **C — PARK:** multi-select apply · delay/stagger · preset preview · easing editörü · broadcast sequence dup · matte drag/drop · timeline matte indicator · Wipe/Matte Reveal · multi/nested/video matte · gradient animation · animated strength · text stagger · matte gizmo · radial gizmo · spring · 3D · motion blur · compositor

## M28 — Timeline Keyframe Copy / Paste (28A-28E)

Kullanıcı bir keyframe frame-group'unu kopyalayıp aynı ya da BAŞKA bir track'in boş bir frame'ine yapıştırabilir (hedef frame = sağ tıklanan konum).

### Akış

```
Keyframe sağ-tık → Copy Keyframes
  → copyKeyframeGroupData(track, frame)      (28A pure — id'siz, track-independent payload)
  → timeline-LOCAL clipboard (SequencerTimeline useState — persist edilmez)

Boş lane konumu sağ-tık → Paste Keyframes
  → pasteKeyframeGroupData(track, frame, payload, totalFrames)  (28A pure)
  → AnimatorContext.pasteKeyframeClipboard (batch → TEK undo)
```

### Kontrat

- **Frame-group:** kopya TÜM frame-group'u yakalar (o frame'deki her channel kf'si + varsa legacy composite kf) — yalnızca tıklanan channel değil
- **Hedef frame:** EXPLICIT — sağ tıklanan timeline konumu (playhead/`source+1`/gizli offset DEĞİL). M27 Duplicate = `source+1`; M28 Paste = explicit hedef — semantikler ayrı
- **Same/cross-track:** aynı helper her ikisini destekler; hedef track id/partId/name/color/visible/locked/expanded korunur; otomatik track oluşturma YOK
- **Collision:** hedef frame'de HERHANGİ kf (herhangi channel + legacy) varsa → safe no-op (M27 non-destructive politika). UI'da kf'li frame'e sağ-tık = kf menüsü (Paste sunulmaz) — overwrite yolu yok
- **Boundary:** `targetFrame > totalFrames` → no-op; `== totalFrames` geçerli; uzama yok
- **ID:** copy payload'da id YOK; paste'te fresh `generateId('pkf_${ch}')`/`generateId('kf')` — source id'ler asla reuse edilmez; tekrarlı paste'ler disjoint
- **Deep clone:** değer/easing/templateId/bezier birebir; bezier/legacy-transform hem copy'de hem paste'te deep-clone — source + payload immutabl
- **History:** Copy = HİÇ history (yalnızca state); Paste = batch → TEK logical undo; collision no-op → entry yok
- **Clipboard:** timeline-local state — persist edilmez (reload → animasyon kalır, clipboard boş); part-level `useClipboard`'dan AYRI (ikinci sistem değil — timeline kf state'i)

### UI

TrackLane kf menüsü: **Copy Keyframes · Duplicate Keyframes · Delete Keyframe**; boş lane sağ-tık: **Paste Keyframes** (yalnızca clipboard doluyken). Yeni panel/modal/toolbar/kısayol YOK — **Ctrl+D hâlâ duplicateSelectedPart**. Mouse→frame dönüşümü mevcut `getFrameFromMouse` (yeniden yazılmadı; clamp [0,totalFrames]).

### M27 / M26 Ayrımı

- **M27 Duplicate:** seçili frame-group → `source+1` (sabit)
- **M28 Paste:** kopyalanmış frame-group → explicit hedef frame
- **M26 Copy Animation:** part-level (channels + legacy + IN/OUT + durations, matte/preset/transform hariç) — M28 timeline-keyframe-only: IN/OUT/durations/preset-library/matte/transform/parent/geometry/media KOPYALANMAZ

### Test'ler (M28)

- Pure: `src/tests/keyframeCopyPaste.test.ts` (20 — payload/izolasyon/same+cross-track/collision/boundary/determinizm)
- UI: `src/tests/trackLane.test.tsx` (+12 — copy item, paste menüsü clipboard'lu/boş, lane hedefleme, aria, click-outside, selection/drag korunumu)
- E2E: `e2e/m28-keyframe-copy-paste.spec.ts` (12 ×2 + fresh — copy, same/cross paste, explicit frame, fresh id, collision UI-safe, undo, boundary, clipboard non-persistence, delete/duplicate/drag regression, multi-part, matte/preset independence, save/reload, accessibility)
- Vitest: 971/971 (M28 sonrası)

### Legacy Import Note (dürüst)

Mevcut import/reload path'leri legacy composite keyframe'leri normalize edip düşürebilir (M26'dan beri — M28 regression DEĞİL). M28 legacy copy/paste 28A unit'te kanıtlı.

### Roadmap (M28 sonrası)

- **A — AKTİF:** M28 ✅ · **M29 Keyframe Value Editing UX** (başlamadı) · **M30 Custom Preset Export/Import** (başlamadı)
- **B — BEKLEMEDE:** repeat/offset · easing quick · mirror/reverse
- **C — PARK:** (M27 listesi aynen)

## M29 — Selected Keyframe Value Editing UX (29A-29D)

Bir keyframe seçildiğinde TransformTab içinde kompakt **"SELECTED KEYFRAME @ FRAME F"** bölümü görünür: yalnızca o frame'de GERÇEKTEN saklı channel'ların RAW değerleri (x/y/rotation/scaleX/scaleY/opacity subset — computed non-keyframed değerler gösterilmez). Düzenleme **mevcut pipeline** üzerinden yapılır — YENİ mutator yok.

### Akış

```
kf click → currentFrame = kf.frame (mevcut onSetFrame senkronu)
  → SelectedKeyframeSection (TransformTab içinde, derived/presentational)
  → SmartNumberInput (deferCommit) → onUpdate = updateCurrentTransform
  → applyTransformToChannels → currentFrame'deki kf güncellenir (value only)
```

### Kontrat

- **Channel filtering:** yalnızca `groupChannelKeyframesByFrame`'de o frame'de kf'si olan channel'lar gösterilir (örn. x@20 + rotation@20 varsa sadece X + Rotation) — computed değerlerle "kf'li" iması yok
- **Çözümleme:** `selectedKeyframeId` → gruplarda id araması; `currentFrame === kf.frame` koşulu — stale (silinen kf / part değişimi / playhead ayrıldı) → bölüm güvenle gizlenir (yanlış kf düzenlenmez)
- **Multi-channel safety:** edit yalnızca düzenlenen property'nin channel'ına gider (mevcut `typeof newVal === 'number'` + per-channel pipeline) — y/rotation etkilenmez
- **Metadata:** kf değer güncellemesi easing/bezierControlPoints/templateId'yi KORUR (useInspector value-only); M29 easing editörü DEĞİL
- **Scale lock:** mevcut `isScaleLocked` (context → DetailsPanel prop) — lock varken scaleX edit scaleY'yi oranlı günceller (TransformScaleCard davranışı); ikinci lock state yok
- **History:** deferCommit — typing ara değerler commit etmez; Enter/blur tek commit = tek logical undo; yeni history yok
- **Base transform:** kf seçili değilken bölüm gizli; Transform kontrolleri normal base/current transform düzenlemeye devam eder (M29 tüm edit'leri kf edit'ine ÇEVİRMEZ)
- **Legacy:** channel'sız (legacy-only) track'te bölüm bilinçli GİZLİ (üçüncü temsil yok; mevcut legacy edit path korunur) — eksik feature değil, kontrat

### M28 / M27 Kompozisyonu

Paste edilmiş (M28) ve duplicate edilmiş (M27) keyframe'ler M29 bölümünden normal şekilde düzenlenebilir — copy/paste → seç → değer düzenle doğal kompozisyon.

### Bağımsızlık

Kf değer düzenleme: inAnimPreset/outAnimPreset/durations/custom preset library/matte/parent/geometry'ye DOKUNMAZ (E2E kanıtı). Serialization değişmez (kf değerleri Track'te doğal persist olur); broadcast/matte/geometry/renderer dokunulmaz.

### Test'ler (M29)

- UI: `src/tests/selectedKeyframeSection.test.tsx` (19 — visibility/stale/part-switch/deletion, channel filtering, edit paths, scale lock, deferCommit tek commit, metadata dokunulmaz, rerender derive, legacy güvenli, aria)
- E2E: `e2e/m29-selected-keyframe.spec.ts` (12 ×2 + fresh — section, frame sync, X/rotation/opacity edit, metadata, scale lock, typing, undo, base transform, stale/delete, part switch, M28+M27 kompozisyon, preset/matte bağımsızlığı, save/reload, legacy)
- Vitest: 990/990 (M29 sonrası)

### Roadmap (M29 sonrası)

- **A — AKTİF:** M28 ✅ · M29 ✅ · **M30 Custom Preset Export/Import** (başlamadı)
- **B — BEKLEMEDE:** repeat/offset · easing quick · mirror/reverse
- **C — PARK:** (M27 listesi aynen)

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
- `e2e/m20-radial.spec.ts` — M20 R-V1..R-V23 (KALICI matrix): radial alpha ramp
  (center>mid>edge), 4-stop stepped, mid-opacity, feather/strength, luminance,
  inverted luminance, freeform pathD parity, text LOCAL/WORLD, text feather/strength,
  rotation, uniform/non-uniform/neg scale (scalar r), animasyonlu center/radius,
  dedupe/collision, legacy linear parity, import/reload EXACT parity (R-V22)
- `e2e/m21-image-matte.spec.ts` — M21 V-M1..V-M26 (KALICI matrix): image alpha/luminance/
  inverted (luminance semantiği — parlak görünür/koyu delik), strength→opacity (fill-opacity
  YOK), feather, linear/radial/4-stop nested-mask multiplication, transform/animasyon
  (translation+radial cx takip, rotation/scale → r × max|scale|), dedupe (1 content mask),
  farklı source'lar collision'suz, shape+text+image coexist, gerçek Inspector source-switch
  (V-M20 — Style tab + selectOption, field preservation), clip → kcs-clipPath YOK, import/
  reload EXACT parity (V-M24), legacy linear/text regression
- `e2e/m22-matte-relationship.spec.ts` — M22 E2E-1..E2E-10 (KALICI, gerçek UI): valid
  relationship (indicator + CharacterPart.name), gerçek Delete ile missing source, self-ref
  UI guard + import sağlığı, direct cycle (clip-mode defs), valid chain false-positive'siz,
  shape/text/image tip-agnostik, source switch (ayarlar + selection korunur), delete/restore,
  outliner interaction regresyonu (eye/reorder), cycle vs missing ayrımı
- `outlinerPanel.test.tsx` (8A) — matte indicator unit (13 test: no-matte/valid/missing,
  CharacterPart.name authority, accessibility, selection/eye etkilenmez, source switch/delete,
  no-drag/drop, timeline dokunulmaz)
- `validateScene.test.ts` (8B) — MATTE_CYCLE unit (15 test: self-ref, 2/3/4+ cycle, valid
  zincirler, missing/cycle ayrımı, çoklu cycle, determinizm, disabled semantiği, parent
  cycle regresyonu)
- `transformInOutPreset.test.tsx` (9B) — IN/OUT preset UI unit (20 test: select render/display,
  IN/OUT bağımsızlık, duration commit/clamp/deferCommit, leak yok, None güvenli, field
  preservation, atomic undo, custom_timeline policy, a11y)
- `e2e/m23-in-out-presets.spec.ts` (9C) — E2E-1..E2E-15 (KALICI, gerçek UI): IN preview
  (slide/fade/pop — invisible frame 0 dersi), OUT bölgesi, IN+OUT birlikte, duration BUG 2,
  undo, field preservation (matte+transform), part switch leak'siz, save/reload parity,
  broadcast uyumu, multi-part, keyframe'siz (Option B kanıtı), custom_timeline, clear,
  no-selection
- `proceduralAnimationCombos.test.ts` (10B) — combination pure unit (12 test: eased 0/0.5/1 ×3
  preset IN + OUT, yön konvansiyonu, soft-pop eğrisi, existing regression, pure delta, determinizm)
- `transformInOutPreset.test.tsx` M24 describe (10C) — combination UI unit (+12: optgroup render,
  3 option, field yazımı, IN/OUT bağımsızlık, field preservation, custom_timeline, None, undo
  tekliği, derive-only, a11y, builtin koruması, sahte combo yok)
- `e2e/m24-combination-presets.spec.ts` (10D) — E2E-1..E2E-17 (KALICI, gerçek UI): slide-scale
  L/R IN (frame 1'de x yönü + scale<1 → frame 15'te normal), soft-pop eğrisi (0.925@frame3),
  OUT ters yönler, IN/OUT bağımsızlık, duration reuse, undo, field preservation (matte),
  keyframe'siz (Option A kanıtı), save/reload parity, broadcast uyumu, multi-part,
  custom_timeline, sahte preset yok, clear, basic regression, a11y/optgroup
- Baseline: **810/810 vitest** (91/91 useSerialization dahil) + M20 R-V matrix 23/23 ×2 +
  M21 image matrix **26/26 ×2** + M22 relationship **10/10 ×2** + M23 presets **15/15 ×2** +
  M24 combos **17/17 ×2** + track-matte 76/76 (full suite'te V-T17 bilinen timing flake — M18
  import/reload yolu, makine yükünde; izole PASS; M20..M24 değiştirmedi; workflow.spec.ts:88
  ölü container testi fail M19 dışı)

## Deferred (yeni feature kararı gerektirir — M13..M24'te YAPILMADI)

**gradient presets** · **gradient animation** · **radial custom geometry controls
(center/radius UI, gizmo, presets)** · **animated strength** (strength channel/animasyon
M16 MVP dışı) · video matte (MİMARİ ENGELLİ: SVG mask + HTML `<video>`/foreignObject uyumsuz) ·
nested matte · multi-matte (tip migration gerekir) ·
matte gizmo / geometry editor · outliner matte icon / relationship visualization ·
timeline matte indicator · drag/drop matte assignment ·
**text stagger / tspan animasyonu** (M18 MVP dışı)

> M21 ile image matte TAMAMLANDI — "image/video matte" maddesinden image ÇIKARILDI
> (video kaldı); deferred'den image matte için kalan hiçbir öğe yoktur.
