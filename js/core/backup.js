// Yedek dosyasinin bicimi, dogrulanmasi ve surum donusumu.
// Bu dosyada dosya okuma/yazma YOK; tamami saf fonksiyon oldugu icin test edilebilir.

export const BACKUP_APP_ID = 'yks-takip';

/** Yedekte yer alan depolar. meta (aktif kronometre gibi gecici durum) yedeklenmez. */
export const BACKUP_STORES = [
  'subjects',
  'studySessions',
  'questionLogs',
  'mockExams',
  'tasks',
  'habits',
  'habitLogs',
  'settings',
];

/**
 * Yedek nesnesini olusturur.
 * dataByStore: { subjects: [...], studySessions: [...], ... }
 */
export function buildBackup(dataByStore, { schemaVersion, appVersion = '1.0.0', now = Date.now() } = {}) {
  const data = {};
  let recordCount = 0;
  for (const name of BACKUP_STORES) {
    const records = Array.isArray(dataByStore?.[name]) ? dataByStore[name] : [];
    data[name] = records;
    recordCount += records.length;
  }
  return {
    app: BACKUP_APP_ID,
    appVersion,
    schemaVersion,
    exportedAt: new Date(now).toISOString(),
    recordCount,
    data,
  };
}

/**
 * Yedek nesnesini dogrular.
 * Donus: { ok: true, backup, warnings: [] } veya { ok: false, error: 'Turkce mesaj' }
 */
export function validateBackup(input, currentSchemaVersion) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Dosya bir yedek dosyası gibi görünmüyor.' };
  }
  if (input.app !== BACKUP_APP_ID) {
    return {
      ok: false,
      error: 'Bu dosya bu uygulamanın yedeği değil. Doğru dosyayı seçtiğinden emin ol.',
    };
  }
  const version = Number(input.schemaVersion);
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'Yedek dosyasının sürüm bilgisi okunamadı.' };
  }
  if (version > currentSchemaVersion) {
    return {
      ok: false,
      error:
        `Bu yedek uygulamanın daha yeni bir sürümünden (${version}). ` +
        'Önce uygulamayı güncelle, sonra geri yükle.',
    };
  }
  if (input.data === null || typeof input.data !== 'object') {
    return { ok: false, error: 'Yedek dosyasının içeriği boş veya bozuk.' };
  }

  const warnings = [];
  for (const name of BACKUP_STORES) {
    const records = input.data[name];
    if (records === undefined) {
      warnings.push(`Yedekte ${name} bölümü yok, boş kabul edildi.`);
      continue;
    }
    if (!Array.isArray(records)) {
      return { ok: false, error: `Yedek dosyasındaki "${name}" bölümü bozuk.` };
    }
    for (const record of records) {
      if (record === null || typeof record !== 'object') {
        return { ok: false, error: `Yedek dosyasındaki "${name}" bölümünde geçersiz kayıt var.` };
      }
      if (name === 'settings') {
        if (!record.id) return { ok: false, error: 'Yedekteki ayar kaydı kimliksiz.' };
      } else if (typeof record.id !== 'string' || record.id.length === 0) {
        return { ok: false, error: `Yedek dosyasındaki "${name}" bölümünde kimliksiz kayıt var.` };
      }
    }
  }

  return { ok: true, backup: input, warnings };
}

/**
 * Eski surumden gelen yedegi guncel semaya tasir.
 * Her surum artisinda buraya bir adim eklenecek. Simdilik tek surum var.
 */
export function migrateBackupData(data, fromVersion, toVersion) {
  let current = deepCopy(data);
  for (let version = fromVersion; version < toVersion; version += 1) {
    const step = BACKUP_MIGRATIONS[version];
    if (typeof step === 'function') current = step(current);
  }
  // Eksik bolumleri bos dizi yap.
  for (const name of BACKUP_STORES) {
    if (!Array.isArray(current[name])) current[name] = [];
  }
  return current;
}

/** version -> (version + 1) donusumleri. */
const BACKUP_MIGRATIONS = {
  // 1(data) { data.studySessions = data.studySessions.map(...); return data; },
};

/** Yedegin ozeti: kullaniciya "ne geri yuklenecek" diye gostermek icin. */
export function summarizeBackup(data) {
  return {
    subjects: countOf(data.subjects),
    sessions: countOf(data.studySessions),
    questions: countOf(data.questionLogs),
    exams: countOf(data.mockExams),
    tasks: countOf(data.tasks),
    habits: countOf(data.habits),
    habitLogs: countOf(data.habitLogs),
  };
}

function countOf(value) {
  return Array.isArray(value) ? value.length : 0;
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Yedek dosyasinin adi: yks-takip-yedek-2026-08-08.json */
export function backupFileName(dayKeyText) {
  return `yks-takip-yedek-${dayKeyText}.json`;
}
