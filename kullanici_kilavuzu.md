# 🎬 Keyframe Studio — Kullanıcı Kılavuzu (User Manual)
### 2D Motion Sequencer & Broadcast Graphics Platform

> Bu kılavuz, Keyframe Studio platformunu hiç teknik bilgisi olmayan bir kullanıcının bile rahatça kullanabilmesi için hazırlanmıştır. Adım adım; ekran bölgelerinden fare hareketlerine, klavye kısayollarından pratik canlı yayın senaryolarına kadar her şeyi kapsar.

---

## 📑 İçindekiler

1. [Ekran ve Arayüz Oryantasyonu (İlk Bakış)](#1-ekran-ve-arayüz-oryantasyonu-ilk-bakış)
2. [Tüm Özelliklerin Kullanımı](#2-tüm-özelliklerin-kullanımı)
3. [Fare Hareketleri ve Sürükle-Bırak Etkileşimleri](#3-fare-hareketleri-ve-sürükle-bırak-etkileşimleri)
4. [Klavye Kısayolları ve Özel Tuşlar](#4-klavye-kısayolları-ve-özel-tuşlar)
5. [Baştan Sona Uygulamalı Örnek Senaryo](#5-baştan-sona-uygulamalı-örnek-senaryo)

---

## 1. Ekran ve Arayüz Oryantasyonu (İlk Bakış)

Keyframe Studio'yu ilk açtığınızda karanlık (dark mode) temalı, profesyonel bir editör arayüzüyle karşılaşırsınız. Ekran **5 ana bölgeye** ayrılmıştır:

### 🔝 Üst Çubuk (Header Bar)

Ekranın en üstünde yatay olarak uzanan ince çubuktur. Soldan sağa şu öğeleri içerir:

| Alan                      | Konum           | Ne İşe Yarar                                                                                                              |
| :------------------------ | :-------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Şablon Sekmeleri**      | Sol üst köşe    | Tarayıcı sekmeleri gibi görünür. Her sekme bir grafik şablonuna (template) karşılık gelir. Aktif sekme vurgulanır.        |
| **"+" Butonu**            | Sekmeler yanında| Yeni bir grafik şablonu oluşturmak için kullanılır. Tıklayınca isim girdiğiniz küçük bir pencere (modal) açılır.         |
| **EDIT MODE / BROADCAST** | Ortada          | İki modlu anahtar (toggle). **EDIT MODE** (turkuaz): Tasarım yaparsınız. **BROADCAST** (altın sarısı): Reji moduna geçersiniz. |
| **Otomatik Kayıt**        | Sağ taraf       | Yeşil nokta ve kayıt zamanını gösterir. Projeniz otomatik kaydedilir. Tıklayarak anında manuel kayıt yapabilirsiniz.      |
| **FPS Seçici**            | Sağ taraf       | Animasyonunuzun kare hızını (24, 30, 60 veya 120 FPS) seçersiniz.                                                         |
| **Import (İçe Aktar)**    | Sağ taraf       | Daha önce dışa aktardığınız bir JSON dosyasını geri yüklemek için kullanılır.                                             |
| **Export Video**          | Sağ taraf       | Projenizi JSON formatında bilgisayarınıza indirmenizi sağlar.                                                             |
| **Sıfırla Butonu (↺)**    | En sağ köşe     | Tüm projeyi sıfırlar, boş bir sayfa ile yeniden başlarsınız.                                                              |

---

### 📐 Sol Panel (Left Toolbar)

Ekranın sol kenarında dikey bir simge çubuğu ve yanında açılan içerik alanı (drawer) bulunur. 5 ana sekmesi vardır:

| Sekme           | Simge              | Açıklama                                                                                                                              |
| :-------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **Project**     | 📐 Layout simgesi  | Proje çözünürlüğünü ayarlarsınız (1080p, Vertical, Square, 1440p veya özel boyut).                                                   |
| **Media**       | 🖥 Monitor simgesi | Bilgisayarınızdan resim veya video dosyası yüklersiniz. Sürükle-bırak veya tıklayarak seçebilirsiniz.                                 |
| **Elements**    | ⬜ Kare simge      | Hazır geometrik şekiller listesidir: Dikdörtgen, Kare, Daire, Üçgen, Yıldız, Eşkenar Dörtgen. Tıklayarak veya sürükleyerek eklersiniz. |
| **Texts**       | 🔤 Yazı simgesi    | Metin öğeleri eklersiniz: Heading (başlık), Cinematic Title (sinematik başlık), Subheading (alt başlık).                              |
| **Transitions** | ⚡ Şimşek simgesi   | Seçili nesneye hazır hareket efektleri uygularsınız: Kayma, Solma (Fade In), Pop Zoom, 360° Dönme, Zıplama (Bounce In).                |

---

### 🖼 Orta Alan (Stage Canvas / Sahne)

Ekranın tam ortasında yer alan geniş karanlık alandır. Bu, animasyonunuzun canlı önizleme sahnesidir:

- **Artboard (Çalışma Alanı):** Sahnedeki açık renkli dikdörtgen, video/grafiğinizin çıktı sınırlarını gösterir. Bu sınırların dışındaki nesneler canlı yayında görünmez.
- **Izgara (Grid):** İnce kesikli çizgiler halinde ızgara. Nesneleri hizalamak için yardımcı olur. Sağ üst köşedeki ızgara butonuyla açıp kapatabilirsiniz.
- **Kılavuz Çizgileri:** Kırmızı kesikli yatay ve dikey çizgiler, sahnenin tam merkezini gösterir. Nesneleri ortalamak için referans noktasıdır.
- **Viewport Araç Çubuğu:** Sahnenin sağ üst köşesinde yüzen küçük cam panel. Izgarayı aç/kapa, yakınlaştır, uzaklaştır ve görünümü sıfırla butonları içerir.

---

### 🎛 Sağ Panel (Property Inspector)

Ekranın sağ tarafında, seçili nesnenin tüm özelliklerini gösteren ve düzenlemenizi sağlayan detay panelidir. İki ana bölümü vardır:

#### Üst Bölüm: Template Elements (Şablon Öğeleri / Outliner)
- Sahnedeki tüm nesnelerin listesidir — her birinin yanında göz simgesi (görünürlük) bulunur.
- Bir nesneye tıklayarak onu seçersiniz.
- `▲` ve `▼` butonlarıyla veya sürükle-bırakla nesnelerin katman sırasını (derinliğini) değiştirebilirsiniz.

#### Alt Bölüm: Details (Detaylar)
Seçili nesnenin adı ve 3 alt sekmesi (tab) vardır:

| Sekme         | İçerik                                                                                                                                 |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Transform** | Konum (X, Y), Döndürme (Rotation), Ölçek (Scale X/Y), Saydamlık (Opacity), Z-Index (katman sırası), Hizalama ve Maskeleme ayarları.   |
| **Style**     | Dolgu rengi (Fill Color), çerçeve rengi (Stroke Color), renk paletleri, köşe yuvarlaklığı, metin/tipografi ayarları, gölge efektleri. |
| **Keyframes** | Seçili nesnenin animasyon karelerini (keyframe) listeler; her birini seçip düzenleyebilir veya silebilirsiniz.                        |

> [!TIP]
> Sağ panelin genişliğini, panelin sol kenarındaki ince çizgiyi sürükleyerek ayarlayabilirsiniz. Ayrıca Outliner ve Details bölümlerinin yükseklik oranını da aralarındaki yatay çizgiyi sürükleyerek değiştirebilirsiniz.

---

### ⏱ Alt Panel (Sequencer Timeline / Zaman Çizelgesi)

Ekranın altında yatay olarak uzanan zaman çizelgesi bölümüdür. Animasyonun kare kare kontrolünü buradan yaparsınız:

| Alan                     | Açıklama                                                                                                                |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **Zaman Kodu**           | Sol üst köşede `00:00:00 / 00:05:00` formatında, şu anki ve toplam süreyi gösterir.                                     |
| **Duration (Süre)**      | Animasyonun toplam süresini saniye cinsinden ayarlarsınız. Hazır butonlar (1s, 2s, 3s, 5s, 10s) ve özel değer girişi.   |
| **Crop (Kırp)**          | Sahneyi kırpma moduna geçirir.                                                                                          |
| **Oynatma Kontrolleri**  | Başa sar (⏮), Oynat/Durdur (▶ büyük yeşil buton), Sonraki kareye git (⏭), Döngü modu (🔁).                               |
| **Motion Curves**        | Hareket eğrisi düzenleyicisini açar. Hızlanma/yavaşlama eğrilerini (easing) Bezier eğrisi ile ince ayar yaparsınız.     |
| **Sequence Sekmeleri**   | Alt kısımda "Sequence" sekmeleri bulunur. Her sekme farklı bir hareket dizisidir. Yeni sekme ekleyebilir veya silersiniz|
| **Katman İzleri**        | Her nesne bir satır (track) olarak görünür. Görünürlük, kilitleme ve yeni öğe ekleme butonları bulunur.                 |
| **Keyframe Elmasları**   | Zaman çizelgesindeki renkli elmas şekilleri animasyon kareleridir. Sürükleyerek zamanlamayı değiştirebilirsiniz.        |
| **Playhead**             | Dikey turkuaz çizgi, mevcut kareyi gösterir. Tıklayarak veya sürükleyerek farklı bir zamana atlayabilirsiniz.           |
| **Undo/Redo, Zoom, Fit** | Sağ alt köşede geri al, ileri al, zaman çizelgesi yakınlaştırma ve ekrana sığdırma butonları bulunur.                   |

---

## 2. Tüm Özelliklerin Kullanımı

### 2.1 Şablon (Template) Yönetimi
- **Yeni şablon oluşturma:** Üst çubuğun solundaki **"+"** butonuna tıklayın → açılan pencereye bir isim yazın → **"Create Template"** butonuna basın.
- **Şablonlar arası geçiş:** Üst çubuktaki sekmelere tıklayarak farklı şablonlar arasında geçiş yapın. Her şablonun kendi sahnesi ve animasyonları bağımsızdır.
- **Şablon adını değiştirme:** Sekme üzerindeki isme **çift tıklayın (double-click)** → ismi düzenleyin → **Enter** tuşuna basarak onaylayın.
- **Şablonu silme:** Sekmedeki küçük **"✕"** butonuna tıklayın.

### 2.2 Sahneye Öğe Ekleme
1. **Tıklayarak ekleme:** Sol paneldeki Elements, Texts veya Media sekmelerinde ilgili öğenin kartına tıklayın. Nesne sahnenin merkezine eklenir.
2. **Sürükle-bırak:** Kartı tutup sahneye sürükleyin ve istediğiniz noktada bırakın.

### 2.3 Medya (Görsel/Video/YouTube) Ekleme
- Sol panelde **Media** sekmesine geçin.
- **"Select media"** yazılı alana tıklayın veya dosyalarınızı bu alana sürükleyip bırakın. (PNG, JPG, WebM, MP4 formatları desteklenir.)
- **YouTube Video Ekleme:** Bir video veya şekil seçtikten sonra medya URL alanına YouTube linki (`youtube.com/watch?v=...` veya `youtu.be/...`) yapıştırarak doğrudan sahneye veya şekil maskesine gömebilirsiniz.

### 2.4 Medya ile Şekil Maskeleme (Canva Tarzı)
1. Sahneye önce bir şekil ekleyin (örneğin üçgen veya dikdörtgen).
2. Bilgisayarınızdan bir resim/video dosyasını veya YouTube linkini doğrudan o şeklin üzerine sürükleyin.
3. Medya, şeklin sınırları içinde otomatik olarak kırpılarak görünecektir.

### 2.5 Nesne Seçimi ve Çoklu Seçim
- **Tek nesne seçme:** Sahnedeki nesneye tıklayın. Etrafında kontrol noktaları belirecektir.
- **Çoklu seçim (Marquee):** Sahnenin boş bir yerine tıklayıp fareyi sürükleyerek seçim kutusu çizin.
- **Seçimi temizleme:** Sahnenin boş bir yerine tıklayın.

### 2.6 Nesneyi Taşıma, Döndürme ve Ölçekleme
- **Taşıma:** Nesnenin gövdesine tıklayıp sürükleyin. Sahne merkeziyle hizalandığında otomatik yapışma çizgileri (snap lines) belirir.
- **Döndürme:** Nesnenin üst ortasındaki turuncu yuvarlak noktayı tutup sürükleyin.
- **Oransal ölçekleme:** Köşelerdeki mavi kare noktaları sürükleyin.
- **Yatay/Dikey ölçekleme:** Sağ, sol, üst veya alt kenardaki noktaları sürükleyin.

### 2.7 Transform Özellikleri (Sağ Panel → Transform Sekmesi)
- **POS X / POS Y:** Nesnenin konumunu piksel cinsinden girin.
- **ROTATION:** Dönme açısını derece olarak girin (0°–360°).
- **SCALE:** Ölçek değerini yüzde olarak girin (100% = orijinal boyut).
- **OPACITY:** Saydamlık değerini 0 ile 100 arasında girin.
- **Z-INDEX:** Nesnenin katman sırasını belirler (`▲`/`▼` butonlarıyla kolayca değiştirebilirsiniz).

### 2.8 Stil Özellikleri (Sağ Panel → Style Sekmesi)
- **Fill Color / Stroke Color:** Dolgu ve çerçeve rengini seçin.
- **Corner Radius:** Dikdörtgen/kare şekillerin köşelerini yuvarlaklaştırın (0 = keskin, 50 = yuvarlak).
- **Font ve Metin Ayarları:** Yazı tipi, boyut, kalınlık ve hizalama seçenekleri.
- **Drop Shadow & Glow:** Nesneye gölge veya parlama efekti ekleyin.

### 2.9 Animasyon ve Keyframe Sistemi
1. Zaman çizelgesinde oynatma iğnesini istediğiniz kareye getirin.
2. Nesnenin özelliğini değiştirin (konum, boyut, saydamlık vb.).
3. Değişiklik otomatik olarak o kareye keyframe olarak kaydedilir.
4. Oynat butonuna basın (▶) — nesne iki konum arasında akıcı şekilde hareket edecektir.

### 2.10 Canlı Yayın Modu (Broadcast Mode)
1. Üst çubuktaki **"BROADCAST"** butonuna tıklayın.
2. Editör panelleri gizlenir ve ekran canlı yayın reji moduna geçer.
3. Alt kısımdaki **"LIVE DIRECTOR PANEL"** üzerinden grafiklerinizi canlı olarak ekrana verebilir veya kaldırabilirsiniz.
4. **"EDIT MODE"** butonuna tıklayarak tasarım moduna geri dönebilirsiniz.

---

## 3. Fare Hareketleri ve Sürükle-Bırak Etkileşimleri

### 🖱 Sol Tık Etkileşimleri

| Eylem               | Nerede                            | Ne Olur                                                                 |
| :------------------ | :-------------------------------- | :---------------------------------------------------------------------- |
| **Tıklama**         | Sahnedeki bir nesneye             | Nesneyi seçer, etrafında kontrol noktaları belirir                      |
| **Tıklama**         | Sahnenin boş alanına              | Seçimi temizler                                                         |
| **Tıkla + Sürükle** | Nesnenin gövdesi                  | Nesneyi taşır (otomatik yapışma çizgileri aktif)                        |
| **Tıkla + Sürükle** | Köşe noktaları (mavi kareler)     | Oransal ölçekleme yaparlar                                              |
| **Tıkla + Sürükle** | Kenar ortası noktaları            | Tek yönlü ölçekleme yapar                                               |
| **Tıkla + Sürükle** | Turuncu yuvarlak nokta (üstte)    | Nesneyi döndürür                                                        |
| **Tıkla + Sürükle** | Sahnenin boş alanında             | Seçim kutusu (marquee) çizer; içine düşen nesneler seçilir              |
| **Tıkla + Sürükle** | Zaman çizelgesindeki iğne         | Oynatma iğnesini (playhead) taşır                                       |
| **Tıkla + Sürükle** | Keyframe elması                   | Keyframe'i zamanda ileri/geri kaydırır                                  |
| **Tıkla + Sürükle** | Sağ panel sol kenarı              | Panelin genişliğini ayarlar                                             |
| **Tıkla + Sürükle** | Outliner/Details arası çizgi      | İki bölümün yükseklik oranını ayarlar                                   |
| **Çift tıklama**    | Şablon sekmesi üzerinde           | Şablon ismini düzenleme moduna geçirir                                  |
| **Çift tıklama**    | Maskelenmiş nesne üzerinde        | Odak moduna (Focus Mode) girer                                          |
| **Çift tıklama**    | Sekans sekmesi üzerinde           | Sekans ismini düzenleme moduna geçirir                                  |

---

### 🖱 Sağ Tık Etkileşimleri

| Eylem               | Nerede                            | Ne Olur                                                                 |
| :------------------ | :-------------------------------- | :---------------------------------------------------------------------- |
| **Sağ tık + Sürükle**| Sahnede herhangi bir yer          | Sahneyi kaydırır (pan). Bir elci (hand) imleci belirir.                 |

---

### 🖱 Fare Tekerleği (Scroll Wheel)

| Eylem                       | Nerede         | Ne Olur               |
| :-------------------------- | :------------- | :-------------------- |
| **Tekerleği yukarı kaydır** | Sahne üzerinde | Yakınlaştırır (zoom in)|
| **Tekerleği aşağı kaydır**  | Sahne üzerinde | Uzaklaştırır (zoom out)|

---

### 📦 Sürükle-Bırak (Drag and Drop)

| Ne Sürüklenir              | Nereden Nereye                         | Ne Olur                                                    |
| :------------------------- | :------------------------------------- | :--------------------------------------------------------- |
| Şekil kartı (Elements)     | Sol panel → Sahne                      | Şekil, bırakılan konumda sahneye eklenir                   |
| Metin kartı (Texts)        | Sol panel → Sahne                      | Metin, bırakılan konumda sahneye eklenir                   |
| Görsel/Video dosyası       | Bilgisayarınızdan → Medya alanına       | Dosya sahneye medya öğesi olarak eklenir                   |
| Görsel/Video dosyası       | Bilgisayarınızdan → Şeklin üzerine     | Medya, şeklin içinde maskelenir (Canva tarzı)              |
| Keyframe elması            | Zaman çizelgesinde sağa/sola           | Keyframe'in zamanlaması değişir                            |

---

## 4. Klavye Kısayolları ve Özel Tuşlar

### ⌨ Global Klavye Kısayolları

> [!NOTE]
> Bu kısayollar yalnızca bir metin kutusu veya düzenlenebilir alan aktif değilken çalışır.

| Kısayol                                | İşlev               | Açıklama                                                       |
| :------------------------------------- | :------------------ | :------------------------------------------------------------- |
| **Boşluk (Space)**                     | Oynat / Durdur      | Animasyonu başlatır veya duraklatır.                           |
| **Ctrl + Z**                           | Geri Al (Undo)      | Son yapılan değişikliği geri alır.                             |
| **Ctrl + Y** veya **Ctrl + Shift + Z** | İleri Al (Redo)     | Geri alınan değişikliği tekrar uygular.                        |
| **Ctrl + C**                           | Kopyala             | Seçili nesneyi panoya kopyalar.                                |
| **Ctrl + V**                           | Yapıştır            | Kopyalanan nesneyi sahneye yapıştırır.                         |
| **Ctrl + D**                           | Çoğalt (Duplicate)  | Seçili nesnenin bir kopyasını oluşturur.                       |
| **Delete** veya **Backspace**          | Sil                 | Seçili nesneyi anında siler.                                   |

---

## 5. Baştan Sona Uygulamalı Örnek Senaryo

### 🎯 Senaryo: "Canlı Yayın İçin Alt Bant (Lower Third) Grafiği Hazırlama"

Bu senaryoda, bir TV yayını veya canlı yayın için ekranın altında beliren isim/başlık grafiğini sıfırdan oluşturacak, animasyon verecek ve canlı yayın modunda test edeceğiz.

1. **Projenizi Hazırlayın:** Üst çubuktaki sekmeye çift tıklayıp ismini **"LowerThird"** yapın. Sol paneldeki **Project** sekmesinden **1080p (16:9)** çözünürlüğünü seçin.
2. **Arka Plan Şeridini Oluşturun:** Sol paneldeki **Elements** sekmesinden bir **Rectangle** ekleyin. Sağ paneldeki **Transform** sekmesinde `POS Y: 350`, `SCALE X: 400`, `SCALE Y: 30` yapın. **Style** sekmesinden dolgu rengini `#0a1628` yapın.
3. **İsim Yazısını Ekleyin:** **Texts** sekmesinden **Add Heading** ekleyin. Metni **"JOHN DOE"**, boyutunu `28`, konumunu `POS Y: 340`, `POS X: -250` yapın.
4. **Unvan Yazısını Ekleyin:** **Add Subheading** ekleyin. Metni **"Senior Producer"**, konumunu `POS Y: 370`, `POS X: -250` yapın.
5. **Giriş Animasyonu Verin:** Öğeleri seçip **Transitions** sekmesinden **"Move left"** efektini uygulayın.
6. **Animasyonu Test Edin:** Oynatma butonuna (▶) veya **Boşluk (Space)** tuşuna basarak animasyonu izleyin.
7. **Projenizi Kaydedin:** Üst çubuktaki **Export Video** butonuna tıklayarak projenizi `.json` formatında indirin.
8. **Canlı Yayın Modunda Test Edin:** **BROADCAST** butonuna tıklayın. Alt kındaki **LIVE DIRECTOR PANEL** üzerinden grafiğinizi canlı yayında test edin!

---

> 🎉 **Tebrikler!** Sıfırdan bir canlı yayın grafik şablonu oluşturdunuz, animasyon verdiniz ve canlı yayın modunda test ettiniz.
