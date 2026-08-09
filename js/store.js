// Uygulamanin tek dogruluk kaynagi.
//
// Yaklasim: veri hacmi tek kullanici icin kucuk oldugu icin acilista TAMAMI bellege
// okunur. Boylece arayuz butun okumalari senkron yapar (anlik tepki) ve yazma islemi
// arka planda kuyruklanir. Iyimser arayuz sarti bu sekilde saglanir.
//
// Silme islemi once "mezar tasi" (deletedAt) olarak isaretlenir. Geri al suresi
// dolunca kayit gercekten silinir. Uygulama arada kapanirsa veri kaybolmaz.

import * as db from './db.js';
import { buildSeed, mergeSettings } from './seed.js';
import { uuid, batched } from './util.js';

/** Bellekteki koleksiyon adi -> IndexedDB deposu */
const COLLECTION_STORES = {
  subjects: db.STORE.subjects,
  sessions: db.STORE.studySessions,
  questions: db.STORE.questionLogs,
  exams: db.STORE.mockExams,
  tasks: db.STORE.tasks,
  habits: db.STORE.habits,
  habitLogs: db.STORE.habitLogs,
  words: db.STORE.words,
};

export const COLLECTIONS = Object.keys(COLLECTION_STORES);

/** Mezar tasi bu sureden eskiyse gercekten silinir. Geri al seridi 5 sn surer. */
const PURGE_AFTER_MS = 15000;

export const state = {
  ready: false,
  subjects: [],
  sessions: [],
  questions: [],
  exams: [],
  tasks: [],
  habits: [],
  habitLogs: [],
  words: [],
  settings: null,
  meta: {},
};

const listeners = new Set();
const errorListeners = new Set();

const notify = batched(() => {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error('Dinleyici hatası:', err);
    }
  }
});

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onError(listener) {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function reportError(error) {
  const message =
    error?.userMessage || 'Beklenmeyen bir hata oldu. Uygulamayı yeniden başlatmayı dene.';
  console.error(error);
  for (const listener of errorListeners) {
    try {
      listener(message, error);
    } catch (err) {
      console.error(err);
    }
  }
}

/** Yazma kuyrugu: islemler siraya girer, biri digerinin ustune binmez. */
let writeQueue = Promise.resolve();
let pendingWrites = 0;

function enqueue(work) {
  pendingWrites += 1;
  writeQueue = writeQueue
    .then(work)
    .catch(async (error) => {
      reportError(error);
      // Bellek ile disk ayristi: diskteki gercek duruma geri don.
      try {
        await reload();
      } catch (err) {
        console.error(err);
      }
    })
    .finally(() => {
      pendingWrites -= 1;
    });
  return writeQueue;
}

/** Bekleyen tum yazmalar bitene kadar bekler (yedek almadan once kullanilir). */
export function flush() {
  return writeQueue;
}

export function hasPendingWrites() {
  return pendingWrites > 0;
}

// ---------------------------------------------------------------- acilis

export async function init() {
  const data = await db.readEverything();
  const metaRows = await db.getAll(db.STORE.meta);

  state.subjects = data[db.STORE.subjects] || [];
  state.sessions = data[db.STORE.studySessions] || [];
  state.questions = data[db.STORE.questionLogs] || [];
  state.exams = data[db.STORE.mockExams] || [];
  state.tasks = data[db.STORE.tasks] || [];
  state.habits = data[db.STORE.habits] || [];
  state.habitLogs = data[db.STORE.habitLogs] || [];
  state.meta = Object.fromEntries((metaRows || []).map((row) => [row.key, row.value]));

  const storedSettings = (data[db.STORE.settings] || [])[0] || null;

  const isFirstRun = state.subjects.length === 0 && !storedSettings;
  if (isFirstRun) {
    const seed = buildSeed();
    state.subjects = seed.subjects;
    state.habits = seed.habits;
    state.settings = seed.settings;
    await db.putMany(db.STORE.subjects, seed.subjects);
    await db.putMany(db.STORE.habits, seed.habits);
    await db.put(db.STORE.settings, seed.settings);
  } else {
    state.settings = mergeSettings(storedSettings);
    // Eksik alanlar tamamlandiysa diske geri yaz.
    if (JSON.stringify(state.settings) !== JSON.stringify(storedSettings)) {
      await db.put(db.STORE.settings, state.settings);
    }
  }

  state.ready = true;
  notify();
  // Suresi gecmis mezar taslarini temizle (arka planda, acilisi bekletmeden).
  purgeExpired();
  return state;
}

/** Diskteki durumu yeniden okur (hata sonrasi senkron kalmak icin). */
export async function reload() {
  const data = await db.readEverything();
  const metaRows = await db.getAll(db.STORE.meta);
  state.subjects = data[db.STORE.subjects] || [];
  state.sessions = data[db.STORE.studySessions] || [];
  state.questions = data[db.STORE.questionLogs] || [];
  state.exams = data[db.STORE.mockExams] || [];
  state.tasks = data[db.STORE.tasks] || [];
  state.habits = data[db.STORE.habits] || [];
  state.habitLogs = data[db.STORE.habitLogs] || [];
  state.meta = Object.fromEntries((metaRows || []).map((row) => [row.key, row.value]));
  state.settings = mergeSettings((data[db.STORE.settings] || [])[0] || null);
  notify();
}

// ---------------------------------------------------------------- okuma

/** Silinmemis kayitlar. Arayuz her zaman bunu kullanir. */
export function list(collection) {
  return state[collection].filter((record) => !record.deletedAt);
}

export function subjects() {
  return list('subjects').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function sessions() {
  return list('sessions');
}

export function questions() {
  return list('questions');
}

export function exams() {
  return list('exams');
}

export function tasks() {
  return list('tasks');
}

export function habits() {
  return list('habits').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function habitLogs() {
  return list('habitLogs');
}

export function words() {
  return list('words');
}

export function find(collection, id) {
  return state[collection].find((record) => record.id === id) || null;
}

export function subject(id) {
  return find('subjects', id);
}

export function subjectName(id) {
  return subject(id)?.name || 'Silinmiş ders';
}

export function subjectColor(id) {
  return subject(id)?.color || '#94a3b8';
}

export function settings() {
  return state.settings;
}

export function penalty() {
  const value = Number(state.settings?.netPenalty);
  return Number.isFinite(value) && value > 0 ? value : 4;
}

export function target(subjectId) {
  const value = Number(state.settings?.targets?.[subjectId]);
  return Number.isFinite(value) ? value : 0;
}

// ---------------------------------------------------------------- yazma

/** Yeni kayit ekler. Bellege hemen yazar, diske arkada yazar. */
export function add(collection, data) {
  const storeName = COLLECTION_STORES[collection];
  if (!storeName) throw new Error(`Bilinmeyen koleksiyon: ${collection}`);
  const record = { id: uuid(), createdAt: Date.now(), ...data };
  state[collection].push(record);
  notify();
  enqueue(() => db.put(storeName, record));
  return record;
}

/** Kaydi gunceller. */
export function update(collection, id, patch) {
  const storeName = COLLECTION_STORES[collection];
  const index = state[collection].findIndex((record) => record.id === id);
  if (index === -1) return null;
  const updated = { ...state[collection][index], ...patch, updatedAt: Date.now() };
  state[collection][index] = updated;
  notify();
  enqueue(() => db.put(storeName, updated));
  return updated;
}

/**
 * Yumusak silme. Kayit listelerden kalkar ama diskte mezar tasiyla bekler.
 * restore() ile geri gelir, purge() ile tamamen gider.
 */
export function softDelete(collection, id) {
  return update(collection, id, { deletedAt: Date.now() });
}

export function restore(collection, id) {
  return update(collection, id, { deletedAt: null });
}

/** Mezar tasini kaliciya cevirir. */
export function purge(collection, id) {
  const storeName = COLLECTION_STORES[collection];
  const index = state[collection].findIndex((record) => record.id === id);
  if (index === -1) return;
  const record = state[collection][index];
  if (!record.deletedAt) return; // silinmemis kayit yanlislikla yok edilmesin
  state[collection].splice(index, 1);
  enqueue(() => db.remove(storeName, id));
}

/** Suresi gecmis butun mezar taslarini temizler. */
export function purgeExpired(now = Date.now()) {
  for (const collection of COLLECTIONS) {
    const expired = state[collection].filter(
      (record) => record.deletedAt && now - record.deletedAt > PURGE_AFTER_MS,
    );
    for (const record of expired) purge(collection, record.id);
  }
}

export function updateSettings(patch) {
  const next = { ...state.settings, ...patch, id: 'app', updatedAt: Date.now() };
  state.settings = next;
  notify();
  enqueue(() => db.put(db.STORE.settings, next));
  return next;
}

export function setTarget(subjectId, value) {
  const targets = { ...(state.settings.targets || {}) };
  targets[subjectId] = Number(value) || 0;
  return updateSettings({ targets });
}

export function getMeta(key, fallback = null) {
  return state.meta[key] ?? fallback;
}

export function setMeta(key, value) {
  state.meta = { ...state.meta, [key]: value };
  notify();
  enqueue(() => db.setMeta(key, value));
  return value;
}

export function deleteMeta(key) {
  const next = { ...state.meta };
  delete next[key];
  state.meta = next;
  notify();
  enqueue(() => db.deleteMeta(key));
}

/**
 * Ders siler. Kayitlari (oturum, soru, deneme) SILMEZ; gecmis istatistik bozulmasin
 * diye kayitlar kalir ve arayuzde "Silinmiş ders" olarak gorunur.
 */
export function deleteSubject(id) {
  return softDelete('subjects', id);
}

/** Tum verileri siler ve baslangic verisiyle yeniden kurar. */
export async function resetEverything() {
  await flush();
  await db.clearAllData({ includeMeta: true });
  const seed = buildSeed();
  await db.putMany(db.STORE.subjects, seed.subjects);
  await db.putMany(db.STORE.habits, seed.habits);
  await db.put(db.STORE.settings, seed.settings);
  await reload();
}
