---
title: Long-term Memory System
created: 2026-08-08
updated: 2026-08-08
type: concept
tags: [hermes, memory, workflow]
sources: [raw/notes/hermes-kb/ogrenilenler.md, raw/notes/hermes-kb/kararlar.md]
confidence: high
---

# Uzun Bellek Sistemi

Hermes agent'ın 2200 karakterlik hızlı belleğin ötesinde kullandığı kalıcı bilgi depolama.

## Evrim

### Aşama 1: Sadece hızlı bellek (2200 karakter)
- Agent profili, ortam detayları, püf noktaları
- Sınırlı — genel kullanım için yetersiz

### Aşama 2: `notes/` klasörü (2026-08-06)
- `profiles/ertu/notes/` altında markdown dosyaları
- 5 dosya: `index.md`, `projeler.md`, `tercihler.md`, `ogrenilenler.md`, `kararlar.md`
- Özet isteğe bağlı ("özet çıkar" deyince `session_search` ile taranır)
- 22:00 cron'u denendi → kullanıcı isteğiyle kaldırıldı

### Aşama 3: LLM Wiki (2026-08-08)
- Karpathy yöntemi — yapılandırılmış, çapraz linkli bilgi tabanı
- Repo içinde: `keyframe-character-studio/wiki/`
- Git ile iki PC arası senkron
- Obsidian uyumlu

## Mevcut durum

```
wiki/
├── SCHEMA.md         # Kurallar, etiket taksonomisi
├── index.md          # Sayfa kataloğu
├── log.md            # İşlem kaydı
├── raw/              # Ham kaynaklar (değişmez)
├── entities/         # Kişi, proje, araç sayfaları
├── concepts/         # Kavram sayfaları
├── comparisons/      # Karşılaştırma analizleri
└── queries/          # Kayda değer soru-cevaplar
```

## İki PC senkronizasyonu

- **Kod:** GitHub (`git pull/push`)
- **Wiki:** Git ile (repo içinde)
- **Hermes profili:** Export/import (tek yönlü snapshot)
- **API anahtarları:** Her makinede ayrı (`.env`'e dokunma)
