import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  net,
  roundNet,
  examTotals,
  accuracy,
  validateAnswers,
  targetProgress,
  DEFAULT_PENALTY
} from '../js/core/scoring.js';

describe('Scoring Module (Puanlama Modülü)', () => {
  describe('net()', () => {
    it('doğru ve yanlış değerlerinden net hesaplamalı', () => {
      assert.equal(net(10, 4), 9);
      assert.equal(net(10, 0), 10);
      assert.equal(net(0, 4), -1);
    });

    it('özel ceza oranlarını desteklemeli', () => {
      assert.equal(net(10, 3, 3), 9);
      assert.equal(net(10, 4, 0), 10); // Ceza yok
    });

    it('negatif veya sıfır değerleri düzgün yönetmeli', () => {
      assert.equal(net(0, 0), 0);
      assert.equal(net(-5, 0), -5);
    });
    
    it('varsayılan ceza katsayısını (DEFAULT_PENALTY) doğru uygulamalı', () => {
      assert.equal(net(10, DEFAULT_PENALTY), 9);
    });
  });

  describe('roundNet()', () => {
    it('net değerini belirtilen basamağa yuvarlamalı', () => {
      assert.equal(roundNet(9.1234), 9.12);
      assert.equal(roundNet(9.125, 2), 9.13);
      assert.equal(roundNet(9.1234, 3), 9.123);
      assert.equal(roundNet(9, 2), 9);
    });
  });

  describe('examTotals()', () => {
    it('sınav sonuçlarının toplamını doğru hesaplamalı', () => {
      const results = [
        { correct: 10, wrong: 4, blank: 1 },
        { correct: 20, wrong: 8, blank: 2 }
      ];
      const expected = { correct: 30, wrong: 12, blank: 3, total: 45, net: 27 };
      assert.deepEqual(examTotals(results), expected);
    });

    it('boş dizi için sıfırlanmış toplam dönmeli', () => {
      const expected = { correct: 0, wrong: 0, blank: 0, total: 0, net: 0 };
      assert.deepEqual(examTotals([]), expected);
    });
  });

  describe('accuracy()', () => {
    it('doğru ve yanlış sayılarından başarı oranını bulmalı', () => {
      assert.equal(accuracy(10, 10), 0.5);
      assert.equal(accuracy(20, 0), 1);
      assert.equal(accuracy(0, 10), 0);
    });

    it('doğru ve yanlış sıfırsa null dönmeli', () => {
      assert.equal(accuracy(0, 0), null);
    });
  });

  describe('validateAnswers()', () => {
    it('toplam soru sayısını aşan cevaplar için hata dönmeli', () => {
      assert.equal(typeof validateAnswers({ correct: 10, wrong: 5, blank: 0 }, 10), 'string');
    });

    it('geçerli cevaplar için null dönmeli', () => {
      assert.equal(validateAnswers({ correct: 5, wrong: 5, blank: 0 }, 10), null);
    });

    it('negatif değerler için hata dönmeli', () => {
      assert.equal(typeof validateAnswers({ correct: -1, wrong: 5, blank: 0 }, 10), 'string');
    });
  });

  describe('targetProgress()', () => {
    it('ilerleme oranını ve kısıtlanmış değerini hesaplamalı', () => {
      assert.deepEqual(targetProgress(50, 100), { ratio: 0.5, clamped: 0.5 });
      assert.deepEqual(targetProgress(150, 100), { ratio: 1.5, clamped: 1 });
      assert.deepEqual(targetProgress(0, 100), { ratio: 0, clamped: 0 });
    });
  });
});
