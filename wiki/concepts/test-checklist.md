---
title: Test Checklist
created: 2026-08-08
updated: 2026-08-08
type: concept
tags: [testing, hardware]
sources: [raw/assets/test-checklist.xlsx]
confidence: high
---

# Reality Test Checklist

İş PC'sinden gelen test dokümanı. **Zero Density Reality** sanal stüdyo yazılımının QA test planı.

## Versiyonlar

| Versiyon | Tarih | Test sayısı |
|---|---|---|
| 5.3 SP3 | 2022-01 | ~60 test |
| 5.4 SP2 | 2024-06 | ~300 test |
| 5.6 | 2025-06 | ~150 test |
| 5.7 | 2025-12 | ~75 test |
| 5.8 | 2026-07 | ~75 test |
| 5.8 (yalandan) | 2026-04 | ~75 test |

## Test kategorileri

- **Track and Lens Check** — Lens kalibrasyon, distortion, track kontrolü
- **Keyer Pipeline Check** — Cyclorama, Cleanplate, RealityKeyer, Composite
- **Process Node Check** — Transform, DOF, Resolution, Spawn Actor, Temporal
- **AJA Testleri** — Tüm AJA/DeckLink kartlarında 720p/1080i/1080p/Quad testleri

## Bulgular

- Son versiyon (5.8, Temmuz 2026): büyük ölçüde "Not tested" — test süreci devam ediyor
- 5.6 ve 5.7 versiyonları kapsamlı test edilmiş (çoğu Pass)
- AJA kart testleri her versiyonda tekrarlanmış

## KCS ile ilişkisi

Bu stajın ana projesi değil — iş PC'sindeki asıl iş (Zero Density'de QA/test mühendisliği). KCS staj projesi, bu işin yanında yürütülen bir yan proje.
