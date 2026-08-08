// Yedek alma ve geri yukleme (dosya islemleri).
// Saf mantik js/core/backup.js icinde, burada sadece tarayici tarafi var.

import * as db from './db.js';
import * as store from './store.js';
import {
  buildBackup,
  validateBackup,
  migrateBackupData,
  summarizeBackup,
  backupFileName,
} from './core/backup.js';
import { todayKey } from './core/dates.js';

const APP_VERSION = '1.0.0';

/** Tum veriyi tek JSON metnine cevirir. */
export async function createBackupText() {
  await store.flush();
  const data = await db.readEverything();
  const backup = buildBackup(data, {
    schemaVersion: db.SCHEMA_VERSION,
    appVersion: APP_VERSION,
  });
  return { text: JSON.stringify(backup, null, 2), backup };
}

/**
 * Yedegi dosya olarak indirir. Android Chrome'da "İndirilenler" klasorune duser.
 */
export async function downloadBackup() {
  const { text, backup } = await createBackupText();
  const fileName = backupFileName(todayKey());
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Tarayicinin indirmeyi baslatmasi icin kisa bir sure bekleyip serbest birak.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { fileName, recordCount: backup.recordCount };
}

/** Paylasim sayfasi destekleniyorsa yedegi baska uygulamaya gonderir (Drive, WhatsApp...). */
export function canShareBackup() {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
  try {
    const probe = new File(['{}'], 'deneme.json', { type: 'application/json' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareBackup() {
  const { text, backup } = await createBackupText();
  const fileName = backupFileName(todayKey());
  const file = new File([text], fileName, { type: 'application/json' });
  await navigator.share({
    files: [file],
    title: 'YKS Takip yedeği',
    text: `${backup.recordCount} kayıt`,
  });
  return { fileName, recordCount: backup.recordCount };
}

/**
 * Dosyayi okur ve dogrular. Henuz hicbir sey YAZMAZ; once kullaniciya ozet gosterilir.
 * Donus: { ok, error, payload, summary, warnings }
 */
export async function readBackupFile(file) {
  let text;
  try {
    text = await file.text();
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'Dosya okunamadı.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Dosya geçerli bir JSON değil. Yedek dosyası bozulmuş olabilir.' };
  }

  const check = validateBackup(parsed, db.SCHEMA_VERSION);
  if (!check.ok) return check;

  const payload = migrateBackupData(check.backup.data, check.backup.schemaVersion, db.SCHEMA_VERSION);
  return {
    ok: true,
    payload,
    summary: summarizeBackup(payload),
    warnings: check.warnings,
    exportedAt: check.backup.exportedAt,
  };
}

/**
 * Dogrulanmis yedegi yazar. Islem atomik: hata olursa mevcut veri bozulmaz.
 */
export async function restoreBackup(payload) {
  await store.flush();
  await db.replaceAll(payload);
  await store.reload();
}
