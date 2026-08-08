// Kullaniciya gorunen metin bicimleme. Tamami saf fonksiyon.
// Ondalik ayirici Turkce kullanima gore virgul.

/** 0 -> "0 dk", 45 -> "45 dk", 120 -> "2 sa", 135 -> "2 sa 15 dk" */
export function formatMinutes(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins} dk`;
  if (mins === 0) return `${hours} sa`;
  return `${hours} sa ${mins} dk`;
}

/** Kisa bicim: 135 -> "2s 15d". Grafik etiketleri gibi dar yerler icin. */
export function formatMinutesShort(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours === 0) return `${mins}d`;
  if (mins === 0) return `${hours}s`;
  return `${hours}s ${mins}d`;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** Milisaniyeyi geri sayim/kronometre bicimine cevirir: "05:31" veya "1:05:31". */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

/** Net degerini Turkce ondalik ayiriciyla yazar: 12.5 -> "12,5", 12 -> "12" */
export function formatNet(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  let text = String(rounded);
  if (Object.is(rounded, -0)) text = '0';
  return text.replace('.', ',');
}

/** Yuzde: 0.734 -> "73%" */
export function formatPercent(ratio, digits = 0) {
  const n = Number(ratio);
  if (!Number.isFinite(n)) return '0%';
  const value = n * 100;
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return `${String(rounded).replace('.', ',')}%`;
}

/** Dosya boyutu gibi sayilar icin binlik ayirici (nokta). */
export function formatCount(value) {
  const n = Math.round(Number(value) || 0);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const PRIORITY_LABELS = {
  1: 'Yüksek',
  2: 'Orta',
  3: 'Düşük',
};

export function priorityLabel(priority) {
  return PRIORITY_LABELS[Number(priority)] || 'Orta';
}

/** Dosya adi icin guvenli metin. */
export function slugify(text) {
  const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  return String(text || '')
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (ch) => map[ch] || ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
