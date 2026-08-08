// Kronometre ve pomodoro motoru.
//
// TASARIM: Sayac ekranda "tick" ile saymaz; baslangic zaman damgasi saklanir ve
// gecen sure her seferinde yeniden hesaplanir. Bu yuzden uygulama tamamen kapanip
// acilsa da sayac dogru yerden devam eder.
//
// Durum meta deposunda 'activeTimer' anahtarinda tutulur, yani IndexedDB'de kalicidir.

import * as store from './store.js';
import * as haptics from './platform/haptics.js';
import * as wakelock from './platform/wakelock.js';
import * as notify from './platform/notify.js';
import { dayKey } from './core/dates.js';
import { uuid } from './util.js';
import { checkDailyGoal } from './goal.js';

const META_KEY = 'activeTimer';

export const MODE_STOPWATCH = 'stopwatch';
export const MODE_POMODORO = 'pomodoro';

export const PHASE_WORK = 'work';
export const PHASE_BREAK = 'break';

/** 12 saatten uzun suren kronometre muhtemelen unutulmustur, kullaniciyi uyaririz. */
export const SUSPICIOUS_MS = 12 * 60 * 60 * 1000;

/** Faz bitisi bu gecikmeden sonra fark edildiyse otomatik gecis yapilmaz. */
const LATE_DETECTION_MS = 5000;

const phaseListeners = new Set();

/** Faz bitisi / kayit olaylarini dinlemek icin (arayuz kutlama veya yenileme yapar). */
export function onPhaseEnd(listener) {
  phaseListeners.add(listener);
  return () => phaseListeners.delete(listener);
}

function emitPhaseEnd(detail) {
  for (const listener of phaseListeners) {
    try {
      listener(detail);
    } catch (err) {
      console.error(err);
    }
  }
}

export function getActive() {
  return store.getMeta(META_KEY, null);
}

export function isRunning() {
  const timer = getActive();
  return Boolean(timer && timer.startedAt);
}

function write(timer) {
  store.setMeta(META_KEY, timer);
}

function clear() {
  store.deleteMeta(META_KEY);
}

/** Su anki fazin hedef suresi (pomodoro). Kronometre modunda hedef yok. */
export function phaseTargetMs(timer) {
  if (!timer || timer.mode !== MODE_POMODORO) return null;
  return timer.phase === PHASE_BREAK ? timer.breakMs : timer.workMs;
}

/** Su anki fazda gecen sure. */
export function elapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;
  const running = timer.startedAt ? Math.max(0, now - timer.startedAt) : 0;
  return (timer.accumulatedMs || 0) + running;
}

/** Arayuzun ekrana basmasi icin gereken her sey. */
export function display(now = Date.now()) {
  const timer = getActive();
  if (!timer) return null;
  const target = phaseTargetMs(timer);
  const elapsed = elapsedMs(timer, now);
  return {
    timer,
    subjectId: timer.subjectId,
    mode: timer.mode,
    phase: timer.phase,
    cycle: timer.cycle,
    running: Boolean(timer.startedAt),
    awaitingContinue: Boolean(timer.awaitingContinue),
    elapsedMs: elapsed,
    targetMs: target,
    remainingMs: target === null ? null : Math.max(0, target - elapsed),
    progress: target ? Math.min(1, elapsed / target) : 0,
    studyMs: (timer.studyMs || 0) + (timer.phase === PHASE_WORK ? elapsed : 0),
    suspicious: timer.mode === MODE_STOPWATCH && elapsed > SUSPICIOUS_MS,
  };
}

async function acquireWakeLock() {
  if (store.settings()?.keepScreenAwake === false) return;
  await wakelock.request();
}

/** Yeni oturum baslatir. Zaten calisan varsa once onu bitirmek gerekir. */
export function start({ subjectId, mode = MODE_STOPWATCH, topic } = {}) {
  if (!subjectId) throw new Error('Ders seçilmedi');
  const pomodoro = store.settings()?.pomodoro || {};
  const now = Date.now();
  const timer = {
    id: uuid(),
    subjectId,
    mode,
    topic: topic || undefined,
    phase: PHASE_WORK,
    cycle: 1,
    startedAt: now,
    accumulatedMs: 0,
    studyMs: 0,
    sessionStartedAt: now,
    workMs: Math.max(1, Number(pomodoro.workMinutes) || 50) * 60000,
    breakMs: Math.max(1, Number(pomodoro.breakMinutes) || 10) * 60000,
    awaitingContinue: false,
  };
  write(timer);
  store.setMeta('lastSubjectId', subjectId);
  haptics.start();
  acquireWakeLock();
  return timer;
}

export function pause() {
  const timer = getActive();
  if (!timer || !timer.startedAt) return null;
  const now = Date.now();
  const next = {
    ...timer,
    accumulatedMs: elapsedMs(timer, now),
    startedAt: null,
  };
  write(next);
  haptics.start();
  wakelock.release();
  return next;
}

export function resume() {
  const timer = getActive();
  if (!timer || timer.startedAt) return null;
  const next = { ...timer, startedAt: Date.now(), awaitingContinue: false };
  write(next);
  haptics.start();
  acquireWakeLock();
  return next;
}

/** Duraklat / devam et arasinda gecis. */
export function toggle() {
  return isRunning() ? pause() : resume();
}

/**
 * Oturumu bitirir ve suresi 1 dakikadan uzunsa kaydeder.
 * Donus: { saved, minutes, session }
 */
export async function finish({ save = true } = {}) {
  const timer = getActive();
  if (!timer) return { saved: false, minutes: 0, session: null };
  const now = Date.now();
  const elapsed = elapsedMs(timer, now);

  // Mola fazinda bitirilirse mola suresi calisma olarak kaydedilmez.
  const countable = timer.phase === PHASE_WORK ? elapsed : 0;
  const minutes = Math.round(countable / 60000);

  clear();
  wakelock.release();
  haptics.finish();

  if (!save || minutes < 1) {
    return { saved: false, minutes, session: null };
  }

  const session = store.add('sessions', {
    date: dayKey(new Date(timer.sessionStartedAt)),
    subjectId: timer.subjectId,
    minutes,
    source: 'timer',
    topic: timer.topic,
  });
  await checkDailyGoal();
  return { saved: true, minutes, session };
}

/** Oturumu kaydetmeden iptal eder. */
export function cancel() {
  if (!getActive()) return;
  clear();
  wakelock.release();
  haptics.warn();
}

/**
 * Pomodoro fazinin dolup dolmadigini kontrol eder. Watchdog her saniye cagirir,
 * ayrica sekme one dondugunde tekrar cagrilir.
 */
export function check(now = Date.now()) {
  const timer = getActive();
  if (!timer || !timer.startedAt) return false;
  if (timer.mode !== MODE_POMODORO) return false;
  const target = phaseTargetMs(timer);
  if (elapsedMs(timer, now) < target) return false;
  completePhase(timer, now);
  return true;
}

async function completePhase(timer, now) {
  const target = phaseTargetMs(timer);
  const remainingWhenStarted = target - (timer.accumulatedMs || 0);
  const phaseEndedAt = timer.startedAt + remainingWhenStarted;
  // Uygulama kapali/arka planda oldugu icin gec fark ettiysek otomatik gecis yapmayiz:
  // ne kadar sure yokta kaldigini bilmedigimiz icin uydurma sayac yurutmek dogru olmaz.
  const late = now - phaseEndedAt > LATE_DETECTION_MS;
  const settings = store.settings()?.pomodoro || {};
  const pomodoroMinutes = Math.round(target / 60000);

  if (timer.phase === PHASE_WORK) {
    const session = store.add('sessions', {
      date: dayKey(new Date(timer.startedAt)),
      subjectId: timer.subjectId,
      minutes: pomodoroMinutes,
      source: 'timer',
      topic: timer.topic,
      note: `Pomodoro ${timer.cycle}. tur`,
    });

    const autoStart = settings.autoStartBreak !== false && !late;
    write({
      ...timer,
      phase: PHASE_BREAK,
      accumulatedMs: 0,
      startedAt: autoStart ? phaseEndedAt : null,
      studyMs: (timer.studyMs || 0) + target,
      awaitingContinue: !autoStart,
      missedWhileAway: late,
    });

    haptics.alarm();
    notify.pomodoroWorkDone(pomodoroMinutes, store.subjectName(timer.subjectId));
    emitPhaseEnd({ phase: PHASE_WORK, minutes: pomodoroMinutes, late, session });
    if (!autoStart) wakelock.release();
    await checkDailyGoal();
    return;
  }

  const autoStart = settings.autoStartWork === true && !late;
  write({
    ...timer,
    phase: PHASE_WORK,
    cycle: (timer.cycle || 1) + 1,
    accumulatedMs: 0,
    startedAt: autoStart ? phaseEndedAt : null,
    awaitingContinue: !autoStart,
    missedWhileAway: late,
  });

  haptics.alarm();
  notify.pomodoroBreakDone(pomodoroMinutes);
  emitPhaseEnd({ phase: PHASE_BREAK, minutes: pomodoroMinutes, late });
  if (!autoStart) wakelock.release();
}

/** Molayi atlayip dogrudan calismaya gecer. */
export function skipBreak() {
  const timer = getActive();
  if (!timer || timer.phase !== PHASE_BREAK) return null;
  const next = {
    ...timer,
    phase: PHASE_WORK,
    cycle: (timer.cycle || 1) + 1,
    accumulatedMs: 0,
    startedAt: Date.now(),
    awaitingContinue: false,
    missedWhileAway: false,
  };
  write(next);
  haptics.start();
  acquireWakeLock();
  return next;
}

/** Faz bitiminden sonra "devam et" dokunusu. */
export function continueNext() {
  const timer = getActive();
  if (!timer) return null;
  const next = { ...timer, startedAt: Date.now(), accumulatedMs: 0, awaitingContinue: false, missedWhileAway: false };
  write(next);
  haptics.start();
  acquireWakeLock();
  return next;
}

/** Calisan bir oturum icin ders degistirir (yanlis ders sectiysem). */
export function changeSubject(subjectId) {
  const timer = getActive();
  if (!timer || !subjectId) return null;
  const next = { ...timer, subjectId };
  write(next);
  store.setMeta('lastSubjectId', subjectId);
  return next;
}

let watchdogId = null;

/**
 * Faz bitislerini uygulama acikken kacirmayan zamanlayici.
 * Arka plandaki sekmede tarayici setInterval'i yavaslatir; bu yuzden sekme one
 * dondugunde de kontrol edilir. Bu bir garanti degil, "en iyi caba"dir.
 */
export function startWatchdog() {
  if (watchdogId !== null) return;
  watchdogId = setInterval(() => check(), 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('focus', () => check());
  // Acilista calisan bir oturum varsa ekran kilidini geri al.
  if (isRunning()) acquireWakeLock();
  check();
}
