// Gorevler ekrani: ekle, tamamla, sil, onem, son tarih.
// Saga kaydir = tamamla, sola kaydir = sil, uzun bas = menu.

import { el, icon, replaceChildren } from './dom.js';
import { swipeItem, longPress } from './gestures.js';
import { openMenu } from './sheet.js';
import { openTaskSheet } from './sheets/tasks.js';
import { deleteWithUndo } from './records.js';
import { emptyBox } from './charts.js';
import * as store from '../store.js';
import * as snack from './snack.js';
import * as haptics from '../platform/haptics.js';
import { todayKey, relativeDayLabel, formatDayShort } from '../core/dates.js';
import { priorityLabel } from '../core/format.js';

let container = null;
let showCompleted = false;

export function render(root) {
  container = root;
  rebuild();
}

export function onEnter() {}
export function onLeave() {}

function rebuild() {
  if (!container) return;
  const key = todayKey();
  const all = store.tasks();
  const pending = all.filter((task) => !task.done);
  const completed = all
    .filter((task) => task.done)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const groups = [
    { title: 'Gecikmiş', tone: 'bad-text', items: pending.filter((t) => t.dueDate && t.dueDate < key) },
    { title: 'Bugün', tone: 'accent-text', items: pending.filter((t) => t.dueDate === key) },
    { title: 'Yaklaşan', tone: '', items: pending.filter((t) => t.dueDate && t.dueDate > key) },
    { title: 'Tarihsiz', tone: '', items: pending.filter((t) => !t.dueDate) },
  ];

  const children = [buildHeader(pending.length)];

  if (pending.length === 0 && completed.length === 0) {
    children.push(
      emptyBox('Henüz görev yok', 'Alttaki düğmeyle ilk görevini ekle. Örnek: "Türev testi 20 soru".'),
    );
  }

  for (const group of groups) {
    if (group.items.length === 0) continue;
    children.push(buildGroup(group, key));
  }

  if (completed.length > 0) {
    children.push(buildCompleted(completed, key));
  }

  children.push(buildDock());
  replaceChildren(container, ...children);
}

function buildHeader(pendingCount) {
  return el(
    'div',
    { class: 'screen-head' },
    el(
      'div',
      {},
      el('p', { class: 'eyebrow', text: pendingCount > 0 ? `${pendingCount} bekleyen görev` : 'Hepsi tamam' }),
      el('h1', { text: 'Görevler' }),
    ),
  );
}

function sortTasks(items) {
  return [...items].sort((a, b) => {
    const priorityDiff = (Number(a.priority) || 2) - (Number(b.priority) || 2);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function buildGroup(group, key) {
  const section = el('div', { class: 'section' });
  section.appendChild(
    el(
      'div',
      { class: 'section-head' },
      el('h2', { class: group.tone, text: group.title }),
      el('span', { class: 'tiny faint', text: String(group.items.length) }),
    ),
  );
  const list = el('ul', { class: 'list' });
  for (const task of sortTasks(group.items)) list.appendChild(taskItem(task, key));
  section.appendChild(list);
  return section;
}

function buildCompleted(completed, key) {
  const section = el('div', { class: 'section' });
  section.appendChild(
    el(
      'div',
      { class: 'section-head' },
      el('h2', { text: 'Tamamlanan' }),
      el('button', {
        class: 'btn-quiet',
        type: 'button',
        text: showCompleted ? 'Gizle' : `Göster (${completed.length})`,
        on: {
          click: () => {
            showCompleted = !showCompleted;
            rebuild();
          },
        },
      }),
    ),
  );
  if (showCompleted) {
    const list = el('ul', { class: 'list' });
    for (const task of completed.slice(0, 40)) list.appendChild(taskItem(task, key));
    section.appendChild(list);
  }
  return section;
}

function taskItem(task, key) {
  const check = el(
    'button',
    {
      class: 'item-check',
      type: 'button',
      'aria-label': task.done ? 'Geri al' : 'Tamamla',
      on: {
        click: (event) => {
          event.stopPropagation();
          toggleTask(task);
        },
      },
    },
    icon('check', 15),
  );

  const sub = el('div', { class: 'item-sub' });
  if (task.subjectId) {
    const dot = el('span', { class: 'dot' });
    dot.style.background = store.subjectColor(task.subjectId);
    sub.appendChild(el('span', { class: 'row', style: { gap: '5px' } }, dot, el('span', { text: store.subjectName(task.subjectId) })));
  }
  if (task.dueDate) {
    const overdue = !task.done && task.dueDate < key;
    sub.appendChild(
      el('span', {
        class: overdue ? 'bad-text' : '',
        text: relativeDayLabel(task.dueDate, key),
        title: formatDayShort(task.dueDate),
      }),
    );
  }
  sub.appendChild(el('span', { class: `prio-${Number(task.priority) || 2}`, text: priorityLabel(task.priority) }));

  const item = el(
    'div',
    { class: `item${task.done ? ' is-done' : ''}` },
    check,
    el('div', { class: 'item-main' }, el('span', { class: 'item-title', text: task.title }), sub),
  );

  longPress(item, () => {
    openMenu(task.title, [
      { label: task.done ? 'Tamamlanmadı yap' : 'Tamamla', iconName: 'check', onSelect: () => toggleTask(task) },
      { label: 'Düzenle', iconName: 'edit', onSelect: () => openTaskSheet({ task }) },
      { label: 'Sil', iconName: 'trash', danger: true, onSelect: () => deleteWithUndo('tasks', task.id, 'Görev') },
    ]);
  });

  return swipeItem(item, {
    right: {
      label: task.done ? 'Geri al' : 'Tamamla',
      keepItem: true,
      onAction: () => toggleTask(task),
    },
    left: {
      label: 'Sil',
      onAction: () => deleteWithUndo('tasks', task.id, 'Görev'),
    },
  });
}

function toggleTask(task) {
  const next = !task.done;
  haptics.success();
  store.update('tasks', task.id, { done: next, completedAt: next ? Date.now() : null });
  if (next) {
    snack.toast('Tamamlandı', {
      duration: 3500,
      actionLabel: 'Geri al',
      onAction: () => store.update('tasks', task.id, { done: false, completedAt: null }),
    });
  }
}

function buildDock() {
  return el(
    'div',
    { class: 'timer-dock' },
    el(
      'button',
      {
        class: 'start-btn',
        type: 'button',
        on: { click: () => openTaskSheet({}) },
      },
      icon('plus', 22),
      el('span', { text: 'Yeni görev' }),
    ),
  );
}
