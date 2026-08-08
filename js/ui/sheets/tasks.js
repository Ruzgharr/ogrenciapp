// Gorev ekleme / duzenleme alt sayfasi.

import { el, icon } from '../dom.js';
import { openSheet } from '../sheet.js';
import { openSubjectPicker } from './subjects.js';
import * as store from '../../store.js';
import * as snack from '../snack.js';
import * as haptics from '../../platform/haptics.js';
import { todayKey, addDays, formatDayShort } from '../../core/dates.js';
import { trimOrUndefined } from '../../util.js';

const PRIORITIES = [
  { value: 1, label: 'Yüksek' },
  { value: 2, label: 'Orta' },
  { value: 3, label: 'Düşük' },
];

/**
 * options: { task, onSaved }
 */
export function openTaskSheet({ task = null, onSaved } = {}) {
  const isNew = !task;
  let subjectId = task?.subjectId || null;
  let dueDate = task?.dueDate || null;
  let priority = Number(task?.priority) || 2;

  const titleInput = el('input', {
    class: 'input',
    type: 'text',
    value: task?.title || '',
    placeholder: 'Örnek: Türev testi 20 soru',
    maxlength: '120',
    enterkeyhint: 'done',
  });

  // Ders (istege bagli)
  const subjectDot = el('span', { class: 'dot' });
  const subjectText = el('span', { class: 'grow', style: { textAlign: 'left' } });
  const subjectButton = el(
    'button',
    {
      class: 'btn btn-block',
      type: 'button',
      on: {
        click: () =>
          openSubjectPicker({
            selectedId: subjectId,
            allowNone: true,
            onPick: (id) => {
              subjectId = id;
              renderSubject();
            },
          }),
      },
    },
    subjectDot,
    subjectText,
    icon('chevronRight', 18),
  );

  function renderSubject() {
    const subject = subjectId ? store.subject(subjectId) : null;
    subjectDot.style.background = subject?.color || 'transparent';
    subjectDot.style.border = subject ? 'none' : '1px dashed var(--border)';
    subjectText.textContent = subject?.name || 'Ders yok';
  }
  renderSubject();

  // Son tarih
  const dateInput = el('input', { class: 'input', type: 'date', value: dueDate || '' });
  dateInput.addEventListener('change', () => {
    dueDate = dateInput.value || null;
    renderDateChips();
  });

  const chipRow = el('div', { class: 'chip-row' });

  function renderDateChips() {
    const today = todayKey();
    const options = [
      { label: 'Yok', value: null },
      { label: 'Bugün', value: today },
      { label: 'Yarın', value: addDays(today, 1) },
      { label: formatDayShort(addDays(today, 7)), value: addDays(today, 7) },
    ];
    chipRow.replaceChildren();
    for (const option of options) {
      chipRow.appendChild(
        el('button', {
          class: `chip${dueDate === option.value ? ' is-active' : ''}`,
          type: 'button',
          text: option.label,
          on: {
            click: () => {
              dueDate = option.value;
              dateInput.value = option.value || '';
              renderDateChips();
            },
          },
        }),
      );
    }
  }
  renderDateChips();

  // Onem
  const priorityRow = el('div', { class: 'seg' });
  const priorityButtons = new Map();
  for (const option of PRIORITIES) {
    const button = el('button', {
      class: priority === option.value ? 'is-active' : '',
      type: 'button',
      text: option.label,
      on: {
        click: () => {
          priority = option.value;
          for (const [key, node] of priorityButtons) node.classList.toggle('is-active', key === option.value);
        },
      },
    });
    priorityButtons.set(option.value, button);
    priorityRow.appendChild(button);
  }

  const errorText = el('p', { class: 'field-error', hidden: true });

  const save = () => {
    const title = trimOrUndefined(titleInput.value);
    if (!title) {
      errorText.textContent = 'Görev başlığı boş olamaz.';
      errorText.hidden = false;
      haptics.warn();
      return;
    }
    const payload = {
      title,
      subjectId: subjectId || undefined,
      dueDate: dueDate || undefined,
      priority,
    };
    if (isNew) {
      store.add('tasks', { ...payload, done: false });
      snack.success('Görev eklendi');
    } else {
      store.update('tasks', task.id, payload);
      snack.toast('Görev güncellendi');
    }
    haptics.success();
    sheet.close();
    onSaved?.();
  };

  const sheet = openSheet({
    title: isNew ? 'Yeni görev' : 'Görevi düzenle',
    autofocus: isNew,
    body: [
      el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Görev' }), titleInput),
      el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Ders' }), subjectButton),
      el(
        'div',
        { class: 'field' },
        el('span', { class: 'field-label', text: 'Son tarih' }),
        chipRow,
        dateInput,
      ),
      el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Önem' }), priorityRow),
      errorText,
    ],
    actions: [
      el('button', { class: 'btn btn-ghost', type: 'button', text: 'Vazgeç', on: { click: () => sheet.close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Kaydet', on: { click: save } }),
    ],
  });

  titleInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    }
  });

  return sheet;
}
