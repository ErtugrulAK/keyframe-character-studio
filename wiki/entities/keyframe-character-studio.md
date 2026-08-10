---
title: Keyframe Character Studio
created: 2026-08-08
updated: 2026-08-09
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
| Test | **Vitest, 316 test — 35 dosya** (M12 durumu) |
| Doğrulama | `npx tsc --noEmit` + `npm run build` + `npx vitest run` |

## Mimari (M12 güncel)

- **Thin Orchestrator Pattern** — `AnimatorContext` yalnızca orkestrasyon; iş mantığı domain hook'lar + pure utils
- Render zinciri: `StageCanvas` (`<svg>` + defs) → `StagePartLayers` → `evaluateFrame` (pure) → `PartRenderer` (world-space `<g transform>`)
- **Canonical channels modeli**: per-property keyframe'ler (`Track.channels` — x/y/rotation/scaleX/scaleY/opacity + maskOffset×4); legacy `keyframes[]` yalnızca **import compatibility** (M8e: **channels-only export**)
- **Track Matte (M11, yeni feature)**: `CharacterPart.matte = { sourcePartId, mode:'clip', enabled? }` — hedef part, başka bir part'ın (source) evaluated world geometrisiyle `clipPath` üzerinden kırpılır
  - Pure helper: `src/utils/matte.ts` (`buildMatteClipPath` → world-space pathD, `kcs-clip-{sourceId}`)
  - Geometry tek kaynak: `src/utils/shapeGeometry.ts` (10 statik shape; renderer + matte aynı kaynak)
  - Tek `<defs>` + 1 source → N target; missing source → recoverable (`MATTE_MISSING_SOURCE`)
  - Editor UI: `StyleMatteSection` (source seçici + enabled toggle + remove); history/clipboard otomatik (structuredClone)
- Eski Mask/Container sistemi **KALDIRILDI** (b60f1ca): MaskTab, MaskGizmo, inner-media, container local-space transform — geri getirilmedi; `MaskData`/`maskOffset*` tipleri bilinçli backward-compat olarak duruyor (track matte bunlara bağlı değil)

## Proje durumu (M12)

- Phase 2-4 ✅ CLOSED — pure evaluation pipeline, serialization fix'leri (BUG #1-6)
- M1-M10 ✅ RELEASE READY — canonical channels, channels-only export, dead code temizliği
- M11 ✅ COMPLETE — Track Matte MVP (clipPath, world-space path, UI, test'ler)
- M12 Step 1 ✅ audit — "M12 KAPATILABİLİR"; 2 LOW OPTIONAL (clipIdFor O(N²), matte-cycle validation) + DEFER listesi (inverted/alpha/luminance/feather matte, freeform/text/image matte, nested/multi-matte, outliner matte icon, matte gizmo)
- Son push: `5763793` (M10) → M11 ayrı commit (bkz. log)

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
