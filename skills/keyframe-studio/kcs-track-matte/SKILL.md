---
name: kcs-track-matte
description: Use when working on KCS Track Matte (SVG clipPath + mask) — architecture, data model, browser-verified semantics, rules, tests.
version: 2.0.0
author: senmu
license: MIT
metadata:
  hermes:
    tags: [keyframe-studio, track-matte, svg, clipPath, mask, alpha, luminance, inverted]
    related_skills: [kcs-project-context, kcs-constitution, kcs-workflows]
---

# Track Matte (SVG clipPath + mask) — KCS

M11 + M13 sistemi: bir CharacterPart (target), başka bir part'ın (source)
evaluated world geometrisiyle kırpılır. Canvas 2D / PixiJS / Fabric.js YOK —
yalnızca SVG.

## Data model

```ts
// animator.ts
interface PartMatte {
  sourcePartId: string;
  mode?: 'clip' | 'alpha' | 'luminance';  // absent → 'clip' (legacy, runtime-resolved)
  inverted?: boolean;
  enabled?: boolean;
}
// CharacterPart.matte?: PartMatte   (SceneLayer.matte?: PartMatte — serialization)
```

- `enabled !== false` → aktif; `mode` yok → `resolveMatteMode` ile 'clip'
- Serialization migration YOK — legacy `{sourcePartId}` import'ta yeniden yazılmaz
- Source kendi channel'larıyla animasyonlu (yeni matte channel YOK — asla ekleme)

## Mimari (tek kaynaklar)

```
shapeGeometry.ts → local geometry (10 statik shape) — TEK kaynak; renderer + matte ortak
matte.ts         → buildMattePath(source, worldTransform) → world-space pathD (SINGLE geometry core)
                   buildMatteClipPath (clip wrapper) / buildMatteMaskFromPath (mask data)
                   matteClipPathId: kcs-clip-{sourceId} / matteMaskId: kcs-mask-{src}-{mode}{-inv}
                   resolveMatteMode / isMatteActive
StagePartLayers  → evaluateFrame sonrası: matteClips + matteMasks Map dedupe → tek <defs>
                   maskPathCache: aynı source'un farklı mask modları 1 buildMattePath paylaşır
PartRenderer     → clip/mask TRANSFORM'SIZ OUTER <g>'de; transform/opacity/events INNER <g>'de
                   (M13 2E fix: userSpaceOnUse defs, transform'lu g'de referans edilince
                    target'ın LOCAL uzayında çözülür — outer g dünya uzayını garanti eder)
validateScene    → MATTE_MISSING_SOURCE (recoverable)
useSerialization → layers[].matte pass-through (M8 channels-only policy DEĞİŞMEZ)
StyleMatteSection→ Inspector: source seçici + Mode select + Inverted toggle + Enabled + Remove
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
- Geometry ASLA hardcode etme — hep shapeGeometry → buildMattePath
- CANVAS_CENTER constants.ts'ten (tek sabit); viewport pan/zoom path'e GİRMEZ
- Freeform/text/image/video matte: DEFER (getShapeGeometry null → clip/mask yok)

## Test'ler

- `matte.test.ts` — world-space A/B/C (static/rotated+scaled/parented), animated frame,
  shape kapsamı, deterministic, pure helper'lar (buildMattePath/buildMatteMask/resolve)
- `matteRender.test.tsx` — render: tek clip/mask def, N target, enabled=false,
  missing source, freeform, mixed modes geometry parity, evenodd alpha-inv
- `styleMatteSection.test.tsx` — UI: source/mode/inverted/enabled/remove, legacy display
- `useSerialization.test.ts` — matte round-trip (alpha/luminance/inverted/combined/
  enabled=false/legacy), channels-only policy
- `e2e/track-matte.spec.ts` — REAL Chromium: 7 DOM testleri (T1-T8) + 7 gerçek PIXEL
  compositing testleri (V-A..V-G — world→screen CTM + PNG decode ile)
- Baseline: 354/354 vitest + 14/14 playwright (M13 kapanışı)

## Deferred (yeni feature kararı gerektirir — M13'te YAPILMADI)

feather · gradient matte · freeform matte · text/image/video matte · nested matte ·
multi-matte (tip migration gerekir) · matte gizmo / geometry editor · outliner matte
icon / relationship visualization · timeline matte indicator · drag/drop matte
assignment · matte strength/opacity
