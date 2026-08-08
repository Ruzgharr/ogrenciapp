// Alt serit: kisa bilgi mesajlari ve "Geri al" seridi.
//
// Silme islemlerinde "Emin misiniz?" sorulmaz. Kayit hemen silinir, altta 5 saniyelik
// geri alma seridi gosterilir.

import { el } from './dom.js';

const MAX_VISIBLE = 3;

function root() {
  return document.getElementById('snack-root');
}

function push(node) {
  const container = root();
  if (!container) return;
  container.appendChild(node);
  while (container.children.length > MAX_VISIBLE) {
    dismiss(container.firstElementChild);
  }
}

function dismiss(node) {
  if (!node || node.dataset.leaving === '1') return;
  node.dataset.leaving = '1';
  node.classList.add('is-leaving');
  const remove = () => node.remove();
  node.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 400);
}

/**
 * Kisa bilgi mesaji.
 * kind: 'info' | 'success' | 'error'
 */
export function toast(message, { kind = 'info', duration = 2600, actionLabel, onAction } = {}) {
  const node = el('div', { class: `snack${kind === 'error' ? ' is-error' : kind === 'success' ? ' is-success' : ''}` });
  node.appendChild(el('div', { class: 'snack-text', text: message }));
  if (actionLabel && onAction) {
    node.appendChild(
      el('button', {
        class: 'snack-action',
        type: 'button',
        text: actionLabel,
        on: {
          click: () => {
            dismiss(node);
            onAction();
          },
        },
      }),
    );
  }
  push(node);
  if (duration > 0) setTimeout(() => dismiss(node), duration);
  return { close: () => dismiss(node) };
}

export function error(message) {
  return toast(message, { kind: 'error', duration: 5200 });
}

export function success(message) {
  return toast(message, { kind: 'success' });
}

/**
 * Geri alma seridi. Sure dolunca onExpire cagrilir (kalici silme burada yapilir).
 */
export function undoBar(message, { onUndo, onExpire, duration = 5000 } = {}) {
  let settled = false;
  const node = el('div', { class: 'snack' });
  node.appendChild(el('div', { class: 'snack-text', text: message }));

  const button = el('button', { class: 'snack-action', type: 'button', text: 'Geri al' });
  node.appendChild(button);

  const bar = el('i', { class: 'snack-timer' });
  bar.style.animationDuration = `${duration}ms`;
  node.appendChild(bar);

  const timeoutId = setTimeout(() => {
    if (settled) return;
    settled = true;
    dismiss(node);
    if (typeof onExpire === 'function') onExpire();
  }, duration);

  button.addEventListener('click', () => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    dismiss(node);
    if (typeof onUndo === 'function') onUndo();
  });

  push(node);
  return {
    close: () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      dismiss(node);
      if (typeof onExpire === 'function') onExpire();
    },
  };
}

/** Yeni surum hazir bildirimi (service worker guncellemesi). */
export function updateReady(onReload) {
  return toast('Uygulamanın yeni sürümü hazır.', {
    duration: 12000,
    actionLabel: 'Yenile',
    onAction: onReload,
  });
}
