// Ders secme ve ders duzenleme alt sayfalari.

import { el, icon } from '../dom.js';
import { openSheet } from '../sheet.js';
import { stepper } from '../stepper.js';
import * as store from '../../store.js';
import * as snack from '../snack.js';
import * as haptics from '../../platform/haptics.js';
import { SUBJECT_COLORS } from '../../seed.js';
import { trimOrUndefined } from '../../util.js';

/**
 * Ders secici. onPick(subjectId) cagrilir ve sayfa kapanir.
 * allowNone true ise "Ders yok" secenegi eklenir ve onPick(null) cagrilir.
 */
export function openSubjectPicker({
  title = 'Ders seç',
  selectedId = null,
  onPick,
  allowNone = false,
  noneLabel = 'Ders yok',
} = {}) {
  const list = el('div', { class: 'list' });
  const sheet = openSheet({ title, body: list });

  if (allowNone) {
    list.appendChild(
      el(
        'button',
        {
          class: 'menu-item',
          type: 'button',
          on: {
            click: () => {
              haptics.success();
              sheet.close();
              onPick?.(null);
            },
          },
        },
        el('span', { class: 'grow', text: noneLabel }),
        selectedId ? null : icon('check', 18),
      ),
    );
  }

  const subjects = store.subjects();
  if (subjects.length === 0) {
    list.appendChild(
      el('div', { class: 'empty' }, el('strong', { text: 'Ders yok' }), el('span', { text: 'Ayarlar ekranından ders ekleyebilirsin.' })),
    );
  }

  for (const subject of subjects) {
    const dot = el('span', { class: 'dot' });
    dot.style.background = subject.color;
    list.appendChild(
      el(
        'button',
        {
          class: `menu-item${subject.id === selectedId ? ' is-selected' : ''}`,
          type: 'button',
          on: {
            click: () => {
              haptics.success();
              sheet.close();
              onPick?.(subject.id);
            },
          },
        },
        dot,
        el(
          'span',
          { class: 'grow' },
          el('span', { text: subject.name }),
        ),
        el('span', { class: 'pill', text: subject.examType }),
        subject.id === selectedId ? icon('check', 18) : null,
      ),
    );
  }

  list.appendChild(
    el(
      'button',
      {
        class: 'menu-item',
        type: 'button',
        on: {
          click: () => {
            sheet.close();
            requestAnimationFrame(() => openSubjectEditor({ onSaved: (created) => onPick?.(created.id) }));
          },
        },
      },
      icon('plus', 19),
      el('span', { text: 'Yeni ders ekle' }),
    ),
  );

  return sheet;
}

/**
 * Ders ekleme / duzenleme.
 * subject verilmezse yeni ders olusturulur.
 */
export function openSubjectEditor({ subject = null, onSaved, onDeleted } = {}) {
  const isNew = !subject;
  const usedColors = new Set(store.subjects().map((s) => s.color));
  const defaultColor = SUBJECT_COLORS.find((color) => !usedColors.has(color)) || SUBJECT_COLORS[0];

  const draft = {
    name: subject?.name || '',
    color: subject?.color || defaultColor,
    examType: subject?.examType || 'TYT',
    questionCount: subject?.questionCount ?? 40,
    target: subject ? store.target(subject.id) : 0,
  };

  const nameInput = el('input', {
    class: 'input',
    type: 'text',
    value: draft.name,
    placeholder: 'Örnek: Matematik',
    maxlength: '40',
    enterkeyhint: 'done',
  });

  const errorText = el('p', { class: 'field-error', hidden: true });

  // Sinav turu
  const typeButtons = new Map();
  const typeRow = el('div', { class: 'seg' });
  for (const type of ['TYT', 'YDT']) {
    const button = el('button', {
      class: `${draft.examType === type ? 'is-active' : ''}`,
      type: 'button',
      text: type,
      on: {
        click: () => {
          draft.examType = type;
          for (const [key, node] of typeButtons) node.classList.toggle('is-active', key === type);
        },
      },
    });
    typeButtons.set(type, button);
    typeRow.appendChild(button);
  }

  // Renk secimi
  const colorRow = el('div', { class: 'chip-wrap' });
  const colorButtons = new Map();
  for (const color of SUBJECT_COLORS) {
    const swatch = el('button', {
      class: `color-swatch${color === draft.color ? ' is-active' : ''}`,
      type: 'button',
      'aria-label': `Renk ${color}`,
      on: {
        click: () => {
          draft.color = color;
          for (const [key, node] of colorButtons) node.classList.toggle('is-active', key === color);
        },
      },
    });
    swatch.style.background = color;
    colorButtons.set(color, swatch);
    colorRow.appendChild(swatch);
  }

  const countControl = stepper({
    value: draft.questionCount,
    min: 1,
    max: 200,
    step: 1,
    unit: 'soru',
    onChange: (value) => {
      draft.questionCount = value;
    },
  });

  const targetControl = stepper({
    value: Math.round(draft.target),
    min: 0,
    max: 200,
    step: 1,
    unit: 'net',
    onChange: (value) => {
      draft.target = value;
    },
  });

  const save = () => {
    const name = trimOrUndefined(nameInput.value);
    if (!name) {
      errorText.textContent = 'Ders adı boş olamaz.';
      errorText.hidden = false;
      haptics.warn();
      return;
    }
    if (draft.target > draft.questionCount) {
      errorText.textContent = 'Hedef net, soru sayısından büyük olamaz.';
      errorText.hidden = false;
      haptics.warn();
      return;
    }

    if (isNew) {
      const order = store.subjects().length;
      const created = store.add('subjects', {
        name,
        color: draft.color,
        examType: draft.examType,
        questionCount: draft.questionCount,
        order,
      });
      store.setTarget(created.id, draft.target);
      sheet.close();
      snack.success(`${name} eklendi`);
      onSaved?.(created);
      return;
    }

    store.update('subjects', subject.id, {
      name,
      color: draft.color,
      examType: draft.examType,
      questionCount: draft.questionCount,
    });
    store.setTarget(subject.id, draft.target);
    sheet.close();
    snack.toast('Ders güncellendi');
    onSaved?.(store.subject(subject.id));
  };

  const body = [
    el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Ders adı' }), nameInput, errorText),
    el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Sınav türü' }), typeRow),
    el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Renk' }), colorRow),
    el(
      'div',
      { class: 'grid-2' },
      el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Soru sayısı' }), countControl.element),
      el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Hedef net' }), targetControl.element),
    ),
  ];

  if (!isNew) {
    body.push(
      el(
        'button',
        {
          class: 'btn btn-danger btn-block',
          type: 'button',
          on: {
            click: () => {
              sheet.close();
              store.deleteSubject(subject.id);
              haptics.remove();
              snack.undoBar(`${subject.name} silindi`, {
                onUndo: () => store.restore('subjects', subject.id),
                onExpire: () => store.purge('subjects', subject.id),
              });
              onDeleted?.();
            },
          },
        },
        icon('trash', 18),
        el('span', { text: 'Dersi sil' }),
      ),
    );
    body.push(
      el('p', {
        class: 'note',
        text: 'Ders silinse bile eski çalışma ve soru kayıtların durur, istatistikte "Silinmiş ders" olarak görünür.',
      }),
    );
  }

  const sheet = openSheet({
    title: isNew ? 'Yeni ders' : 'Dersi düzenle',
    body,
    actions: [
      el('button', { class: 'btn btn-ghost', type: 'button', text: 'Vazgeç', on: { click: () => sheet.close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Kaydet', on: { click: save } }),
    ],
  });

  return sheet;
}
