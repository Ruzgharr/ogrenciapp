import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKey,
  todayKey,
  parseDayKey,
  isDayKey,
  addDays,
  diffDays,
  rangeKeys,
  lastNDays,
  startOfWeek,
  relativeDayLabel
} from '../js/core/dates.js';

describe('Dates Module (Tarih Modülü)', () => {
  describe('dayKey()', () => {
    it('Date objesinden YYYY-MM-DD formatında string üretmeli', () => {
      const date = new Date(2026, 7, 8); // 8 Ağustos 2026
      assert.equal(dayKey(date), '2026-08-08');
    });
  });

  describe('todayKey()', () => {
    it('geçerli bir tarih stringi dönmeli', () => {
      const today = todayKey();
      assert.ok(isDayKey(today));
    });
  });

  describe('parseDayKey()', () => {
    it('YYYY-MM-DD stringini yerel saatte Date objesine çevirmeli', () => {
      const date = parseDayKey('2026-08-08');
      assert.equal(date.getFullYear(), 2026);
      assert.equal(date.getMonth(), 7); // Ağustos
      assert.equal(date.getDate(), 8);
    });
  });

  describe('isDayKey()', () => {
    it('geçerli tarih formatlarını doğrulamalı', () => {
      assert.equal(isDayKey('2026-08-08'), true);
      assert.equal(isDayKey('2026-12-31'), true);
      assert.equal(isDayKey('2026-8-8'), false);
      assert.equal(isDayKey('invalid'), false);
      assert.equal(isDayKey('2026/08/08'), false);
    });
  });

  describe('addDays()', () => {
    it('tarih anahtarına gün eklemeli', () => {
      assert.equal(addDays('2026-08-08', 2), '2026-08-10');
    });

    it('ay sınırlarını düzgün geçmeli', () => {
      assert.equal(addDays('2026-08-31', 1), '2026-09-01');
      assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    });

    it('negatif günleri çıkarabilmeli', () => {
      assert.equal(addDays('2026-08-01', -1), '2026-07-31');
    });

    it('yıl sınırlarını düzgün geçmeli', () => {
      assert.equal(addDays('2026-12-31', 1), '2027-01-01');
      assert.equal(addDays('2027-01-01', -1), '2026-12-31');
    });
  });

  describe('diffDays()', () => {
    it('iki tarih arasındaki gün farkını bulmalı', () => {
      assert.equal(diffDays('2026-08-10', '2026-08-08'), 2);
      assert.equal(diffDays('2026-08-08', '2026-08-10'), -2);
      assert.equal(diffDays('2026-08-08', '2026-08-08'), 0);
    });
  });

  describe('rangeKeys()', () => {
    it('başlangıç ve bitiş arasındaki gün anahtarlarını üretmeli', () => {
      const keys = rangeKeys('2026-08-08', '2026-08-10');
      assert.deepEqual(keys, ['2026-08-08', '2026-08-09', '2026-08-10']);
    });
    
    it('ters aralıklar için boş dizi dönmeli veya doğru işlemeli', () => {
      const keys = rangeKeys('2026-08-10', '2026-08-08');
      assert.deepEqual(keys, []); // Uygulama boş dönüyorsa
    });
  });

  describe('lastNDays()', () => {
    it('belirtilen günden geriye doğru N günü üretmeli', () => {
      const keys = lastNDays(3, '2026-08-10');
      assert.deepEqual(keys, ['2026-08-08', '2026-08-09', '2026-08-10']);
    });
  });

  describe('startOfWeek()', () => {
    it('verilen tarihin pazartesi gününü bulmalı', () => {
      assert.equal(startOfWeek('2026-08-08'), '2026-08-03'); // Cumartesi -> Pazartesi
      assert.equal(startOfWeek('2026-08-09'), '2026-08-03'); // Pazar -> Pazartesi
      assert.equal(startOfWeek('2026-08-03'), '2026-08-03'); // Pazartesi
    });
  });

  describe('relativeDayLabel()', () => {
    it('referans tarihine göre göreceli etiketler üretmeli', () => {
      assert.equal(relativeDayLabel('2026-08-08', '2026-08-08'), 'Bugün');
      assert.equal(relativeDayLabel('2026-08-09', '2026-08-08'), 'Yarın');
      assert.equal(relativeDayLabel('2026-08-07', '2026-08-08'), 'Dün');
    });
  });
});
