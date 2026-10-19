# Progress 198 — Uzun Koşu Kalite/Performans/UI Sprinti (Q1–Q4, P1–P4, U1–U6, R1)

## Başlangıç / bitiş
- Start: `main == origin/main == 034c7f86e4a8281bf84740ab8640d33062133e46`
- End: aynı. **Merge yapılmadı** (beş PR açık), tag/version/publish yok, 4312 hiç açılmadı, 5173/5000 kesintisiz.

## Açılan PR'lar (exact-head CI: beşinde de PASS)

| PR | Konu | Head | Doğrudan kanıt |
|----|------|------|----------------|
| #41 | Q1 — GIF kurtarma kartına "Reload editor" + e2e'yi platform gerçeğine oturtma | `7e3efae` | Enstrümante repro: abort→unroute→Retry'da **hiç network isteği yok** (Chrome module-map kalıcı hata); tek-test ×5 yeşil, tam-spec prod+dev 8/8, unit 7/7 |
| #42 | Q2 — m26 clear onay diyaloğu senkronu (test tarafı) | `4c6231a` | Kırmızı iz: pointer-interception timeout (K1/D2 onay kontratı); tek ×3 + dosya 2/2 |
| #43 | Q3 — R5-02 hit-test'i yalnız monte panelden sonra ölçüyor | `d66e91e` | Kırmızı iz: loading-card swap penceresi (geometricOverlap=false); dosya ×4 yeşil; R5-07 uydurma-düzeltme reddi defterde |
| #44 | U1 — cetvel WAI slider: ok ±1, Shift ±10, Home/End, tek seek otoritesi | `aeb87b4` | Unit 4/4 + kalıcı e2e 3/3 (playhead data-frame + mover'ın boyanan konumu), full Vitest 193/2827 |
| #45 | Doküman paketi — P1 tablosu, U2–U6, R1 | `b0b033d0` | Kanıt PR head branch'indedir (`docs/KCS_SPRINT_BLUEPRINTS_AND_AUDITS.md` + index satırı); main'de henüz yoktur — PR OPEN, merge bekleniyor |

## Q4 stabilite matrisi (hepsi ilk-deneme, retries=0, Chromium stable, Windows)
- #41 head: gif tek ×5 PASS · gif tam-spec prod 8/8 · dev 8/8 · combined(w1) 13/13 · combined(w4) 13/13
- #42 head: m26 tek ×3 PASS · dosya 2/2 · combined(w1) 13/13 · combined(w4) 13/13
- #43 head: panel dosyası ×4 PASS · timeline dosyası ×3 PASS · combined(w1) 13/13 · combined(w4) 13/13
- İzole-yeşil/kombinasyon-kırmızı ayrımı yalnız R5-07'de sürüyor (kronik yüzey; §defter).

## P1 üretim profili (izole prod build; ×3 tur; varyans ≤%10)
| Sahne | rAF p50/p95 | Long task (ilk mount) | DOM | Heap |
|---|---|---|---|---|
| 6×4 | 16.7 / 16.7–16.8 ms | 1 × 79–89 ms | 1,124 | 40.6 MB |
| 40×30 | 16.7 / 16.7–16.8 ms | 2 × 196–209 ms | 6,692 | 51.8 MB |
| 80×30 | 16.7 / 16.7–16.8 ms | 3 × 258–264 ms | 12,692 | 72 MB |

**Kararlar:** P2 optimizasyon PR'ı YOK (prod'da Playback hotspot yok; ~2.5 MB/frame sayısı DEV artefaktı olarak resmen emekli). P3 provider split YOK (aynı kanıt). P4 history sabit: undo/redo ≈50 ms içinde settle, 30 edit 6→120 katmanda düz (~130 ms), derin-sonuç sendetik tuş caveat'ı ile; birim E1 ölçümleriyle uyumlu.

## Nihai kombine QA (aday `6fbb351` = main + #41+#42+#43+#44 octopus, throwaway worktree)
- Vitest **193 dosya / 2828 / 0 fail**.
- **Full Chromium 462: 460 geçti · 1 flaky-pass (import-undo, bilinen yüzey) · 1 FAILED: R5-07** (tek kronik yük-yüzeyi; izole ×5 yeşil). progress_197'nin dört kırmızısından üçü kombine koşuda **öldü**: gif:384 ✓, m26:73 ✓, R5-02 ✓.
- Kombinasyon lokal test amaçlıdır; PR merge'i yapılmadı, main'e hiçbir şey patch'lenmedi.

## Korumalar
Manifest dirty korundu (ellenilmedi, commit edilmedi); EFFECTCRAFT + progress_189–198 + `.research/*` + QA klasörleri 4/4 yerinde; 124 branch, worktree listesi yalnız **bu turun kendi worktree'leriyle** büyüdü (5 yeni), hiçbiri silinmedi; stash 0.

## Kalan borç / karar bekleyenler
1. #41–#45 merge onayı (bağımsız; dosya kesişimi yok) — merge sonrası main üzerinde tek tam gate koşusu.
2. R5-07 kroniği (kombinasyon-yük yüzeyi) — ayrı izleme.
3. U3 focus-token ikiliği (`--kcs-focus` iki katmanda iki renk) — görsel-diff'li stil görevi.
4. U4 Graph Editor V2 increment planı, U5 restore pipeline önerisi (onaylı ayrı tur).
5. G1 release-prep: rc drift + CHANGELOG + merge'lerden sonra main üzerinde tek tam yeşil gate.
6. Bu turun throwaway dosyaları silindi; geçici local ref `test/combined-qa-20261019` (push edilmedi) ve tur worktree'leri temizlik onayında ele alınacak.

## ChatGPT'ye Yüklenecek Dosya
`C:\Users\ertugrul.ak\Desktop\keyframe-character-studio\chatgpt_handoff\latest\CHATGPT_UPLOAD_ONEFILE.md`
