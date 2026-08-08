# Claude Code Prompt — Kişisel YKS Çalışma Takip Uygulaması

> Aşağıdaki metnin tamamını Claude Code'a ilk mesaj olarak yapıştır.
> Boş bir klasörde başlat (`mkdir yks-takip && cd yks-takip && claude`).

---

## ROL VE HEDEF

Sen deneyimli bir frontend mühendisisin. Benim için **tek kullanıcılı, kişisel bir YKS çalışma takip uygulaması** geliştireceksin. Kullanıcı benim, tek kişiyim, çok kullanıcı/hesap sistemi **yok**.

Ben kod yazmayı bilmiyorum. Bana "şurayı şöyle düzelt" diyemezsin; her şeyi sen yapacak, ben sadece telefondan test edip geri bildirim vereceğim. Bu yüzden **çalışmayan hiçbir şeyi "tamamlandı" diye bana teslim etme.**

## MUTLAK KISITLAR — bunlar tartışmaya kapalı

Bu kısıtlar, elindeki alışkanlıklara ters gelse bile geçerlidir. İhlal etmen gereken bir durum olursa **kod yazmadan önce bana sor.**

1. **Build adımı YOK.** Webpack, Vite, Babel, TypeScript derleyicisi, bundler, transpiler — hiçbiri olmayacak. Tarayıcının doğrudan çalıştırabildiği HTML + CSS + vanilla JavaScript (ES modules) yazacaksın.
2. **`node_modules` YOK.** `npm install` ile gelen hiçbir runtime bağımlılığı olmayacak. Diskimde yer yok, bu projenin var olma sebebi bu kısıt.
3. **React, Vue, Svelte, React Native, Flutter, Expo YOK.** Framework kullanmayacaksın.
4. **CDN'den kütüphane çekme YOK.** Uygulama internetsiz çalışmak zorunda. Grafik kütüphanesi de dahil — grafikleri elle SVG üreterek çizeceksin.
5. **Backend / sunucu / veritabanı YOK.** Veri tamamen telefonun içinde, IndexedDB'de duracak. Login yok, API yok, bulut yok. (Tek olası istisna: aşağıdaki "Bildirimler" bölümündeki Kademe 3 — o da ancak ben açıkça onay verirsem.)
6. **Toplam repo boyutu 5 MB'ı geçmeyecek.**
7. **Arayüz dili tamamen Türkçe.** Kod içindeki değişken/fonksiyon isimleri İngilizce, kullanıcıya görünen her metin Türkçe.

## TEKNİK YAKLAŞIM

- **PWA (Progressive Web App).** `manifest.json` + service worker ile Android'de "Ana ekrana ekle" yapıldığında tam ekran, ikonlu, internetsiz çalışan bir uygulama gibi davranacak.
- **Depolama: IndexedDB.** `localStorage` kullanma (boyut sınırı ve senkron erişim sorunlu). IndexedDB'nin üstüne kendi ince sarmalayıcı katmanını yaz — **sürümlü şema migration'ı destekleyecek**, çünkü ileride yeni alanlar ekleyeceğiz ve mevcut verim silinmeyecek.
- **Barındırma: GitHub Pages.** Kurulumunu sen yapacak, adımlarını README'ye yazacaksın.
- **Kod yapısı:** tek dev dosya değil, mantıklı ES module'lere böl (`db.js`, `stats.js`, `ui/*.js` gibi). Net hesabı, istatistik ve tarih işlemleri **saf fonksiyonlar** olarak ayrı dosyalarda dursun ki test edilebilsinler.

## VERİ MODELİ

Aşağıdaki varlıkları kur. Her kaydın `id` (uuid) ve `createdAt` alanı olsun.

- **subject** — ders. `{ name, color, examType }`. `examType`: `"TYT"` veya `"YDT"`.
- **studySession** — çalışma oturumu. `{ date, subjectId, minutes, source: "timer" | "manual", topic?, note? }`
- **questionLog** — soru çözüm kaydı. `{ date, subjectId, topic?, correct, wrong, blank }`
- **mockExam** — deneme sınavı. `{ date, name, examType, results: [{ subjectId, correct, wrong, blank }], note? }`
- **task** — todo. `{ title, subjectId?, dueDate?, priority: 1|2|3, done, completedAt? }`
- **habit** ve **habitLog** — günlük rutin takibi. `habit: { name, order }`, `habitLog: { date, habitId, done }`
- **settings** — tek kayıt. `{ targets: { subjectId: netHedefi }, dailyGoalMinutes, theme }`

**Net hesabı:** `net = doğru - (yanlış / 4)`. Bu katsayı `settings` içinden değiştirilebilir olsun, sabit kodlama.

**Başlangıç verisi (seed):** dersler ve hedef netlerim şunlar, ilk açılışta bunlarla kurulsun ama ayarlardan düzenlenebilsin:

| Ders | Tür | Hedef net |
|---|---|---|
| Türkçe | TYT | 39 |
| Sosyal Bilimler | TYT | 19 |
| Matematik (geometri dahil) | TYT | 28 |
| Fen Bilimleri | TYT | 17 |
| İngilizce | YDT | 77 |

Rutin (habit) başlangıç maddeleri: `07:00 kalktım`, `Sabah dışarı çıktım (ışık)`, `14:00 sonrası kafein almadım`, `22:30 ekranları kapattım`, `23:00'te yattım`.

## BİLDİRİMLER — gerçekçi kapsam

Bildirim benim için önemli, ama PWA'da bunun net bir teknik sınırı var ve bunu bilerek planlamanı istiyorum. Üç kademe var:

**Kademe 1 — Uygulama açık/arka planda iken bildirim.** Notification API ile sorunsuz çalışır. Pomodoro bitişi, mola sonu, hedef tamamlandı bildirimleri buraya girer. **Bunu yapacaksın.**

**Kademe 2 — Uygulama tamamen kapalıyken zamanlanmış bildirim.** Notification Triggers API tarayıcılara girmedi; Periodic Background Sync ise sadece kurulu PWA'da, saatlik hassasiyette değil ve tarayıcının insafına kalmış şekilde çalışır. **Yani "her gün 22:30'da uygulama kapalıyken kesin bildirim" PWA'da güvenilir değil.** Bunu bana çalışıyormuş gibi gösterme, sahte bir zamanlayıcı yazma. Periodic Background Sync'i "en iyi çaba" olarak ekleyebilirsin ama arayüzde bunun garantili olmadığını açıkça yazacaksın. Kesin saatli günlük hatırlatıcılar için telefonun kendi alarm uygulamasını kullanıyorum, uygulamanın bunu taklit etmesine gerek yok.

**Kademe 3 — Web Push (küçük bir sunucu gerektirir).** Gerçekten kesin zamanlı bildirim istersem tek yol bu: VAPID anahtarları + bir push servisi + zamanlayıcı. **Bunu şimdi yapma.** Sadece README'nin sonuna, ileride istersem izlenecek adımları ve maliyetini/karmaşıklığını 10 satırla yaz.

Kısacası: Kademe 1'i tam yap, Kademe 2'yi dürüstçe etiketle, Kademe 3'ü belgele ve geç.

## ETKİLEŞİM ŞARTLARI

Uygulama "form doldurulan bir web sayfası" gibi değil, tepki veren bir uygulama gibi hissettirmeli. Şunlar zorunlu:

- **Screen Wake Lock API** — kronometre çalışırken ekran kendi kendine kapanmasın.
- **Vibration API ile dokunsal geri bildirim** — kronometre başlat/bitir, görev tamamlama, pomodoro bitişi. Kısa ve ölçülü, her dokunuşta değil. Ayarlardan kapatılabilsin.
- **İyimser arayüz (optimistic UI)** — dokunduğum an ekran tepki versin, veritabanı yazımı arkada olsun.
- **Onay kutusu yerine "Geri al"** — silme işlemlerinde "Emin misiniz?" sorma; sil, altta 5 saniyelik "Geri al" şeridi göster.
- **Kaydırma hareketleri (swipe)** — görev listesinde sağa kaydır = tamamla, sola kaydır = sil.
- **Uzun basma** — kayıt üzerinde uzun basınca düzenle/sil menüsü.
- **Yumuşak geçişler** — sekmeler arası geçiş ve liste öğesi ekleme/çıkarmada kısa (150-200 ms) animasyon. Abartma.
- **Sayı girişlerinde klavye açtırma** — doğru/yanlış/boş gibi alanlarda artı-eksi düğmeleri ve hızlı seçim olsun.
- **App Badging API** — kurulu uygulamanın ikonunda bekleyen görev sayısı rozeti (destekleyen cihazda).

Destek olmayan cihazda hiçbiri uygulamayı kırmayacak; özellik algılama (feature detection) ile sarmalayıp sessizce devre dışı bırak.

## ÖZELLİKLER — fazlar halinde

Fazları sırayla yap. **Her fazın sonunda uygulama çalışır ve kullanılabilir durumda olmalı.** Bir sonrakine geçmeden önce bana haber ver.

### Faz 1 — Çekirdek (önce sadece bunu yap)
- Alt navigasyonlu iskelet: **Bugün · İstatistik · Görevler · Ayarlar**
- **Kronometre:** ders seç, başlat/duraklat/bitir → `studySession` kaydı. Sayfa kapanıp açılsa bile devam eden sayaç kaybolmayacak (başlangıç zamanı saklanıp yeniden hesaplansın).
- **Manuel süre girişi** (kronometreyi unuttuğum günler için).
- **Bugün ekranı:** bugünkü toplam süre, ders bazlı dağılım, günlük hedefe (`dailyGoalMinutes`) göre ilerleme.
- **Görevler:** ekle / tamamla / sil, öncelik ve son tarih.
- **Veri yedekleme:** tüm veriyi tek JSON dosyası olarak dışa aktar, geri yükle. **Bu faz 1'de olacak, sonraya bırakma** — verimi kaybetme riski taşıyamam.

### Faz 2 — Pomodoro ve bildirimler
- **Pomodoro modu:** çalışma/mola süreleri ayarlanabilir (varsayılan 50/10), otomatik geçiş, tur sayacı. Pomodoro oturumları da `studySession` olarak kaydedilsin.
- Kademe 1 bildirimleri: pomodoro bitişi, mola bitişi, günlük hedefe ulaşma.
- Bildirim izninin istenmesi doğru anda olsun — uygulama ilk açılışta değil, ben pomodoro'yu ilk kez başlattığımda.
- Wake lock, titreşim ve geri sayım arayüzü bu fazda tam çalışır olsun.

### Faz 3 — Ölçüm
- **Soru kaydı:** ders + konu + doğru/yanlış/boş girişi, net otomatik hesaplanır.
- **Deneme sınavı kaydı:** ders bazlı sonuç girişi, toplam net, hedefle karşılaştırma.
- **İstatistik ekranı** (hepsi elle çizilmiş SVG grafiklerle):
  - Son 7/30 gün günlük çalışma süresi — çubuk grafik
  - Ders bazlı süre dağılımı — yatay çubuk
  - Denemelerde ders bazlı net gelişimi — çizgi grafik, üzerinde hedef net çizgisi
  - Toplam istatistik: bu hafta/bu ay toplam süre, seri (üst üste çalışılan gün sayısı)

### Faz 4 — Rutin ve ekstra
- **Günlük rutin checklist'i** (habit) ve 30 günlük tamamlanma ısı haritası.
- Konu bazlı filtreleme, notlar.
- Karanlık/aydınlık tema geçişi.

**Faz 4'ten sonra hiçbir şey ekleme.** Aklına gelen fikirleri README'nin sonuna "İleride" başlığı altında yaz, uygulama.

## TASARIM VE KULLANILABİLİRLİK

- **Mobil öncelikli.** Masaüstü görünümü umurumda değil, telefonda kullanacağım.
- Karanlık tema varsayılan.
- Dokunma hedefleri en az 44×44 px. Tek elle, başparmakla kullanılabilmeli — ana aksiyonlar ekranın alt yarısında.
- Sık yapacağım iş "kronometreyi başlatmak". Uygulamayı açtığımda bu **tek dokunuşla** ulaşılabilir olsun.
- Animasyon minimum, hız maksimum. Açılış 1 saniyenin altında olmalı.
- Sistem fontları kullan, harici font indirme.

## KALİTE ŞARTLARI

- **Sahte veri yok.** Boş ekranlar "Henüz kayıt yok" gibi düzgün boş durumlarla karşılansın, uydurma örnek kayıtlarla değil.
- **Saf fonksiyonlar için testler yaz** (net hesabı, seri hesabı, tarih aralığı, istatistik toplamları). Node'un yerleşik test çalıştırıcısıyla (`node --test`) çalışsın, ek paket kurma.
- **Hata yönetimi:** IndexedDB işlemleri try/catch içinde, kullanıcıya Türkçe hata mesajı.
- **Tarih işlemleri yerel saat diliminde** (Türkiye), UTC kaymasıyla kayıtların bir önceki güne düşmesi klasik hatadır, buna dikkat et.
- **README.md** yaz: uygulamanın ne yaptığı, GitHub Pages'e nasıl yayınlanacağı, telefona nasıl kurulacağı, yedeğin nasıl alınacağı. Kod bilmeyen birine anlatır gibi.

## ÇALIŞMA YÖNTEMİN

1. **Önce soru sor.** Bu dokümanda belirsiz veya çelişkili bulduğun ne varsa, kod yazmadan önce hepsini tek seferde bana sor.
2. Sonra **plan çıkar**: dosya yapısı ve Faz 1'de ne yapacağın. Onayımı al.
3. Sonra kodla. Her fazın sonunda git commit at, anlamlı commit mesajı yaz.
4. Bir fazı bitirince **bana nasıl test edeceğimi tarif et** — hangi adrese gireceğim, ne yapacağım, ne görmem gerekiyor.
5. Bir şeyi yapamıyorsan veya kısıtlar yüzünden kötü bir çözüme mecbur kalıyorsan **söyle**. Sessizce etrafından dolaşma, bahane üretme.

## TAMAMLANMA KRİTERİ

Faz 1 şu üçü sağlandığında bitmiştir:
- Telefonumda ana ekrandan açılıyor, uçak modunda çalışıyor.
- Kronometreyle kaydettiğim süre, uygulamayı tamamen kapatıp açtığımda hâlâ orada.
- Yedeği dışa aktarıp, tarayıcı verisini silip, geri yüklediğimde her şey aynen geri geliyor.

---

**İlk adım:** Bu dokümanı oku, sorularını sor, sonra Faz 1 planını çıkar. Henüz kod yazma.
