// Service worker: uygulamayi tamamen cevrimdisi calistirir.
//
// Strateji: uygulama kabugu kurulumda onbellege alinir, sonra istekler once
// onbellekten karsilanir (cache-first). Uygulamanin tamami statik dosya oldugu ve
// veriler IndexedDB'de durdugu icin bu yaklasim internetsiz tam islevsellik verir.
//
// Surum degistiginde CACHE_VERSION artirilir, eski onbellekler silinir.

const CACHE_VERSION = 'v5';
const CACHE_NAME = `yks-takip-${CACHE_VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/store.js',
  './js/db.js',
  './js/seed.js',
  './js/backup.js',
  './js/goal.js',
  './js/timer.js',
  './js/theme.js',
  './js/util.js',
  './js/core/dates.js',
  './js/core/scoring.js',
  './js/core/stats.js',
  './js/core/format.js',
  './js/core/backup.js',
  './js/platform/haptics.js',
  './js/platform/wakelock.js',
  './js/platform/notify.js',
  './js/platform/badge.js',
  './js/platform/periodicsync.js',
  './js/ui/dom.js',
  './js/ui/snack.js',
  './js/ui/sheet.js',
  './js/ui/gestures.js',
  './js/ui/stepper.js',
  './js/ui/charts.js',
  './js/ui/records.js',
  './js/ui/today.js',
  './js/ui/stats.js',
  './js/ui/tasks.js',
  './js/ui/settings.js',
  './js/ui/sheets/subjects.js',
  './js/ui/sheets/records.js',
  './js/ui/sheets/tasks.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Tek dosya eksik olsa bile kurulum tamamlansin: allSettled kullaniyoruz.
      const results = await Promise.allSettled(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      );
      const failed = results
        .map((result, index) => (result.status === 'rejected' ? PRECACHE[index] : null))
        .filter(Boolean);
      if (failed.length > 0) console.warn('Önbelleğe alınamadı:', failed);
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-First stratejisi: İnternet varken HER ZAMAN güncel kodu sunucudan al ve önbelleği güncelle.
  // İnternet yoksa (çevrimdışı) önbellekteki dosyayı ver.
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Çevrimdışı durumunda önbellekten sun
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;

        if (request.mode === 'navigate') {
          const navCached = (await cache.match('./index.html')) || (await cache.match('./'));
          if (navCached) return navCached;
        }
        return new Response('Çevrimdışı ve önbellek boş.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })(),
  );
});

// ---------------------------------------------------------------- bildirim tiklama

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })(),
  );
});

// ---------------------------------------------------------------- arka plan hatirlatici
//
// DURUSTLUK NOTU: Bu olay "belirli saatte" tetiklenmez. Tarayici, kurulu ve sik
// kullanilan uygulamalar icin gunde bir kez civari, kendi uygun gordugu bir anda
// uyandirir. Kesin saatli hatirlatici icin telefonun alarm uygulamasi kullanilmali.
// Burada sahte bir zamanlayici yok: sadece uyandirildigimizda o gunun durumuna bakip
// gerekiyorsa tek bir hatirlatma gosteriyoruz.

const DB_NAME = 'yks-takip';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAll(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

function writeMeta(db, key, value) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

function localDayKey(date) {
  const pad = (n) => (n < 10 ? `0${n}` : String(n));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function maybeRemind() {
  let db;
  try {
    db = await openDatabase();
  } catch {
    return;
  }
  try {
    const settingsRows = await readAll(db, 'settings');
    const settings = settingsRows[0];
    if (!settings || settings.periodicSyncEnabled !== true) return;

    const metaRows = await readAll(db, 'meta');
    const meta = Object.fromEntries(metaRows.map((row) => [row.key, row.value]));
    const today = localDayKey(new Date());
    if (meta.reminderShownDate === today) return;

    const sessions = await readAll(db, 'studySessions');
    const minutes = sessions
      .filter((session) => session.date === today && !session.deletedAt)
      .reduce((sum, session) => sum + (Number(session.minutes) || 0), 0);

    const goal = Number(settings.dailyGoalMinutes) || 0;
    if (goal > 0 && minutes >= goal) return;

    await writeMeta(db, 'reminderShownDate', today);
    await self.registration.showNotification('Bugün çalışma zamanı', {
      body:
        minutes > 0
          ? `Bugün ${minutes} dakika oldu${goal > 0 ? `, hedef ${goal} dakika` : ''}. Devam?`
          : 'Bugün henüz kayıt yok. Kısa bir pomodoro iyi gider.',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'gunluk-hatirlatici',
      lang: 'tr',
    });
  } catch (err) {
    console.warn('Hatırlatıcı çalışmadı:', err);
  } finally {
    db.close?.();
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'gunluk-hatirlatici') event.waitUntil(maybeRemind());
});
