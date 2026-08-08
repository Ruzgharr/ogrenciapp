# YKS Takip

Tamamen cihazında çalışan, internetsiz kullanılabilen, kişisel YKS çalışma takip uygulaması. Crafted with passion by LevioraLabs.

📱 **PWA Özelliği** - Ana ekrana ekleyince normal uygulama gibi çalışır.
🔒 **Veriler Cihazında** - Bulut yok, veri sızıntısı yok, her şey telefonunda.
✈️ **Çevrimdışı** - İnternet olmadan da her yerde, her zaman çalışır.
🪶 **Sıfır Bağımlılık** - Saf HTML, CSS ve JavaScript (ES modules) ile geliştirilmiştir.

## Özellikler

### Kronometre ve Odak Modu
Tek dokunuşla kronometreyi başlat. Özel olarak tasarlanmış "Odak Modu" ile devasa ve dikkat dağıtmayan bir ekranda çalışmalarına konsantre ol. Uygulama kapansa bile sayaç kaldığı yerden arka planda devam eder. Wake Lock API ile ekran açık kalır.

### Günün Özeti (Canvas PNG Export)
Çalışmalarını tamamladığında günlük hedef, doğru/yanlış netlerin, ders dağılımların ve süren özel "Premium" bir görselle dışa aktarılır. Arkadaşlarınla veya sosyal medyada tek dokunuşla paylaş.

### Detaylı İstatistikler
Son 7 veya 30 günün çalışma süresini, ders bazlı süre dağılımlarını, deneme net gelişimlerini ve soru analizlerini grafiklerle (saf SVG) takip et. Seri takibi ile motivasyonunu yüksek tut.

### Görev Yönetimi
Günlük veya haftalık yapılacaklarını ekle, tamamla veya sil. Hızlıca kaydırarak işlemleri gerçekleştir. 

## Telefona Kurulum (GitHub Pages)

Bu repo doğrudan GitHub Pages üzerinden yayınlanmaktadır.

**Canlı adres:** `https://ruzgharr.github.io/ogrenciapp/`

### Kurulum Adımları
**Android (Chrome):**
1. Chrome'dan yukarıdaki linke git.
2. Sağ üstteki üç noktaya (⋮) dokun.
3. **Ana ekrana ekle** veya **Uygulamayı yükle** seçeneğini seç.

**iPhone (Safari):**
1. Safari'den linke git.
2. Alt çubuktaki **Paylaş** düğmesine (↑) dokun.
3. **Ana Ekrana Ekle** seçeneğini seç.

*Not: Uygulamayı bir kez açtıktan sonra artık internet bağlantısına ihtiyacın yoktur. Çevrimdışı (uçak modunda) test edebilirsin.*

## Teknik Detaylar
Bu proje saf (vanilla) teknolojilerle, modern web yeteneklerini sergilemek amacıyla yapılmıştır. Hiçbir harici kütüphane, framework veya build (derleme) adımı kullanılmamıştır. 

* **Veritabanı:** IndexedDB (Versiyonlanmış Schema destekli)
* **PWA:** Service Worker (Cache-first), Webmanifest
* **Grafikler:** HTML5 Canvas API (PNG dışa aktarım), SVG (Grafikler)

## Lisans
Bu proje **GNU GPLv3** lisansı ile lisanslanmıştır. 
Kaynak kodlarını açık kaynak projelerinde, belirtilen lisans koşullarına uymak şartıyla kullanabilirsin. Detaylar için `LICENSE` dosyasına göz at.
