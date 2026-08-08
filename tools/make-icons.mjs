// PWA ikonlarini uretir. Hicbir paket kurulmaz: PNG kodlayici Node'un yerlesik
// zlib modulu ile elle yazilmistir.
//
// Kullanim:  node tools/make-icons.mjs
// Cikti:     icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
//
// Ikon tasarimi: koyu zemin, mavi ilerleme halkasi, icinde yukselen uc cubuk.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, '..', 'icons');

// ---------------------------------------------------------------- PNG kodlayici

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(buffer) {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (const byte of buffer) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit derinligi
  ihdr[9] = 6; // renk turu: RGBA
  ihdr[10] = 0; // sikistirma
  ihdr[11] = 0; // filtre
  ihdr[12] = 0; // interlace yok

  // Her satirin basina filtre baytini (0) koy.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- kucuk cizim motoru

function createCanvas(size) {
  return { size, data: new Float64Array(size * size * 4) };
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** sdf(x, y) < 0 ise ic taraf. color: [r,g,b] veya (x,y) => [r,g,b], alpha ayri. */
function fillShape(canvas, sdf, color, alpha = 1) {
  const { size, data } = canvas;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = sdf(x + 0.5, y + 0.5);
      const coverage = clamp01(0.5 - distance) * alpha;
      if (coverage <= 0) continue;
      const [r, g, b] = typeof color === 'function' ? color(x + 0.5, y + 0.5) : color;
      const index = (y * size + x) * 4;
      const srcA = coverage;
      const dstA = data[index + 3];
      const outA = srcA + dstA * (1 - srcA);
      if (outA <= 0) continue;
      data[index] = (r * srcA + data[index] * dstA * (1 - srcA)) / outA;
      data[index + 1] = (g * srcA + data[index + 1] * dstA * (1 - srcA)) / outA;
      data[index + 2] = (b * srcA + data[index + 2] * dstA * (1 - srcA)) / outA;
      data[index + 3] = outA;
    }
  }
}

function toBuffer(canvas) {
  const { size, data } = canvas;
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    out[i * 4] = Math.round(clamp01(data[i * 4] / 255) * 255);
    out[i * 4 + 1] = Math.round(clamp01(data[i * 4 + 1] / 255) * 255);
    out[i * 4 + 2] = Math.round(clamp01(data[i * 4 + 2] / 255) * 255);
    out[i * 4 + 3] = Math.round(clamp01(data[i * 4 + 3]) * 255);
  }
  return out;
}

function roundedRect(cx, cy, halfW, halfH, radius) {
  return (x, y) => {
    const dx = Math.abs(x - cx) - (halfW - radius);
    const dy = Math.abs(y - cy) - (halfH - radius);
    const ax = Math.max(dx, 0);
    const ay = Math.max(dy, 0);
    return Math.min(Math.max(dx, dy), 0) + Math.hypot(ax, ay) - radius;
  };
}

function circle(cx, cy, radius) {
  return (x, y) => Math.hypot(x - cx, y - cy) - radius;
}

/**
 * Halka yayi. startAngle ve endAngle derece, saat yonunde, 0 = saat 3 yonu.
 * Ucu yuvarlatmak icin uclara ayrica daire eklenir.
 */
function arc(cx, cy, radius, thickness, startAngle, endAngle) {
  const half = thickness / 2;
  const start = (startAngle * Math.PI) / 180;
  const end = (endAngle * Math.PI) / 180;
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const ringDistance = Math.abs(Math.hypot(dx, dy) - radius) - half;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    let normalized = angle;
    let from = start;
    let to = end;
    if (to < from) to += Math.PI * 2;
    if (normalized < from) normalized += Math.PI * 2;
    const inside = normalized >= from && normalized <= to;
    if (inside) return ringDistance;
    // Yay disinda: yuvarlak uclara olan uzaklik
    const capA = circle(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius, half);
    const capB = circle(cx + Math.cos(end) * radius, cy + Math.sin(end) * radius, half);
    return Math.min(capA(x, y), capB(x, y));
  };
}

// ---------------------------------------------------------------- ikon cizimi

const ACCENT = [109, 143, 255];
const LIGHT = [232, 236, 244];
const BG_TOP = [26, 32, 51];
const BG_BOTTOM = [11, 13, 18];

function drawIcon({ size, cornerRatio, contentScale }) {
  const canvas = createCanvas(size);

  const gradient = (x, y) => {
    const t = clamp01(y / size);
    return [
      BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t,
      BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t,
      BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t,
    ];
  };

  const radius = size * cornerRatio;
  fillShape(canvas, roundedRect(size / 2, size / 2, size / 2, size / 2, radius), gradient);

  const center = size / 2;
  const ringRadius = size * 0.325 * contentScale;
  const ringThickness = size * 0.075 * contentScale;

  // Soluk tam halka (izleyici hattı)
  fillShape(canvas, arc(center, center, ringRadius, ringThickness, 0, 359.9), LIGHT, 0.13);
  // Ilerleme yayi: saat 9 yonunden baslayip saatin tersi hissi veren genis bir yay.
  fillShape(canvas, arc(center, center, ringRadius, ringThickness, 130, 50), ACCENT, 1);

  // Icteki yukselen cubuklar
  const barWidth = size * 0.058 * contentScale;
  const gap = size * 0.038 * contentScale;
  const baseline = center + size * 0.13 * contentScale;
  const heights = [0.11, 0.175, 0.245].map((value) => size * value * contentScale);
  const totalWidth = barWidth * 3 + gap * 2;
  let x = center - totalWidth / 2 + barWidth / 2;
  for (const height of heights) {
    fillShape(
      canvas,
      roundedRect(x, baseline - height / 2, barWidth / 2, height / 2, barWidth / 2.6),
      LIGHT,
    );
    x += barWidth + gap;
  }

  return canvas;
}

function write(name, canvas) {
  const png = encodePng(canvas.size, canvas.size, toBuffer(canvas));
  const path = join(iconsDir, name);
  writeFileSync(path, png);
  console.log(`${name} yazıldı (${(png.length / 1024).toFixed(1)} KB)`);
}

mkdirSync(iconsDir, { recursive: true });

write('icon-192.png', drawIcon({ size: 192, cornerRatio: 0.22, contentScale: 1 }));
write('icon-512.png', drawIcon({ size: 512, cornerRatio: 0.22, contentScale: 1 }));
// Maskable: zemin tum tuvali kaplar, icerik guvenli alanda kalir (%80 daire).
write('maskable-512.png', drawIcon({ size: 512, cornerRatio: 0, contentScale: 0.72 }));
write('apple-touch-icon.png', drawIcon({ size: 180, cornerRatio: 0, contentScale: 0.86 }));
