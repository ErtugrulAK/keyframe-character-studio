---
name: kcs-track-matte
description: Use when working on KCS Track Matte (SVG clipPath) — architecture, data model, rules, tests.
version: 1.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, track-matte, svg, clipPath]
    related_skills: [kcs-project-context, kcs-constitution, kcs-workflows]
---

# Track Matte (SVG clipPath) — KCS

M11 ile eklenen sistem: bir CharacterPart (target), başka bir part'ın (source)
evaluated world geometrisiyle SVG `clipPath` üzerinden kırpılır. Canvas 2D /
PixiJS / Fabric.js YOK — yalnızca SVG.

## Data model

```ts
// animator.ts
interface PartMatte { sourcePartId: string; mode: 'clip'; enabled?: boolean }
// CharacterPart.matte?: PartMatte   (SceneLayer.matte?: PartMatte — serialization)
```

- `enabled !== false` → aktif (undefined = aktif — backward-compat)
- `mode` MVP'de yalnızca `'clip'`; bilinmeyen mode render'da kontrol edilmiyor (yine clip uygular — güvenli)
- Source kendi channel'larıyla animasyonlu (yeni matte channel YOK — asla ekleme)

## Mimari (tek kaynaklar)

```
shapeGeometry.ts  → local geometry (10 statik shape) — TEK kaynak; renderer + matte ortak
matte.ts          → buildMatteClipPath(source, worldTransform) → { id, pathD } | null
                    world-space path: CANVAS_CENTER + x/y + rotate + scale (PartRenderer ile birebir sıra)
                    id: kcs-clip-{sourcePartId} (deterministik)
StagePartLayers   → evaluateFrame sonrası: Map<sourceId, clip> dedupe → tek <defs>
                    buildMatteClipPath ÖNCESİ matteClips.has(clipId) kontrolü (1 source → N target: 1 build)
PartRenderer      → matteClipPathId prop → root <g clipPath="url(#kcs-clip-{id})">
validateScene     → MATTE_MISSING_SOURCE (recoverable)
useSerialization  → layers[].matte (export) / l.matte (import) — M8 channels-only policy DEĞİŞMEZ
StyleMatteSection → Inspector UI: source seçici + enabled toggle + remove
```

## Kurallar

- `sourcePartId` otomatik remap YOK (copy/duplicate'ta aynen taşınır — bilinçli, değiştirme)
- Matte ≠ parent-child: matte parentId sistemine DOKUNMAZ; source/target z-order normal
- Source normal render edilmeye devam eder (opacity/visible/zIndex clip geometrisini etkilemez — transform harici)
- Missing source → clip yok + recoverable uyarı; asla crash
- Freeform matte: DEFER (path parsing gerekir — buildFreeformPath dynamic)
- Text/image/video/cloner matte: DEFER (geometry yok → getShapeGeometry null → clip yok)
- Geometry ASLA hardcode etme — hep shapeGeometry'den (renderer + matte duplicate yasak)
- CANVAS_CENTER constants.ts'ten (tek sabit — iki yerde hesaplama yok); viewport pan/zoom path'e GİRMEZ

## Pitfall'lar

- `evaluateTransform` part'ın track'i YOKSA early return (parent composition çalışmaz) — parent'lı source testlerinde boş track vermek gerekir
- `clipPathUnits="userSpaceOnUse"` + world-space path (transform attr yok — browser riski yok)
- Negatif scale: circle/rounded-rect sweep edge case (|sx| + sweep=1) — bilinen sınır, DEFER
- Matte cycle (A→B→A): render güvenli (recursion yok — build source'un matte'sine bakmaz); validation uyarısı yok (MATTE_CYCLE — OPTIONAL)

## Test'ler

- `matte.test.ts` — world-space A/B/C (static/rotated+scaled/parented), shape kapsamı, deterministic, animated frame
- `matteRender.test.tsx` — StagePartLayers render: tek clip, N target, enabled=false, missing source, freeform
- `styleMatteSection.test.tsx` — UI: source seçimi, self/unsupported engeli, toggle, remove, missing source
- `useSerialization.test.ts` — matte round-trip, legacy no-matte; `useHistory.test.ts` — undo/redo; `useClipboard.test.ts` — duplicate
- Baseline: 316/316 (M12)

## Deferred (yeni feature kararı gerektirir)

inverted / alpha / luminance / feather / gradient matte (→ `<mask>` fazı — defs üretim noktası aynı, mimari uygun) · nested / multi-matte (tip migration gerekir) · freeform/text/image/video matte · outliner matte icon / relationship viz · matte gizmo
