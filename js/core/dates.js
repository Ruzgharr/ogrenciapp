// Tarih islemleri. Tamami saf fonksiyon, test edilebilir.
//
// ONEMLI: Butun gun hesaplari YEREL saat diliminde yapilir. Date.prototype.toISOString
// burada asla kullanilmaz, cunku UTC'ye cevirince gece yarisina yakin kayitlar bir
// onceki gune dusuyor. Gun anahtari (dayKey) "YYYY-MM-DD" bicimindedir ve dogrudan
// yerel getFullYear/getMonth/getDate degerlerinden uretilir.

const MS_PER_DAY = 86400000;

export const WEEKDAYS_LONG = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
];
export const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const MONTHS_LONG = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
export const MONTHS_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** Verilen Date nesnesinin yerel gun anahtarini dondurur. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Bugunun gun anahtari. Test edilebilmesi icin "now" disaridan verilebilir. */
export function todayKey(now = new Date()) {
  return dayKey(now instanceof Date ? now : new Date(now));
}

/** Gun anahtarini yerel gece yarisina denk gelen Date nesnesine cevirir. */
export function parseDayKey(key) {
  const parts = String(key).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function isDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Gun anahtarina n gun ekler (n negatif olabilir). Ay/yil tasmalarini kendisi cozer. */
export function addDays(key, n) {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** a - b, tam gun cinsinden. Yaz saati gecislerinde de dogru sonuc verir. */
export function diffDays(a, b) {
  const da = parseDayKey(a).getTime();
  const db = parseDayKey(b).getTime();
  return Math.round((da - db) / MS_PER_DAY);
}

/** startKey ile endKey arasindaki gun anahtarlari, artan sirada, iki uc dahil. */
export function rangeKeys(startKey, endKey) {
  const out = [];
  const total = diffDays(endKey, startKey);
  if (total < 0) return out;
  for (let i = 0; i <= total; i++) out.push(addDays(startKey, i));
  return out;
}

/** endKey ile biten son n gunun anahtarlari, artan sirada. */
export function lastNDays(n, endKey) {
  if (n <= 0) return [];
  return rangeKeys(addDays(endKey, -(n - 1)), endKey);
}

/** Haftanin ilk gunu Pazartesi kabul edilir. */
export function startOfWeek(key) {
  const wd = (parseDayKey(key).getDay() + 6) % 7;
  return addDays(key, -wd);
}

export function endOfWeek(key) {
  return addDays(startOfWeek(key), 6);
}

export function startOfMonth(key) {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonth(key) {
  const d = parseDayKey(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function weekdayShort(key) {
  return WEEKDAYS_SHORT[parseDayKey(key).getDay()];
}

export function weekdayLong(key) {
  return WEEKDAYS_LONG[parseDayKey(key).getDay()];
}

/** "8 Ağu" */
export function formatDayShort(key) {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "8 Ağustos 2026, Cumartesi" */
export function formatDayLong(key) {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}, ${WEEKDAYS_LONG[d.getDay()]}`;
}

/** "8 Ağustos" */
export function formatDayMonth(key) {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

/**
 * Insanin okudugu gun etiketi: Bugün / Yarın / Dün / "3 gün gecikti" / "8 Ağu".
 */
export function relativeDayLabel(key, refKey) {
  const delta = diffDays(key, refKey);
  if (delta === 0) return 'Bugün';
  if (delta === 1) return 'Yarın';
  if (delta === -1) return 'Dün';
  if (delta === 2) return 'Öbür gün';
  if (delta < 0) return `${Math.abs(delta)} gün gecikti`;
  if (delta <= 6) return `${delta} gün sonra`;
  return formatDayShort(key);
}

/** Gun anahtarinin bugunden once olup olmadigi. */
export function isPast(key, refKey) {
  return diffDays(key, refKey) < 0;
}

/** Bir zaman damgasinin "SS:DD" bicimli yerel saati. */
export function formatTime(timestamp) {
  const d = new Date(timestamp);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
