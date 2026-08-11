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
| Test | **Vitest, 411 test — 35 dosya** (M15 durumu) |
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
  - **Gerçek browser doğrulaması**: `e2e/track-matte.spec.ts` — 8 DOM + 19 gerçek pixel compositing testi (world→screen CTM + PNG decode) — 27/27 PASS
- Eski Mask/Container sistemi **KALDIRILDI** (b60f1ca): MaskTab, MaskGizmo, inner-media, container local-space transform — geri getirilmedi; `MaskData`/`maskOffset*` tipleri bilinçli backward-compat olarak duruyor (track matte bunlara bağlı değil)

## Proje durumu (M15)

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
- M12 ✅ audit — "kapatılabilir"; 2 LOW OPTIONAL (clipIdFor O(N²), MATTE_CYCLE validation)
- Son push: `dff30d2` (M13 2A-2B, iş PC) → `e4ddc68` (M14 2A-2C, ev PC) → M14 2D-2E + M15 3A-3F iş PC (push bekliyor)

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
