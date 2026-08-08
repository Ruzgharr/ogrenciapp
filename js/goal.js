// Gunluk hedef takibi ve hedefe ulasma bildirimi.

import * as store from './store.js';
import * as notify from './platform/notify.js';
import { todayKey } from './core/dates.js';
import { onDay, totalMinutes } from './core/stats.js';

export function minutesOn(dayKeyText) {
  return totalMinutes(onDay(store.sessions(), dayKeyText));
}

export function todayMinutes() {
  return minutesOn(todayKey());
}

export function dailyGoal() {
  const value = Number(store.settings()?.dailyGoalMinutes);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Gunluk hedef bugun ilk kez asildiysa bildirim gonderir.
 * Ayni gun icinde ikinci kez bildirim gitmez (meta'da isaretlenir).
 * Donus: hedefe yeni ulasildi mi (arayuz kutlama gostersin diye).
 */
export async function checkDailyGoal() {
  const goal = dailyGoal();
  if (goal <= 0) return false;
  const key = todayKey();
  const minutes = minutesOn(key);
  if (minutes < goal) return false;
  if (store.getMeta('goalNotifiedDate') === key) return false;
  store.setMeta('goalNotifiedDate', key);
  await notify.dailyGoalReached(minutes);
  return true;
}
