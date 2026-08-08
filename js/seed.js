// Ilk acilis verisi. Sahte kayit degil, sadece kullanicinin kendi dersleri ve rutini.
// Hepsi Ayarlar ekranindan degistirilebilir.

import { uuid } from './util.js';

export const DEFAULT_SETTINGS = {
  id: 'app',
  dailyGoalMinutes: 300,
  netPenalty: 4,
  theme: 'dark',
  targets: {},
  pomodoro: {
    workMinutes: 50,
    breakMinutes: 10,
    autoStartBreak: true,
    autoStartWork: false,
  },
  hapticsEnabled: true,
  keepScreenAwake: true,
  notificationsAsked: false,
  periodicSyncEnabled: false,
  reminderHour: 22,
  reminderMinute: 30,
};

const SEED_SUBJECTS = [
  { name: 'Türkçe', color: '#f87171', examType: 'TYT', questionCount: 40, target: 39 },
  { name: 'Sosyal Bilimler', color: '#fbbf24', examType: 'TYT', questionCount: 20, target: 19 },
  { name: 'Matematik', color: '#60a5fa', examType: 'TYT', questionCount: 40, target: 28 },
  { name: 'Fen Bilimleri', color: '#34d399', examType: 'TYT', questionCount: 20, target: 17 },
  { name: 'İngilizce', color: '#a78bfa', examType: 'YDT', questionCount: 80, target: 77 },
];

const SEED_HABITS = [
  '07:00 kalktım',
  'Sabah dışarı çıktım (ışık)',
  '14:00 sonrası kafein almadım',
  '22:30 ekranları kapattım',
  "23:00'te yattım",
];

/** Ders ve rutin renk paleti: yeni ders eklendiginde siradaki renk verilir. */
export const SUBJECT_COLORS = [
  '#f87171', '#fbbf24', '#60a5fa', '#34d399', '#a78bfa',
  '#fb923c', '#22d3ee', '#f472b6', '#a3e635', '#94a3b8',
];

/**
 * Bos veritabani icin baslangic kayitlarini uretir.
 * Hedef netler settings.targets icine subjectId anahtariyla yazilir.
 */
export function buildSeed(now = Date.now()) {
  const subjects = SEED_SUBJECTS.map((item, index) => ({
    id: uuid(),
    createdAt: now,
    name: item.name,
    color: item.color,
    examType: item.examType,
    questionCount: item.questionCount,
    order: index,
  }));

  const targets = {};
  subjects.forEach((subject, index) => {
    targets[subject.id] = SEED_SUBJECTS[index].target;
  });

  const habits = SEED_HABITS.map((name, index) => ({
    id: uuid(),
    createdAt: now,
    name,
    order: index,
  }));

  const settings = {
    ...structuredCloneSafe(DEFAULT_SETTINGS),
    targets,
    createdAt: now,
    updatedAt: now,
  };

  return { subjects, habits, settings };
}

/** structuredClone her ortamda olmayabilir; JSON yedegi yeterli (veri saf JSON). */
function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * Kayitli ayarlari varsayilanlarla birlestirir.
 * Yeni surumde eklenen alanlar boylece eski kayitlarda da tanimli olur.
 */
export function mergeSettings(stored) {
  const base = structuredCloneSafe(DEFAULT_SETTINGS);
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    id: 'app',
    targets: { ...base.targets, ...(stored.targets || {}) },
    pomodoro: { ...base.pomodoro, ...(stored.pomodoro || {}) },
  };
}
