// Kucuk DOM yardimcilari.
//
// innerHTML kullanilmaz: kullanicinin girdigi metinler (gorev basligi, not, konu)
// dogrudan textContent ile yazilir, boylece HTML enjeksiyonu mumkun olmaz.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Eleman olusturur.
 * el('div', { class: 'card', text: 'Merhaba', on: { click: fn } }, cocuk1, cocuk2)
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  applyProps(node, props);
  append(node, children);
  return node;
}

export function svgEl(tag, props = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (key === 'class') node.setAttribute('class', value);
    else if (key === 'text') node.textContent = value;
    else if (key === 'on') attachListeners(node, value);
    else if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(key, value);
    }
  }
  append(node, children);
  return node;
}

function applyProps(node, props) {
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') {
      if (typeof value === 'string') node.setAttribute('style', value);
      else Object.assign(node.style, value);
    } else if (key === 'data') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        if (dataValue !== undefined && dataValue !== null) node.dataset[dataKey] = dataValue;
      }
    } else if (key === 'on') {
      attachListeners(node, value);
    } else if (key === 'hidden' || key === 'disabled' || key === 'checked' || key === 'readOnly') {
      if (value) node.setAttribute(key.toLowerCase(), '');
      else node.removeAttribute(key.toLowerCase());
    } else if (key === 'value') {
      node.value = value;
    } else {
      node.setAttribute(key, value);
    }
  }
}

function attachListeners(node, listeners) {
  for (const [event, handler] of Object.entries(listeners || {})) {
    if (typeof handler === 'function') node.addEventListener(event, handler);
    else if (handler) node.addEventListener(event, handler.handler, handler.options);
  }
}

function append(node, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function frag(...children) {
  const fragment = document.createDocumentFragment();
  append(fragment, children);
  return fragment;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Cocuklari tek seferde degistirir (kismi yenileme yerine bolum yenileme). */
export function replaceChildren(node, ...children) {
  clear(node);
  append(node, children);
  return node;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/** Liste ogesini yumusak sekilde kaldirir (yukseklik olculup animasyonla kapanir). */
export function collapseRemove(node, done) {
  if (!node) return;
  node.style.setProperty('--item-h', `${node.offsetHeight}px`);
  node.classList.add('is-leaving');
  const finish = () => {
    node.remove();
    if (typeof done === 'function') done();
  };
  node.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 400);
}

/** Yeni eklenen ogeye kisa giris animasyonu verir. */
export function animateIn(node) {
  if (!node) return node;
  node.classList.add('is-entering');
  node.addEventListener('animationend', () => node.classList.remove('is-entering'), { once: true });
  return node;
}

// ---------------------------------------------------------------- ikonlar

const ICON_PATHS = {
  play: ['M8 5.5v13l11-6.5z'],
  pause: ['M9 5.5v13M15 5.5v13'],
  stop: ['M6.5 6.5h11v11h-11z'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M4.5 12.5l5 5 10-11'],
  trash: ['M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13'],
  edit: ['M4.5 19.5h4l10-10-4-4-10 10z', 'M14.5 5.5l4 4'],
  clock: ['M12 7.5V12l3 1.8'],
  calendar: ['M4.5 8.5h15M7.5 4.5v3M16.5 4.5v3', 'M4.5 6.5h15v13h-15z'],
  target: ['M12 3v3M12 18v3M3 12h3M18 12h3'],
  book: ['M5 5.5h6.5v13H5zM12.5 5.5H19v13h-6.5z'],
  download: ['M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14'],
  upload: ['M12 15.5v-11M7.5 9l4.5-4.5L16.5 9M5 19.5h14'],
  share: ['M12 15.5v-11M8 8l4-4 4 4', 'M5 13v6.5h14V13'],
  x: ['M6 6l12 12M18 6L6 18'],
  chevronRight: ['M9.5 5.5l7 6.5-7 6.5'],
  chevronDown: ['M5.5 9.5l6.5 7 6.5-7'],
  flame: ['M12 3.5c3 3.5 5.5 5.5 5.5 9a5.5 5.5 0 0 1-11 0c0-2 1-3.5 2.5-5 .3 1.5 1 2.5 2 2.5 1.2 0 1.8-1.4 1-6.5z'],
  skip: ['M6 5.5l8 6.5-8 6.5zM17 5.5v13'],
  more: ['M12 6.5v.01M12 12v.01M12 17.5v.01'],
  note: ['M6 4.5h9l3 3v12H6z', 'M9 11h6M9 14.5h4'],
  chart: ['M4 19.5h16M7.5 19.5v-5M12 19.5v-11M16.5 19.5v-8'],
  refresh: ['M19 12a7 7 0 1 1-2-4.9', 'M19 4v4h-4'],
  bell: ['M8 10a4 4 0 0 1 8 0c0 4 1.5 5.5 1.5 5.5h-11S8 14 8 10z', 'M10.5 18.5a1.7 1.7 0 0 0 3 0'],
  sun: ['M12 5.5V4M12 20v-1.5M5.5 12H4M20 12h-1.5M7.3 7.3 6.2 6.2M17.8 17.8l-1.1-1.1M7.3 16.7l-1.1 1.1M17.8 6.2l-1.1 1.1', 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'],
  moon: ['M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z'],
  maximize: ['M8 4.5H4.5V8M16 4.5h3.5V8M8 19.5H4.5V16M16 19.5h3.5V16'],
  minimize: ['M4.5 8h3.5V4.5M19.5 8h-3.5V4.5M4.5 16h3.5v3.5M19.5 16h-3.5v3.5'],
};

const ICON_CIRCLES = {
  clock: [{ cx: 12, cy: 12, r: 8.5 }],
  target: [
    { cx: 12, cy: 12, r: 8.5 },
    { cx: 12, cy: 12, r: 3.5 },
  ],
};

/** Cizgi tabanli ikon. size: px */
export function icon(name, size = 20) {
  const paths = ICON_PATHS[name] || [];
  const circles = ICON_CIRCLES[name] || [];
  const node = svgEl('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  for (const circle of circles) node.appendChild(svgEl('circle', circle));
  for (const d of paths) node.appendChild(svgEl('path', { d }));
  return node;
}

/** Dolgu ikonlari (oynat dugmesi gibi). */
export function iconFilled(name, size = 20) {
  const node = icon(name, size);
  node.setAttribute('fill', 'currentColor');
  node.setAttribute('stroke', 'none');
  return node;
}
