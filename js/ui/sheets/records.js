// Calisma suresi, soru kaydi ve deneme sinavi alt sayfalari.

import { el, icon, replaceChildren } from '../dom.js';
import { openSheet } from '../sheet.js';
import { stepper, quickPicks, answerTriplet } from '../stepper.js';
import { openSubjectPicker } from './subjects.js';
import * as store from '../../store.js';
import * as snack from '../snack.js';
import * as haptics from '../../platform/haptics.js';
import { todayKey } from '../../core/dates.js';
import { net, roundNet, validateAnswers, examTotals } from '../../core/scoring.js';
import { formatMinutes, formatNet } from '../../core/format.js';
import { trimOrUndefined } from '../../util.js';
import { checkDailyGoal } from '../../goal.js';

const MINUTE_PICKS = [15, 25, 30, 45, 60, 90, 120];

/** Ders secme dugmesi (alt sayfalarda ortak kullanilir). */
function subjectField({ subjectId, onChange, examType = null }) {
  const dot = el('span', { class: 'dot' });
  const nameText = el('span', { class: 'grow', text: '' });
  const button = el('button', { class: 'btn btn-block', type: 'button' }, dot, nameText, icon('chevronRight', 18));

  const render = (id) => {
    const subject = store.subject(id);
    dot.style.background = subject?.color || 'var(--text-faint)';
    nameText.textContent = subject?.name || 'Ders seç';
    nameText.style.textAlign = 'left';
  };

  button.addEventListener('click', () => {
    openSubjectPicker({
      selectedId: subjectId,
      onPick: (id) => {
        subjectId = id;
        render(id);
        onChange?.(id);
      },
      examType,
    });
  });

  render(subjectId);
  return {
    element: el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Ders' }), button),
    get: () => subjectId,
  };
}

function dateField(value) {
  const input = el('input', { class: 'input', type: 'date', value });
  return {
    element: el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Tarih' }), input),
    get: () => input.value || value,
  };
}

// ---------------------------------------------------------------- calisma suresi

/**
 * Manuel sure girisi / oturum duzenleme.
 * options: { session, defaultSubjectId, onSaved }
 */
export function openSessionSheet({ session = null, defaultSubjectId = null, onSaved } = {}) {
  const isNew = !session;
  const subject = subjectField({ subjectId: session?.subjectId || defaultSubjectId || store.subjects()[0]?.id || null });
  const date = dateField(session?.date || todayKey());

  const minutesControl = stepper({
    value: session?.minutes ?? 30,
    min: 1,
    max: 900,
    step: 5,
    unit: 'dakika',
    onChange: (value) => picks.setActive(value),
  });

  const picks = quickPicks({
    values: MINUTE_PICKS,
    unit: 'dk',
    active: session?.minutes ?? 30,
    onPick: (value) => minutesControl.set(value),
  });

  const topicInput = el('input', {
    class: 'input',
    type: 'text',
    value: session?.topic || '',
    placeholder: 'Örnek: Paragraf, Türev',
    maxlength: '60',
  });

  const noteInput = el('textarea', {
    class: 'input',
    placeholder: 'İstersen kısa bir not',
    maxlength: '400',
    text: session?.note || '',
  });

  const errorText = el('p', { class: 'field-error', hidden: true });

  const save = async () => {
    const subjectId = subject.get();
    if (!subjectId) {
      errorText.textContent = 'Ders seçmelisin.';
      errorText.hidden = false;
      haptics.warn();
      return;
    }
    const payload = {
      date: date.get(),
      subjectId,
      minutes: minutesControl.get(),
      topic: trimOrUndefined(topicInput.value),
      note: trimOrUndefined(noteInput.value),
    };

    if (isNew) {
      store.add('sessions', { ...payload, source: 'manual' });
      snack.success(`${formatMinutes(payload.minutes)} eklendi`);
    } else {
      store.update('sessions', session.id, payload);
      snack.toast('Kayıt güncellendi');
    }
    haptics.success();
    sheet.close();
    onSaved?.();
    await checkDailyGoal();
  };

  const sheet = openSheet({
    title: isNew ? 'Süre ekle' : 'Süreyi düzenle',
    subtitle: isNew ? 'Kronometreyi çalıştırmadığın zamanlar için.' : null,
    body: [
      subject.element,
      el(
        'div',
        { class: 'field' },
        el('span', { class: 'field-label', text: 'Süre' }),
        minutesControl.element,
        picks.element,
      ),
      date.element,
      el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Konu (isteğe bağlı)' }), topicInput),
      el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Not (isteğe bağlı)' }), noteInput),
      errorText,
    ],
    actions: [
      el('button', { class: 'btn btn-ghost', type: 'button', text: 'Vazgeç', on: { click: () => sheet.close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Kaydet', on: { click: save } }),
    ],
  });

  return sheet;
}

// ---------------------------------------------------------------- soru kaydi

/**
 * Soru cozum kaydi.
 * options: { log, defaultSubjectId, onSaved }
 */
export function openQuestionSheet({ log = null, defaultSubjectId = null, onSaved } = {}) {
  const isNew = !log;
  let subjectId = log?.subjectId || defaultSubjectId || store.subjects()[0]?.id || null;

  const subject = subjectField({
    subjectId,
    onChange: (id) => {
      subjectId = id;
      updateSummary();
    },
  });
  const date = dateField(log?.date || todayKey());

  const topicInput = el('input', {
    class: 'input',
    type: 'text',
    value: log?.topic || '',
    placeholder: 'Örnek: Paragraf, Limit',
    maxlength: '60',
  });

  const summary = el('div', { class: 'row-between' });
  const errorText = el('p', { class: 'field-error', hidden: true });

  const answers = answerTriplet({
    correct: log?.correct ?? 0,
    wrong: log?.wrong ?? 0,
    blank: log?.blank ?? 0,
    max: 200,
    onChange: () => updateSummary(),
  });

  function updateSummary() {
    const values = answers.get();
    const total = values.correct + values.wrong + values.blank;
    const netValue = roundNet(net(values.correct, values.wrong, store.penalty()));
    const limit = store.subject(subjectId)?.questionCount;
    replaceChildren(
      summary,
      el('span', { class: 'muted small', text: `Toplam ${total} soru${limit ? ` / ${limit}` : ''}` }),
      el('strong', { class: 'accent-text', text: `${formatNet(netValue)} net` }),
    );
    errorText.hidden = true;
  }

  const save = () => {
    if (!subjectId) {
      errorText.textContent = 'Ders seçmelisin.';
      errorText.hidden = false;
      haptics.warn();
      return;
    }
    const values = answers.get();
    const problem = validateAnswers(values, store.subject(subjectId)?.questionCount);
    if (problem) {
      errorText.textContent = problem;
      errorText.hidden = false;
      haptics.warn();
      return;
    }
    const payload = {
      date: date.get(),
      subjectId,
      topic: trimOrUndefined(topicInput.value),
      correct: values.correct,
      wrong: values.wrong,
      blank: values.blank,
    };
    if (isNew) {
      store.add('questions', payload);
      snack.success(`${formatNet(roundNet(net(values.correct, values.wrong, store.penalty())))} net kaydedildi`);
    } else {
      store.update('questions', log.id, payload);
      snack.toast('Soru kaydı güncellendi');
    }
    haptics.success();
    sheet.close();
    onSaved?.();
  };

  updateSummary();

  const sheet = openSheet({
    title: isNew ? 'Soru kaydı' : 'Soru kaydını düzenle',
    body: [
      subject.element,
      el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Sonuç' }), answers.element, summary),
      date.element,
      el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Konu (isteğe bağlı)' }), topicInput),
      errorText,
    ],
    actions: [
      el('button', { class: 'btn btn-ghost', type: 'button', text: 'Vazgeç', on: { click: () => sheet.close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Kaydet', on: { click: save } }),
    ],
  });

  return sheet;
}

// ---------------------------------------------------------------- deneme sinavi

/**
 * Deneme sinavi kaydi. Sinav turune gore ilgili derslerin satirlari cikar.
 * options: { exam, onSaved }
 */
export function openExamSheet({ exam = null, onSaved } = {}) {
  const isNew = !exam;
  let examType = exam?.examType || 'TYT';

  const nameInput = el('input', {
    class: 'input',
    type: 'text',
    value: exam?.name || '',
    placeholder: 'Örnek: 3D TYT Deneme 4',
    maxlength: '60',
  });
  const date = dateField(exam?.date || todayKey());
  const noteInput = el('textarea', {
    class: 'input',
    placeholder: 'Nasıl gitti, nerede zorlandın?',
    maxlength: '500',
    text: exam?.note || '',
  });

  const rowsWrap = el('div', { class: 'list' });
  const totalsRow = el('div', { class: 'card card-flat' });
  const errorText = el('p', { class: 'field-error', hidden: true });

  /** subjectId -> { get, set } */
  let controls = new Map();

  const typeButtons = new Map();
  const typeRow = el('div', { class: 'seg' });
  for (const type of ['TYT', 'YDT']) {
    const button = el('button', {
      class: examType === type ? 'is-active' : '',
      type: 'button',
      text: `${type} denemesi`,
      on: {
        click: () => {
          if (examType === type) return;
          examType = type;
          for (const [key, node] of typeButtons) node.classList.toggle('is-active', key === type);
          buildRows();
        },
      },
    });
    typeButtons.set(type, button);
    typeRow.appendChild(button);
  }

  function currentResults() {
    const results = [];
    for (const [subjectId, control] of controls) {
      const values = control.get();
      const total = values.correct + values.wrong + values.blank;
      if (total === 0) continue;
      results.push({ subjectId, ...values });
    }
    return results;
  }

  function updateTotals() {
    const results = currentResults();
    const totals = examTotals(results, store.penalty());
    const targetSum = results.reduce((sum, row) => sum + store.target(row.subjectId), 0);
    const diff = roundNet(totals.net - targetSum);
    replaceChildren(
      totalsRow,
      el(
        'div',
        { class: 'row-between' },
        el('span', { class: 'card-title', text: 'Toplam net' }),
        el('strong', { style: { fontSize: '1.2rem' }, text: formatNet(totals.net) }),
      ),
      el(
        'div',
        { class: 'row-between' },
        el('span', { class: 'small muted', text: `Hedef ${formatNet(targetSum)}` }),
        el('span', {
          class: `small ${diff >= 0 ? 'ok-text' : 'bad-text'}`,
          text: `${diff >= 0 ? '+' : ''}${formatNet(diff)} net`,
        }),
      ),
    );
    errorText.hidden = true;
  }

  function buildRows() {
    controls = new Map();
    const subjects = store.subjects().filter((subject) => subject.examType === examType);
    replaceChildren(rowsWrap);
    if (subjects.length === 0) {
      rowsWrap.appendChild(
        el('div', { class: 'empty' }, el('strong', { text: `${examType} dersi yok` }), el('span', { text: 'Ayarlardan ders ekleyebilirsin.' })),
      );
      updateTotals();
      return;
    }
    for (const subject of subjects) {
      const existing = (exam?.results || []).find((row) => row.subjectId === subject.id);
      const netText = el('strong', { class: 'accent-text small' });
      const control = answerTriplet({
        correct: existing?.correct ?? 0,
        wrong: existing?.wrong ?? 0,
        blank: existing?.blank ?? 0,
        max: subject.questionCount || 200,
        onChange: (values) => {
          netText.textContent = `${formatNet(roundNet(net(values.correct, values.wrong, store.penalty())))} net`;
          updateTotals();
        },
      });
      controls.set(subject.id, control);
      const dot = el('span', { class: 'dot' });
      dot.style.background = subject.color;
      netText.textContent = `${formatNet(roundNet(net(existing?.correct || 0, existing?.wrong || 0, store.penalty())))} net`;

      rowsWrap.appendChild(
        el(
          'div',
          { class: 'card card-flat' },
          el(
            'div',
            { class: 'row-between', style: { marginBottom: '8px' } },
            el('span', { class: 'row' }, dot, el('span', { class: 'strong small', text: subject.name })),
            netText,
          ),
          control.element,
          el('p', { class: 'tiny faint', text: `${subject.questionCount || '?'} soru · hedef ${formatNet(store.target(subject.id))} net` }),
        ),
      );
    }
    updateTotals();
  }

  const save = () => {
    const results = currentResults();
    if (results.length === 0) {
      errorText.textContent = 'En az bir ders için sonuç girmelisin.';
      errorText.hidden = false;
      haptics.warn();
      return;
    }
    for (const row of results) {
      const subject = store.subject(row.subjectId);
      const problem = validateAnswers(row, subject?.questionCount);
      if (problem) {
        errorText.textContent = `${subject?.name || 'Ders'}: ${problem}`;
        errorText.hidden = false;
        haptics.warn();
        return;
      }
    }

    const payload = {
      date: date.get(),
      name: trimOrUndefined(nameInput.value) || `${examType} denemesi`,
      examType,
      results,
      note: trimOrUndefined(noteInput.value),
    };

    if (isNew) {
      store.add('exams', payload);
      snack.success(`Deneme kaydedildi · ${formatNet(examTotals(results, store.penalty()).net)} net`);
    } else {
      store.update('exams', exam.id, payload);
      snack.toast('Deneme güncellendi');
    }
    haptics.success();
    sheet.close();
    onSaved?.();
  };

  buildRows();

  const sheet = openSheet({
    title: isNew ? 'Deneme ekle' : 'Denemeyi düzenle',
    body: [
      el('div', { class: 'field' }, el('span', { class: 'field-label', text: 'Sınav türü' }), typeRow),
      el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Deneme adı' }), nameInput),
      date.element,
      rowsWrap,
      totalsRow,
      el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Not (isteğe bağlı)' }), noteInput),
      errorText,
    ],
    actions: [
      el('button', { class: 'btn btn-ghost', type: 'button', text: 'Vazgeç', on: { click: () => sheet.close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Kaydet', on: { click: save } }),
    ],
  });

  return sheet;
}
