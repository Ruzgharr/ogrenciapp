// Bildirimler (Kademe 1): uygulama acikken veya arka plandayken calisir.
//
// DURUSTLUK NOTU: Uygulama tamamen kapaliyken belirli bir saatte bildirim gonderme
// PWA'da guvenilir degildir (Notification Triggers API tarayicilara girmedi,
// Periodic Background Sync ise tarayicinin insafina kalmis ve saat hassasiyeti yok).
// Bu dosya sahte bir zamanlayici KURMAZ. Kesin saatli hatirlaticilar icin telefonun
// kendi alarm uygulamasi kullanilir; Ayarlar ekraninda bu aciklama yazili.

let registration = null;

export function setRegistration(swRegistration) {
  registration = swRegistration || null;
}

export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 'granted' | 'denied' | 'default' | 'unsupported' */
export function permission() {
  if (!isSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Izin ister. Dogru anda cagrilmasi arayuzun sorumlulugu:
 * uygulama acilisinda degil, pomodoro ilk kez baslatildiginda.
 */
export async function ensurePermission() {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Bildirim gosterir. Once service worker uzerinden dener; Android'de tek guvenilir
 * yol budur. Kayit yoksa dogrudan Notification nesnesine duser.
 */
export async function show(title, options = {}) {
  if (permission() !== 'granted') return false;
  const payload = {
    body: '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    lang: 'tr',
    dir: 'ltr',
    tag: 'yks-takip',
    renotify: true,
    ...options,
  };
  try {
    const reg = registration || (await navigator.serviceWorker?.getRegistration?.());
    if (reg?.showNotification) {
      await reg.showNotification(title, payload);
      return true;
    }
    // eslint-disable-next-line no-new
    new Notification(title, payload);
    return true;
  } catch (err) {
    console.debug('Bildirim gösterilemedi:', err?.message || err);
    return false;
  }
}

export function pomodoroWorkDone(minutes, subjectName) {
  return show('Çalışma bitti, mola zamanı', {
    body: `${subjectName} · ${minutes} dakika tamamlandı.`,
    tag: 'pomodoro-faz',
    vibrate: [140, 90, 140],
  });
}

export function pomodoroBreakDone(minutes) {
  return show('Mola bitti', {
    body: `${minutes} dakikalık mola doldu. Devam etmeye hazır mısın?`,
    tag: 'pomodoro-faz',
    vibrate: [140, 90, 140],
  });
}

export function dailyGoalReached(minutes) {
  return show('Günlük hedef tamam', {
    body: `Bugün ${minutes} dakika çalıştın. Hedefi geçtin.`,
    tag: 'gunluk-hedef',
  });
}
