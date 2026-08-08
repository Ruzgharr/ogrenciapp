// Dokunma hareketleri: kaydirma (swipe) ve uzun basma.
//
// Dikey kaydirmayla kavga etmemesi icin yatay surukleme ancak yatay hareket dikeyden
// belirgin sekilde buyukse baslar. Baslamadan once liste normal sekilde kaydirilir.

import { el } from './dom.js';
import * as haptics from '../platform/haptics.js';

const DECIDE_THRESHOLD = 10; // px, yon karari
const ACTION_RATIO = 0.32; // genisligin bu kadari gecilirse islem tetiklenir
const ACTION_MIN = 72; // px, kucuk ekranlarda alt sinir
const LONG_PRESS_MS = 480;

/**
 * Kaydirilabilir liste ogesi olusturur.
 *
 * item: .item sinifli eleman
 * right: parmak SAGA kayarken gorunen islem (varsayilan tamamla)
 * left: parmak SOLA kayarken gorunen islem (varsayilan sil)
 */
export function swipeItem(item, { right, left } = {}) {
  const wrap = el('li', { class: 'item-wrap' });
  if (right) wrap.appendChild(el('div', { class: 'item-bg item-bg-left', text: right.label }));
  if (left) wrap.appendChild(el('div', { class: 'item-bg item-bg-right', text: left.label }));
  wrap.appendChild(item);

  let startX = 0;
  let startY = 0;
  let decided = null; // null | 'horizontal' | 'vertical'
  let pointerId = null;
  let dx = 0;

  const threshold = () => Math.max(ACTION_MIN, wrap.offsetWidth * ACTION_RATIO);

  const setOffset = (value) => {
    item.style.transform = value === 0 ? '' : `translateX(${value}px)`;
  };

  const clearState = () => {
    item.classList.remove('is-dragging');
    dx = 0;
    decided = null;
    pointerId = null;
  };

  const reset = (animate = true) => {
    if (animate) {
      item.classList.add('is-settling');
      setTimeout(() => item.classList.remove('is-settling'), 200);
    }
    setOffset(0);
    clearState();
  };

  item.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      startX = event.clientX;
      startY = event.clientY;
      decided = null;
      pointerId = event.pointerId;
      dx = 0;
    },
    { passive: true },
  );

  item.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    const moveX = event.clientX - startX;
    const moveY = event.clientY - startY;

    if (decided === null) {
      if (Math.abs(moveY) > DECIDE_THRESHOLD && Math.abs(moveY) > Math.abs(moveX)) {
        decided = 'vertical';
        return;
      }
      if (Math.abs(moveX) > DECIDE_THRESHOLD) {
        decided = 'horizontal';
        item.classList.add('is-dragging');
        item.classList.remove('is-settling');
        try {
          item.setPointerCapture(event.pointerId);
        } catch {
          /* yoksay */
        }
      } else {
        return;
      }
    }
    if (decided !== 'horizontal') return;

    event.preventDefault();
    // Islem yonu tanimli degilse o tarafa direnc uygula.
    let value = moveX;
    if ((value > 0 && !right) || (value < 0 && !left)) value = moveX * 0.18;
    else if (Math.abs(value) > threshold()) {
      const extra = Math.abs(value) - threshold();
      value = Math.sign(value) * (threshold() + extra * 0.35);
    }
    dx = value;
    setOffset(value);
  });

  const finish = (event) => {
    if (pointerId !== event.pointerId) return;
    if (decided !== 'horizontal') {
      reset(false);
      return;
    }
    const limit = threshold();
    if (dx > limit && right) {
      commit(item, wrap, 'right', right, clearState);
    } else if (dx < -limit && left) {
      commit(item, wrap, 'left', left, clearState);
    } else {
      reset(true);
    }
  };

  item.addEventListener('pointerup', finish);
  item.addEventListener('pointercancel', () => reset(true));

  return wrap;
}

function commit(item, wrap, direction, action, clearState) {
  haptics.success();
  clearState();
  item.classList.add('is-settling');

  if (action.keepItem) {
    // Tamamlama gibi ogeyi listede birakan islemler: yerine geri kayar, islem hemen calisir.
    item.style.transform = '';
    setTimeout(() => item.classList.remove('is-settling'), 200);
    action.onAction?.();
    return;
  }

  // Silme gibi ogeyi kaldiran islemler: ekrandan dogru yone kayarak cikar.
  wrap.style.setProperty('--item-h', `${wrap.offsetHeight}px`);
  item.style.transform = `translateX(${direction === 'right' ? '110%' : '-110%'})`;
  setTimeout(() => action.onAction?.(), 150);
}

/**
 * Uzun basma. Tetiklendikten sonra ayni dokunustan gelen click bastirilir.
 */
export function longPress(node, handler, { ms = LONG_PRESS_MS } = {}) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  let fired = false;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    node.classList.remove('is-pressing');
  };

  node.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      fired = false;
      startX = event.clientX;
      startY = event.clientY;
      node.classList.add('is-pressing');
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        node.classList.remove('is-pressing');
        haptics.success();
        handler(event);
      }, ms);
    },
    { passive: true },
  );

  node.addEventListener(
    'pointermove',
    (event) => {
      if (!timer) return;
      if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) cancel();
    },
    { passive: true },
  );

  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('pointerleave', cancel);

  node.addEventListener('click', (event) => {
    if (fired) {
      event.preventDefault();
      event.stopPropagation();
      fired = false;
    }
  });

  node.addEventListener('contextmenu', (event) => event.preventDefault());
  return () => cancel();
}
