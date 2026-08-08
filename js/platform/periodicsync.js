// Periodic Background Sync: "en iyi caba" gunluk hatirlatici.
//
// DURUSTCE: Bu API kesin saatli bildirim VERMEZ.
// - Sadece ana ekrana eklenmis (kurulu) PWA'da calisir.
// - Tarayici uygulamayi ne zaman uyandiracagina kendisi karar verir; saat hassasiyeti yok,
//   gunlerce hic uyandirmayabilir.
// - Chrome dışındaki cogu tarayicida hic desteklenmez.
// Bu yuzden arayuzde "garanti degil" yazisi her zaman gosterilir ve kesin saatli
// hatirlatici icin telefonun alarm uygulamasi onerilir.

const TAG = 'gunluk-hatirlatici';

export function isSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PeriodicSyncManager' in globalThis
  );
}

export async function permissionState() {
  if (!navigator.permissions?.query) return 'unsupported';
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    return status.state;
  } catch {
    return 'unsupported';
  }
}

export async function isRegistered() {
  if (!isSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.periodicSync) return false;
    const tags = await registration.periodicSync.getTags();
    return tags.includes(TAG);
  } catch {
    return false;
  }
}

/** Donus: { ok, reason } */
export async function enable() {
  if (!isSupported()) return { ok: false, reason: 'Bu tarayıcı arka plan senkronizasyonunu desteklemiyor.' };
  const state = await permissionState();
  if (state !== 'granted') {
    return {
      ok: false,
      reason:
        'Tarayıcı izin vermedi. Bu izin ancak uygulama ana ekrana eklenmiş ve sık kullanılıyorsa veriliyor.',
    };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.periodicSync.register(TAG, { minInterval: 12 * 60 * 60 * 1000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Kaydedilemedi: ${err?.message || err}` };
  }
}

export async function disable() {
  if (!isSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.periodicSync) return false;
    await registration.periodicSync.unregister(TAG);
    return true;
  } catch {
    return false;
  }
}
