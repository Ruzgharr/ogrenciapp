# YKS Takip — Kişisel Çalışma Takip Uygulaması

Tamamen telefonunda çalışan, internetsiz kullanılabilen, kişisel YKS çalışma takip uygulaması.

- 📱 **PWA** — ana ekrana ekleyince normal uygulama gibi çalışır
- 🔒 **Veriler telefonda** — bulut yok, hesap yok, veriler sadece senin cihazında
- ✈️ **Çevrimdışı** — internet olmadan da tam çalışır
- 🪶 **Sıfır bağımlılık** — `node_modules` yok, build adımı yok

---

## Özellikler

### Kronometre & Pomodoro
- Tek dokunuşla kronometre başlat, son seçtiğin ders hatırlanır
- Pomodoro modu: çalışma/mola süreleri ayarlanabilir (varsayılan 50/10)
- Uygulama kapanıp açılsa bile sayaç kaldığı yerden devam eder
- Ekran kilidi (Wake Lock): kronometre açıkken ekran kapanmaz

### Manuel Kayıt
- Kronometresiz süre girişi (+/- düğmeli hızlı seçim)
- Soru çözüm kaydı (doğru/yanlış/boş → net otomatik hesaplanır)
- Deneme sınavı kaydı (TYT/YDT, ders bazlı sonuçlar)

### Görevler
- Ekle, tamamla, sil
- Öncelik (yüksek/orta/düşük) ve son tarih
- Sağa kaydır = tamamla, sola kaydır = sil
- Uzun basınca düzenle/sil menüsü
- Geri al şeridi (yanlışlıkla silersen 5 saniye geri al)

### İstatistik
- Son 7/30 gün çalışma süresi (çubuk grafik)
- Ders bazlı süre dağılımı (yatay çubuk)
- Deneme netleri gelişimi (çizgi grafik + hedef çizgisi)
- Konu bazlı soru analizi (isabet oranıyla renklendirilmiş)
- Seri takibi, haftalık/aylık toplamlar

### Günlük Rutin
- Checklist (07:00 kalktım, sabah ışığı, kafein, ekran, uyku)
- 30 günlük ısı haritası

### Bildirimler
- Pomodoro bitişi, mola bitişi, günlük hedefe ulaşma bildirimi
- Bildirim izni doğru anda istenir (ilk Pomodoro başlatılırken)
- Arka plan hatırlatıcı (en iyi çaba, garantisiz — detay Ayarlar'da)

### Tema
- Karanlık (varsayılan) ve aydınlık tema
- Sistem temasını takip edebilir

### Yedekleme
- Tüm veriyi tek JSON dosyası olarak dışa aktar
- Geri yükle (sürüm ve bozukluk kontrolüyle)
- Paylaş (Google Drive, WhatsApp vs.)

---

## Telefona Kurulum (GitHub Pages)

### 1. Yayınlama

Bu repo GitHub Pages üzerinden yayınlanmaktadır:

**Canlı adres:** `https://ruzgharr.github.io/ogrenciapp/`

Eğer kendi fork'unu kullanıyorsan:
1. GitHub'da repo ayarlarına git → **Settings** → **Pages**
2. **Source** olarak `Deploy from a branch` seç
3. **Branch** olarak `main`, klasör olarak `/ (root)` seç
4. Kaydet. Birkaç dakika içinde yayınlanır.

### 2. Telefona Ekleme

#### Android (Chrome)
1. Yukarıdaki adresi Chrome ile aç
2. Tarayıcı menüsünden (⋮) → **Ana ekrana ekle** / **Uygulamayı yükle**
3. Artık ana ekranda ikonla açılır, adres çubuğu olmadan tam ekran çalışır

#### iPhone (Safari)
1. Adresi Safari ile aç (Chrome'dan olmaz!)
2. Alt çubuktaki **paylaş düğmesi** (↑) → **Ana Ekrana Ekle**
3. Uygulama ikonla ana ekrana eklenir

### 3. Çevrimdışı Test
1. Uygulamayı aç, birkaç saniye bekle (service worker yüklenir)
2. Uçak moduna al
3. Uygulamayı kapat ve tekrar aç → hâlâ çalışıyor olmalı

---

## Yerel Geliştirme

```bash
# Sunucuyu başlat (bağımlılık kurmaya gerek yok)
node tools/serve.mjs

# Farklı port
node tools/serve.mjs 3000

# Testleri çalıştır
node --test test/

# İkonları yeniden üret
node tools/make-icons.mjs
```

Sunucu başladığında konsolda yerel ağ adresini gösterir:
```
  Bilgisayarda:  http://localhost:8080
  Telefonda:     http://192.168.1.42:8080
```

Telefondan aynı WiFi üzerinden bu adrese girebilirsin. Ancak **service worker ve "Ana ekrana ekle" yalnızca HTTPS veya localhost'ta çalışır**. Tam PWA testi için GitHub Pages adresini kullan.

---

## Yedek Alma ve Geri Yükleme

### Yedek al
1. **Ayarlar** → **Yedek al** → dosya indirilir (`yks-takip-yedek-2026-08-08.json`)
2. Veya **Paylaş** ile Google Drive / WhatsApp'a gönder

### Geri yükle
1. **Ayarlar** → **Yedeği geri yükle** → dosyayı seç
2. Özet ekranı gösterilir (kaç kayıt geri yüklenecek)
3. Onayla → mevcut veri silinir, yedekteki veri yüklenir

> ⚠️ **Önemli:** Yedek geri yükleme mevcut tüm veriyi siler ve yerine yedekteki veriyi koyar. Önce mevcut verinin yedeğini al.

---

## Teknik Detaylar

- **Saf HTML + CSS + vanilla JavaScript (ES modules)** — build adımı yok
- **IndexedDB** — sürümlü şema (migration desteği)
- **Service Worker** — cache-first strateji, tam çevrimdışı
- **PWA manifest** — ana ekrana ekleme, tam ekran, kısayollar
- Toplam repo boyutu ~200 KB

### Dosya Yapısı

```
index.html                    Ana sayfa
manifest.webmanifest          PWA manifest
sw.js                         Service worker
css/
  base.css                    Tema değişkenleri, tipografi
  layout.css                  Sayfa iskeleti, alt navigasyon
  components.css              Bileşenler (kart, düğme, liste...)
js/
  app.js                      Giriş noktası, sekme yönetimi
  db.js                       IndexedDB katmanı
  store.js                    Bellek içi durum, iyimser yazma
  seed.js                     Başlangıç verisi
  timer.js                    Kronometre & Pomodoro motoru
  backup.js                   Yedek dosya işlemleri
  goal.js                     Günlük hedef takibi
  theme.js                    Tema yönetimi
  util.js                     Yardımcı fonksiyonlar
  core/
    dates.js                  Tarih işlemleri (yerel saat)
    format.js                 Metin biçimleme
    scoring.js                Net hesabı
    stats.js                  İstatistik hesapları
    backup.js                 Yedek doğrulama (saf fonksiyon)
  platform/
    haptics.js                Titreşim (Vibration API)
    wakelock.js               Ekran kilidi (Wake Lock API)
    notify.js                 Bildirimler (Notification API)
    badge.js                  Uygulama rozeti (App Badging API)
    periodicsync.js           Arka plan senkronizasyonu
  ui/
    today.js                  Bugün ekranı
    stats.js                  İstatistik ekranı
    tasks.js                  Görevler ekranı
    settings.js               Ayarlar ekranı
    sheet.js                  Alt sayfa bileşeni
    snack.js                  Bildirim şeridi
    stepper.js                Adımlı sayı girişi
    gestures.js               Kaydırma ve uzun basma
    dom.js                    DOM yardımcıları
    charts.js                 SVG grafik çizimi
    records.js                Kayıt listesi bileşenleri
    sheets/
      records.js              Süre/soru/deneme formları
      subjects.js             Ders seçici ve editörü
      tasks.js                Görev formu
icons/                        PWA ikonları (otomatik üretilir)
tools/
  serve.mjs                   Yerel geliştirme sunucusu
  make-icons.mjs              İkon üretici
test/
  scoring.test.js             Net hesabı testleri
  dates.test.js               Tarih işlemi testleri
  stats.test.js               İstatistik testleri
```

---

## İleride

Bu özellikler şu an uygulamada yok ama ileride eklenebilir:

- **Web Push bildirimleri** — Kesin saatli, uygulama kapalıyken de çalışan bildirimler. Bunun için küçük bir sunucu gerekir:
  1. VAPID anahtar çifti üret (`npx web-push generate-vapid-keys`)
  2. Küçük bir Node.js / Cloudflare Worker sunucusu kur (ücretsiz)
  3. Push aboneliğini sunucuya kaydet, zamanlayıcıyla bildirim gönder
  4. Maliyet: Cloudflare Workers ücretsiz katman yeterli (100K istek/gün)
  5. Alternatif: Firebase Cloud Messaging (FCM) — ücretsiz, daha kolay kurulum
  
- **Çoklu cihaz senkronizasyonu** — Bulut yedekleme ile farklı cihazlardan erişim
- **PDF rapor** — Aylık çalışma özeti
- **Pomodoro istatistikleri** — Tamamlanan tur sayısı, en verimli saatler
- **Widget** — Android ana ekran widget'ı (PWA sınırları dahilinde)

---

## Lisans

Kişisel kullanım için geliştirilmiştir.
