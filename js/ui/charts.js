// Elle uretilen SVG grafikler. Hicbir grafik kutuphanesi kullanilmaz.
//
// Hepsi viewBox ile olceklenir, yani telefonda genislige gore buyur/kucultur.
// Renkler CSS degiskenlerinden gelir; SVG sunum niteligi var() desteklemedigi icin
// renkler CSS sinifi veya style uzerinden verilir.

import { el, svgEl } from './dom.js';

const W = 320;

/** Ust sinir icin yuvarlak bir deger secer (60, 120, 180 ... gibi). */
function niceCeiling(value, unitStep = 30) {
  if (!Number.isFinite(value) || value <= 0) return unitStep;
  return Math.ceil(value / unitStep) * unitStep;
}

/**
 * Dikey cubuk grafik.
 * options: { items: [{ label, value, hint }], goal, formatValue, height, unitStep, emptyText }
 */
export function barChart({
  items = [],
  goal = 0,
  formatValue = (v) => String(v),
  height = 118,
  unitStep = 30,
  onSelect,
} = {}) {
  const wrap = el('div');
  if (items.length === 0) {
    wrap.appendChild(emptyBox('Grafik için yeterli kayıt yok'));
    return wrap;
  }

  const padTop = 12;
  const padBottom = 20;
  const padX = 2;
  const plotHeight = height - padTop - padBottom;
  const maxValue = Math.max(niceCeiling(Math.max(...items.map((i) => i.value), goal), unitStep), unitStep);
  const step = (W - padX * 2) / items.length;
  const barWidth = Math.max(3, Math.min(26, step - Math.max(1.5, step * 0.22)));
  const radius = Math.min(4, barWidth / 2);

  const svg = svgEl('svg', {
    class: 'chart',
    viewBox: `0 0 ${W} ${height}`,
    role: 'img',
    'aria-label': 'Günlük çalışma süresi grafiği',
  });

  // Taban cizgisi ve orta izgara
  const baseline = padTop + plotHeight;
  svg.appendChild(svgEl('line', { class: 'chart-grid', x1: 0, y1: baseline + 0.5, x2: W, y2: baseline + 0.5 }));
  svg.appendChild(
    svgEl('line', {
      class: 'chart-grid',
      x1: 0,
      y1: padTop + plotHeight / 2,
      x2: W,
      y2: padTop + plotHeight / 2,
      'stroke-dasharray': '2 4',
    }),
  );

  if (goal > 0 && goal <= maxValue) {
    const y = padTop + plotHeight - (goal / maxValue) * plotHeight;
    svg.appendChild(svgEl('line', { class: 'chart-goal', x1: 0, y1: y, x2: W, y2: y }));
  }

  const tip = el('p', { class: 'chart-tip' });
  const bars = [];

  const select = (index) => {
    bars.forEach((bar, i) => bar.classList.toggle('is-selected', i === index));
    const item = items[index];
    tip.textContent = item ? `${item.label} · ${formatValue(item.value)}${item.hint ? ` · ${item.hint}` : ''}` : '';
    onSelect?.(item, index);
  };

  items.forEach((item, index) => {
    const x = padX + index * step + (step - barWidth) / 2;
    const ratio = maxValue > 0 ? item.value / maxValue : 0;
    const barHeight = item.value > 0 ? Math.max(2.5, ratio * plotHeight) : 2;
    const y = baseline - barHeight;

    const group = svgEl('g', { style: 'cursor:pointer' });
    // Genis dokunma alani
    group.appendChild(
      svgEl('rect', {
        x: padX + index * step,
        y: 0,
        width: step,
        height,
        fill: 'transparent',
      }),
    );
    const bar = svgEl('rect', {
      class: `chart-bar${item.value > 0 ? '' : ' is-empty'}`,
      x,
      y,
      width: barWidth,
      height: barHeight,
      rx: radius,
    });
    if (item.color) bar.style.fill = item.color;
    group.appendChild(bar);
    group.addEventListener('pointerdown', () => select(index));
    bars.push(bar);
    svg.appendChild(group);
  });

  // Alt etiketler: kalabalik olmasin diye araliklarla yazilir.
  const labelEvery = items.length <= 8 ? 1 : items.length <= 16 ? 2 : Math.ceil(items.length / 6);
  items.forEach((item, index) => {
    if (index % labelEvery !== 0 && index !== items.length - 1) return;
    svg.appendChild(
      svgEl('text', {
        class: 'chart-label',
        x: padX + index * step + step / 2,
        y: height - 6,
        'text-anchor': 'middle',
        text: item.shortLabel || item.label,
      }),
    );
  });

  wrap.appendChild(svg);
  wrap.appendChild(tip);
  // Baslangicta son gunu sec.
  select(items.length - 1);
  return wrap;
}

/**
 * Cizgi grafik. Denemelerde net gelisimi icin.
 * options: { points: [{ label, value }], target, color, formatValue, height }
 */
export function lineChart({
  points = [],
  target = 0,
  color = 'var(--accent)',
  formatValue = (v) => String(v),
  height = 150,
} = {}) {
  const wrap = el('div');
  if (points.length === 0) {
    wrap.appendChild(emptyBox('Henüz deneme kaydı yok'));
    return wrap;
  }

  const padLeft = 28;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 22;
  const plotW = W - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const values = points.map((p) => p.value);
  let maxValue = Math.max(...values, target || 0);
  let minValue = Math.min(...values, 0);
  if (maxValue === minValue) maxValue = minValue + 1;
  const range = maxValue - minValue;
  maxValue += range * 0.12;
  minValue -= range * 0.08;

  const xAt = (index) =>
    points.length === 1 ? padLeft + plotW / 2 : padLeft + (index / (points.length - 1)) * plotW;
  const yAt = (value) => padTop + plotH - ((value - minValue) / (maxValue - minValue)) * plotH;

  const svg = svgEl('svg', {
    class: 'chart',
    viewBox: `0 0 ${W} ${height}`,
    role: 'img',
    'aria-label': 'Deneme net gelişimi',
  });

  // Yatay izgara ve deger etiketleri
  for (let i = 0; i <= 2; i += 1) {
    const value = minValue + ((maxValue - minValue) * i) / 2;
    const y = yAt(value);
    svg.appendChild(
      svgEl('line', { class: 'chart-grid', x1: padLeft, y1: y, x2: W - padRight, y2: y, 'stroke-dasharray': i === 0 ? '' : '2 4' }),
    );
    svg.appendChild(
      svgEl('text', {
        class: 'chart-label',
        x: padLeft - 5,
        y: y + 3,
        'text-anchor': 'end',
        text: formatValue(Math.round(value * 10) / 10),
      }),
    );
  }

  if (target > 0 && target >= minValue && target <= maxValue) {
    const y = yAt(target);
    svg.appendChild(svgEl('line', { class: 'chart-target', x1: padLeft, y1: y, x2: W - padRight, y2: y }));
    svg.appendChild(
      svgEl('text', {
        class: 'chart-label',
        x: W - padRight,
        y: y - 4,
        'text-anchor': 'end',
        style: 'fill: var(--warn)',
        text: `Hedef ${formatValue(target)}`,
      }),
    );
  }

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(' ');

  if (points.length > 1) {
    const area = svgEl('path', {
      class: 'chart-area',
      d: `${path} L${xAt(points.length - 1).toFixed(1)} ${padTop + plotH} L${xAt(0).toFixed(1)} ${padTop + plotH} Z`,
    });
    area.style.fill = color;
    svg.appendChild(area);
  }

  const line = svgEl('path', { class: 'chart-line', d: path });
  line.style.stroke = color;
  svg.appendChild(line);

  const tip = el('p', { class: 'chart-tip' });
  const dots = [];

  const select = (index) => {
    dots.forEach((dot, i) => dot.setAttribute('r', i === index ? 5.5 : 3.6));
    const point = points[index];
    tip.textContent = point ? `${point.label} · ${formatValue(point.value)} net` : '';
  };

  points.forEach((point, index) => {
    const group = svgEl('g', { style: 'cursor:pointer' });
    group.appendChild(
      svgEl('rect', {
        x: xAt(index) - 12,
        y: 0,
        width: 24,
        height,
        fill: 'transparent',
      }),
    );
    const dot = svgEl('circle', { class: 'chart-dot', cx: xAt(index), cy: yAt(point.value), r: 3.6 });
    dot.style.fill = color;
    group.appendChild(dot);
    group.addEventListener('pointerdown', () => select(index));
    dots.push(dot);
    svg.appendChild(group);
  });

  // Ilk ve son etiket
  const labelIndexes = points.length <= 4 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  for (const index of labelIndexes) {
    svg.appendChild(
      svgEl('text', {
        class: 'chart-label',
        x: xAt(index),
        y: height - 6,
        'text-anchor': index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle',
        text: points[index].shortLabel || points[index].label,
      }),
    );
  }

  wrap.appendChild(svg);
  wrap.appendChild(tip);
  select(points.length - 1);
  return wrap;
}

/**
 * Yatay cubuklar (ders bazli dagilim). SVG yerine DOM kullanir: metin secilebilir kalir.
 * rows: [{ label, value, color, hint }]
 */
export function horizontalBars({ rows = [], formatValue = (v) => String(v), emptyText } = {}) {
  if (rows.length === 0) return emptyBox(emptyText || 'Kayıt yok');
  const max = Math.max(...rows.map((r) => r.value), 1);
  const list = el('div', { class: 'bar-list' });
  for (const row of rows) {
    const fill = el('i', { class: 'bar-fill' });
    fill.style.width = `${Math.max(2, (row.value / max) * 100)}%`;
    fill.style.background = row.color || 'var(--accent)';
    list.appendChild(
      el(
        'div',
        { class: 'bar-row' },
        el('span', { class: 'bar-label', text: row.label }),
        el('span', { class: 'bar-value', text: formatValue(row.value) + (row.hint ? ` · ${row.hint}` : '') }),
        el('span', { class: 'bar-track' }, fill),
      ),
    );
  }
  return list;
}

/**
 * Halka ilerleme gostergesi.
 * options: { ratio, main, sub, done }
 */
export function ring({ ratio = 0, main = '', sub = '', done = false } = {}) {
  const size = 96;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, ratio));

  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' });
  svg.appendChild(
    svgEl('circle', {
      class: 'ring-track',
      cx: size / 2,
      cy: size / 2,
      r: radius,
      'stroke-width': stroke,
    }),
  );
  const value = svgEl('circle', {
    class: 'ring-value',
    cx: size / 2,
    cy: size / 2,
    r: radius,
    'stroke-width': stroke,
    'stroke-dasharray': circumference.toFixed(2),
    'stroke-dashoffset': (circumference * (1 - clamped)).toFixed(2),
  });
  svg.appendChild(value);

  return el(
    'div',
    { class: `ring${done ? ' is-done' : ''}` },
    svg,
    el('div', { class: 'ring-center' }, el('strong', { text: main }), el('span', { text: sub })),
  );
}

/**
 * 30 gunluk isi haritasi.
 * days: [{ date, ratio, done, total }]
 */
export function heatmap({ days = [], todayKey, labelFor } = {}) {
  const grid = el('div', { class: 'heatmap' });
  for (const day of days) {
    const level = day.ratio <= 0 ? 0 : day.ratio >= 1 ? 4 : Math.max(1, Math.ceil(day.ratio * 4) - 0);
    const cell = el('div', {
      class: `heat-cell${day.date === todayKey ? ' is-today' : ''}`,
      data: { level: Math.min(4, level), date: day.date },
      title: labelFor ? labelFor(day) : `${day.date}: ${day.done}/${day.total}`,
    });
    grid.appendChild(cell);
  }
  return grid;
}

export function emptyBox(text, hint) {
  return el(
    'div',
    { class: 'empty' },
    el('strong', { text }),
    hint ? el('span', { text: hint }) : null,
  );
}
