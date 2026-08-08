# Öğrenilenler & Teknik Notlar

## Hermes kurulum notları
- KCS skill'leri repoda yaşıyor: `skills/keyframe-studio/` (kcs-*). Tek kaynak orası;
  profile'da kopya oluşturma (gölge sürümler repo sürümünü ezer).
- `skills.external_dirs` ayarı **düz metin yol** olmalı, JSON array değil (array yazımı
  sessizce yok sayılır).

## Uzun bellek sistemi
- [2026-08-06] notes/ klasörü kuruldu; önce otomatik 22:00 özet cron'u denendi, sonra
  kullanıcı isteğiyle kaldırıldı → özet artık isteğe bağlı ("özet çıkar" deyince yapılır).
- Obsidian kurulursa aynı klasör vault olarak açılır — ekstra kurulum gerekmez.
- [2026-08-06] Çalışma PC (kullanıcı ertugrul.ak) kuruldu: ertu profili import edildi,
  OPENCODE_GO_API_KEY yeni anahtarla değiştirildi (test edildi), repo main'den güncel
  (C:/Users/ertugrul.ak/Desktop/keyframe-character-studio), skills.external_dirs bu yola
  ayarlandı — 13 kcs-* skill aktif.

## Ortam & senkron
- [2026-08-06] İki bilgisayarda **ayrı API anahtarları** kullanılıyor; `.env`'e dokunma,
  sağlayıcı hatası olursa kullanıcıya sor.
- Kod senkronu **GitHub** ile; not senkronu **elle** (export/import + isteğe bağlı birleştirme).

## Cron notları
- [2026-08-06] Agent'ın cronjob aracıyla oluşturulan görevlere varsayılan "aux model"
  snapshot'ı yazılıyor (accounts/fireworks/models/kimi-k2p6); o sağlayıcıda API anahtarı
  yoksa "No usable credentials found for provider 'fireworks'" hatası veriyor. Çözüm:
  `hermes cron edit <job_id> --model <model> --provider <provider>` ile pin'lemek
  (örn. `--model deepseek-v4-flash --provider opencode-go`).
