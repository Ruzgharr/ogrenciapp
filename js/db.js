// IndexedDB ince sarmalayici katmani.
//
// Neden localStorage degil: localStorage senkron calisir (ana is parcacigini kilitler)
// ve 5 MB civari sinirlari vardir. IndexedDB asenkrondur ve pratikte cok daha genis yer verir.
//
// Surumlu sema: SCHEMA_VERSION arttiginda MIGRATIONS icindeki ilgili adim calisir.
// Yeni alan eklendiginde mevcut veri SILINMEZ, sadece donusturulur.

export const DB_NAME = 'yks-takip';
export const SCHEMA_VERSION = 1;

export const STORE = {
  subjects: 'subjects',
  studySessions: 'studySessions',
  questionLogs: 'questionLogs',
  mockExams: 'mockExams',
  tasks: 'tasks',
  habits: 'habits',
  habitLogs: 'habitLogs',
  settings: 'settings',
  meta: 'meta',
};

/** Yedekleme ve toplu okuma islemlerinde kullanilan veri depolari (meta haric). */
export const DATA_STORES = [
  STORE.subjects,
  STORE.studySessions,
  STORE.questionLogs,
  STORE.mockExams,
  STORE.tasks,
  STORE.habits,
  STORE.habitLogs,
  STORE.settings,
];

/**
 * Kullaniciya Turkce mesaj tasiyan hata tipi.
 * Arayuz katmani her zaman error.userMessage'i gosterir, teknik detayi konsola yazar.
 */
export class DbError extends Error {
  constructor(userMessage, cause) {
    super(userMessage);
    this.name = 'DbError';
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

const MIGRATIONS = {
  // Surum 1: ilk sema.
  1(db) {
    const subjects = db.createObjectStore(STORE.subjects, { keyPath: 'id' });
    subjects.createIndex('order', 'order');

    const sessions = db.createObjectStore(STORE.studySessions, { keyPath: 'id' });
    sessions.createIndex('date', 'date');
    sessions.createIndex('subjectId', 'subjectId');

    const questions = db.createObjectStore(STORE.questionLogs, { keyPath: 'id' });
    questions.createIndex('date', 'date');
    questions.createIndex('subjectId', 'subjectId');

    const exams = db.createObjectStore(STORE.mockExams, { keyPath: 'id' });
    exams.createIndex('date', 'date');

    const tasks = db.createObjectStore(STORE.tasks, { keyPath: 'id' });
    tasks.createIndex('dueDate', 'dueDate');

    const habits = db.createObjectStore(STORE.habits, { keyPath: 'id' });
    habits.createIndex('order', 'order');

    const habitLogs = db.createObjectStore(STORE.habitLogs, { keyPath: 'id' });
    habitLogs.createIndex('date', 'date');
    habitLogs.createIndex('habitId', 'habitId');

    db.createObjectStore(STORE.settings, { keyPath: 'id' });
    db.createObjectStore(STORE.meta, { keyPath: 'key' });
  },

  // Sonraki surumler buraya eklenecek. Ornek:
  // 2(db, tx) {
  //   const store = tx.objectStore(STORE.studySessions);
  //   store.createIndex('topic', 'topic');
  // },
};

let dbPromise = null;

function isSupported() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/** Veritabanini acar (tekil baglanti, tekrar cagrilirsa ayni sozu dondurur). */
export function open() {
  if (dbPromise) return dbPromise;

  if (!isSupported()) {
    return Promise.reject(
      new DbError(
        'Tarayıcı yerel veritabanını (IndexedDB) desteklemiyor. Gizli sekmede açtıysan normal sekmede dene.',
      ),
    );
  }

  dbPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    } catch (err) {
      reject(new DbError('Veritabanı açılamadı.', err));
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      const from = event.oldVersion || 0;
      for (let version = from + 1; version <= SCHEMA_VERSION; version += 1) {
        const step = MIGRATIONS[version];
        if (typeof step === 'function') step(db, tx);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        // Baska bir sekme semayi guncelliyor: baglantiyi birak, kilitlenme olmasin.
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(new DbError('Veritabanı açılamadı. Tarayıcı depolama izni kapalı olabilir.', request.error));
    };

    request.onblocked = () => {
      reject(
        new DbError(
          'Veritabanı başka bir sekme tarafından kilitlendi. Uygulamanın açık diğer sekmelerini kapat.',
        ),
      );
    };
  });

  return dbPromise;
}

function requestToPromise(request, failureMessage) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new DbError(failureMessage, request.error));
  });
}

async function withStore(storeNames, mode, work, failureMessage) {
  const db = await open();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(names, mode);
    } catch (err) {
      reject(new DbError(failureMessage, err));
      return;
    }
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new DbError(failureMessage, tx.error));
    tx.onabort = () => reject(new DbError(failureMessage, tx.error));
    try {
      // work senkron olmali: IndexedDB islemi await beklerken kendini kapatir.
      result = work(tx);
    } catch (err) {
      try {
        tx.abort();
      } catch {
        /* zaten iptal edilmis olabilir */
      }
      reject(new DbError(failureMessage, err));
    }
  });
}

/** Bir depodaki tum kayitlar. */
export async function getAll(storeName) {
  const db = await open();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () =>
        reject(new DbError('Kayıtlar okunamadı. Uygulamayı yeniden başlatmayı dene.', request.error));
    } catch (err) {
      reject(new DbError('Kayıtlar okunamadı. Uygulamayı yeniden başlatmayı dene.', err));
    }
  });
}

/** Tek kayit. */
export async function get(storeName, key) {
  const db = await open();
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).get(key), 'Kayıt okunamadı.');
}

/** Kaydi ekler veya gunceller. */
export function put(storeName, value) {
  return withStore(storeName, 'readwrite', (tx) => {
    tx.objectStore(storeName).put(value);
  }, 'Kayıt edilemedi. Cihazın deposu dolu olabilir.');
}

/** Coklu kaydi tek islemde yazar. */
export function putMany(storeName, values) {
  if (!values || values.length === 0) return Promise.resolve();
  return withStore(storeName, 'readwrite', (tx) => {
    const store = tx.objectStore(storeName);
    for (const value of values) store.put(value);
  }, 'Kayıtlar edilemedi. Cihazın deposu dolu olabilir.');
}

/** Kaydi siler. */
export function remove(storeName, key) {
  return withStore(storeName, 'readwrite', (tx) => {
    tx.objectStore(storeName).delete(key);
  }, 'Kayıt silinemedi.');
}

export function removeMany(storeName, keys) {
  if (!keys || keys.length === 0) return Promise.resolve();
  return withStore(storeName, 'readwrite', (tx) => {
    const store = tx.objectStore(storeName);
    for (const key of keys) store.delete(key);
  }, 'Kayıtlar silinemedi.');
}

/** Bir deponun tamamini bosaltir. */
export function clearStore(storeName) {
  return withStore(storeName, 'readwrite', (tx) => {
    tx.objectStore(storeName).clear();
  }, 'Kayıtlar temizlenemedi.');
}

/** Butun veri depolarini tek islemde bosaltir (meta dahil degil). */
export function clearAllData({ includeMeta = false } = {}) {
  const names = includeMeta ? [...DATA_STORES, STORE.meta] : [...DATA_STORES];
  return withStore(names, 'readwrite', (tx) => {
    for (const name of names) tx.objectStore(name).clear();
  }, 'Veriler temizlenemedi.');
}

/**
 * Yedek geri yukleme: tum depolari bosaltip verilen kayitlari tek islemde yazar.
 * Islem atomiktir; ortasinda hata olursa hicbir sey degismez.
 */
export function replaceAll(payload) {
  const names = [...DATA_STORES];
  return withStore(names, 'readwrite', (tx) => {
    for (const name of names) {
      const store = tx.objectStore(name);
      store.clear();
      const records = payload[name] || [];
      for (const record of records) store.put(record);
    }
  }, 'Yedek geri yüklenemedi. Dosya bozuk olabilir, mevcut verilerine dokunulmadı.');
}

/** Tum verinin tek seferde okunmasi (uygulama acilisi ve yedekleme icin). */
export async function readEverything() {
  const entries = await Promise.all(
    DATA_STORES.map(async (name) => [name, await getAll(name)]),
  );
  return Object.fromEntries(entries);
}

/** meta deposu: uygulama durumu (aktif kronometre, son secilen ders gibi). */
export async function getMeta(key, fallback = null) {
  try {
    const row = await get(STORE.meta, key);
    return row ? row.value : fallback;
  } catch {
    return fallback;
  }
}

export function setMeta(key, value) {
  return put(STORE.meta, { key, value });
}

export function deleteMeta(key) {
  return remove(STORE.meta, key);
}

/** Depolama kotasi bilgisi (destekleyen tarayicilarda). */
export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

/** Tarayicinin veriyi kendiliginden silmesini engellemeye calisir (destekleyen cihazda). */
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
