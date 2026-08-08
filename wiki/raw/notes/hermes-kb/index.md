# 📚 Kişisel Bilgi Tabanı (Hermes Uzun Belleği)

Bu klasör Hermes agent'ın uzun vadeli belleğidir. 2200 karakterlik hızlı belleğin
ötesinde, sınırsız alanda kullanıcıyla ilgili kalıcı bilgileri biriktirir.

## Nasıl çalışır?
- Hermes **her oturumda** önce bu dosyayı (index.md) okur, sonra ilgili konu dosyalarına bakar.
- Konuştukça yeni bilgiler dosyalara işlenir.
- **Özet isteğe bağlıdır:** kullanıcı "özet çıkar" / "şunları birleştir" dediğinde Hermes oturumları tarar ve
  kalıcı bilgileri buraya yazar. Otomatik cron yoktur.

## Dosyalar
| Dosya | Ne içerir |
|---|---|
| [projeler.md](projeler.md) | Projeler, görevler, ilerleme durumu |
| [tercihler.md](tercihler.md) | Kişisel tercihler, çalışma tarzı |
| [ogrenilenler.md](ogrenilenler.md) | Öğrenilenler, teknik notlar, ortam bilgisi |
| [kararlar.md](kararlar.md) | Alınan kararlar ve gerekçeleri |

## Komutlar (özet isteme)
| Sen dersen | Hermes ne yapar |
|---|---|
| "özet çıkar" | Son konuşmaları tarar, kalıcı bilgileri notes'a işler |
| "haftalık özet" / "aylık özet" | Son 7 gün / 30 günün özeti |
| "work-notes birleştir" | Attığın work-notes klasörünü evdeki notes ile birleştirir |
| "[konu] hakkında ne yazmışız" | Bilgi tabanında arar |
| "not al" | Şu anki konuşmadaki kalıcı bilgileri hemen dosyalara yazar |
| "bellek ne diyor" / "bende ne var" | Bilgi tabanında ne biriktiğini özetler |

> Doğal cümle de olur: "dün ne konuştuk", "şunları unutma", "bunları kaydet". Hermes bağlamdan anlar.

## Kurallar
- Güncellemeler kısa ve madde işaretli olsun.
- Sadece **kalıcı** bilgi yaz; geçici task durumu / tek seferlik işleri yazma.
- Tarih damgası ekle: `[YYYY-MM-DD]`
- Aynı bilgiyi tekrar ekleme — varsa güncelle.
