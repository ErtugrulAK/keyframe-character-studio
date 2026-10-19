# progress_199 — Güvenilirlik Sprinti Uygulama Turu (2026-10-20, İş PC)

## Bu turun PR'ları (exact-head CI)

| PR | Branch @ Head | Konu | Kanıt |
|----|---------------|------|-------|
| #41 | `test/q1-gif-retry-reliability` @ `f834cb0` | A1: GIF kurtarma kartının reload'u anlık persistence kararıyla gate'lendi | Unit matrisi A–G,I 15/15 (7'i RED-first); e2e H/F/D+E: gerçek dirty FPS düzenlemesi save-and-reload ile reload'ı geçirdi, cancel'da bellekte kaldı, quota bloklu save reload yapmadı. Tam gif spec 11/11. CI pass |
| #46 | `test/a2-r507-stopwatch-contract` @ `84ec50a` | A2: R5-07 kök neden + sözleşme düzeltmesi | Atık-dump spec 0/300/11000 ms'de statik `buttonCount:4, stopwatch pressed=true` ölçtü → zamanlama yarışı değil, K1 stopwatch'unun aynı konteynerde olması; trio sınıf-kapsamlı sayıldı, stopwatch ayrı assert edildi; dosya 3/3. CI pass |
| #47 | `feat/b1-velocity-math` @ `a062642` | B1: türetilmiş velocity matematiği, tek evaluator üzerinden | 15 unit: lineer kapalı-form, köşe one-sided limit, easeInOut analitik sınır (maks eğim 1.724), ters işaret simetrisi. Paralel easing motoru YOK, ters dönüşüm YOK. CI pass |
| #48 | `fix/d2-focus-token-single-source` @ `548562d` | D2: `--kcs-border-focus` tek tanım | Çalışan uygulamada önce/sonra ölçüm birebir `#52e2c7`; yitiren gölge tanım kaldırıldı. CI pass |
| #49 | `feat/d1-graph-presentation` @ `0ce3992` | D1: graph Editör Increment-1 (sunum) | Live: speed ekseni artık `-34.8..3.2, value-units/frame` (negatif eğim görünür), value ekseni donuk `0..100`; HOLD/IN/OUT rozetleri DOM'da. 18/18 panel+gestürü unit, v6-motion-core e2e yeşil. CI pass |
| #50 | `test/d4-public-controls-contract` @ `43e974d` | D4: public-controls resolver doğrudan kontrat testleri | 10/10; gating, matte dışlaması, paketli-görsel-only, id politikası. CI beklemede (manifest anı) |
| #51 | `docs/d5-feature-blueprints-round2` @ `af6f64d` | D5: Round-2 feature blueprint paketi + index satırı | Docs-only; consistency kapısı 67/67 PASS. CI beklemede |

A3 (defter düzeltmesi) doğrudan main'e commit'lendi: `c14d01f` — #45 kanıt satırı
"PR head'de, main'de henüz yok" olarak düzeltildi.

## Engellenenler (sebep defterde)

- **B2 velocity UI** — roadmap kapısı: hız-graph düzenlenebilirliği ters-eşleme şartnamesi ister
  (Round-2 blueprint F5). İhlal edilmedi.
- **C1 easing preset dilimi** — blueprint sıralaması Increment-1 yüzeyini şart koşar (yüzey #49 ile
  geldi); dropdown yerleşimi ürün kararı. Tüketici-siz preset verisi ölü kod olurdu.
- **D3 mikro cila** — kalan ADOPT maddelerinin üçü de görsel-diff harness'i veya ürün kararı istiyor
  (Round-2 blueprint'te shared prerequisite olarak belgelendi).

## Kombine QA (aday `117aa41` = main + #41…#51, throwaway worktree, push edilmedi)

- Önceki aday `daab052` (#41–#46) sınırlı matrisi: Vitest 194/2851, full Chromium **464/465 + 1
  flaky (history-restore:138, bilinen yüzey)**, tsc/build temiz.
- Genişletilmiş aday `117aa41` (#47–#51 dâhil): Vitest **195/2864**, tsc `0`, build OK;
  full Chromium (workers=1, retries=0) **464 passed / 1 failed**.
- Tek kırmızı `graph-accessibility` — D1 sunum değişikliğinin meşru aria-hidden düğüm artışını
  sayı-kırılganlığıyla pin'leyen mevcut e2e assert'ıydı (10 düğüm vs sabit 3); semantik assert'a
  çevrildi (`b3dc2b6`, PR #49). Güncel aday `1663cf5`: graph-a11y + gif + v6-motion-core 16/16
  yeşil; birimlerde değişiklik yok (e2e dosya düzeltmesi).
- **Octopus uyarısı:** #45 ve #51 aynı `docs/README_INDEX.md` bölgesine additive satır ekliyor —
  tek octopus merge çakıştı; sıralı merge + iki satırı da tutarak çözüldü.
- #47–#51 dosya kesişimi yok (velocityMath / index.css / TemporalGraphPanel+testi / ograf testi /
  docs) — tek PR'lar bağımsız merge edilebilir; yalnız README_INDEX çifti sıralı-dikkat ister.

## Koruma durumu

- Main yalnız `c14d01f` docs commit'i ile ilerledi; PR merge edilmedi (onay sınırında).
- Kanonik hizmetler (5173 UI / 5000 API) yeniden başlatılmadı; tüm browser doğrulaması izole
  worktree'lerde veya kendi izole QA portlarında (5188/5198/5199 — tur sonunda öldürüldü).
- Worktree'ler bu turun kendi 8 worktree'siyle büyüdü; hiçbiri silinmedi. Manifest dirty KORUNDU
  (commit edilmedi). Stash 0.
- Geçici dosyalar silindi: `zz-a2-dump.spec.ts`, `.a1-append.tmp`; a4 adayı throwaway.
