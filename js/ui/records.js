// Kayit listesi ogeleri (calisma suresi, soru kaydi, deneme) ve silme + geri alma.
// Bugun ve Istatistik ekranlarinda ortak kullanilir.

import { el } from './dom.js';
import { swipeItem, longPress } from './gestures.js';
import { openMenu } from './sheet.js';
import * as snack from './snack.js';
import * as store from '../store.js';
import * as haptics from '../platform/haptics.js';
import { formatMinutes, formatNet } from '../core/format.js';
import { formatTime } from '../core/dates.js';
import { net, roundNet, examTotals } from '../core/scoring.js';
import { openSessionSheet, openQuestionSheet, openExamSheet } from './sheets/records.js';

const LABELS = {
  sessions: 'Çalışma kaydı',
  questions: 'Soru kaydı',
  exams: 'Deneme',
  tasks: 'Görev',
  subjects: 'Ders',
};

/**
 * Kaydi siler ve 5 saniyelik geri alma seridi gosterir.
 * "Emin misiniz?" sorulmaz; silme hemen olur, geri alinabilir.
 */
export function deleteWithUndo(collection, id, label) {
  const record = store.find(collection, id);
  if (!record) return;
  store.softDelete(collection, id);
  haptics.remove();
  snack.undoBar(`${label || LABELS[collection] || 'Kayıt'} silindi`, {
    onUndo: () => store.restore(collection, id),
    onExpire: () => store.purge(collection, id),
  });
}

function subjectDot(subjectId) {
  const dot = el('span', { class: 'dot' });
  dot.style.background = store.subjectColor(subjectId);
  return dot;
}

function attachActions(item, { onEdit, onDelete, title }) {
  longPress(item, () => {
    openMenu(title, [
      onEdit ? { label: 'Düzenle', iconName: 'edit', onSelect: onEdit } : null,
      onDelete ? { label: 'Sil', iconName: 'trash', danger: true, onSelect: onDelete } : null,
    ]);
  });
  return swipeItem(item, {
    left: { label: 'Sil', onAction: onDelete },
  });
}

/** Calisma oturumu ogesi. */
export function sessionItem(session, { onChanged } = {}) {
  const subject = store.subject(session.subjectId);
  const sub = el('div', { class: 'item-sub' });
  sub.appendChild(
    el('span', { text: session.source === 'timer' ? 'Kronometre' : 'Elle girildi' }),
  );
  if (session.topic) sub.appendChild(el('span', { text: `· ${session.topic}` }));
  if (session.createdAt) sub.appendChild(el('span', { text: `· ${formatTime(session.createdAt)}` }));

  const item = el(
    'div',
    { class: 'item' },
    subjectDot(session.subjectId),
    el(
      'div',
      { class: 'item-main' },
      el('span', { class: 'item-title', text: subject?.name || 'Silinmiş ders' }),
      sub,
    ),
    el('div', { class: 'item-right' }, el('strong', { text: formatMinutes(session.minutes) })),
  );

  return attachActions(item, {
    title: 'Çalışma kaydı',
    onEdit: () => openSessionSheet({ session, onSaved: onChanged }),
    onDelete: () => {
      deleteWithUndo('sessions', session.id, 'Çalışma kaydı');
      onChanged?.();
    },
  });
}

/** Soru cozum kaydi ogesi. */
export function questionItem(log, { onChanged } = {}) {
  const subject = store.subject(log.subjectId);
  const netValue = roundNet(net(log.correct, log.wrong, store.penalty()));

  const sub = el(
    'div',
    { class: 'item-sub' },
    el('span', { class: 'ok-text', text: `${log.correct} D` }),
    el('span', { class: 'bad-text', text: `${log.wrong} Y` }),
    el('span', { text: `${log.blank} B` }),
    log.topic ? el('span', { text: `· ${log.topic}` }) : null,
  );

  const item = el(
    'div',
    { class: 'item' },
    subjectDot(log.subjectId),
    el(
      'div',
      { class: 'item-main' },
      el('span', { class: 'item-title', text: subject?.name || 'Silinmiş ders' }),
      sub,
    ),
    el('div', { class: 'item-right' }, el('strong', { text: `${formatNet(netValue)} net` })),
  );

  return attachActions(item, {
    title: 'Soru kaydı',
    onEdit: () => openQuestionSheet({ log, onSaved: onChanged }),
    onDelete: () => {
      deleteWithUndo('questions', log.id, 'Soru kaydı');
      onChanged?.();
    },
  });
}

/** Deneme sinavi ogesi. */
export function examItem(exam, { onChanged } = {}) {
  const totals = examTotals(exam.results, store.penalty());
  const targetSum = (exam.results || []).reduce((sum, row) => sum + store.target(row.subjectId), 0);
  const diff = roundNet(totals.net - targetSum);

  const item = el(
    'div',
    { class: 'item' },
    el('span', { class: 'pill', text: exam.examType }),
    el(
      'div',
      { class: 'item-main' },
      el('span', { class: 'item-title', text: exam.name }),
      el(
        'div',
        { class: 'item-sub' },
        el('span', { text: `${totals.correct} D · ${totals.wrong} Y · ${totals.blank} B` }),
        targetSum > 0
          ? el('span', {
              class: diff >= 0 ? 'ok-text' : 'bad-text',
              text: `· hedefe ${diff >= 0 ? '+' : ''}${formatNet(diff)}`,
            })
          : null,
      ),
    ),
    el('div', { class: 'item-right' }, el('strong', { text: `${formatNet(totals.net)} net` })),
  );

  return attachActions(item, {
    title: exam.name,
    onEdit: () => openExamSheet({ exam, onSaved: onChanged }),
    onDelete: () => {
      deleteWithUndo('exams', exam.id, 'Deneme');
      onChanged?.();
    },
  });
}
