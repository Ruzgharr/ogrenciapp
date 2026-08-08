// Screen Wake Lock API: kronometre calisirken ekranin kendi kendine kapanmasini onler.
//
// Kilit, sekme arka plana gectiginde tarayici tarafindan otomatik birakilir.
// Bu yuzden "istiyorum" bayragini kendimiz tutup sekme one dondugunde yeniden aliyoruz.

let sentinel = null;
let wanted = false;
let listenerAttached = false;

export function isSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function isActive() {
  return sentinel !== null && !sentinel.released;
}

function attachVisibilityListener() {
  if (listenerAttached || typeof document === 'undefined') return;
  listenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') acquire();
  });
}

async function acquire() {
  if (!isSupported() || isActive()) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch (err) {
    // Kullanici pil tasarrufunda olabilir veya sekme gorunur degildir. Sessizce gec.
    sentinel = null;
    console.debug('Ekran kilidi alınamadı:', err?.message || err);
  }
}

/** Ekranin acik kalmasini ister. */
export async function request() {
  wanted = true;
  attachVisibilityListener();
  await acquire();
  return isActive();
}

/** Istegi geri ceker ve kilidi birakir. */
export async function release() {
  wanted = false;
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    /* yoksay */
  }
  sentinel = null;
}
