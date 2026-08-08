// App Badging API: kurulu uygulamanin ikonunda bekleyen gorev sayisi.
// Destegi olmayan cihazda sessizce devre disi kalir.

export function isSupported() {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

export async function set(count) {
  if (!isSupported()) return false;
  try {
    const value = Math.max(0, Math.round(Number(count) || 0));
    if (value === 0) await navigator.clearAppBadge();
    else await navigator.setAppBadge(value);
    return true;
  } catch {
    return false;
  }
}

export async function clear() {
  if (!isSupported()) return false;
  try {
    await navigator.clearAppBadge();
    return true;
  } catch {
    return false;
  }
}
