---
title: Keyframe Character Studio
created: 2026-08-08
updated: 2026-08-08
type: entity
tags: [kcs, react, typescript, canvas]
sources: [raw/notes/hermes-kb/projeler.md]
confidence: high
---

# Keyframe Character Studio

Staj projesi — karakter animasyon editörü. React + TypeScript canvas uygulaması.

## Temel bilgiler

| Alan | Değer |
|---|---|
| Repo (ev) | `C:\Users\senmu\Masaüstü\keyframe-character-studio` |
| Repo (iş) | `C:\Users\ertugrul.ak\Desktop\keyframe-character-studio` |
| Branch | `main` |
| Paket yöneticisi | npm |
| Build | `npm run build` → Vite |
| Test | Vitest, 106 test |
| Lint | ESLint, 0 hata |

## Mimari

- **Thin Orchestrator Pattern** — [[thin-orchestrator-pattern]]
- Canvas render: `StageCanvas` → `StagePartLayers` → `PartRenderer`
- Gizmo sistemi: `TransformGizmo`, `MaskGizmo`, `SelectionGizmo`, media/child handles
- Inspector: Mask tab, Transform tab, Container assign

## AI ajan kuralları

- Anayasa: analiz → plan → onay → uygula → doğrula
- Konuşma dili: Türkçe
- Kod/yorum/commit: İngilizce
- KCS skill'leri: `skills/keyframe-studio/` (kcs-* serisi)

## Son durum (2026-08-08)

- Mask varsayılanları şekil konturunu izliyor ([[mask-defaults]])
- Render katmanları düzeltildi: dolgu altta, mask'lı medya ortada, kontur üstte
- Gizmo tutamaçları ekran-sabit boyutta, köşe imleçleri doğru yönde
- LLM Wiki kuruldu ([[wiki-setup]])
