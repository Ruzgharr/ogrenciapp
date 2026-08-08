// Dokunsal geri bildirim (Vibration API).
// Destegi olmayan cihazda hicbir sey yapmaz, hata firlatmaz.
// Ayarlardan kapatilabilir. Her dokunusta degil, sadece anlamli olaylarda titrer.

import * as store from '../store.js';

export function isSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function enabled() {
  if (!isSupported()) return false;
  return store.settings()?.hapticsEnabled !== false;
}

function buzz(pattern) {
  if (!enabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* bazi tarayicilar kullanici etkilesimi olmadan reddeder, sessizce gec */
  }
}

/** Kronometre / pomodoro baslatma. */
export const start = () => buzz(20);

/** Onemli bir islem tamamlandi (gorev tamamlama, kayit ekleme). */
export const success = () => buzz([0, 18, 45, 18]);

/** Kronometre bitirme. */
export const finish = () => buzz([0, 30, 50, 60]);

/** Silme islemi. */
export const remove = () => buzz(35);

/** Pomodoro faz bitisi: fark edilmesi gereken tek uzun desen. */
export const alarm = () => buzz([0, 140, 90, 140, 90, 260]);

/** Uyari / hata. */
export const warn = () => buzz([0, 40, 60, 40]);

/** Titresimi keser. */
export function stop() {
  if (!isSupported()) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* yoksay */
  }
}
