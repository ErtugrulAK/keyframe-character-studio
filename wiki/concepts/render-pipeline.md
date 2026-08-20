---
title: Render Pipeline
created: 2026-08-08
updated: 2026-08-08
type: concept
tags: [canvas, render, svg, mask, media]
sources: []
confidence: medium
---

# Canvas Render Pipeline

KCS sahne canvas'ının render mimarisi.

## Katman sırası (içten dışa)

1. **Dolgu (fill)** — Şeklin kendi rengi, `transform.opacity`'yi takip eder
2. **Mask'lı medya (fotoğraf)** — `clipPath` ile maskelenir, kendi `innerMediaOpacity`'si
3. **Kontur (stroke)** — Şeklin dış çizgisi

## Bileşen zinciri

```
StageCanvas
  └─ StagePartLayers (sortedParts)
       └─ PartRenderer (her parça için)
            ├─ ShapePartRenderers (dolgu + kontur)
            ├─ mediaLayer (fotoğraf + mask grubu)
            ├─ mediaDragHandle (fotoğraf çerçeve tutamaçları)
            └─ childFrameGizmo (container içi çocuk çerçevesi)
```

## Gizmo sistemi

| Gizmo | Konum | Ne işe yarar |
|---|---|---|
| [[transform-gizmo]] | Overlay (zoom dışı) | Taşıma/döndürme/boyutlandırma |
| [[mask-gizmo]] | Overlay (zoom dışı) | Mask noktalarını düzenleme |
| mediaDragHandle | PartRenderer içi | Fotoğraf çerçevesini taşıma/boyutlandırma |
| childFrameGizmo | PartRenderer içi | Container içi çocuk element düzenleme |

## Zoom ve ekran-sabit boyut

- `zScale = 1 / zoomLevel` — overlay gizmo'larına prop olarak geçilir
- PartRenderer içi gizmo'lar: `zScale / abs(partScale)` ile ekran-sabit piksel
- MaskGizmo: `invScale = zoomLevel` (aslında zScale) — overlay'de olduğu için doğrudan çarpar

## Bilinen sorunlar

- Container içine atanan çocuk elementler bazen görünmüyor (clip bölgesi sorunu)
- Freeform'un concave şekillerinde mask render'ı test edilmedi
