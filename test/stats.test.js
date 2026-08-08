import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  totalMinutes,
  minutesByDay,
  minutesBySubject,
  activeDayKeys,
  currentStreak,
  longestStreak,
  rangeSummary,
  questionTotals,
  examSummary,
  pendingTaskCount,
  habitDayRatios
} from '../js/core/stats.js';

describe('Stats Module (İstatistik Modülü)', () => {
  describe('totalMinutes()', () => {
    it('oturumların toplam süresini hesaplamalı', () => {
      const sessions = [{ minutes: 30 }, { minutes: 45 }];
      assert.equal(totalMinutes(sessions), 75);
    });

    it('boş dizi için 0 dönmeli', () => {
      assert.equal(totalMinutes([]), 0);
    });

    it('null/undefined için 0 dönmeli', () => {
      assert.equal(totalMinutes(null), 0);
      assert.equal(totalMinutes(undefined), 0);
    });

    it('geçersiz minutes değerlerini 0 saymalı', () => {
      const sessions = [{ minutes: 30 }, { minutes: 'abc' }, { minutes: null }];
      assert.equal(totalMinutes(sessions), 30);
    });
  });

  describe('minutesByDay()', () => {
    it('günlere göre toplam süreleri hesaplamalı', () => {
      const sessions = [
        { date: '2026-08-08', minutes: 30 },
        { date: '2026-08-08', minutes: 15 },
        { date: '2026-08-09', minutes: 45 }
      ];
      const keys = ['2026-08-08', '2026-08-09', '2026-08-10'];
      const result = minutesByDay(sessions, keys);
      // Dizi döndürür: [{date, minutes}, ...]
      assert.equal(result.length, 3);
      assert.equal(result[0].date, '2026-08-08');
      assert.equal(result[0].minutes, 45);
      assert.equal(result[1].date, '2026-08-09');
      assert.equal(result[1].minutes, 45);
      assert.equal(result[2].date, '2026-08-10');
      assert.equal(result[2].minutes, 0);
    });

    it('boş oturum listesiyle her gün 0 olmalı', () => {
      const keys = ['2026-08-08'];
      const result = minutesByDay([], keys);
      assert.equal(result[0].minutes, 0);
    });
  });

  describe('minutesBySubject()', () => {
    it('derslere göre toplam süreleri hesaplamalı', () => {
      const sessions = [
        { subjectId: 'math', minutes: 30 },
        { subjectId: 'physics', minutes: 45 },
        { subjectId: 'math', minutes: 20 }
      ];
      // Dizi döndürür, azalan sırada: [{subjectId, minutes}, ...]
      const result = minutesBySubject(sessions);
      assert.equal(result.length, 2);
      // math = 50, physics = 45. Azalan sıra: math önce
      assert.equal(result[0].subjectId, 'math');
      assert.equal(result[0].minutes, 50);
      assert.equal(result[1].subjectId, 'physics');
      assert.equal(result[1].minutes, 45);
    });

    it('boş dizi için boş dizi dönmeli', () => {
      assert.deepEqual(minutesBySubject([]), []);
    });
  });

  describe('activeDayKeys()', () => {
    it('aktif çalışılan benzersiz günleri dönmeli', () => {
      const sessions = [
        { date: '2026-08-08', minutes: 30 },
        { date: '2026-08-08', minutes: 15 },
        { date: '2026-08-10', minutes: 45 }
      ];
      assert.deepEqual(activeDayKeys(sessions), ['2026-08-08', '2026-08-10']);
    });

    it('0 dakikalık kayıtları saymamalı', () => {
      const sessions = [
        { date: '2026-08-08', minutes: 0 },
        { date: '2026-08-09', minutes: 10 }
      ];
      assert.deepEqual(activeDayKeys(sessions), ['2026-08-09']);
    });
  });

  describe('currentStreak()', () => {
    it('mevcut ardışık çalışma serisini hesaplamalı', () => {
      const days = ['2026-08-05', '2026-08-06', '2026-08-07'];
      assert.equal(currentStreak(days, '2026-08-07'), 3);
      assert.equal(currentStreak(days, '2026-08-08'), 3); // Dün çalışılmış, seri devam ediyor
      assert.equal(currentStreak(days, '2026-08-09'), 0); // Seri bozulmuş
    });

    it('boş dizi için 0 dönmeli', () => {
      assert.equal(currentStreak([], '2026-08-08'), 0);
    });

    it('tek günlük seri', () => {
      assert.equal(currentStreak(['2026-08-08'], '2026-08-08'), 1);
    });
  });

  describe('longestStreak()', () => {
    it('en uzun ardışık çalışma serisini hesaplamalı', () => {
      const days = ['2026-08-01', '2026-08-02', '2026-08-04', '2026-08-05', '2026-08-06'];
      assert.equal(longestStreak(days), 3);
      assert.equal(longestStreak([]), 0);
    });

    it('tek gün en uzun seri 1 olmalı', () => {
      assert.equal(longestStreak(['2026-08-08']), 1);
    });
  });

  describe('rangeSummary()', () => {
    it('belirtilen aralıktaki oturumları özetlemeli', () => {
      const sessions = [
        { date: '2026-08-08', minutes: 30 },
        { date: '2026-08-09', minutes: 45 },
        { date: '2026-08-15', minutes: 60 } // Aralık dışı
      ];
      const summary = rangeSummary(sessions, '2026-08-08', '2026-08-10');
      assert.equal(summary.minutes, 75);
      assert.equal(summary.days, 2);       // 2 aktif gün
      assert.equal(summary.spanDays, 3);   // 3 günlük aralık
    });

    it('boş aralık', () => {
      const summary = rangeSummary([], '2026-08-08', '2026-08-10');
      assert.equal(summary.minutes, 0);
      assert.equal(summary.days, 0);
    });
  });

  describe('questionTotals()', () => {
    it('soru loglarının toplamını hesaplamalı', () => {
      const logs = [
        { correct: 10, wrong: 4, blank: 0 },
        { correct: 20, wrong: 4, blank: 2 }
      ];
      const totals = questionTotals(logs);
      assert.equal(totals.correct, 30);
      assert.equal(totals.wrong, 8);
      assert.equal(totals.blank, 2);
      assert.equal(totals.total, 40);
      assert.equal(totals.net, 28); // 30 - 8/4 = 28
    });

    it('boş dizi için sıfırlar dönmeli', () => {
      const totals = questionTotals([]);
      assert.equal(totals.correct, 0);
      assert.equal(totals.total, 0);
      assert.equal(totals.net, 0);
    });

    it('farklı katsayı ile hesaplamalı', () => {
      const logs = [{ correct: 10, wrong: 5, blank: 0 }];
      const totals = questionTotals(logs, 5);
      assert.equal(totals.net, 9); // 10 - 5/5 = 9
    });
  });

  describe('examSummary()', () => {
    it('deneme sınavının özetini çıkartmalı', () => {
      const exam = {
        id: 'e1',
        date: '2026-08-08',
        name: 'TYT Deneme 1',
        examType: 'TYT',
        results: [
          { subjectId: 's1', correct: 30, wrong: 10, blank: 0 }, // 27.5 net
          { subjectId: 's2', correct: 10, wrong: 0, blank: 10 }  // 10 net
        ]
      };
      const summary = examSummary(exam);
      assert.equal(summary.net, 37.5); // Doğrudan net alanı var
      assert.equal(summary.results.length, 2);
      assert.equal(summary.results[0].net, 27.5);
      assert.equal(summary.results[1].net, 10);
    });
  });

  describe('pendingTaskCount()', () => {
    it('tamamlanmamış görev sayısını dönmeli', () => {
      const tasks = [
        { done: true },
        { done: false },
        { done: false }
      ];
      assert.equal(pendingTaskCount(tasks), 2);
    });

    it('boş dizi için 0 dönmeli', () => {
      assert.equal(pendingTaskCount([]), 0);
      assert.equal(pendingTaskCount(null), 0);
    });

    it('hepsi tamamlandıysa 0 dönmeli', () => {
      const tasks = [{ done: true }, { done: true }];
      assert.equal(pendingTaskCount(tasks), 0);
    });
  });

  describe('habitDayRatios()', () => {
    it('alışkanlıkların tamamlanma oranlarını gün bazında hesaplamalı', () => {
      const logs = [
        { date: '2026-08-08', habitId: 'h1', done: true },
        { date: '2026-08-08', habitId: 'h2', done: true },
        { date: '2026-08-09', habitId: 'h1', done: true }
      ];
      const keys = ['2026-08-08', '2026-08-09'];
      const habitIds = ['h1', 'h2'];
      
      // Dizi döndürür: [{date, done, total, ratio}, ...]
      const ratios = habitDayRatios(logs, keys, habitIds);
      assert.equal(ratios.length, 2);
      assert.equal(ratios[0].date, '2026-08-08');
      assert.equal(ratios[0].done, 2);
      assert.equal(ratios[0].ratio, 1);   // 2/2
      assert.equal(ratios[1].date, '2026-08-09');
      assert.equal(ratios[1].done, 1);
      assert.equal(ratios[1].ratio, 0.5); // 1/2
    });

    it('boş log için tüm oranlar 0 olmalı', () => {
      const ratios = habitDayRatios([], ['2026-08-08'], ['h1']);
      assert.equal(ratios[0].ratio, 0);
    });
  });
});
