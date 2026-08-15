---
title: Keyframe Character Studio
created: 2026-08-08
updated: 2026-08-10
type: entity
tags: [kcs, react, typescript, svg, track-matte]
sources: [raw/notes/hermes-kb/projeler.md]
confidence: high
---

# Keyframe Character Studio

Staj projesi — karakter animasyon editörü. React + TypeScript + **SVG** uygulaması (Canvas 2D yok, PixiJS/Fabric.js yok).

## Temel bilgiler

| Alan | Değer |
|---|---|
| Repo (ev) | `C:\Users\senmu\Masaüstü\keyframe-character-studio` |
| Repo (iş) | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` |
| Branch | `main` (doğrudan main üzerinde çalışılır) |
| Build | `npm run build` (tsc -b + Vite) |
| Test | **Vitest, 810 test — 41 dosya** (M24 durumu) |
| Doğrulama | `npx tsc --noEmit` + `npm run build` + `npx vitest run` |

## Mimari (M12 güncel)

- **Thin Orchestrator Pattern** — `AnimatorContext` yalnızca orkestrasyon; iş mantığı domain hook'lar + pure utils
- Render zinciri: `StageCanvas` (`<svg>` + defs) → `StagePartLayers` → `evaluateFrame` (pure) → `PartRenderer` (world-space `<g transform>`)
- **Canonical channels modeli**: per-property keyframe'ler (`Track.channels` — x/y/rotation/scaleX/scaleY/opacity + maskOffset×4); legacy `keyframes[]` yalnızca **import compatibility** (M8e: **channels-only export**)
- **Track Matte (M11 + M13 + M14)**: `CharacterPart.matte = { sourcePartId, mode?: 'clip'|'alpha'|'luminance', inverted?, enabled?, feather? }` — hedef part, başka bir part'ın (source) evaluated world geometrisiyle kırpılır
  - Pure helper: `src/utils/matte.ts` (`buildMattePath` — TEK world-space geometry çekirdeği; `kcs-clip-{src}` / `kcs-mask-{src}-{mode}{-inv}{-f{feather}}` deterministik id'ler)
  - Geometry tek kaynak: `src/utils/shapeGeometry.ts` (10 statik shape; renderer + matte aynı kaynak)
  - Rendering: clip → `clipPath`; alpha/luminance → `<mask mask-type>` (maskUnits + maskContentUnits userSpaceOnUse); inverted alpha → **tek `fill-rule="evenodd"` path** (region konturu + matte konturu — Chromium alpha mask'ta ikinci eleman yok sayıldığı için, pixel-verified); inverted luminance → white region rect + black path
  - **Feather (M14)**: world-space px soft edge; `feGaussianBlur stdDeviation=feather/2`, geniş userSpaceOnUse filter region (artboard ± feather); yalnızca mask modlarında (clip → clipPath, blur yok → UI slider clip modunda disabled); aynı source farklı feather → `-f{feather}` suffix'li ayrı deterministik id
  - M13 2E coordinate fix: clip/mask, **transform'suz OUTER `<g>`** üzerinde (userSpaceOnUse defs'i transform'lu g'de referans edilince target'ın local uzayında çözülüyordu — world path yanlış konumlanıyordu)
  - Tek `<defs>` + 1 source → N target (Map dedupe + maskPathCache: aynı source'un modları 1 geometry paylaşır); missing source → recoverable (`MATTE_MISSING_SOURCE`)
  - Editor UI: `StyleMatteSection` (source seçici + Mode + Inverted toggle + FEATHER slider 0-100 + Enabled + Remove); history/clipboard otomatik (structuredClone)
  - **Gerçek browser doğrulaması**: `e2e/track-matte.spec.ts` — 8 DOM + 39 gerçek pixel compositing testi (world→screen CTM + PNG decode) — 47/47 PASS
- Eski Mask/Container sistemi **KALDIRILDI** (b60f1ca): MaskTab, MaskGizmo, inner-media, container local-space transform — geri getirilmedi; `MaskData`/`maskOffset*` tipleri bilinçli backward-compat olarak duruyor (track matte bunlara bağlı değil)

## Proje durumu (M28)

- Phase 2-4 ✅ CLOSED — pure evaluation pipeline, serialization fix'leri (BUG #1-6)
- M1-M10 ✅ RELEASE READY — canonical channels, channels-only export, dead code temizliği
- M11 ✅ COMPLETE — Track Matte MVP (clipPath, world-space path, UI, test'ler)
- **M13 ✅ COMPLETE — mode clip|alpha|luminance + inverted + gerçek browser doğrulaması**
  - 2A: PartMatte.mode + inverted, resolveMatteMode, matteMaskId
  - 2B: buildMattePath tek geometry çekirdeği, buildMatteMask
  - 2C: StagePartLayers mask pipeline, PartRenderer matteMaskId, explicit region
  - 2D: StyleMatteSection Mode select + Inverted toggle
  - 2E: gerçek Chromium doğrulaması — 2 browser bug'ı bulundu ve düzeltildi:
    (1) userSpaceOnUse defs transform'lu g'de local uzayda çözülüyor → transform'suz outer g;
    (2) Chromium alpha mask'ta region rect + ikinci eleman yok sayılıyor → tek evenodd path
  - 2F: final audit + dokümantasyon
  - Baseline: 354/354 vitest + 14/14 playwright
- **M14 ✅ COMPLETE — Feather (soft edge)**
  - 2A: browser spike — mask + feGaussianBlur mimarisi doğrulandı
  - 2B: `PartMatte.feather?` + `normalizeFeather` + mask id `-f{feather}` suffixi (pathD DEĞİŞMEDİ — testli)
  - 2C: StagePartLayers feGaussianBlur pipeline (stdDeviation=feather/2, geniş userSpaceOnUse region — blur kırpılmaz); alpha-inverted evenodd + luminance-inverted korundu
  - 2D: StyleMatteSection FEATHER slider (0-100, clip modunda disabled)
  - 2E: serialization round-trip (feather 0/12/100, undefined-key yok, negative/NaN guard) + V-K (inverted alpha feather pixel) + V-L (luminance feather pixel) + docs
  - Baseline: 382/382 vitest + 19/19 track-matte playwright (full suite: workflow.spec.ts:88 ölü container testi fail — M14 dışı, b60f1ca sonrası)
- **M15 ✅ COMPLETE — Freeform Track Matte**
  - Free Draw (`custom_freeform`) artık matte source: `buildMattePath` freeform dalı = `CharacterPart.points` → world-space polygon pathD (renderer'ın `buildFreeformPath` ile AYNI points kaynağı — ikinci geometry sistemi YOK; static shape zinciri değişmedi)
  - clip/alpha/luminance/inverted/feather + rotated/scaled + animated freeform source — hepsi çalışıyor (V-M1..V-M6 pixel-verified)
  - 3D: `StyleMatteSection` `isMatteEligible` filtresi (freeform listede); source swap `{...matte, sourcePartId}` — mode/inverted/enabled/feather korunur
  - 3E: serialization round-trip (points + matte kayıpsız) + gerçek import→render pixel parity (V-M7/V-M8)
  - Baseline: 411/411 vitest + 27/27 track-matte playwright
- **M16 ✅ COMPLETE — Matte Strength / Opacity**
  - 2A: `PartMatte.strength?` (0-1) + `normalizeStrength` (undefined/NaN/±Inf/negatif/>1 → 1; **0 geçerli**) + `MatteMask.strength`; geometry parity kanıtlı
  - 2B: mask content'e `fill-opacity` (yalnızca strength<1; undefined/1 = canonical — DOM byte-for-byte) + `-s{strength}` mask id suffixi (dedupe farklı strength'e duyarlı); clip etkisiz; evenodd/luminance korundu; V-S1..V-S5 pixel kanıtı (0/0.5/1 + inverted + feather ramp)
  - 2C: Inspector STRENGTH slider (0-100%, clip disabled, field preservation, local state yok, undefined→100%)
  - 2E: serialization round-trip (strength 0/0.5/1/undefined/malformed; 0 falsy kaybolmaz; M8 kanıtı) + V-S6..V-S8 (import→reload: strength+feather+inverted korunur, fill-opacity DOM, pixel parity exact)
  - Baseline: 454/454 vitest + 35/35 track-matte playwright
- **M17 ✅ COMPLETE — Gradient Track Matte**
  - 3A: browser spike — userSpaceOnUse linearGradient + mask content fill Chromium'da kanıtlandı (12/12 pixel: alpha/evenodd/luminance/inv-lum/feather/strength/freeform/rotation/scale/neg-scale/animasyon/dedupe)
  - 3B: `PartMatte.gradient?: {angle}` + `normalizeGradientAngle` (undefined→undefined; NaN/±Inf→0; mod 360) + `gradientId` (kcs-mg-{src}-{angle}-{mode}) + default stops (alpha white→transparent; luminance white→black); geometry parity testli
  - 3C: StagePartLayers — `<linearGradient userSpaceOnUse>` defs (world-space endpoints: lokal bbox → 2 nokta → applyWorld — source'la taşınır/döner/ölçeklenir/flip; animasyonda stale yok) + mask content fill=url + mask id `-g{angle}` suffixi; V-G1..V-G10 pixel (alpha/180°/strength/feather/freeform/rot+scale/animated/import-reload parity/luminance/inv-luminance); 496/496 + 45/45
  - 3D: Inspector GRADIENT toggle + ANGLE slider (0-360, clip disabled, field preservation, local state yok); 510/510
  - 3E: serialization round-trip (gradient 0/45/90/360-raw/malformed/full matte/freeform/channels-only/legacy) + V-G11 (neg scale) + V-G12 (dedupe); 518/518 + 47/47 ×2 deterministik
  - 3F: docs (SKILL v5.0.0, wiki, README) — radial/custom-stop/gradient-animation deferred
  - Baseline: 518/518 vitest + 47/47 track-matte playwright
- **M18 ✅ COMPLETE — Text Track Matte** (commit/push PENDING — onay bekliyor)
  - 4A: browser spike — text part matte source olabilir; mask content `<text>` Chromium'da
    kanıtlı (13/13 ×2 deterministik); KRİTİK BULGULAR: (1) inverted alpha + text → alpha mask
    ikinci elementi ignore ediyor → inverted text HER DURUMDA luminance yapısı (mask-type=luminance
    + white rect + siyah text); (2) userSpaceOnUse gradient transform'lu g içinde text'in LOKAL
    uzayında çözülüyor → text gradient endpoint'leri lokal (worldToLocal inverse); font determinizm
    (fonts.ready + fonts.check + HHH/80px solid crossbar modeli)
  - 4B: data/pure — `isMatteEligible(custom_text)===true`; `MatteMask.text?` render-data
    (pathD null; content/font'lar source'tan runtime — PartMatte'e YENİ alan YOK);
    `textMaskContent` + `buildMatteTextMask` + `worldToLocal` (applyWorld inverse; negatif scale;
    zero-scale→1) + `gradientEndpointsLocal`; buildMattePath text→null KALIR; 533/533 + 47/47 ×2
  - 4C: render — StagePartLayers text content branch: `<g transform=translate(CX+tx,CY+ty)
    rotate(r) scale(sx,sy)><text x=0 y=0 anchor=middle baseline=middle>` (evaluated world her frame —
    stale yok); inverted → luminance yapısı; gradient lokal endpoint + inverted-text structure key;
    feather/strength aynen; dedupe; clip → clip oluşmaz; 543/543 + 51/51 ×2
  - 4D: UI — text listede (isMatteEligible tek authority); text+clip → Clip option disabled +
    non-blocking not; inverted/gradient/feather/strength normal çalışır; source switching text↔shape
    field preservation; local state YOK; 552/552 + 51/51 ×2
  - 4E: serialization + full e2e/pixel — text matte round-trip (7 alan; runtime text data matte
    JSON'una GİRMEZ; sourcePartId tek persistent bağlantı; useSerialization DEĞİŞMEDİ) +
    V-T1..V-T17 (alpha/luminance/inv-lum/inv-alpha-fallback/gradient/feather/strength/combo/rotation/
    scale/neg-scale/animasyon/dedupe/clip-policy/gradient+rot/gradient+scale/import-reload EXACT
    parity); 558/558 + 64/64 ×2 deterministik
  - 4F: docs (SKILL v6.0.0, wiki, README) + final audit
  - Baseline: 558/558 vitest + 64/64 track-matte playwright; full suite 66/1 (tek fail
    workflow.spec.ts:88 ölü container — M18 dışı)
- **M19 ✅ COMPLETE — Custom / Multi-stop Gradient** (commit/push PENDING — onay bekliyor)
  - 5A: spike — N-stop linearGradient-in-mask Chromium kanıtı (15/15 ×2): unsorted doc order
    farklı ramp üretiyor (sıralama şart), duplicate offset'te sonraki stop kazanıyor, aynı id +
    farklı stops → COLLISION (ilk def kazanıyor — id stops hash taşımalı), determinizm byte-identical
  - 5B: data/pure — `gradient.stops?` (additive; PartMatte'e ek alan YOK), `normalizeGradientStops`
    (tek authority: clamp/sort-stabil/salvage/drop/<2→default), `canonicalStopsKey` + `gradientStopsHash`
    (deterministic FNV-1a), `gradientId` stops hash suffix'i (`kcs-mg-{src}-{angle}-s{hash}`);
    legacy `{angle}` id byte-for-byte; 572/572
  - 5C: render — def'lere normalize stops (mevcut stops.map), gerçek gradient nesnesi id'ye
    (rekonstrüksiyon stops'u düşürüyordu), mask id `-g{angle}-s{hash}` (`matteMaskGradientSuffix`);
    farklı stops → farklı def+mask; aynı normalize set → dedupe; legacy parity; 582/582 + 66/66
  - 5D: UI — STOPS editörü (2-4: Add en büyük boşluk midpoint'i + sol miras, Remove min 2,
    color/offset/opacity, field preservation, local state YOK, legacy {angle} dokunulmaz);
    594/594 + 66/66
  - 5E: serialization (4-stop EXACT round-trip, legacy stops uydurmaz, malformed pass-through +
    render-side normalize, runtime veri yok) + V-H1..V-H12 (4-stop ramp, opacity, feather,
    strength, inverted luminance, **inverted TEXT + multi-stop — BLOCKER: dış alan transparan**,
    rotation, scale, dedupe, import-reload EXACT parity); 599/599 + 75/76
  - 5E BLOCKER FIX (onaylı): inverted text gradient koordinat kontratı — def endpoint'leri
    WORLD (rect world-space; text siyah — def'i kullanmaz), identity `-luminance-inv`
    (non-inverted luminance TEXT lokal `-luminance` ile çakışmaz), text her zaman düz siyah
    (fill="black" — url() ALMAZ); V-H8 pixel-kanıtlı; 599/599 + 76/76 ×2 + full 78/1
  - 5F: docs (SKILL v7.0.0, wiki, README) + final audit
  - Baseline: 599/599 vitest + 76/76 track-matte playwright; full suite 78/1 (tek fail
    workflow.spec.ts:88 ölü container — M19 dışı)
- M12 ✅ audit — "kapatılabilir"; 2 LOW OPTIONAL (clipIdFor O(N²), MATTE_CYCLE validation)
- **M20 ✅ COMPLETE — Radial Gradient** (6A-6F iş PC'de tamamlandı; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 6A spike: 17/17 ×2 pixel/DOM deterministik (geçici, silindi) — kontratlar: radial mask'te
    çalışır, r ötesi = SON stop (linear before-start = ilk stop'tan farklı), world daire elips
    olmaz (rX/rY gerekmez), mask+transform: content transform'lu g'nin LOCAL space'inde çözülür
    (production OUTER/INNER deseni doğru), text+url fill mask'ta çalışır (LOCAL/WORLD ayrımı)
  - 6B data/pure: `gradient.type?: 'linear'|'radial'` (yok = linear — legacy byte-for-byte) +
    `normalizeGradientType` (TEK authority) + `radialGradientGeometry` (center = bbox merkezi
    applyWorld; r = sqrt(w²+h²)/2 × max(|sx|,|sy|); rotation r'yi değiştirmez; neg scale |abs|;
    zero → 1) + `sourceLocalPoints` (gradientEndpoints ile AYNI kaynak — ikinci bbox sistemi YOK);
    identity `kcs-mg-{src}-radial[-s{hash}]` / mask `-radial[-s{hash}]` (linear DEĞİŞMEDİ);
    M19 stops/hash %100 reuse; derived geometry ASLA persist edilmez
  - 6C render: StagePartLayers'a minimal branch — `<radialGradient userSpaceOnUse cx cy r>`;
    shape/freeform WORLD, non-inverted text LOCAL (0,0/104.4), inverted text WORLD + siyah text +
    `-luminance-inv`; feather/strength/dedupe/collision korundu; animasyonlu source center/radius
    her frame EVALUATED transform'dan (stale yok)
  - 6D UI: TYPE [Linear|Radial] select — radial'de ANGLE gizli; Linear'a dönüş type OMIT
    (canonical legacy); field preservation (sourcePartId/mode/inverted/enabled/feather/strength/
    stops); local state YOK; M19 stop editörü birebir
  - 6E: serialization 80/80 (EXACT round-trip, derived geometry serialize edilmez, legacy
    korunur); R-V1..R-V23 pixel/DOM matrisi 23/23 ×2 (`e2e/m20-radial.spec.ts` KALICI);
    import/reload EXACT parity 3/3
  - 6F: docs — SKILL v8.0.0 (M20 bölümü + deferred güncellemesi), wiki, README
  - Bilinen parity limitation (M19/M20 ortak — M20 regression DEĞİL): gradient'li inverted
    TEXT delik üretmez (linear'de de; gradient'siz delik üretir — V-T3); doğrulanan: text siyah +
    world region rect gradient + dış alan ramp
  - Baseline: 678/678 vitest + R-V 23/23 ×2 + track-matte 76/76 (full'da V-T17 timing flake —
    M18 import/reload, izole PASS)
- **M21 ✅ COMPLETE — Image Matte** (7A-7F iş PC'de tamamlandı; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 7A spike: 17/17 ×2 (geçici, silindi) — SVG `<image>` mask CONTENT olarak çalışır:
    alpha mask'a alpha akar, luminance deterministik; `<image>` fill kullanamaz →
    **nested-mask multiplication** (image alpha/luminance × gradient mask); `fill-opacity`
    image'da INERT (strength → `opacity`); inverted image SİYAH repaint edilemez (luminance
    semantiği: parlak görünür, koyu delik); Canvas/foreignObject/ikinci-geometry/yeni-filter YOK
  - 7B data/pure: `isMatteEligible(custom_image) → true` (tek authority); `imageMaskContent`
    (href = imageUrl || innerMediaUrl tek authority; width×height layout box — piksel okuma yok);
    `MatteMask.image` runtime-only (PartMatte'e alan YOK — sourcePartId tek ilişki);
    buildMattePath(image) → null; image+clip semantik olarak kapalı
  - 7C render: StagePartLayers image content branch — transform-baked `<image>` mask içinde;
    inverted image → mask-type luminance (mask-type koşulu text||image'e genişletildi — 7A);
    strength → `opacity` (fill-opacity asla); gradient → `kcs-mask-{src}-img` content mask ×
    gradient rect (nested); feather mevcut filter; M18/M19/M20 byte-compatible
  - 7D UI: image source listede; Clip UI'da disabled + uyarı (text deseni genişletildi);
    alpha/luminance/inverted/feather/strength/gradient/stops tam destekli; field preservation
    birebir; local state yok
  - 7E: serialization 91/91 (EXACT; runtime descriptor asla persist edilmez; legacy linear
    structurally legacy kalır); V-M1..V-M26 pixel/DOM matrisi **26/26 ×2** (`e2e/m21-image-matte.spec.ts`
    KALICI — dedupe, coexist, Inspector real-user flow V-M20, clip güvenli, import/reload EXACT
    parity V-M24, animated radial takip V-M22/23); inverted image semantiği + strength=opacity +
    nested composition açıkça kanıtlı
  - 7F: docs — SKILL v9.0.0 (M21 bölümü + mimari + baseline + deferred), wiki, README
  - Baseline: **738/738 vitest** (91/91 serialization dahil) + R-V 23/23 ×2 + V-M **26/26 ×2** +
    track-matte 76/76 (full'da V-T17 timing flake — M18 import/reload, izole PASS; M20/M21 değiştirmedi)
- **M22 ✅ COMPLETE — Matte Relationship UX + Integrity** (8A-8C iş PC'de tamamlandı; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 8A UI: Outliner'da matte relationship indicator — VALID: Scissors + source
    **CharacterPart.name** (track.name asla — cross-machine import düzeltmesi korunur);
    MISSING: AlertTriangle + "Missing" + aria-label/title; render anında derive (sourcePartId +
    characterParts — yerel state/cache/mirror YOK); selection/eye/reorder/drag etkilenmez;
    `outlinerPanel.test.tsx` 13 test
  - 8B validation: validateCritical'e `MATTE_CYCLE` (recoverable) — parent-cycle chain-walk
    deseni birebir; self-reference (A→A) dahil, uzun cycle'lar; **disabled matte
    (enabled:false) cycle graph'a DAHİL DEĞİL** (StagePartLayers semantiği); missing
    (MATTE_MISSING_SOURCE) asla cycle sayılmaz, cycle asla missing'e dönüşmez; asiklik
    zincirler VALID; deterministik issue sıralaması; `validateScene.test.ts` 15 test
  - 8C E2E: `e2e/m22-matte-relationship.spec.ts` E2E-1..E2E-10 **10/10 ×2** — gerçek UI
    (outliner row tıklama + Style tab + matte select + Delete butonu + eye/reorder):
    valid relationship, gerçek delete → missing, self-ref UI guard (kendini hariç tutar) +
    import sağlığı, direct cycle (clip-mode defs), valid chain, tip-agnostik source'lar,
    source switch (ayarlar + selection korunur), delete/restore, outliner regresyonu,
    cycle vs missing ayrımı; production değişikliği 0
  - Kapsam: renderer/geometry/serialization DEĞİŞMEDİ; M8 SAFE; UI + validation hardening
  - Baseline: **766/766 vitest** (91/91 serialization dahil) + R-V 23/23 ×2 + V-M 26/26 ×2 +
    E2E **10/10 ×2** + track-matte 76/76 (V-T17 bilinen M18 flake — izole PASS)
- **M23 ✅ COMPLETE — Basic IN/OUT Preset UX** (9A-9C iş PC'de tamamlandı; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 9A discovery: preset engine ZATEN VAR (inAnimPreset/outAnimPreset/durations +
    computeProceduralDelta/applyEditPreset — broadcast + edit preview) ama kullanıcıya KAPALI
    (hiçbir UI yok); **Option B kararı: mevcut procedural engine'e UI bağlama** (keyframe
    üretimi YOK — Option A reddedildi: ikinci paralel sistem + overwrite riski)
  - 9B UI: Inspector Transform tab'ında ANIMATION IN / OUT kartı (TransformInOutPresetCard) —
    IN/OUT preset select (None/Fade/Slide L/R/U/D/Pop/Spin — builtin'ler, yeni id yok) +
    duration (SmartNumberInput + deferCommit — BUG 2 güvenliği; min 0 max 1000; default 30);
    derive-only (local state YOK); tek onPartPropChange → atomic history; custom_timeline
    GİZLİ (internal — değerler korunur); SmartNumberInput'a ariaLabel eklendi;
    `transformInOutPreset.test.tsx` 20 test
  - 9C E2E: `e2e/m23-in-out-presets.spec.ts` E2E-1..E2E-15 **15/15 ×2** — gerçek UI: IN
    preview (slide/fade/pop — frame 1'de ölçüm: frame 0'da IN opacity 0 → part invisible —
    renderer skip — test dersi, bug değil), OUT bölgesi, IN+OUT birlikte, duration BUG 2
    regression, undo (UI derive), field preservation (matte+transform), part switch leak'siz,
    save/reload parity (mevcut schema), broadcast uyumu, multi-part, **keyframe'siz kanıtı**
    (channel count 0→0), custom_timeline korunur, clear, no-selection; **production bug
    bulunmadı** (StagePartLayers geçici debug kaldırıldı)
  - Kapsam: evaluateFrame/proceduralAnimation/usePlayback/useBroadcast/useSerialization
    DEĞİŞMEDİ; M8 SAFE; yeni engine/keyframe/channel YOK
  - Baseline: **786/786 vitest** (91/91 serialization dahil) + R-V 23/23 ×2 + V-M 26/26 ×2 +
    M22 **10/10 ×2** + M23 **15/15 ×2** + track-matte 76/76 (V-T17 bilinen M18 flake — izole PASS)
- **M24 ✅ COMPLETE — Builtin Combination Presets** (10A-10D iş PC'de tamamlandı; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 10A discovery: mevcut builtin'lerin HEPSİ opacity=eased içeriyor → Fade+Slide ≡ slide,
    Fade+Scale ≡ pop, Pop+Fade ≡ pop → **duplicate'ler KASITLI eklenmedi** (eksik feature değil);
    gerçek yeni davranış: slide+scale ailesi + soft-pop; **Option A: yeni builtin ID'ler**
    (applyBuiltin case'leri) — en küçük yüzey
  - 10B pure: `applyBuiltin`'e 3 case (slide-scale-left/right: x=±300·(1-eased)·sign +
    sx=sy=opacity=eased; soft-pop: sx=sy=0.85+0.15·eased + opacity=eased) — atomic'lar byte-for-byte;
    `proceduralAnimationCombos.test.ts` 12 test (eased 0/0.5/1 IN + OUT, yön konvansiyonu,
    existing regression, pure delta, determinizm)
  - 10C UI: M23 kartında `<optgroup label="Basic">` (8 builtin aynı) + `<optgroup
    label="Combinations">` (Slide + Scale Left/Right, Soft Pop) — yeni panel/editor yok;
    transformInOutPreset.test +12 (optgroup, 3 option, IN/OUT bağımsızlık, field preservation,
    custom_timeline, sahte combo yok)
  - 10D E2E: `e2e/m24-combination-presets.spec.ts` E2E-1..E2E-17 **17/17 ×2** — slide-scale L/R
    IN (frame 1 yön + scale<1 → frame 15 normal), soft-pop eğrisi (≈0.925@frame3), OUT ters
    yönler (ayrı "-out" ID yok), IN/OUT bağımsızlık, duration reuse, undo, field preservation
    (matte), **keyframe'siz kanıtı** (channel 0→0 — Option A), save/reload parity, broadcast
    uyumu, multi-part, custom_timeline korunur, sahte preset yok, clear, basic regression,
    a11y/optgroup; production değişikliği 0
  - Kapsam: production'daki TEK animasyon değişikliği `applyBuiltin`; evaluateFrame/playback/
    broadcast/serialization/renderer/geometry DEĞİŞMEDİ; M8 SAFE; yeni engine/keyframe/channel YOK
  - Baseline: **810/810 vitest** (91/91 serialization dahil) + R-V 23/23 ×2 + V-M 26/26 ×2 +
    M22 **10/10 ×2** + M23 **15/15 ×2** + M24 **17/17 ×2** + track-matte 76/76 (V-T17 bilinen
    M18 flake — izole PASS)
- **M25 ✅ COMPLETE — User-Saved Animation Presets** (25A-25F; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 25A data: `usePresets.savePreset/deletePreset` (mevcut `CustomMotionPreset` + `keyframe_custom_motion_presets` key; deterministic `generateId('preset')` + collision guard; null-safe; malformed storage fallback)
  - 25B runtime proof + **gerçek edit-mode bugfix**: `applyEditPreset` customPresets almıyordu → custom preset broadcast'te çalışıp edit preview'da çalışmıyordu; fix: `applyEditPreset` → `applyPreset` delegasyonu (mevcut lookup/scope/clamp/sampler zinciri — yeni engine YOK)
  - 25C UI: Custom optgroup (IN/OUT type filtreli, value=id/label=name) + Save Current as Preset dialog + Delete (yalnızca custom); `presetConversion.ts` builtin→custom (deterministik 0/0.25/0.5/0.75/1 örnekleme — builtin id'den bağımsız)
  - 25D E2E: `e2e/m25-user-saved-presets.spec.ts` **18/18 ×2** (save≠apply, apply IN/OUT, equivalence, reload, delete, referenced-delete, type filtering, state isolation, undo, broadcast, schema pollution)
  - 25E regression fix: **DEFAULT_INITIAL_PRESETS Custom optgroup'ta görünüyordu** (M24 E2E-17 kırıldı) → id-eşitliğiyle user-only filtre (default'lar runtime'da aynen korunur); M24 **17/17** geri yeşil
  - Baseline: **879/879 vitest** + M25 18/18 ×2 + M24 17/17 + M23 15/15 + M22 10/10 + M20 23/23 + M21 26/26; track-matte bilinen ev-PC timing-flake'leri (V-T15/T17/H12 — izole PASS)
- Son push: `dff30d2` (M13) → `e4ddc68`/`37e4db9` (M14) → `4e50cf1` (M15) → `20c3a81` (M16) → `1f6c7ba` (M17) → `e88517f` (M18) → `28d0e94` (M19) → `b711f83` (M20 discovery wiki) → `766326a`/`6487760`/`733d878` (ev PC bugfix+toolbar) → `d7324ad` (broadcast bugfix) → `668a3b3` (M20) → `64eb14c` (M21) → `6a0c767` (M22) → `47f7dce` (M23) → `4a77ba4` (M24) → `147ba8a` (M25) → **M26 implementasyonu PENDING (commit/push YOK — hash icat edilmedi)**
- **M26 ✅ COMPLETE — Copy/Paste Animation onto Existing Part + Clear Animation** (26A-26E; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 26A data: `cloneAnimationOntoTarget` (`src/utils/animationTransfer.ts` — saf transfer: channels + legacy keyframes + IN/OUT/durations; fresh id remap; hedef track reuse/oluşturma; nested deep-clone) + `useClipboard.pasteAnimationOntoSelected(targetPartId)`
  - 26B UI: TransformInOutPresetCard'a `Copy Animation` / `Paste Animation` (disabled: clipboard yok veya source===target) / `Clear Animation` (IN/OUT → none, duration policy A → 30, channels/keyframes temizlenir; matte/identity korunur); paste+clear `startBatchInteraction/endBatchInteraction` → tek logical undo
  - 26C E2E: `e2e/m26-copy-paste-animation.spec.ts` **13/13 ×2 deterministik** — identity preservation, keyframe/fresh-id transfer, custom preset referans (library çoğalmaz), matte/parent korunumu, tek-Ctrl+Z undo, clear, Copy Part regression, multi-select (yalnızca primary), broadcast, save/reload
  - 26D regression: Vitest **906/906** · M20 23 · M21 26 · M22 10 · M23 15 · M24 17 · M25 18 · M26 13 — full koşu **194 passed**; track-matte bilinen ev-PC timing-flake'leri (V-T15/T17/V-H12 — M26'sız koşularda da vardı, pre-existing)
  - 26E docs: SKILL v14 + wiki + README
  - Push zinciri `147ba8a`'da biter — **M26 commit hash icat edilmedi**
- **M27 ✅ COMPLETE — Timeline Keyframe Frame-Group Duplicate** (27A-27E; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 27A pure: `src/utils/keyframeDuplicate.ts` — `duplicateKeyframeGroup(track, frame, offset=1, totalFrames?)` — frame-group (tüm channel'lar + legacy) klonu; fresh id'ler; deep clone; collision/boundary safe no-op; **22 pure test**
  - 27B UI: TrackLane keyframe context menu (**Duplicate Keyframes** + Delete Keyframe — delete semantiği korundu, menüye taşındı); AnimatorContext `duplicateKeyframeGroup` minimal bridge (batch → tek undo); Ctrl+D değişmedi (part duplicate); **+11 UI test** (trackLane.test.tsx)
  - 27C E2E: `e2e/m27-keyframe-duplicate.spec.ts` **11/11 ×3 + fresh** — tek kf, frame-group, değer/easing/template/bezier, legacy (import-notu), fresh id, collision no-op, boundary, tek-undo, delete/drag regression, repeated, metadata, multi-select, accessibility
  - 27D regression: Vitest **939/939** · full e2e **207 passed** (M20 23+M21 26+M22 10+M23 15+M24 17+M25 18+M26 13+M27 11+drag 1+track 73); track-matte bilinen ev-PC timing-flake'leri (V-T15/T17/V-H12 — pre-existing)
  - 27E docs: SKILL v15 + wiki + README
  - Push zinciri `b0cf9ea`'da biter — **M27 commit hash icat edilmedi**
- **M28 ✅ COMPLETE — Timeline Keyframe Copy / Paste** (28A-28E; **COMMIT/PUSH PENDING — onay bekliyor**)
  - 28A pure: `src/utils/keyframeCopyPaste.ts` — `copyKeyframeGroupData` (id'siz, track-independent payload) + `pasteKeyframeGroupData` (explicit hedef frame; collision/boundary no-op; fresh id; deep clone); **20 pure test**
  - 28B UI: TrackLane kf menüsüne **Copy Keyframes** + boş lane sağ-tık **Paste Keyframes** (yalnızca clipboard doluyken); timeline-LOCAL clipboard (SequencerTimeline state — persist yok); AnimatorContext `pasteKeyframeClipboard` bridge (batch → tek undo); **+12 UI test**
  - 28C E2E: `e2e/m28-keyframe-copy-paste.spec.ts` **12/12 ×2 + fresh** — copy, same/cross paste, explicit frame, fresh id, collision UI-safe, undo (copy history'siz kanıtı), boundary, clipboard non-persistence, delete/duplicate/drag regression, multi-part, matte/preset independence, save/reload, accessibility
  - 28D regression: Vitest **971/971** · full e2e **218 passed** (M20 23+M21 26+M22 10+M23 15+M24 17+M25 18+M26 13+M27 11+M28 12+drag 1+track 72); track-matte bilinen ev-PC timing-flake'leri (V-T15/T17/V-H12 — pre-existing)
  - 28E docs: SKILL v16 + wiki + README
  - Push zinciri `b216239`'da biter — **M28 commit hash icat edilmedi**

## Önemli kararlar

- M8: channels-only export; legacy `keyframes[]` import'u kalıcı korunuyor; mask point/feather bilinçli gap
- M9: `addKeyframeForSelected`, `updateCharacterPart`, `selectedTrackId` silindi; legacy CRUD (`addKeyframeToTrack`/`deleteKeyframe`/`updateKeyframeFrame`/`applyMotionTransition`) KEEP
- Broadcast trigger family (per-part In/Out, stunt kontrol) DEFER — tamamlanmamış feature
- Matte `sourcePartId` otomatik remap YOK (copy/duplicate'ta aynen taşınır — bilinçli)
- Yeni animation channel eklenmedi / eklenmeyecek (matte source kendi channel'larıyla animasyonlu)

## AI ajan kuralları

- Anayasa: analiz → plan → onay → uygula → doğrula
- Konuşma dili: Türkçe; kod/yorum/commit: İngilizce
- Approval-first: onay olmadan commit/push/merge yok
- Feature/bug-driven: refactor yasak; her adımda tsc + build + vitest + rapor
- KCS skill'leri: `skills/keyframe-studio/` (kcs-* serisi)
