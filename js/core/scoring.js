// Net hesabi ve puanlama. Tamami saf fonksiyon.
//
// net = dogru - (yanlis / katsayi). Katsayi ayarlardan degistirilebilir, sabit degildir.

export const DEFAULT_PENALTY = 4;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Net hesabi. penalty 0 veya gecersizse yanlislar net goturmez.
 */
export function net(correct, wrong, penalty = DEFAULT_PENALTY) {
  const c = toNumber(correct);
  const w = toNumber(wrong);
  const p = Number(penalty);
  if (!Number.isFinite(p) || p <= 0) return c;
  return c - w / p;
}

/** Netleri 2 basamaga yuvarlar. Kayan nokta artiklarini temizler. */
export function roundNet(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
}

/**
 * Bir deneme sonucu dizisinin toplamlari.
 * results: [{ subjectId, correct, wrong, blank }]
 */
export function examTotals(results, penalty = DEFAULT_PENALTY) {
  const list = Array.isArray(results) ? results : [];
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  for (const r of list) {
    correct += toNumber(r.correct);
    wrong += toNumber(r.wrong);
    blank += toNumber(r.blank);
  }
  return {
    correct,
    wrong,
    blank,
    total: correct + wrong + blank,
    net: roundNet(net(correct, wrong, penalty)),
  };
}

/**
 * Dogruluk orani: dogru / (dogru + yanlis). Hic soru cozulmemisse null.
 */
export function accuracy(correct, wrong) {
  const c = toNumber(correct);
  const w = toNumber(wrong);
  const attempted = c + w;
  if (attempted <= 0) return null;
  return c / attempted;
}

/**
 * Girilen dogru/yanlis/bos degerleri tutarli mi?
 * Sorun varsa Turkce mesaj, sorun yoksa null doner.
 */
export function validateAnswers(answers, questionCount) {
  const c = toNumber(answers?.correct);
  const w = toNumber(answers?.wrong);
  const b = toNumber(answers?.blank);
  if (c < 0 || w < 0 || b < 0) return 'Değerler negatif olamaz.';
  if (!Number.isInteger(c) || !Number.isInteger(w) || !Number.isInteger(b)) {
    return 'Soru sayıları tam sayı olmalı.';
  }
  const sum = c + w + b;
  if (sum === 0) return 'En az bir soru girmelisin.';
  const limit = Number(questionCount);
  if (Number.isFinite(limit) && limit > 0 && sum > limit) {
    return `Toplam ${sum} soru girdin, bu dersin soru sayısı ${limit}.`;
  }
  return null;
}

/**
 * Hedefe gore ilerleme orani. 0 ile 1 arasi kirpilmis deger ve ham oran birlikte doner.
 */
export function targetProgress(value, target) {
  const t = toNumber(target);
  if (t <= 0) return { ratio: 0, clamped: 0 };
  const ratio = toNumber(value) / t;
  return { ratio, clamped: Math.max(0, Math.min(1, ratio)) };
}
