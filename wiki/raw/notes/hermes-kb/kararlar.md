# Kararlar

## [2026-08-06] Uzun bellek sistemi: notes/ klasörü + otomatik günlük özet
- **Sebep:** 2200 karakterlik hızlı bellek genel kullanım için yetersizdi; kullanıcı
  sınırsız, kalıcı bir bellek istedi (sadece projeye değil, genel agent kullanımına).
- **Seçim:** Basit markdown bilgi tabanı (LLM wiki tam formatı yerine — daha hafif) +
  her akşam 22:00'de otomatik özet cron'u.
- **Not:** Obsidian kurulursa aynı klasör vault olarak açılır; seçenekler çakışmaz.

## [2026-08-06] Günlük cron kaldırıldı → özet isteğe bağlı
- Kullanıcı otomatik günlük özet istemedi; "ben deyince yap" dedi.
- Cron görevi (gunluk-bellek-ozeti) silindi; gateway kurulumuna gerek kalmadı.
- Yeni akış: kullanıcı "özet çıkar" / "work-notes birleştir" der → Hermes session_search
  ile tarar, notes'a yazar. İki PC'de de aynı: isteğe bağlı.

## [2026-08-06] Bellek temizliği: düşük değerli kayıtlar silindi
- **Sebep:** 2200 karakterlik hızlı bellek sınırlı; IDE kullanımı ve kurulum detayları
  gibi kayıtlar kalıcı değer taşımıyordu.
- **Yapılan:** "Antigravity IDE/VS Code/OpenCode kullanımı", "VS Code ↔ Hermes (ACP)",
  "OpenCode kurulum detayları" kayıtları bellekten silindi (bellek %62 → %39).
- **İlke:** Bellek sade tutulur — yalnızca kalıcı değeri olan bilgi saklanır.
