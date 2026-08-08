// Alt sayfa (bottom sheet): form ve menuler icin.
// Ekranin altindan yukselir, parmakla asagi cekilerek veya arka plana dokunularak kapanir.

import { el, icon } from './dom.js';
import { prefersReducedMotion } from '../util.js';

let openCount = 0;

function sheetRoot() {
  return document.getElementById('sheet-root');
}

/**
 * Alt sayfa acar.
 * options: { title, subtitle, body (Node|Node[]), actions (Node[]), onClose, autofocus }
 * Donus: { close, panel }
 */
export function openSheet({ title, subtitle, body, actions, onClose, autofocus = false } = {}) {
  const previousFocus = document.activeElement;
  const overlay = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const backdrop = el('div', { class: 'sheet-backdrop' });
  const panel = el('div', { class: 'sheet-panel' });

  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    openCount = Math.max(0, openCount - 1);
    overlay.classList.remove('is-open');
    const remove = () => {
      overlay.remove();
      if (previousFocus instanceof HTMLElement) {
        try {
          previousFocus.focus({ preventScroll: true });
        } catch {
          /* yoksay */
        }
      }
      if (typeof onClose === 'function') onClose();
    };
    if (prefersReducedMotion()) remove();
    else setTimeout(remove, 220);
  };

  backdrop.addEventListener('click', close);

  const grab = el('div', { class: 'sheet-grab' });
  panel.appendChild(grab);

  if (title) {
    panel.appendChild(
      el(
        'div',
        { class: 'sheet-head' },
        el(
          'div',
          {},
          el('h2', { text: title }),
          subtitle ? el('p', { class: 'note', text: subtitle }) : null,
        ),
        el(
          'button',
          {
            class: 'btn-icon btn',
            type: 'button',
            'aria-label': 'Kapat',
            on: { click: close },
          },
          icon('x', 20),
        ),
      ),
    );
  }

  const bodyWrap = el('div', { class: 'sheet-body' });
  if (body) {
    for (const child of [body].flat()) {
      if (child) bodyWrap.appendChild(child);
    }
  }
  panel.appendChild(bodyWrap);

  if (actions && actions.length) {
    const actionRow = el('div', { class: 'sheet-actions' });
    for (const action of actions.flat()) if (action) actionRow.appendChild(action);
    panel.appendChild(actionRow);
  }

  overlay.appendChild(backdrop);
  overlay.appendChild(panel);
  sheetRoot().appendChild(overlay);
  openCount += 1;

  attachDragToClose(panel, close);

  // Gecis animasyonunun tetiklenmesi icin bir kare bekle.
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };
  overlay.addEventListener('keydown', onKeyDown);
  document.addEventListener('keydown', onKeyDown);
  overlay.addEventListener('remove', () => document.removeEventListener('keydown', onKeyDown));

  if (autofocus) {
    const target = panel.querySelector('input, textarea, select, button');
    if (target) setTimeout(() => target.focus({ preventScroll: true }), 220);
  }

  return { close, panel, body: bodyWrap };
}

/** Panelin ust kismindan asagi cekerek kapatma. */
function attachDragToClose(panel, close) {
  let startY = 0;
  let dragging = false;
  let moved = 0;

  panel.addEventListener(
    'pointerdown',
    (event) => {
      // Sadece panelin ust 56 pikselinden baslayan hareketler kapatir; icerik kaydirmasini bozmaz.
      const rect = panel.getBoundingClientRect();
      if (event.clientY - rect.top > 56) return;
      startY = event.clientY;
      dragging = true;
      moved = 0;
      panel.style.transition = 'none';
    },
    { passive: true },
  );

  panel.addEventListener(
    'pointermove',
    (event) => {
      if (!dragging) return;
      moved = Math.max(0, event.clientY - startY);
      panel.style.transform = `translateY(${moved}px)`;
    },
    { passive: true },
  );

  const end = () => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';
    if (moved > 90) {
      panel.style.transform = 'translateY(100%)';
      close();
    } else {
      panel.style.transform = '';
    }
  };

  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
}

/**
 * Uzun basma menusu.
 * items: [{ label, iconName, danger, onSelect }]
 */
export function openMenu(title, items) {
  const list = el('div', { class: 'menu-list' });
  const sheet = openSheet({ title, body: list });
  for (const item of items) {
    if (!item) continue;
    list.appendChild(
      el(
        'button',
        {
          class: `menu-item${item.danger ? ' is-danger' : ''}`,
          type: 'button',
          on: {
            click: () => {
              sheet.close();
              // Kapanma animasyonuyla cakismasin diye bir kare bekle.
              requestAnimationFrame(() => item.onSelect?.());
            },
          },
        },
        item.iconName ? icon(item.iconName, 19) : null,
        el('span', { text: item.label }),
      ),
    );
  }
  return sheet;
}

/**
 * Basili tutarak onaylama. Yalnizca geri alinamayan tek islem icin kullanilir:
 * tum verileri silme. Normal silmelerde onay sorulmaz, geri alma seridi vardir.
 */
export function holdToConfirmButton({ label = 'Basılı tut', holdMs = 1600, onConfirm }) {
  const button = el('button', { class: 'btn btn-danger btn-block', type: 'button' });
  const fill = el('i', {
    style: {
      position: 'absolute',
      left: '0',
      top: '0',
      bottom: '0',
      width: '0%',
      background: 'var(--danger)',
      opacity: '0.35',
      transition: 'width linear',
      pointerEvents: 'none',
    },
  });
  button.style.position = 'relative';
  button.style.overflow = 'hidden';
  button.appendChild(el('span', { text: label, style: { position: 'relative', zIndex: '1' } }));
  button.appendChild(fill);

  let timer = null;

  const start = () => {
    fill.style.transitionDuration = `${holdMs}ms`;
    fill.style.width = '100%';
    timer = setTimeout(() => {
      timer = null;
      fill.style.transitionDuration = '0ms';
      fill.style.width = '0%';
      onConfirm?.();
    }, holdMs);
  };

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    fill.style.transitionDuration = '150ms';
    fill.style.width = '0%';
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', cancel);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('pointerleave', cancel);
  return button;
}

export function isSheetOpen() {
  return openCount > 0;
}
